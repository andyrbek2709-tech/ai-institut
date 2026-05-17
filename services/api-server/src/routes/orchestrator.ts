/**
 * /api/orchestrator — ChatGPT 4.0 (gpt-4o) AI помощник
 *
 * Задача: ассистент по нормативной базе (ГОСТ/СНиП/EN/АГСК), задачам,
 * чертежам и инженерным расчётам. OpenAI gpt-4o с function calling:
 *   - search_normativka — реальный поиск по AGSK с цитатами
 *   - create_task        — создаёт задачу в проекте + event task.created
 *   - list_drawings      — список чертежей проекта (для AI-анализа)
 *
 * POST /api/orchestrator
 * Body:    { project_id, message, role? }
 * Response:{ message, agent: 'chatgpt4', model: 'gpt-4o', citations?, actions?, usage? }
 */

import { Router, Request, Response } from 'express';
import { createRequire } from 'module';
import { authMiddleware } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { execDiffReports, execApproveReport } from '../services/reportTools.js';
import { ApiError } from '../middleware/errorHandler.js';
import { env } from '../config/environment.js';
import { getSupabaseAdmin } from '../config/supabase.js';
import { getRedisClient } from '../config/redis.js';
import { createRecord, listRecords } from '../services/supabase-proxy.js';
import { reportManager } from '../services/reportManager.js';
import OpenAI from 'openai';
import { createHash } from 'crypto';

const _require = createRequire(import.meta.url);

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

const NORMATIVE_SEARCH_RULES = `
ПРАВИЛА ПОИСКА НОРМАТИВОВ ДЛЯ ПРОЕКТА:
Когда просят "какие нормативы нужны для проекта" или "что применять":
  Шаг 1: вызови get_project_tz — прочитай ТЗ, выяви инженерные дисциплины и тип работ.
  Шаг 2: из ТЗ/названия проекта выдели 3-5 технических ключевых слов (НЕ название проекта целиком).
    Пример: "Замена сборника отстоянных сточных вод" → ищи "резервуар сточных вод", "канализация", "ВК очистные сооружения".
    Пример: "Электроснабжение насосной станции" → ищи "электроснабжение", "ЭС насосная", "кабельные трассы".
  Шаг 3: вызови search_normativka с каждым из ключевых слов (2-3 запроса).
  Шаг 4: вызови search_normative_kb с теми же словами.
  Шаг 5: сведи результаты в список по дисциплинам.
ЗАПРЕЩЕНО: искать нормативы по полному названию проекта — так ничего не найдёшь.`;

