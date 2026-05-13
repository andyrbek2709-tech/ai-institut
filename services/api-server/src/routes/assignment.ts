import { Router, Request, Response, NextFunction } from 'express';
import { createRequire } from 'module';
import OpenAI from 'openai';
import { getSupabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { mapDiscipline } from '../utils/disciplines.js';
import { embedQuery } from './agsk.js';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

function getToken(req: Request): string | undefined {
  return req.headers.authorization?.replace('Bearer ', '');
}

async function verifyAuth(token: string) {
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new ApiError(401, 'Invalid token');
  const { data: appUser } = await supabase
    .from('app_users').select('id, role').eq('supabase_uid', user.id).single();
  if (!appUser) throw new ApiError(403, 'User not found');
  return { appUserId: appUser.id as number };
}

async function parseMultipart(req: Request): Promise<{
  fields: Record<string, string>;
  file?: { name: string; buffer: Buffer; mime: string };
}> {
  return new Promise((resolve, reject) => {
    const ct = req.headers['content-type'] || '';
    const bm = ct.match(/boundary=(.+)$/);
    if (!bm) { reject(new Error('No boundary in Content-Type')); return; }
    const boundary = '--' + bm[1];
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('error', reject);
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks);
        const bodyStr = body.toString('binary');
        const parts = bodyStr.split(boundary).slice(1);
        const fields: Record<string, string> = {};
        let file: { name: string; buffer: Buffer; mime: string } | undefined;
        for (const part of parts) {
          if (part.trim() === '--' || part.trim() === '--\r\n') continue;
          const hbs = part.indexOf('\r\n\r\n');
          if (hbs === -1) continue;
          const hdr = part.slice(0, hbs);
          const raw = part.slice(hbs + 4);
          const bodyContent = raw.endsWith('\r\n') ? raw.slice(0, -2) : raw;
          const cdm = hdr.match(/Content-Disposition:[^\r\n]*name="([^"]+)"/i);
          if (!cdm) continue;
          const fn = cdm[1];
          const fnm = hdr.match(/filename="([^"]+)"/i);
          const ctm = hdr.match(/Content-Type:\s*([^\r\n]+)/i);
          if (fnm) {
            file = { name: fnm[1], buffer: Buffer.from(bodyContent, 'binary'), mime: ctm ? ctm[1].trim() : 'application/octet-stream' };
          } else {
            fields[fn] = bodyContent;
          }
        }
        resolve({ fields, file });
      } catch (e) { reject(e); }
    });
  });
}

async function parseSectionsFromPdf(buf: Buffer, assignmentId: string): Promise<any[]> {
  try {
    const data = await pdfParse(buf);
    const text = data.text || '';
    const DISC: Record<string, string[]> = {
      'ЭС':    ['электр', 'ЭС', 'энергоснабж', 'электроснабж'],
      'КИПиА': ['КИПиА', 'автоматиз', 'контрольно-измер'],
      'ООС':   ['ООС', 'охрана окруж', 'экологи'],
      'ПОС':   ['ПОС', 'организаци строительств', 'производств работ'],
      'Смета': ['смет', 'стоимост', 'финанс'],
      'ПБ':    ['пожарн', 'ПБ', 'пожаровзрывобезопасн'],
      'ПромБ': ['промышленн безопасн', 'ПромБ'],
      'КР':    ['конструктив', 'КР', 'строителн конструк'],
      'ОПД':   ['ОПД', 'опасн производств'],
      'АКЗ':   ['антикоррозийн', 'АКЗ', 'защита от коррозии'],
    };
    const lines = text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 3);
    const re = /^(\d{1,2}(?:\.\d{1,2})*)[.\s)]+(.{10,120})$/;
    const found: any[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
      const m = re.exec(line);
      if (!m) continue;
      const num = m[1]; const title = m[2].trim();
      const key = `${num}:${title.slice(0, 20)}`;
      if (seen.has(key)) continue; seen.add(key);
      let discipline: string | null = null;
      const lower = title.toLowerCase();
      for (const [d, kws] of Object.entries(DISC)) {
        if (kws.some(k => lower.includes(k.toLowerCase()))) { discipline = d; break; }
      }
      found.push({
        assignment_id: assignmentId,
        section_number: parseInt(num.split('.')[0], 10),
        section_title: title,
        section_text: title,
        discipline,
      });
      if (found.length >= 100) break;
    }
    return found;
  } catch (e: any) {
    logger.warn({ err: e?.message }, 'parseSectionsFromPdf failed');
    return [];
  }
}

