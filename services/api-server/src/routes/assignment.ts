import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/environment.js';
import { logger } from '../utils/logger.js';
import { embedQuery, getOrgId } from './agsk.js';
import { mapDiscipline, disciplineTitle } from '../utils/disciplines.js';
import OpenAI from 'openai';

const router = Router();

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) _openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
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
  return { appUserId: appUser.id as number, supabaseUid: user.id as string };
}

// Parse multipart/form-data without multer
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
    if (!assignment) return res.status(404).json({ error: 'No assignment' });
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
    const sections = parseSections(file.buffer, newA.id);
    if (sections.length > 0) await supabase.from('assignment_sections').insert(sections);
    const { data: urlData } = await supabase.storage
      .from('project-assignments').createSignedUrl(storagePath, 3600);
    return res.json({ assignment: { ...newA, signed_url: urlData?.signedUrl || null }, sections });
  } catch (err) { next(err); }
});

function parseSections(buf: Buffer, assignmentId: string): any[] {
  try {
    const raw = buf.toString('latin1');
    const textRuns: string[] = [];
    let run = '';
    for (let i = 0; i < raw.length && i < 500000; i++) {
      const code = raw.charCodeAt(i);
      if (code >= 32 && code < 127) { run += raw[i]; }
      else if (run.length > 3) { textRuns.push(run); run = ''; }
      else { run = ''; }
    }
    if (run.length > 3) textRuns.push(run);
    const text = textRuns.join(' ');
    const re = /\b(\d{1,2}(?:\.\d{1,2})*)[.\s]+([А-ЯЁA-Z][^\n\r.!?]{5,80})/g;
    const DISC: Record<string, string[]> = {
      'ЭС': ['электр','ЭС','энергоснабж'], 'КИПиА': ['КИПиА','автоматиз'],
      'ООС': ['ООС','охрана окруж','экологи'], 'ПОС': ['ПОС','организаци строительств'],
      'Смета': ['смет','стоимост'], 'ПБ': ['пожарн','ПБ'],
      'ПромБ': ['промышленн безопасн','ПромБ'], 'КР': ['конструктив','КР'],
      'ОПД': ['ОПД','опасн производств'], 'АКЗ': ['антикоррозийн','АКЗ'],
    };
    const found: any[] = [];
    const seen = new Set<string>();
    let match;
    while ((match = re.exec(text)) !== null) {
      const num = match[1]; const title = match[2].trim().replace(/\s+/g, ' ');
      const key = `${num}:${title.slice(0, 20)}`;
      if (seen.has(key)) continue; seen.add(key);
      let discipline: string | null = null;
      const lower = title.toLowerCase();
      for (const [d, kws] of Object.entries(DISC)) {
        if (kws.some(k => lower.includes(k.toLowerCase()))) { discipline = d; break; }
      }
      found.push({ assignment_id: assignmentId, section_number: parseInt(num.split('.')[0], 10), section_title: title, section_text: title, discipline });
      if (found.length >= 100) break;
    }
    return found;
  } catch { return []; }
}