const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
  gip: `Ты — ChatGPT 4.0, AI-помощник для Главного инженера проекта (ГИП) в проектном институте EngHub (Caspian Engineering & Research).
Задачи: помощь с нормативной базой (ГОСТ, СНиП, СП, EN, ASME, АГСК), сроками, междисциплинарными коллизиями, контролем выдачи документации.

В системном промпте ты уже получил СНАПШОТ ПРОЕКТА с актуальными задачами, чертежами и совещаниями — используй его для ответов без вызова инструментов, если данных достаточно.

ПРАВИЛА:
1. По вопросам про нормативку → ОБЯЗАТЕЛЬНО вызывай search_normativka. Не выдумывай номера пунктов.
2. Когда цитируешь — ВСЕГДА давай 1-2 ключевые фразы из найденного текста + источник: документ, раздел, стр.
3. Если просят создать задачу → используй create_task.
4. Если просят посмотреть задачи / прогресс / статус → list_tasks (если снапшота недостаточно).
5. Если просят посмотреть чертежи → list_drawings.
6. Если спрашивают про ТЗ, задание на проектирование, требования проекта — НЕМЕДЛЕННО вызывай get_project_tz.
7. Если спрашивают про загруженные документы организации → search_normative_kb.
8. Отвечай кратко, по-русски. Без воды.
${NORMATIVE_SEARCH_RULES}
КЛЮЧЕВОЕ ПРАВИЛО: НЕ задавай уточняющих вопросов до того как вызвал нужный инструмент.`,

  lead: `Ты — ChatGPT 4.0, AI-помощник Руководителя отдела в EngHub.
Фокус: загрузка инженеров, проверки, нормативная база (ГОСТ/СНиП/EN/АГСК), задачи.

В системном промпте ты уже получил СНАПШОТ ПРОЕКТА с актуальными задачами, чертежами и совещаниями — используй его для ответов без вызова инструментов, если данных достаточно.

ПРАВИЛА:
1. По нормативке → search_normativka. Цитируй текст + источник.
2. Создание задач → create_task.
3. Задачи / прогресс → list_tasks (если снапшота недостаточно).
4. Чертежи → list_drawings.
5. ТЗ / задание на проектирование → get_project_tz (сразу).
6. Загруженные документы организации → search_normative_kb.
7. Кратко, по-русски.
${NORMATIVE_SEARCH_RULES}
КЛЮЧЕВОЕ ПРАВИЛО: НЕ задавай уточняющих вопросов до того как вызвал нужный инструмент.`,

  engineer: `Ты — ChatGPT 4.0, AI-помощник инженера в EngHub.
Фокус: задачи, нормативка (ГОСТ/СНиП/СП/EN/АГСК), расчёты, чертежи.

В системном промпте ты уже получил СНАПШОТ ПРОЕКТА с актуальными задачами, чертежами и совещаниями — используй его для ответов без вызова инструментов, если данных достаточно.

ПРАВИЛА:
1. По нормативке → ОБЯЗАТЕЛЬНО search_normativka. Не выдумывай ГОСТы.
2. Когда цитируешь — 1-2 фразы из текста + ссылка (документ, раздел, стр.).
3. Создать задачу → create_task.
4. Задачи / прогресс → list_tasks (если снапшота недостаточно).
5. Список чертежей → list_drawings.
6. ТЗ / задание на проектирование → get_project_tz (сразу).
7. Загруженные файлы организации → search_normative_kb.
8. Кратко, по-русски.
${NORMATIVE_SEARCH_RULES}
КЛЮЧЕВОЕ ПРАВИЛО: НЕ задавай уточняющих вопросов до того как вызвал нужный инструмент.`,
};

const DEFAULT_SYSTEM_PROMPT = ROLE_SYSTEM_PROMPTS.engineer;

