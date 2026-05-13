/**
 * Normative Docs API — knowledge base for ГОСТы / СНиПы / СП
 *
 * POST /api/normative-docs  { action: 'upload_init', name, file_type, file_path, overwrite_id? }
 * POST /api/normative-docs  { action: 'vectorize', doc_id }
 * POST /api/normative-docs  { action: 'retry_pending' }  — re-queue all pending
 * GET  /api/normative-docs?ilike=query
 */

import { Router, Request, Response, NextFunction } from 'express';
import { execFile as _execFile } from 'child_process';
import { promisify } from 'util';
import { writeFile, readdir, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { authMiddleware } from '../middleware/auth.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/environment.js';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

const execFile = promisify(_execFile);

const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return _openai;
}

// ── Chunk text ────────────────────────────────────────────────────────────
function chunkText(text: string, maxChars = 1500): string[] {
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
  return chunks.filter(c => c.length > 30);
}

// ── OCR fallback: Tesseract via pdftoppm (scanned PDFs) ──────────────────
async function ocrPdfBuffer(buf: Buffer): Promise<string> {
  const tmpDir = join('/tmp', `ocr_${randomBytes(6).toString('hex')}`);
  await mkdir(tmpDir, { recursive: true });
  const pdfPath = join(tmpDir, 'in.pdf');
  const pageBase = join(tmpDir, 'pg');
  try {
    await writeFile(pdfPath, buf);
    // Convert all PDF pages to PNG at 300 DPI
    await execFile('pdftoppm', ['-r', '300', '-png', pdfPath, pageBase], { timeout: 120_000 });
    const pages = (await readdir(tmpDir))
      .filter(f => f.startsWith('pg') && f.endsWith('.png'))
      .sort();
    const parts: string[] = [];
    for (const pg of pages) {
      try {
        const { stdout } = await execFile(
          'tesseract',
          [join(tmpDir, pg), 'stdout', '-l', 'rus+eng', '--psm', '1'],
          { timeout: 60_000, maxBuffer: 10 * 1024 * 1024 },
        );
        if (stdout.trim()) parts.push(stdout.trim());
      } catch (pageErr: any) {
        logger.warn({ err: pageErr?.message, pg }, 'OCR page failed, skipping');
      }
    }
    return parts.join('\n\n');
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Extract text from storage ─────────────────────────────────────────────
async function extractText(filePath: string, fileType: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage.from('normative-docs').download(filePath);
  if (error || !data) throw new Error(`Storage download failed: ${error?.message}`);
  const buf = Buffer.from(await data.arrayBuffer());

  const lowerType = (fileType || '').toLowerCase();
  const lowerPath = filePath.toLowerCase();

  if (lowerType.includes('pdf') || lowerPath.endsWith('.pdf')) {
    // Try text-layer extraction first (fast)
    try {
      const parsed = await pdfParse(buf);
      const text = (parsed.text || '').trim();
      if (text.length >= 50) return text;
    } catch (e: any) {
      logger.warn({ err: e?.message }, 'pdf-parse failed, falling back to OCR');
    }
    // Scanned PDF — fall back to Tesseract OCR
    logger.info({ filePath }, 'PDF appears to be a scan, starting Tesseract OCR');
    return ocrPdfBuffer(buf);
  }

  if (lowerType.includes('wordprocessingml') || lowerPath.endsWith('.docx')) {
    const result = await mammoth.extractRawText({ buffer: buf });
    return result.value || '';
  }

  if (lowerPath.endsWith('.doc')) {
    // Basic .doc: strip binary, keep printable Russian/Latin text
    return buf.toString('latin1').replace(/[^\x20-\x7EЀ-ӿ\n\r\t]/g, ' ').replace(/ {3,}/g, ' ');
  }

  // Plain text fallback
  return buf.toString('utf-8');
}

// ── Vectorise one doc ─────────────────────────────────────────────────────
async function vectorizeDoc(docId: string): Promise<void> {
  const sb = getSupabaseAdmin();
  await sb.from('normative_docs').update({ status: 'processing', updated_at: new Date().toISOString() }).eq('id', docId);

  const { data: doc, error: docErr } = await sb.from('normative_docs').select('*').eq('id', docId).single();
  if (docErr || !doc) throw new Error('Doc not found');

  const text = await extractText(doc.file_path, doc.file_type || '');
  if (!text || text.trim().length < 20) throw new Error('Не удалось извлечь текст из документа');

  const chunks = chunkText(text);
  if (!chunks.length) throw new Error('Текст разбит на 0 чанков');

  // Delete old chunks
  await sb.from('normative_chunks').delete().eq('doc_id', docId);

  let stored = 0;
  const BATCH = 8;
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

  // Store full text in content column for keyword search
  const contentSnippet = text.slice(0, 8000);
  await sb.from('normative_docs').update({
    status: 'ready',
    chunks_count: stored,
    content: contentSnippet,
    updated_at: new Date().toISOString(),
  }).eq('id', docId);

  logger.info({ docId, chunks: stored }, 'normative doc vectorized');
}

async function runVectorize(docId: string, sb: any) {
  vectorizeDoc(docId).catch(async (e: any) => {
    logger.error({ err: e?.message, docId }, 'vectorize failed');
    await sb.from('normative_docs').update({
      status: 'error',
      error_text: e?.message || 'unknown',
      updated_at: new Date().toISOString(),
    }).eq('id', docId);
  });
}

// ── GET /api/normative-docs?ilike=query ──────────────────────────────────
// When ilike provided: search normative_chunks.content (App.tsx expects {doc_id, doc_name, content})
// When no ilike: return normative_docs list
router.get('/normative-docs', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabaseAdmin();
    const q = (req.query.ilike as string || '').trim();

    if (q) {
      // Full-text chunk search — App.tsx searchNormativeIlike expects doc_id field
      const { data, error } = await sb
        .from('normative_chunks')
        .select('id,doc_id,doc_name,content')
        .ilike('content', `%${q}%`)
        .limit(100);
      if (error) throw new ApiError(500, error.message);
      res.json(data || []);
      return;
    }

    // No query — return document list
    const { data, error } = await sb
      .from('normative_docs')
      .select('id,name,file_type,file_path,status,chunks_count,error_text,created_at')
      .order('name');
    if (error) throw new ApiError(500, error.message);
    res.json(data || []);
  } catch (e) { next(e); }
});