// ── POST /api/assignment/analyze ──────────────────────────────────────────
// Body: { assignment_id }
// Для каждой дисциплины: RAG-поиск (AGSK hybrid) + LLM-синтез рекомендаций.
// On-demand, без хранения (см. план Phase 4 для кэша).
router.post('/assignment/analyze', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { supabaseUid } = await verifyAuth(token);

    const { assignment_id } = req.body || {};
    if (!assignment_id) throw new ApiError(400, 'assignment_id required');

    const sb = getSupabaseAdmin();
    const { data: assignment, error: aErr } = await sb
      .from('project_assignments')
      .select('id, version, file_name, project_id')
      .eq('id', assignment_id)
      .maybeSingle();
    if (aErr) throw new ApiError(500, aErr.message);
    if (!assignment) throw new ApiError(404, 'Assignment not found');

    const { data: sections } = await sb
      .from('assignment_sections')
      .select('id, section_number, section_title, section_text, discipline')
      .eq('assignment_id', assignment_id)
      .order('section_number', { ascending: true });

    if (!sections || sections.length === 0) {
      return res.json({
        assignment_id,
        analyses: [],
        warning: 'Разделы ТЗ не распознаны — анализ невозможен',
        generated_at: new Date().toISOString(),
      });
    }

    const orgId = await getOrgId(supabaseUid);
    if (!orgId) throw new ApiError(403, 'User has no associated organisation');

    // Группируем по RU-дисциплине (null → "—" как маркер «без дисциплины»)
    const byDisc = new Map<string, any[]>();
    for (const s of sections) {
      const key = s.discipline || '—';
      if (!byDisc.has(key)) byDisc.set(key, []);
      byDisc.get(key)!.push(s);
    }

    const PER_DISC_TIMEOUT_MS = 25_000;

    const tasks = Array.from(byDisc.entries()).map(async ([ru, secs]) => {
      const ruOrNull = ru === '—' ? null : ru;
      const enDisc = mapDiscipline(ruOrNull);
      const title = disciplineTitle(ruOrNull);
      const query = secs.map(s => s.section_title).filter(Boolean).join('; ').slice(0, 500);
      if (query.length < 5) {
        return { discipline: ru, title, sections: secs, citations: [], summary: 'Слишком короткий контекст для анализа', error: null };
      }
      const work = (async () => {
        const { embedding } = await embedQuery(query);
        const { data, error } = await sb.rpc('agsk_hybrid_search_v2', {
          p_query: query,
          p_query_embedding: embedding,
          p_org_id: orgId,
          p_limit: 5,
          p_vector_weight: 0.7,
          p_bm25_weight: 0.3,
          p_discipline: enDisc,
          p_standard_code: null,
          p_version_year: null,
          p_version_latest_only: true,
        });
        if (error) {
          logger.error({ rpc: 'agsk_hybrid_search_v2', err: error, discipline: ru }, 'Analyze: RPC failed');
          return { discipline: ru, title, sections: secs, citations: [], summary: null, error: 'Ошибка поиска в АГСК' };
        }
        const chunks = data ?? [];
        const citations = dedupCitations(chunks.map(buildCitation));
        if (chunks.length === 0) {
          return { discipline: ru, title, sections: secs, citations, summary: 'Применимых норм в АГСК не найдено', error: null };
        }
        const summary = await synthesizeAnalysis(title, secs, chunks);
        return { discipline: ru, title, sections: secs, citations, summary, error: null };
      })();
      try {
        return await Promise.race([
          work,
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), PER_DISC_TIMEOUT_MS)),
        ]) as any;
      } catch (e: any) {
        logger.warn({ err: e?.message, discipline: ru }, 'Analyze: per-discipline failed');
        return { discipline: ru, title, sections: secs, citations: [], summary: null, error: e?.message === 'timeout' ? 'Превышен таймаут (25с)' : 'Ошибка анализа' };
      }
    });

    const analyses = await Promise.all(tasks);

    res.json({
      assignment_id,
      version: assignment.version,
      analyses,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

function buildCitation(c: any) {
  return {
    document:   c.citation_document ?? '',
    standard:   c.citation_standard ?? '',
    section:    c.citation_section ?? '',
    page:       c.citation_page ?? 0,
    version:    c.citation_version ?? '',
    confidence: c.citation_confidence ?? 1.0,
  };
}

function dedupCitations(arr: any[]): any[] {
  const seen = new Set<string>();
  return arr.filter(c => {
    const k = `${c.standard}::${c.section}::${c.version}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

async function synthesizeAnalysis(discTitle: string, sections: any[], chunks: any[]): Promise<string> {
  const secList = sections
    .map(s => `  - ${s.section_number ?? '—'}. ${s.section_title}`)
    .join('\n')
    .slice(0, 2000);

  const ctx = chunks
    .map((c: any, i: number) => {
      const cit = `[${c.citation_standard ?? '?'} §${c.citation_section ?? '?'} стр.${c.citation_page ?? '?'}]`;
      const text = (c.content ?? '').toString().slice(0, 800);
      return `(${i + 1}) ${cit}\n${text}`;
    })
    .join('\n\n')
    .slice(0, 6000);

  const system = [
    'Ты инженер-консультант проектного института. Анализируешь раздел ТЗ и подбираешь применимые нормативы из АГСК.',
    'Правила:',
    '1. Цитируй только то, что есть в предоставленных фрагментах — никаких новых стандартов.',
    '2. Формат: 2–4 коротких пункта на русском.',
    '3. Каждый пункт ссылается на номер фрагмента в скобках, например (1) или (1,3).',
    '4. Если ничего применимого — напиши «Прямо применимых норм не обнаружено».',
    '5. Не используй markdown-заголовки, только список с тире.',
  ].join('\n');

  const user = `Дисциплина: ${discTitle}\n\nРазделы ТЗ:\n${secList}\n\nФрагменты норм:\n${ctx}\n\nКраткий вывод по применимым нормам и ключевым требованиям:`;

  try {
    const resp = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      max_tokens: 400,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });
    return resp.choices[0]?.message?.content?.trim() || 'Не удалось сгенерировать анализ';
  } catch (e: any) {
    logger.error({ err: e?.message, discipline: discTitle }, 'Analyze: synthesize failed');
    throw new Error('LLM synthesize failed: ' + (e?.message ?? 'unknown'));
  }
}

export default router;