// GET /api/assignment?project_id=X
router.get('/assignment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyAuth(token);
    const projectId = req.query.project_id;
    if (!projectId) throw new ApiError(400, 'project_id required');
    const supabase = getSupabaseAdmin();
    const { data: assignment, error: aErr } = await supabase
      .from('project_assignments')
      .select('id, version, file_name, storage_path, notes, uploaded_at')
      .eq('project_id', projectId).eq('is_current', true).maybeSingle();
    if (aErr) throw new ApiError(500, aErr.message);
    if (!assignment) {
      // Fallback: check project_documents with doc_type='tz' (DocumentsPanel upload path)
      const { data: doc } = await supabase
        .from('project_documents')
        .select('id, name, uploaded_at, storage_path')
        .eq('project_id', projectId)
        .eq('doc_type', 'tz')
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (doc) {
        const { data: urlData } = await supabase.storage
          .from('project-files').createSignedUrl(doc.storage_path, 3600);
        return res.json({
          assignment: {
            id: doc.id, version: 1, file_name: doc.name,
            storage_path: doc.storage_path,
            notes: 'Загружено через раздел «Документы»',
            uploaded_at: doc.uploaded_at,
            signed_url: urlData?.signedUrl || null,
          },
          sections: [],
        });
      }
      return res.status(404).json({ error: 'No assignment' });
    }
    const { data: urlData } = await supabase.storage
      .from('project-assignments').createSignedUrl(assignment.storage_path, 3600);
    const { data: sections } = await supabase
      .from('assignment_sections').select('id, section_number, section_title, section_text, discipline')
      .eq('assignment_id', assignment.id).order('section_number', { ascending: true });
    return res.json({ assignment: { ...assignment, signed_url: urlData?.signedUrl || null }, sections: sections || [] });
  } catch (err) { next(err); }
});

// POST /api/assignment — multipart: project_id, file (PDF), notes?
router.post('/assignment', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId } = await verifyAuth(token);
    const { fields, file } = await parseMultipart(req);
    const projectId = fields.project_id;
    if (!projectId) throw new ApiError(400, 'project_id required');
    if (!file) throw new ApiError(400, 'file required');
    if (!file.name.toLowerCase().endsWith('.pdf')) throw new ApiError(400, 'Only PDF files allowed');
    if (file.buffer.length > 50 * 1024 * 1024) throw new ApiError(400, 'File too large (max 50 MB)');
    const supabase = getSupabaseAdmin();
    const { data: existing } = await supabase
      .from('project_assignments').select('id, version').eq('project_id', projectId)
      .order('version', { ascending: false }).limit(1).maybeSingle();
    const nextVersion = existing ? existing.version + 1 : 1;
    const safeName = file.name.replace(/[^a-zA-Z0-9._\- ]/g, '_');
    const storagePath = `${projectId}/v${nextVersion}/${Date.now()}_${safeName}`;
    const { error: uploadErr } = await supabase.storage
      .from('project-assignments').upload(storagePath, file.buffer, { contentType: file.mime, upsert: false });
    if (uploadErr) throw new ApiError(500, `Storage upload failed: ${uploadErr.message}`);
    if (existing) {
      await supabase.from('project_assignments').update({ is_current: false }).eq('project_id', projectId);
    }
    const { data: newA, error: insertErr } = await supabase
      .from('project_assignments')
      .insert({ project_id: Number(projectId), version: nextVersion, is_current: true, file_name: file.name, storage_path: storagePath, uploaded_by: appUserId, notes: fields.notes?.trim() || null })
      .select().single();
    if (insertErr) {
      await supabase.storage.from('project-assignments').remove([storagePath]);
      throw new ApiError(500, insertErr.message);
    }
    // Extract and save full text so AI orchestrator can read it via project context
    let fullText: string | null = null;
    try {
      const pdfData = await pdfParse(file.buffer);
      fullText = (pdfData.text || '').trim().slice(0, 60000) || null;
      if (fullText) {
        await supabase.from('project_assignments').update({ full_text: fullText }).eq('id', newA.id);
      }
    } catch (e: any) {
      logger.warn({ err: e?.message }, 'PDF full_text extraction failed — sections still saved');
    }

    const sections = await parseSectionsFromPdf(file.buffer, newA.id);
    if (sections.length > 0) await supabase.from('assignment_sections').insert(sections);
    const { data: urlData } = await supabase.storage
      .from('project-assignments').createSignedUrl(storagePath, 3600);
    return res.json({ assignment: { ...newA, signed_url: urlData?.signedUrl || null }, sections });
  } catch (err) { next(err); }
});

