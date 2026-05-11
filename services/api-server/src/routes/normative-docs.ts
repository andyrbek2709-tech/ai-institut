/**
 * Normative Docs API — knowledge base for ГОСТы / СНиПы / СП
 *
 * POST /api/normative-docs  { action: 'upload_init', name, file_type, file_path, overwrite_id? }
 * POST /api/normative-docs  { action: 'vectorize', doc_id }
 * GET  /api/normative-docs?ilike=query
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/environment.js';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';

const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return _openai;
}

// ── Chunk text into ~400 token pieces (~1600 chars) ──────────────────────
function chunkText(text: string, maxChars = 1600): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n{2,}/);
  let current = '';
  for (const p of paragraphs) {
    if ((current + p).length > maxChars && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current += (current ? '\n\n' : '') + p;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.filter(c => c.length > 50);
}

// ── Extract text from file in Supabase storage ──────────────────────────
async function extractText(filePath: string, fileType: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage.from('normative-docs').download(filePath);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);

  const buf = Buffer.from(await data.arrayBuffer());

  if (fileType.includes('pdf')) {
    const parsed = await pdfParse(buf);
    return parsed.text;
  }
  // For docx/txt — basic buffer-to-string (plain text extraction)
  return buf.toString('utf-8').replace(/[^\x20-\x7EЀ-ӿ\n\r\t]/g, ' ');
}

// ── Vectorise doc (background, fire-and-forget friendly) ────────────────
async function vectorizeDoc(docId: string): Promise<void> {
  const sb = getSupabaseAdmin();

  await sb.from('normative_docs').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', docId);

  const { data: doc } = await sb.from('normative_docs').select('*').eq('id', docId).single();
  if (!doc) throw new Error('Doc not found');

  const text = await extractText(doc.file_path, doc.file_type || '');
  const chunks = chunkText(text);

  // Delete old chunks if re-vectorizing
  await sb.from('normative_chunks').delete().eq('doc_id', docId);

  let stored = 0;
  const BATCH = 10;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const embedResp = await getOpenAI().embeddings.create({
      model: 'text-embedding-3-small',
      input: batch,
    });
    const rows = batch.map((content, j) => ({
      doc_id: docId,
      chunk_index: i + j,
      content,
      embedding: JSON.stringify(embedResp.data[j].embedding),
    }));
    await sb.from('normative_chunks').insert(rows);
    stored += batch.length;
  }

  await sb.from('normative_docs').update({
    status: 'ready',
    chunks_count: stored,
    updated_at: new Date().toISOString(),
  }).eq('id', docId);

  logger.info({ docId, chunks: stored }, 'normative doc vectorized');
}

// ── GET /api/normative-docs?ilike=query ──────────────────────────────────
router.get('/normative-docs', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabaseAdmin();
    const q = (req.query.ilike as string || '').trim();
    let query = sb.from('normative_docs').select('id,name,file_type,file_path,status,chunks_count,created_at').order('name');
    if (q) query = query.ilike('name', `%${q}%`);
    const { data, error } = await query;
    if (error) throw new ApiError(500, error.message);
    res.json(data || []);
  } catch (e) { next(e); }
});

// ── POST /api/normative-docs ──────────────────────────────────────────────
router.post('/normative-docs', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabaseAdmin();
    const { action, name, file_type, file_path, overwrite_id, doc_id } = req.body;

    if (action === 'upload_init') {
      if (!name || !file_path) throw new ApiError(400, 'name and file_path required');
      // Delete overwritten doc
      if (overwrite_id) {
        const { data: old } = await sb.from('normative_docs').select('file_path').eq('id', overwrite_id).single();
        if (old?.file_path) await sb.storage.from('normative-docs').remove([old.file_path]);
        await sb.from('normative_docs').delete().eq('id', overwrite_id);
      }
      const { data, error } = await sb.from('normative_docs').insert({
        name, file_type: file_type || null, file_path, status: 'pending',
      }).select().single();
      if (error) throw new ApiError(500, error.message);
      return res.json(data);
    }

    if (action === 'vectorize') {
      if (!doc_id) throw new ApiError(400, 'doc_id required');
      // Fire-and-forget — don't await, return immediately
      vectorizeDoc(doc_id).catch(async (e: any) => {
        logger.error({ err: e?.message, doc_id }, 'vectorize failed');
        await getSupabaseAdmin().from('normative_docs').update({
          status: 'error', error_text: e?.message || 'unknown', updated_at: new Date().toISOString(),
        }).eq('id', doc_id);
      });
      return res.json({ ok: true, doc_id });
    }

    throw new ApiError(400, `Unknown action: ${action}`);
  } catch (e) { next(e); }
});

export default router;
