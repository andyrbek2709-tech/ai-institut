/**
 * /api/orchestrator — ChatGPT 4.0 (gpt-4o) AI помощник
 *
 * Задача: ассистент по нормативной базе (ГОСТ/СНиП/EN), проектным задачам и
 * инженерным расчётам. Использует OpenAI gpt-4o с системным промптом,
 * адаптированным под роль (gip/lead/engineer).
 *
 * POST /api/orchestrator
 * Body: { user_id, project_id, message, use_rag?, role? }
 * Response: { message, agent: 'chatgpt4', model: 'gpt-4o', usage? }
 */

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/environment.js';
import OpenAI from 'openai';

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
  gip: `Ты — ChatGPT 4.0, AI-помощник для Главного инженера проекта (ГИП) в проектном институте EngHub.
Твои задачи: помогать с нормативной базой (ГОСТ, СНиП, СП, EN, ASME), сроками, междисциплинарными коллизиями, контролем выдачи документации.
Отвечай кратко, по делу, на русском. Ссылайся на конкретные пункты норм. Если вопрос требует загруженной документации — попроси использовать поиск по базе знаний (AGSK).`,

  lead: `Ты — ChatGPT 4.0, AI-помощник Руководителя отдела в EngHub.
Фокус: загрузка инженеров, качество проверок, возвраты на доработку, нормативная база (ГОСТ/СНиП/EN).
Отвечай кратко, на русском. При работе с нормативкой ссылайся на пункты.`,

  engineer: `Ты — ChatGPT 4.0, AI-помощник инженера в EngHub.
Фокус: конкретные шаги выполнения задач, входные данные, критерии готовности, поиск по нормативке (ГОСТ/СНиП/СП/EN), помощь с инженерными расчётами.
Отвечай кратко, на русском, без воды. При работе с нормативкой ссылайся на пункты.`,
};

const DEFAULT_SYSTEM_PROMPT = ROLE_SYSTEM_PROMPTS.engineer;

// ── POST /api/orchestrator ────────────────────────────────────────────────

router.post('/orchestrator', authMiddleware, async (req: Request, res: Response) => {
  const { user_id, project_id, message, use_rag, role } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new ApiError(400, 'message is required');
  }

  const callerId = req.user?.id || user_id;
  if (!callerId) {
    throw new ApiError(401, 'Authenticated user required');
  }

  const systemPrompt = ROLE_SYSTEM_PROMPTS[role as string] || DEFAULT_SYSTEM_PROMPT;

  const ragHint = use_rag
    ? '\n\nПримечание: пользователь включил поиск по нормативной базе (RAG). Если вопрос про конкретный документ — сообщи, что для точной цитаты нужно загрузить стандарт через AGSK.'
    : '';

  try {
    const openai = getOpenAI();

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt + ragHint },
        { role: 'user', content: message.trim() },
      ],
      temperature: 0.3,
      max_tokens: 1200,
    });

    const reply = completion.choices?.[0]?.message?.content?.trim() || 'Не удалось сформировать ответ.';

    logger.info({
      msg: 'orchestrator.chatgpt4',
      user_id: callerId,
      project_id,
      role,
      use_rag,
      tokens: completion.usage,
    }, 'ChatGPT 4.0 reply generated');

    return res.json({
      message: reply,
      agent: 'chatgpt4',
      model: 'gpt-4o',
      usage: completion.usage,
    });
  } catch (err: any) {
    logger.error({ err, user_id: callerId, project_id }, 'orchestrator.chatgpt4 failed');

    if (err instanceof ApiError) throw err;

    if (err?.status === 401 || err?.code === 'invalid_api_key') {
      throw new ApiError(503, 'OpenAI authentication failed — check OPENAI_API_KEY');
    }
    if (err?.status === 429) {
      throw new ApiError(429, 'OpenAI rate limit reached — try again shortly');
    }

    throw new ApiError(500, 'ChatGPT 4.0 request failed', { message: err?.message });
  }
});

export default router;