// POST /api/assignment/analyze
router.post('/assignment/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyAuth(token);
    const { assignment_id } = req.body;
    if (!assignment_id) throw new ApiError(400, 'assignment_id required');
    const supabase = getSupabaseAdmin();
    const { data: assignment } = await supabase
      .from('project_assignments').select('id, project_id, file_name')
      .eq('id', assignment_id).single();
    if (!assignment) throw new ApiError(404, 'Assignment not found');
    const { data: sections } = await supabase
      .from('assignment_sections')
      .select('id, section_number, section_title, section_text, discipline')
      .eq('assignment_id', assignment_id);
    if (!sections || sections.length === 0) {
      return res.json({ assignment_id, analyses: [], warning: 'Sections not parsed' });
    }
    const groups: Record<string, typeof sections> = {};
    for (const s of sections) {
      const key = s.discipline || '—';
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    }
    const analyzeDisc = async (ruDisc: string, secs: typeof sections) => {
      try {
        const query = secs.map((s: any) => s.section_title).join('. ');
        const enDisc = mapDiscipline(ruDisc);
        const { embedding } = await embedQuery(query);
        const { data: results } = await supabase.rpc('agsk_hybrid_search_v2', {
          p_query: query,
          p_query_embedding: embedding,
          p_org_id: null,
          p_limit: 5,
          p_vector_weight: 0.5,
          p_bm25_weight: 0.5,
          p_discipline: enDisc,
          p_standard_code: null,
          p_version_year: null,
          p_version_latest_only: true,
        });
        const citations = (results || []).map((r: any) => ({
          standard: r.standard_code || r.code,
          section: r.section_title || r.chunk_title,
          page: r.page_number,
          score: r.score,
          text: (r.chunk_text || '').slice(0, 200),
        }));
        let summary = 'Применимых норм в базе не найдено.';
        if (citations.length > 0) {
          const citText = citations.map((c: any) =>
            `${c.standard}: ${c.section}${c.page ? ' (стр.' + c.page + ')' : ''}\n${c.text}`
          ).join('\n\n');
          const gpt = await getOpenAI().chat.completions.create({
            model: 'gpt-4o',
            max_tokens: 400,
            messages: [
              { role: 'system', content: 'Ты технический консультант. Кратко объясни какие нормы применимы к данным разделам ТЗ. Упоминай только конкретные стандарты из контекста.' },
              { role: 'user', content: `Разделы ТЗ (${ruDisc}):\n${query}\n\nНайденные нормы:\n${citText}` },
            ],
          });
          summary = gpt.choices[0]?.message?.content || summary;
        }
        return { discipline: ruDisc, sections: secs.map((s: any) => s.section_title), citations, summary };
      } catch (e: any) {
        return { discipline: ruDisc, sections: secs.map((s: any) => s.section_title), citations: [], summary: '', error: e.message };
      }
    };
    const timeout = <T>(p: Promise<T>, ms: number): Promise<T> =>
      Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
    const analyses = await Promise.all(
      Object.entries(groups).map(([disc, secs]) =>
        timeout(analyzeDisc(disc, secs), 25000).catch((e: any) => ({
          discipline: disc, sections: secs.map((s: any) => s.section_title),
          citations: [], summary: '', error: e.message,
        }))
      )
    );
    return res.json({ assignment_id, analyses, generated_at: new Date().toISOString() });
  } catch (err) { next(err); }
});

export default router;

// redeploy: 2026-05-11T19:04:35Z
