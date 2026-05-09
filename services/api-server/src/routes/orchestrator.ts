/**
 * /api/orchestrator — ChatGPT 4.0 (gpt-4o) AI помощник
 *
 * Задача: ассистент по нормативной базе (ГОСТ/СНиП/EN/АГСК), проектным задачам и
 * инженерным расчётам. Использует OpenAI gpt-4o с function calling:
 *   - search_normativka — реальный поиск по AGSK с цитатами
 *
 * POST /api/orchestrator
 * Body: { user_id, project_id, message, use_rag?, role? }
 * Response: { message, agent: 'chatgpt4', model: 'gpt-4o', tool_calls?, citations?, usage? }
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/environment.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import OpenAI from 'openai';
import { createHash } from 'crypto';

const router = Router();

// ── Lazy OpenAI client ────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    if (!env.OPENAI_API_KEY) {
      throw new ApiError(503, 'OPENAI_API_KEY not configured on server');
    }
    _openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return _openai;
}

// ── Системный промпт по ролям ─────────────────────────────────────────────

const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
  gip: `Ты — ChatGPT 4.0, AI-помощник для Главного инженера проекта (ГИП) в проектном институте EngHub (Caspian Engineering & Research).
Твои задачи: помогать с нормативной базой (ГОСТ, СНиП, СП, EN, ASME, АГСК), сроками, междисциплинарными коллизиями, контролем выдачи документации.
ВАЖНО: при любом вопросе про конкретную норму, ГОСТ, СНиП, требование — обязательно вызывай инструмент search_normativka и используй цитаты из реальных документов. Не выдумывай номера пунктов.
Отвечай кратко, по делу, на русском. Всегда указывай источник (документ, раздел, страницу) если цитируешь.`,

  lead: `Ты — ChatGPT 4.0, AI-помощник Руководителя отдела в EngHub.
Фокус: загрузка инженеров, качество проверок, возвраты на доработку, нормативная база (ГОСТ/СНиП/EN/АГСК).
ВАЖНО: при вопросах про нормативку — вызывай search_normativka и опирайся на реальные цитаты, не выдумывай.
Отвечай кратко, на русском. При работе с нормативкой ссылайся на пункты и источник.`,

  engineer: `Ты — ChatGPT 4.0, AI-помощник инженера в EngHub.
Фокус: конкретные шаги выполнения задач, входные данные, критерии готовности, поиск по нормативке (ГОСТ/СНиП/СП/EN/АГСК), помощь с инженерными расчётами.
ВАЖНО: при вопросах про конкретные нормы и требования — обязательно вызывай search_normativka. Не выдумывай номера ГОСТов и пункты.
Отвечай кратко, на русском, без воды. Всегда указывай источник цитаты (документ + раздел + страница).`,
};

const DEFAULT_SYSTEM_PROMPT = ROLE_SYSTEM_PROMPTS.engineer;

// ── Function calling tools ────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_normativka',
      description: 'Поиск по нормативной базе AGSK (ГОСТ, СНиП, СП, EN, ASME, внутренние стандарты). Возвращает релевантные фрагменты документов с цитатами (документ, раздел, страница). Используй при ЛЮБОМ вопросе про конкретные требования, толщины, давления, температуры, классификации, методики и т.п.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Поисковый запрос на русском или английском. Чем конкретнее — тем лучше. Примеры: "толщина стенки трубопровода ГОСТ 32569", "welding inspection criteria", "коррозионная стойкость"',
          },
          limit: {
            type: 'number',
            description: 'Максимум результатов (1-10). По умолчанию 5.',
          },
        },
        required: ['query'],
      },
    },
  },
];

// ── Helper: получить org_id юзера (та же логика что в agsk.ts) ───────────

async function getOrgIdForUser(userId: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('pilot_users')
    .select('org_id')
    .eq('user_id', userId)
    .maybeSingle();
  return ((data as any)?.org_id) || 'f0624384-9ed0-56d0-9c0c-abbd2f5ae8dd';
}

// ── Инструмент: search_normativka ─────────────────────────────────────────

async function execSearchNormativka(args: { query: string; limit?: number }, orgId: string) {
  const sb = getSupabaseAdmin();
  const limit = Math.min(Math.max(1, args.limit || 5), 10);

  // 1. Embedding
  const hash = createHash('sha256').update(args.query, 'utf8').digest('hex');
  const { data: cached } = await sb.from('agsk_embedding_cache').select('embedding').eq('content_hash', hash).maybeSingle();
  let embedding: number[];
  if (cached?.embedding) {
    embedding = typeof cached.embedding === 'string' ? JSON.parse(cached.embedding) : cached.embedding;
  } else {
    try {
      const resp = await getOpenAI().embeddings.create({ model: 'text-embedding-3-small', input: args.query });
      embedding = resp.data[0].embedding;
      Promise.resolve(sb.rpc('agsk_upsert_embedding_cache', { p_content_hash: hash, p_embedding: embedding }))
        .then(() => {}, () => {});
    } catch (e: any) {
      logger.error({ err: e?.message }, 'embedQuery in tool failed');
      return { error: 'Не удалось получить эмбеддинг для запроса', chunks: [], citations: [] };
    }
  }

  // 2. Hybrid RPC
  const { data, error } = await sb.rpc('agsk_hybrid_search_v2', {
    p_query: args.query,
    p_query_embedding: embedding,
    p_org_id: orgId,
    p_limit: limit,
    p_vector_weight: 0.7,
    p_bm25_weight: 0.3,
    p_discipline: null,
    p_standard_code: null,
    p_version_year: null,
    p_version_latest_only: true,
  });
  if (error) {
    logger.error({ err: error.message, code: error.code }, 'AGSK RPC in tool failed');
    return { error: 'Поиск временно недоступен: ' + error.message, chunks: [], citations: [] };
  }

  const chunks = (data as any[]) || [];
  // Compact format for LLM
  const compact = chunks.map((c) => ({
    document: c.citation_document || '',
    standard: c.citation_standard || '',
    section: c.citation_section || '',
    page: c.citation_page || 0,
    text: (c.chunk_text || c.text || '').slice(0, 500),
    score: c.score ?? c.similarity ?? null,
  }));

  return {
    found: compact.length,
    results: compact,
  };
}

// ── POST /api/orchestrator ────────────────────────────────────────────────

router.post('/orchestrator', authMiddleware, async (req: Request, res: Response) => {
  const { project_id, message, role } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new ApiError(400, 'message is required');
  }

  const callerId = req.user?.id;
  if (!callerId) {
    throw new ApiError(401, 'Authenticated user required');
  }

  const systemPrompt = ROLE_SYSTEM_PROMPTS[role as string] || DEFAULT_SYSTEM_PROMPT;
  const orgId = await getOrgIdForUser(callerId);

  try {
    const openai = getOpenAI();
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message.trim() },
    ];

    const collectedCitations: any[] = [];
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    // Multi-turn loop с tool calls (макс 4 итерации, чтобы не зациклиться)
    for (let turn = 0; turn < 4; turn++) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens: 1200,
      });

      if (completion.usage) {
        totalUsage.prompt_tokens += completion.usage.prompt_tokens;
        totalUsage.completion_tokens += completion.usage.completion_tokens;
        totalUsage.total_tokens += completion.usage.total_tokens;
      }

      const choice = completion.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      messages.push(msg);

      if (!msg.tool_calls || msg.tool_calls.length === 0) {
        // Финальный ответ от модели
        const reply = msg.content?.trim() || 'Не удалось сформировать ответ.';
        logger.info({ msg: 'orchestrator.chatgpt4', user_id: callerId, project_id, role, turns: turn + 1, citations: collectedCitations.length, tokens: totalUsage }, 'ChatGPT 4.0 reply generated');
        return res.json({
          message: reply,
          agent: 'chatgpt4',
          model: 'gpt-4o',
          citations: collectedCitations,
          tool_turns: turn,
          usage: totalUsage,
        });
      }

      // Выполняем tool calls
      for (const tc of msg.tool_calls) {
        let toolResult: any;
        try {
          const args = JSON.parse(tc.function.arguments || '{}');
          if (tc.function.name === 'search_normativka') {
            toolResult = await execSearchNormativka(args, orgId);
            // Собираем уникальные цитаты для UI
            if (toolResult?.results) {
              for (const r of toolResult.results) {
                const key = `${r.standard}::${r.section}::${r.page}`;
                if (!collectedCitations.find((c) => `${c.standard}::${c.section}::${c.page}` === key)) {
                  collectedCitations.push({ document: r.document, standard: r.standard, section: r.section, page: r.page });
                }
              }
            }
          } else {
            toolResult = { error: `Unknown tool: ${tc.function.name}` };
          }
        } catch (e: any) {
          toolResult = { error: 'Tool execution failed: ' + (e?.message || 'unknown') };
        }
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(toolResult),
        });
      }
    }

    // Если за 4 turn модель не закончила — отдаём что есть
    return res.json({
      message: 'Ответ слишком длинный, попробуйте уточнить вопрос.',
      agent: 'chatgpt4',
      model: 'gpt-4o',
      citations: collectedCitations,
      usage: totalUsage,
    });
  } catch (err: any) {
    logger.error({ err: err?.message, status: err?.status, code: err?.code }, 'orchestrator.chatgpt4 failed');
    if (err instanceof ApiError) throw err;
    if (err?.status === 401 || err?.code === 'invalid_api_key') {
      throw new ApiError(503, 'OpenAI authentication failed — check OPENAI_API_KEY');
    }
    if (err?.status === 429) {
      throw new ApiError(429, 'OpenAI rate limit reached — try again shortly');
    }
    throw new ApiError(500, 'ChatGPT 4.0 request failed: ' + (err?.message || 'unknown'));
  }
});

export default router;