// ── POST /api/normative-docs ──────────────────────────────────────────────
router.post('/normative-docs', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sb = getSupabaseAdmin();
    const { action, name, file_type, file_path, overwrite_id, doc_id } = req.body;

    // Upload init — create DB record
    if (action === 'upload_init') {
      if (!name || !file_path) throw new ApiError(400, 'name and file_path required');
      if (overwrite_id) {
        const { data: old } = await sb.from('normative_docs').select('file_path').eq('id', overwrite_id).single();
        if (old?.file_path) await sb.storage.from('normative-docs').remove([old.file_path]);
        await sb.from('normative_docs').delete().eq('id', overwrite_id);
      }
      const { data, error } = await sb.from('normative_docs').insert({
        name,
        file_type: file_type || null,
        file_path,
        status: 'pending',
      }).select().single();
      if (error) throw new ApiError(500, error.message);
      return res.json(data);
    }

    // Vectorize one doc — fire and forget
    if (action === 'vectorize') {
      if (!doc_id) throw new ApiError(400, 'doc_id required');
      await runVectorize(doc_id, sb);
      return res.json({ ok: true, doc_id });
    }

    // Retry all pending docs
    if (action === 'retry_pending') {
      const { data: pending } = await sb.from('normative_docs')
        .select('id').eq('status', 'pending');
      const ids = (pending || []).map((d: any) => d.id);
      for (const id of ids) await runVectorize(id, sb);
      return res.json({ ok: true, queued: ids.length });
    }

    throw new ApiError(400, `Unknown action: ${action}`);
  } catch (e) { next(e); }
});

export default router;
