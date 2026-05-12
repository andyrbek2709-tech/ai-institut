/**
 * /api/interdept-ai — AI-ассистент для межотдельских коммуникаций
 *
 * POST /api/interdept-ai/stage4b-summary
 *   C1: AI-summary при запросе данных у смежника (Stage 4b)
 *
 * POST /api/interdept-ai/assignment-check
 *   C4: AI-сверка требования увязки с ТЗ + нормативной базой
 *
 * POST /api/interdept-ai/transmittal-diff
 *   C3: AI-diff при смене ревизии трансмиттала
 *
 * POST /api/interdept-ai/revision-diff
 *   C5: AI-summary изменений при создании ревизии чертежа
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { env } from '../config/environment.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import OpenAI from 'openai';
// @ts-ignore — pdf-parse lacks proper ESM types
import pdfParse from 'pdf-parse';

const router = Router();

// ── Lazy OpenAI ───────────────────────────────────────────────────────────
let _oai: OpenAI | null = null;
function getOAI(): OpenAI {
  if (!_oai) {
    if (!env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
    _oai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _oai;
}

// ── Helper: скачать файл из Supabase Storage и извлечь текст ─────────────
async function extractTextFromStorageFile(bucketName: string, filePath: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.storage.from(bucketName).download(filePath);
  if (error || !data) return '';
  try {
    const buf = Buffer.from(await data.arrayBuffer());
    const parsed = await pdfParse(buf);
    return (parsed.text || '').slice(0, 6000);
  } catch {
    return '';
  }
}

// ── Helper: получить ТЗ проекта ──────────────────────────────────────────
async function getProjectTz(projectId: number): Promise<string> {
  if (!projectId) return '';
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('project_assignments')
    .select('file_name, full_text')
    .eq('project_id', projectId)
    .eq('is_current', true)
    .maybeSingle();
  if (!data?.full_text) return '';
  return (data.full_text as string).slice(0, 3000);
}

// ── Helper: поиск в нормативной базе ─────────────────────────────────────
async function searchNormativka(query: string, orgId: string): Promise<string> {
  const sb = getSupabaseAdmin();
  try {
    const resp = await getOAI().embeddings.create({ model: 'text-embedding-3-small', input: query });
    const embedding = resp.data[0].embedding;
    const { data } = await sb.rpc('agsk_hybrid_search_v2', {
      p_query: query, p_query_embedding: embedding,
      p_org_id: orgId, p_limit: 3,
      p_vector_weight: 0.7, p_bm25_weight: 0.3,
      p_discipline: null, p_standard_code: null,
      p_version_year: null, p_version_latest_only: true,
    });
    if (!data?.length) return '';
    return (data as any[]).map((c) =>
      `[${c.citation_document || c.citation_standard || 'N/A'} ${c.citation_section || ''}] ${(c.content || c.chunk_text || '').slice(0, 300)}`
    ).join('\n');
  } catch {
    return '';
  }
}

// ── Helper: получить org_id ───────────────────────────────────────────────
async function getOrgId(userId: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('pilot_users').select('org_id').eq('user_id', userId).maybeSingle();
  return (data as any)?.org_id || 'f0624384-9ed0-56d0-9c0c-abbd2f5ae8dd';
}

// ── C1: Stage 4b AI-summary ───────────────────────────────────────────────
router.post('/interdept-ai/stage4b-summary', authMiddleware, async (req: Request, res: Response) => {
  const { dependency_id, what_needed, attachment_url, project_id } = req.body;
  if (!dependency_id || !what_needed) {
    return res.status(400).json({ error: 'dependency_id и what_needed обязательны' });
  }
  try {
    const userId = (req as any).userId || '';
    const orgId = await getOrgId(userId);

    // Если есть вложение — попытаться извлечь текст
    let fileText = '';
    if (attachment_url && typeof attachment_url === 'string') {
      // attachment_url формат: bucket/path  или  full Supabase URL
      const match = attachment_url.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)/);
      if (match) {
        fileText = await extractTextFromStorageFile(match[1], match[2]);
      }
    }

    // Контекст ТЗ
    const tzText = project_id ? await getProjectTz(Number(project_id)) : '';

    const systemPrompt = `Ты — ChatGPT 4.0, AI-помощник в проектном институте EngHub.
Задача: написать краткое резюме запроса данных у смежного отдела.
Формат: 3-4 предложения, профессиональный инженерный стиль, по-русски.
Если есть текст вложения — опиши его суть.
Если есть ТЗ проекта — укажи привязку к релевантным разделам.`;

    const userContent = `Запрос смежнику: "${what_needed}"
${fileText ? `\nТекст вложения (извлечённый):\n${fileText}` : ''}
${tzText ? `\nТЗ проекта:\n${tzText}` : ''}

Напиши краткое summary для получателя запроса (3-4 предложения).`;

    const completion = await getOAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });

    const summary = completion.choices[0]?.message?.content?.trim() || '';

    // Сохраняем в task_dependencies
    const sb = getSupabaseAdmin();
    await sb.from('task_dependencies')
      .update({ ai_summary: summary, ai_summary_at: new Date().toISOString() })
      .eq('id', dependency_id);

    return res.json({ success: true, ai_summary: summary });
  } catch (e: any) {
    logger.error({ err: e?.message }, 'interdept-ai stage4b-summary failed');
    return res.status(500).json({ error: e?.message || 'AI error' });
  }
});

// ── C4: Assignment AI-check ───────────────────────────────────────────────
router.post('/interdept-ai/assignment-check', authMiddleware, async (req: Request, res: Response) => {
  const { dependency_id, what_needed, project_id } = req.body;
  if (!dependency_id || !what_needed) {
    return res.status(400).json({ error: 'dependency_id и what_needed обязательны' });
  }
  try {
    const userId = (req as any).userId || '';
    const orgId = await getOrgId(userId);

    const [tzText, normResults] = await Promise.all([
      project_id ? getProjectTz(Number(project_id)) : Promise.resolve(''),
      searchNormativka(what_needed, orgId),
    ]);

    const systemPrompt = `Ты — ChatGPT 4.0, AI-помощник в проектном институте EngHub.
Задача: проверить требование по увязке на соответствие ТЗ проекта и нормативной базе.
Ответь кратко (3-5 предложений). Укажи конкретные разделы ТЗ и нормативных документов.
Стиль: инженерный, по-русски.`;

    const userContent = `Требование увязки: "${what_needed}"
${tzText ? `\nТЗ проекта:\n${tzText}` : ''}
${normResults ? `\nРелевантные нормативные фрагменты:\n${normResults}` : ''}

Проверь соответствие требованию. Укажи ссылки на ТЗ и нормативы.`;

    const completion = await getOAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 500,
      temperature: 0.2,
    });

    const aiCheck = completion.choices[0]?.message?.content?.trim() || '';

    const sb = getSupabaseAdmin();
    await sb.from('task_dependencies')
      .update({ ai_check: aiCheck, ai_check_at: new Date().toISOString() })
      .eq('id', dependency_id);

    return res.json({ success: true, ai_check: aiCheck });
  } catch (e: any) {
    logger.error({ err: e?.message }, 'interdept-ai assignment-check failed');
    return res.status(500).json({ error: e?.message || 'AI error' });
  }
});

// ── C3: Transmittal AI-diff ───────────────────────────────────────────────
router.post('/interdept-ai/transmittal-diff', authMiddleware, async (req: Request, res: Response) => {
  const { transmittal_id, note, drawing_codes } = req.body;
  if (!transmittal_id) {
    return res.status(400).json({ error: 'transmittal_id обязателен' });
  }
  try {
    const systemPrompt = `Ты — ChatGPT 4.0, AI-помощник в проектном институте EngHub.
Задача: составить краткое описание изменений при выпуске трансмиттала.
Формат: 3-5 предложений, перечисли ключевые изменения и потенциально затронутые дисциплины.
Стиль: инженерный, по-русски.`;

    const userContent = `Трансмиттал выпущен.
${note ? `Примечание к трансмитталу: "${note}"` : ''}
${drawing_codes?.length ? `Чертежи: ${drawing_codes.join(', ')}` : ''}

Составь краткое описание изменений для получателей.`;

    const completion = await getOAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 400,
      temperature: 0.3,
    });

    const aiDiff = completion.choices[0]?.message?.content?.trim() || '';

    const sb = getSupabaseAdmin();
    await sb.from('transmittals')
      .update({ ai_diff: aiDiff, ai_diff_at: new Date().toISOString() })
      .eq('id', transmittal_id);

    return res.json({ success: true, ai_diff: aiDiff });
  } catch (e: any) {
    logger.error({ err: e?.message }, 'interdept-ai transmittal-diff failed');
    return res.status(500).json({ error: e?.message || 'AI error' });
  }
});

// ── C5: Revision AI-diff ──────────────────────────────────────────────────
router.post('/interdept-ai/revision-diff', authMiddleware, async (req: Request, res: Response) => {
  const { revision_id, drawing_code, from_revision, to_revision, comment } = req.body;
  if (!revision_id) {
    return res.status(400).json({ error: 'revision_id обязателен' });
  }
  try {
    const systemPrompt = `Ты — ChatGPT 4.0, AI-помощник в проектном институте EngHub.
Задача: сформулировать краткое описание новой ревизии чертежа.
Формат: 2-4 предложения. Укажи характер изменений.
Стиль: инженерный, по-русски.`;

    const userContent = `Чертёж: ${drawing_code || '—'}
Ревизия: ${from_revision || '—'} → ${to_revision || '—'}
${comment ? `Комментарий: "${comment}"` : 'Комментарий не указан.'}

Составь краткое AI-резюме этой ревизии.`;

    const completion = await getOAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      max_tokens: 300,
      temperature: 0.3,
    });

    const aiDiff = completion.choices[0]?.message?.content?.trim() || '';

    const sb = getSupabaseAdmin();
    await sb.from('revisions')
      .update({ ai_diff: aiDiff, ai_diff_at: new Date().toISOString() })
      .eq('id', revision_id);

    return res.json({ success: true, ai_diff: aiDiff });
  } catch (e: any) {
    logger.error({ err: e?.message }, 'interdept-ai revision-diff failed');
    return res.status(500).json({ error: e?.message || 'AI error' });
  }
});

export default router;