// ── Function calling tools ────────────────────────────────────────────────

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_normativka',
      description: 'Поиск по нормативной базе AGSK (ГОСТ, СНиП, СП, EN, ASME, внутренние стандарты). Возвращает релевантные фрагменты документов с цитатами (документ, раздел, страница, текст). Используй ВСЕГДА когда нужны конкретные требования, толщины, давления, температуры, классификации, методики и т.п.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Поисковый запрос на русском или английском. Чем конкретнее — тем лучше.',
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
  {
    type: 'function',
    function: {
      name: 'create_task',
      description: 'Создаёт задачу в текущем проекте. Используй когда пользователь явно просит создать задачу, поручение или TODO. Задача автоматически уведомит исполнителя через оркестратор. После создания обязательно сообщи пользователю id задачи.',
      parameters: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Название задачи (краткое, понятное, до 200 символов)',
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'urgent'],
            description: 'Приоритет. По умолчанию normal.',
          },
          deadline: {
            type: 'string',
            description: 'Дедлайн в формате YYYY-MM-DD. Если не указан явно — используй дату через 30 дней от сегодня.',
          },
          description: {
            type: 'string',
            description: 'Подробное описание задачи. Опционально.',
          },
          dept: {
            type: 'string',
            description: 'Отдел/дисциплина (Общие, ОВ, ВК, КЖ, КМ, ЭО, АТХ и т.п.). По умолчанию "Общие".',
          },
        },
        required: ['name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_drawings',
      description: 'Возвращает список чертежей текущего проекта с их статусами. Используй когда пользователь спрашивает про чертежи, ОВ-001, КМ-005 и т.п. Также используй для обзора что есть в проекте.',
      parameters: {
        type: 'object',
        properties: {
          discipline: {
            type: 'string',
            description: 'Фильтр по дисциплине (ОВ, ВК, КЖ, КМ, ЭО, АТХ). Опционально.',
          },
          status: {
            type: 'string',
            enum: ['draft', 'in_work', 'review', 'approved', 'issued'],
            description: 'Фильтр по статусу. Опционально.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_project_tz',
      description: 'Получить полный текст технического задания текущего проекта. Используй когда спрашивают про требования проекта, что сказано в ТЗ, отступления от ТЗ.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_tasks',
      description: 'Получить список задач текущего проекта с их статусами, приоритетами, сроками и исполнителями. Используй когда спрашивают про задачи, что сделано, что в работе, какие задачи открыты, прогресс по проекту.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['todo', 'in_progress', 'review', 'done'],
            description: 'Фильтр по статусу. Опционально.',
          },
          priority: {
            type: 'string',
            enum: ['low', 'normal', 'high', 'urgent'],
            description: 'Фильтр по приоритету. Опционально.',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_normative_kb',
      description: 'Поиск по локальной базе знаний (загруженные ГОСТы, СНиПы, СП, внутренние регламенты организации). Используй когда нужно найти конкретные требования из загруженных документов.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Поисковый запрос' },
          limit: { type: 'number', description: 'Количество результатов (1-8, default 5)' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_discipline_collisions',
      description: 'Проверить коллизии и противоречия между разделами ТЗ разных дисциплин. Используй когда спрашивают про коллизии, противоречия, несоответствия между дисциплинами.',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_report',
      description: 'Сформировать официальный инженерный отчет по заданной дисциплине. Статус сохранения в БД, checksum для целостности. В контент ОБЯЗАТЕЛЬНО включай раздел «Нормативная база» со ссылками на использованные документы и конкретные пункты (номер раздела/пункта).',
      parameters: {
        type: 'object',
        properties: {
          discipline: {
            type: 'string',
            description: 'Дисциплина отчета (например, «Промбезопасность», «Геодезия», «Архитектура»).'
          },
          content: {
            type: 'string',
            description: 'Полный текст отчета в структурированном виде: Введение → Расчеты → Выводы → Нормативная база. В разделе «Нормативная база» указывай конкретные документы и пункты (например, ГОСТ 12.1.004-91, раздел 4.2).'
          }
        },
        required: ['discipline', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'diff_reports',
      description: 'Сравнить текущую версию отчета с предыдущей ревизией и показать изменения.',
      parameters: {
        type: 'object',
        properties: {
          discipline: {
            type: 'string',
            description: 'Дисциплина отчета для сравнения.'
          }
        },
        required: ['discipline']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'approve_report',
      description: 'Подписать и утвердить отчет (сменит статус на approved и запишется в ауди-лог).',
      parameters: {
        type: 'object',
        properties: {
          discipline: {
            type: 'string',
            description: 'Дисциплина отчета для утверждения.'
          }
        },
        required: ['discipline']
      }
    }
  },
];

// ── Helper: получить org_id юзера ──────────────────────────────────────────

async function getOrgIdForUser(userId: string): Promise<string> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from('pilot_users').select('org_id').eq('user_id', userId).maybeSingle();
  return ((data as any)?.org_id) || 'f0624384-9ed0-56d0-9c0c-abbd2f5ae8dd';
}

// ── TOOL: search_normativka ────────────────────────────────────────────────

async function execSearchNormativka(args: { query: string; limit?: number }, orgId: string) {
  const sb = getSupabaseAdmin();
  const limit = Math.min(Math.max(1, args.limit || 5), 10);

  const hash = createHash('sha256').update(args.query, 'utf8').digest('hex');
  const { data: cached } = await sb.from('agsk_embedding_cache').select('embedding').eq('content_hash', hash).maybeSingle();
  let embedding: number[];
  if (cached?.embedding) {
    embedding = typeof cached.embedding === 'string' ? JSON.parse(cached.embedding) : cached.embedding;
  } else {
    try {
      const resp = await getOpenAI().embeddings.create({ model: 'text-embedding-3-small', input: args.query });
      embedding = resp.data[0].embedding;
      Promise.resolve(sb.rpc('agsk_upsert_embedding_cache', { p_content_hash: hash, p_embedding: embedding })).then(() => {}, () => {});
    } catch (e: any) {
      logger.error({ err: e?.message }, 'embedQuery in tool failed');
      return { error: 'Не удалось получить эмбеддинг для запроса', results: [] };
    }
  }

  const { data, error } = await sb.rpc('agsk_hybrid_search_v2', {
    p_query: args.query, p_query_embedding: embedding, p_org_id: orgId,
    p_limit: limit, p_vector_weight: 0.7, p_bm25_weight: 0.3,
    p_discipline: null, p_standard_code: null, p_version_year: null, p_version_latest_only: true,
  });
  if (error) {
    logger.error({ err: error.message, code: error.code }, 'AGSK RPC in tool failed');
    return { error: 'Поиск временно недоступен: ' + error.message, results: [] };
  }
  const chunks = (data as any[]) || [];
  return {
    found: chunks.length,
    results: chunks.map((c) => ({
      document: c.citation_document || '',
      standard: c.citation_standard || '',
      section: c.citation_section || '',
      page: c.citation_page || 0,
      text: (c.content || c.chunk_text || c.text || '').slice(0, 500),
      score: c.score ?? c.similarity ?? null,
    })),
  };
}

// ── TOOL: create_task ──────────────────────────────────────────────────────

async function execCreateTask(args: { name: string; priority?: string; deadline?: string; description?: string; dept?: string }, projectId: string | number, userId: string, token: string | undefined) {
  if (!projectId) {
    return { error: 'project_id не передан в сессии — задачу создать нельзя' };
  }
  const payload: any = {
    project_id: projectId,
    name: args.name,
    status: 'todo',
    priority: args.priority || 'normal',
    dept: args.dept || 'Общие',
    assigned_to: null, // AI не имеет права назначать (см. validateApplyAction)
  };
  if (args.deadline) {
    payload.deadline = args.deadline;
  } else {
    // DB deadline NOT NULL — default to +30 days when AI omits it
    payload.deadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }
  if (args.description) payload.description = args.description;

  try {
    const created = await createRecord<any>('tasks', payload, token);
    // Publish event for orchestrator
    try {
      const redis = getRedisClient();
      await redis.xadd(
        'task-events', '*',
        'event_type', 'task.created',
        'task_id', String(created.id),
        'project_id', String(created.project_id),
        'user_id', userId,
        'metadata', JSON.stringify({ name: created.name, status: created.status, source: 'chatgpt4' }),
        'timestamp', Date.now().toString(),
      );
    } catch (redisErr: any) {
      logger.warn({ err: redisErr?.message }, 'Failed to publish task.created event from chatgpt4 tool');
    }
    return {
      success: true,
      task_id: created.id,
      name: created.name,
      priority: created.priority,
      status: created.status,
      message: `Задача #${created.id} создана. Оркестратор уведомит участников проекта.`,
    };
  } catch (e: any) {
    logger.error({ err: e?.message }, 'create_task tool failed');
    return { error: 'Не удалось создать задачу: ' + (e?.message || 'unknown') };
  }
}

// ── TOOL: list_drawings ────────────────────────────────────────────────────

async function execListDrawings(args: { discipline?: string; status?: string }, projectId: string | number, token: string | undefined) {
  if (!projectId) {
    return { error: 'project_id не передан в сессии — чертежи получить нельзя' };
  }
  try {
    const filters: Record<string, string> = { project_id: `eq.${projectId}` };
    if (args.discipline) filters.discipline = `eq.${args.discipline}`;
    if (args.status) filters.status = `eq.${args.status}`;
    const drawings = await listRecords<any>('drawings', {
      filters, order: 'created_at.desc', limit: 30, token,
      select: 'id,code,title,discipline,stage,status,revision,due_date',
    });
    return {
      found: drawings.length,
      drawings: drawings.map((d: any) => ({
        id: d.id, code: d.code, title: d.title,
        discipline: d.discipline, status: d.status, revision: d.revision, due_date: d.due_date,
      })),
    };
  } catch (e: any) {
    logger.error({ err: e?.message }, 'list_drawings tool failed');
    return { error: 'Не удалось получить чертежи: ' + (e?.message || 'unknown') };
  }
}

// ── TOOL: list_tasks ──────────────────────────────────────────────────────────

async function execListTasks(args: { status?: string; priority?: string }, projectId: string | number, token: string | undefined) {
  if (!projectId) {
    return { error: 'project_id не передан — задачи получить нельзя' };
  }
  try {
    const filters: Record<string, string> = { project_id: `eq.${projectId}` };
    if (args.status) filters.status = `eq.${args.status}`;
    if (args.priority) filters.priority = `eq.${args.priority}`;
    const tasks = await listRecords<any>('tasks', {
      filters, order: 'created_at.desc', limit: 50, token,
      select: 'id,name,status,priority,deadline,dept,description,assigned_to',
    });
    return {
      found: tasks.length,
      tasks: tasks.map((t: any) => ({
        id: t.id, name: t.name, status: t.status,
        priority: t.priority, deadline: t.deadline,
        dept: t.dept, description: t.description,
        assigned_to: t.assigned_to,
      })),
    };
  } catch (e: any) {
    logger.error({ err: e?.message }, 'list_tasks tool failed');
    return { error: 'Не удалось получить задачи: ' + (e?.message || 'unknown') };
  }
}

// ── fetchProjectSummary — auto-inject project snapshot into system prompt ──────

async function fetchProjectSummary(projectId: string | number | undefined): Promise<string> {
  if (!projectId) return '';
  try {
    const sb = getSupabaseAdmin();

    const [tasksRes, drawingsRes, meetingsRes] = await Promise.allSettled([
      sb.from('tasks').select('id,name,status,priority,deadline,dept').eq('project_id', Number(projectId)).order('created_at', { ascending: false }).limit(30),
      sb.from('drawings').select('id,code,title,discipline,status,revision').eq('project_id', Number(projectId)).order('created_at', { ascending: false }).limit(20),
      sb.from('meetings').select('id,title,meeting_date,participants').eq('project_id', Number(projectId)).order('meeting_date', { ascending: false }).limit(5),
    ]);

    const tasks = tasksRes.status === 'fulfilled' ? (tasksRes.value.data || []) : [];
    const drawings = drawingsRes.status === 'fulfilled' ? (drawingsRes.value.data || []) : [];
    const meetings = meetingsRes.status === 'fulfilled' ? (meetingsRes.value.data || []) : [];

    if (tasks.length === 0 && drawings.length === 0 && meetings.length === 0) return '';

    const todoTasks = tasks.filter((t: any) => t.status === 'todo');
    const inProgressTasks = tasks.filter((t: any) => t.status === 'in_progress');
    const doneTasks = tasks.filter((t: any) => t.status === 'done');

    let summary = '\n\n---\nСНАПШОТ ПРОЕКТА (актуально):\n';

    if (tasks.length > 0) {
      summary += `\nЗАДАЧИ (всего: ${tasks.length}, к выполнению: ${todoTasks.length}, в работе: ${inProgressTasks.length}, выполнено: ${doneTasks.length}):\n`;
      tasks.slice(0, 20).forEach((t: any) => {
        summary += `  • [${t.status}][${t.priority}] ${t.name}${t.dept ? ` (${t.dept})` : ''}${t.deadline ? ` — срок: ${t.deadline}` : ''}\n`;
      });
      if (tasks.length > 20) summary += `  ... и ещё ${tasks.length - 20} задач\n`;
    }

    if (drawings.length > 0) {
      summary += `\nЧЕРТЕЖИ (всего: ${drawings.length}):\n`;
      drawings.slice(0, 10).forEach((d: any) => {
        summary += `  • ${d.code || '?'} — ${d.title} [${d.status}] ${d.revision || ''} ${d.discipline ? `(${d.discipline})` : ''}\n`;
      });
      if (drawings.length > 10) summary += `  ... и ещё ${drawings.length - 10} чертежей\n`;
    }

    if (meetings.length > 0) {
      summary += `\nПОСЛЕДНИЕ СОВЕЩАНИЯ:\n`;
      meetings.forEach((m: any) => {
        summary += `  • ${m.meeting_date} — ${m.title}\n`;
      });
    }

    summary += '---';
    return summary;
  } catch { return ''; }
}

// ── Helper: Auto-corrector (Normative Validator) ─────────────────────────────

async function validateNormatives(content: string): Promise<{ isValid: boolean; warnings: string[] }> {
  // Mock data: In a real system, query a 'normative_versions' table
  const mockDeprecated = ['ГОСТ 12.1.004-91', 'СНиП 2.04.01-85', 'ГОСТ 32569-2013'];
  // Regex to find common normative patterns
  const normativeRegex = /(?:ГОСТ|СНиП|СП РК|ГОСТ Р|EN|ISO|ASME) [\d.-]+/gi;
  const found = content.match(normativeRegex) || [];
  const warnings: string[] = [];

  found.forEach(ref => {
    const cleanRef = ref.trim();
    if (mockDeprecated.includes(cleanRef)) {
      warnings.push(`ВНИМАНИЕ: Норматив ${cleanRef} помечен как устаревший. Пожалуйста, замените на актуальную версию.`);
    }
  });

  return { isValid: warnings.length === 0, warnings };
}

// ── TOOL: generate_report ────────────────────────────────────────────────────

async function execGenerateReport(
  args: { discipline: string; content: string },
  projectId: string | number,
  userId: string,
  citations: any[] // Список цитат из текущего диалога (нормативы)
) {
  if (!projectId) {
    return { error: 'project_id не передан в сессии — отчет создать нельзя' };
  }
  try {
    // Step 2.1: Validate normatives (Auto-corrector)
    const validation = await validateNormatives(args.content);
    let finalContent = args.content;

    if (!validation.isValid) {
      const warningBlock = '\n\n---\n### ⚠️ АВТО-КОРРЕКТОР: Обнаружены устаревшие нормативы\n' + validation.warnings.map(w => `- ${w}`).join('\n') + '\n---';
      finalContent += warningBlock;
      logger.warn({ warnings: validation.warnings }, 'Normative validator flagged deprecated standards in report.');
    }

    // Stage 2: Capture Context Snapshot для воспроизводимости
    const tzCtx = await fetchProjectContext(projectId);
    const tzVersion = tzCtx ? 'v1.0.0' : 'unknown'; // TODO: Заменить на реальную версию документа
    const normativeReferences = citations.map(c => `${c.standard}::${c.section}::${c.page}`);

    const reportData = {
      projectId: Number(projectId),
      discipline: args.discipline,
      content: finalContent,
      userId,
      contextSnapshot: {
        tzVersion,
        normativeReferences
      }
    };
    const created = await reportManager.generateReport(reportData);
    return {
      success: true,
      report_id: created.id,
      discipline: created.discipline,
      checksum: created.checksum,
      status: created.status,
      validation_warnings: validation.warnings,
      message: `Отчет #${created.id} создан и сохранен в БД с checksum ${created.checksum}.` + (validation.isValid ? '' : ' Обнаружены предупреждения по нормативам.'),
    };
  } catch (e: any) {
    logger.error({ err: e?.message }, 'generate_report tool failed');
    return { error: 'Не удалось создать отчет: ' + (e?.message || 'unknown') };
  }
}


// ── TOOL: fetchProjectContext ─────────────────────────────────────────────
// Reads the project's TZ (technical specification) from project_documents
// where doc_type = 'tz' (uploaded via DocumentsPanel), with Redis cache.

async function fetchProjectContext(projectId: string | number | undefined): Promise<string> {
  if (!projectId) return '';
  const cacheKey = `tz_ctx:${projectId}`;
  try {
    const redis = getRedisClient();
    const cached = await redis.get(cacheKey);
    if (cached) return cached;
  } catch {}

  try {
    const sb = getSupabaseAdmin();

    // Primary: project_documents with doc_type='tz' (DocumentsPanel upload path)
    const { data: tzDoc } = await sb
      .from('project_documents')
      .select('name, storage_path, mime_type')
      .eq('project_id', Number(projectId))
      .eq('doc_type', 'tz')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let contextText = '';
    let fileName = '';

    if (tzDoc?.storage_path) {
      const { data: fileData } = await sb.storage.from('project-files').download(tzDoc.storage_path);
      if (fileData) {
        const buf = Buffer.from(await fileData.arrayBuffer());
        try {
          const pdfParse = _require('pdf-parse');
          const parsed = await pdfParse(buf);
          contextText = (parsed.text || '').trim();
        } catch (e: any) {
          logger.warn({ err: e?.message }, 'pdf-parse failed in fetchProjectContext');
        }
        fileName = tzDoc.name;
      }
    }

    // Fallback: project_assignments (old upload path, if full_text was saved)
    if (!contextText) {
      const { data: pa } = await sb
        .from('project_assignments')
        .select('file_name, full_text')
        .eq('project_id', Number(projectId))
        .eq('is_current', true)
        .maybeSingle();
      if (pa?.full_text) {
        contextText = pa.full_text as string;
        fileName = pa.file_name || '';
      }
    }

    if (!contextText || contextText.length < 30) return '';

    const result = `\n\n---\nТЕХНИЧЕСКОЕ ЗАДАНИЕ ПРОЕКТА: "${fileName}"\n${contextText.slice(0, 4000)}\n---`;

    // Cache for 30 min so repeated chat messages don't re-download the PDF
    try {
      const redis = getRedisClient();
      await redis.setex(cacheKey, 1800, result);
    } catch {}

    return result;
  } catch { return ''; }
}

// ── POST /api/orchestrator ────────────────────────────────────────────────

router.post('/orchestrator', authMiddleware, async (req: Request, res: Response) => {
  const { project_id, message, role, history } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new ApiError(400, 'message is required');
  }
  const callerId = req.user?.id;
  if (!callerId) throw new ApiError(401, 'Authenticated user required');

  const systemPrompt = ROLE_SYSTEM_PROMPTS[role as string] || DEFAULT_SYSTEM_PROMPT;
  const [projectContext, projectSummary] = await Promise.all([
    fetchProjectContext(project_id),
    fetchProjectSummary(project_id),
  ]);
  const finalSystemPrompt = systemPrompt + projectContext + projectSummary;
  const orgId = await getOrgIdForUser(callerId);
  const token = req.headers.authorization?.replace('Bearer ', '');

  // Build history messages (last 8, validated shape)
  const historyMsgs: OpenAI.Chat.ChatCompletionMessageParam[] = Array.isArray(history)
    ? history
        .filter((h: any) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string')
        .slice(-8)
        .map((h: any) => ({ role: h.role, content: h.content.slice(0, 2000) }))
    : [];

  try {
    const openai = getOpenAI();
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: finalSystemPrompt },
      ...historyMsgs,
      { role: 'user', content: message.trim() },
    ];

    const collectedCitations: any[] = [];
    const collectedActions: any[] = [];
    let totalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

    for (let turn = 0; turn < 4; turn++) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o', messages, tools: TOOLS, tool_choice: 'auto',
        temperature: 0.3, max_tokens: 1500,
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
        const reply = msg.content?.trim() || 'Не удалось сформировать ответ.';
        logger.info({ msg: 'orchestrator.chatgpt4', user_id: callerId, project_id, role, turns: turn + 1, citations: collectedCitations.length, actions: collectedActions.length, tokens: totalUsage }, 'ChatGPT 4.0 reply generated');
        return res.json({
          message: reply, agent: 'chatgpt4', model: 'gpt-4o',
          citations: collectedCitations, actions: collectedActions,
          tool_turns: turn, usage: totalUsage,
        });
      }

      for (const tc of msg.tool_calls) {
        let toolResult: any;
        try {
          const args = JSON.parse(tc.function.arguments || '{}');
          if (tc.function.name === 'search_normativka') {
            toolResult = await execSearchNormativka(args, orgId);
            if (toolResult?.results) {
              for (const r of toolResult.results) {
                const key = `${r.standard}::${r.section}::${r.page}`;
                if (!collectedCitations.find((c) => `${c.standard}::${c.section}::${c.page}` === key)) {
                  collectedCitations.push({ document: r.document, standard: r.standard, section: r.section, page: r.page, text: r.text });
                }
              }
            }
          } else if (tc.function.name === 'create_task') {
            toolResult = await execCreateTask(args, project_id, callerId, token);
            if (toolResult?.success) collectedActions.push({ type: 'task_created', task_id: toolResult.task_id, name: toolResult.name });
          } else if (tc.function.name === 'list_drawings') {
            toolResult = await execListDrawings(args, project_id, token);
          } else if (tc.function.name === 'list_tasks') {
            toolResult = await execListTasks(args, project_id, token);
          } else if (tc.function.name === 'get_project_tz') {
            const ctx = await fetchProjectContext(project_id);
            toolResult = ctx || 'ТЗ для проекта не найдено';
          } else if (tc.function.name === 'search_normative_kb') {
            try {
              const sb = getSupabaseAdmin();
              const query = args.query as string;
              const limit = Math.min(Number(args.limit) || 5, 8);
              const embedResp = await getOpenAI().embeddings.create({ model: 'text-embedding-3-small', input: query });
              const embedding = embedResp.data[0].embedding;
              const { data: chunks } = await sb.rpc('search_normative_chunks', {
                query_embedding: JSON.stringify(embedding),
                match_count: limit,
                min_similarity: 0.25,
              });
              if (!chunks?.length) {
                toolResult = { results: [], message: 'Ничего не найдено в локальной базе знаний' };
              } else {
                toolResult = {
                  results: (chunks as any[]).map((c: any) => ({
                    document: c.doc_name,
                    text: c.content,
                    similarity: Math.round(c.similarity * 100) + '%',
                  })),
                };
              }
            } catch (e: any) {
              toolResult = { error: e?.message };
            }
          } else if (tc.function.name === 'check_discipline_collisions') {
            try {
              const ctx = await fetchProjectContext(project_id);
              if (!ctx) {
                toolResult = { error: 'ТЗ проекта не найдено' };
              } else {
                const completion = await getOpenAI().chat.completions.create({
                  model: 'gpt-4o', temperature: 0.2, max_tokens: 1000,
                  messages: [
                    { role: 'system', content: 'Ты — инженер-координатор. Найди противоречия и коллизии между разными разделами ТЗ. Выдай список: Коллизия N: [раздел А] vs [раздел Б] — описание проблемы.' },
                    { role: 'user', content: ctx },
                  ],
                });
                toolResult = { analysis: completion.choices[0]?.message?.content || '' };
              }
            } catch (e: any) {
              toolResult = { error: e?.message };
            }
          } else if (tc.function.name === 'generate_report') {
            toolResult = await execGenerateReport(args, project_id, callerId, collectedCitations);
            if (toolResult?.success) collectedActions.push({ type: 'report_generated', report_id: toolResult.report_id, discipline: toolResult.discipline });
          } else if (tc.function.name === 'diff_reports') {
            toolResult = await execDiffReports(args, project_id);
            if (toolResult?.message) collectedActions.push({ type: 'report_diffed', discipline: args.discipline });
          } else if (tc.function.name === 'approve_report') {
            toolResult = await execApproveReport(args, project_id, callerId);
            if (toolResult?.success) collectedActions.push({ type: 'report_approved', report_id: toolResult.report_id });
          } else {
            toolResult = { error: `Unknown tool: ${tc.function.name}` };
          }
        } catch (e: any) {
          toolResult = { error: 'Tool execution failed: ' + (e?.message || 'unknown') };
        }
        messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(toolResult) });
      }
    }

    return res.json({
      message: 'Ответ слишком длинный, попробуйте уточнить вопрос.',
      agent: 'chatgpt4', model: 'gpt-4o',
      citations: collectedCitations, actions: collectedActions, usage: totalUsage,
    });
  } catch (err: any) {
    logger.error({ err: err?.message, status: err?.status }, 'orchestrator.chatgpt4 failed');
    if (err instanceof ApiError) throw err;
    if (err?.status === 401 || err?.code === 'invalid_api_key') throw new ApiError(503, 'OpenAI authentication failed — check OPENAI_API_KEY');
    if (err?.status === 429) throw new ApiError(429, 'OpenAI rate limit reached — try again shortly');
    throw new ApiError(500, 'ChatGPT 4.0 request failed: ' + (err?.message || 'unknown'));
  }
});

export default router;
