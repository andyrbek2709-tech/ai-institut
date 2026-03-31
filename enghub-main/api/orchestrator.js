const SURL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const TASK_TRANSITIONS = {
  todo: ['inprogress'],
  inprogress: ['review_lead'],
  review_lead: ['review_gip', 'revision'],
  review_gip: ['done', 'revision'],
  revision: ['inprogress'],
  done: ['revision'],
};

const ROLE_PROMPTS = {
  gip: 'Ты помощник ГИПа: приоритет срокам, рискам и координации между отделами.',
  lead: 'Ты помощник руководителя отдела: контроль загрузки и качества задач команды.',
  engineer: 'Ты помощник инженера: конкретные шаги выполнения, входные данные и критерии готовности.',
};

const ROLE_ALLOWED_INTENTS = {
  gip: ['create_tasks', 'create_drawing', 'update_drawing', 'drawing_revision', 'create_review', 'create_transmittal', 'workflow_transition', 'unknown'],
  lead: ['create_tasks', 'create_drawing', 'update_drawing', 'drawing_revision', 'create_review', 'create_transmittal', 'workflow_transition', 'unknown'],
  engineer: ['create_tasks', 'create_review', 'workflow_transition', 'unknown'],
};

const ROLE_ALLOWED_ACTIONS = {
  gip: ['search_normative', 'validate_workflow', 'create_drawing', 'update_drawing', 'create_drawing_revision', 'create_revision', 'create_review', 'update_review_status', 'create_transmittal', 'update_transmittal_status'],
  lead: ['search_normative', 'validate_workflow', 'create_drawing', 'update_drawing', 'create_drawing_revision', 'create_revision', 'create_review', 'update_review_status', 'create_transmittal', 'update_transmittal_status'],
  engineer: ['search_normative', 'validate_workflow', 'create_review', 'update_review_status'],
};

async function createEmbedding(input) {
  const embRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'text-embedding-3-small', input }),
  });
  if (!embRes.ok) throw new Error('OpenAI embeddings failed');
  const embData = await embRes.json();
  return embData.data[0].embedding;
}

function detectIntent(message = '') {
  const msg = message.toLowerCase();
  if (/чертеж|drawing/.test(msg)) {
    if (/ревизи|revision/.test(msg)) return 'drawing_revision';
    if (/обнов|update|измени/.test(msg)) return 'update_drawing';
    return 'create_drawing';
  }
  if (/workflow|переход|статус|проверк/.test(msg)) return 'workflow_transition';
  if (/замечан|review/.test(msg)) return 'create_review';
  if (/трансмит|transmittal|register/.test(msg)) return 'create_transmittal';
  if (/задач|сделай|создай|task|план|график/.test(msg)) return 'create_tasks';
  return 'unknown';
}

function blockedResponse({ agent = 'router', message, reason_code = 'blocked', next_step = null, extra = {} }) {
  return {
    success: false,
    blocked: true,
    agent,
    reason_code,
    message,
    next_step,
    ...extra,
  };
}

function buildDrawingAction(actionType, project_id, user_id, payload = {}) {
  if (actionType === 'create_drawing') {
    const autoCode = `AI-${String(project_id)}-${Date.now().toString().slice(-6)}`;
    return {
      ok: true,
      insertData: {
        project_id,
        user_id,
        action_type: 'create_drawing',
        agent_type: 'drawing_agent',
        payload: {
          code: payload.code || autoCode,
          title: payload.title || 'Новый чертеж',
          discipline: payload.discipline || null,
        },
        status: 'pending',
      },
      message: 'Drawing Agent подготовил карточку нового чертежа.',
    };
  }

  if (actionType === 'update_drawing') {
    if (!payload.drawing_id) {
      return { ok: false, blocked: true, reason_code: 'missing_drawing_id', message: 'Для обновления чертежа нужен payload.drawing_id', next_step: 'Передайте drawing_id существующего чертежа и объект updates.' };
    }
    return {
      ok: true,
      insertData: {
        project_id,
        user_id,
        action_type: 'update_drawing',
        agent_type: 'drawing_agent',
        payload: { drawing_id: payload.drawing_id, updates: payload.updates || {} },
        status: 'pending',
      },
      message: 'Drawing Agent подготовил обновление чертежа.',
    };
  }

  if (actionType === 'create_drawing_revision' || actionType === 'create_revision') {
    if (!payload.drawing_id) {
      return { ok: false, blocked: true, reason_code: 'missing_drawing_id', message: 'Для выпуска ревизии нужен payload.drawing_id', next_step: 'Передайте drawing_id чертежа, для которого требуется новая ревизия.' };
    }
    const normalizedAction = actionType === 'create_revision' ? 'create_revision' : 'create_drawing_revision';
    return {
      ok: true,
      insertData: {
        project_id,
        user_id,
        action_type: normalizedAction,
        agent_type: 'revision_agent',
        payload: { drawing_id: payload.drawing_id, note: payload.note || 'Ревизия по запросу Copilot' },
        status: 'pending',
      },
      message: 'Revision Agent подготовил выпуск новой ревизии.',
    };
  }

  return { ok: false, blocked: true, reason_code: 'unsupported_action', message: 'Неподдерживаемое drawing действие', next_step: 'Используйте create_drawing, update_drawing, create_drawing_revision или create_revision.' };
}

function buildReviewAction(actionType, project_id, user_id, payload = {}) {
  if (actionType === 'create_review') {
    if (!payload.title || !String(payload.title).trim()) {
      return { ok: false, blocked: true, reason_code: 'missing_title', message: 'Для замечания нужен payload.title', next_step: 'Передайте непустой title для карточки замечания.' };
    }
    return {
      ok: true,
      insertData: {
        project_id,
        user_id,
        action_type: 'create_review',
        agent_type: 'review_agent',
        payload: {
          title: String(payload.title).trim(),
          severity: payload.severity || 'major',
          drawing_id: payload.drawing_id || null,
          assignee_id: payload.assignee_id || null,
        },
        status: 'pending',
      },
      message: 'Review Agent подготовил замечание на подтверждение.',
    };
  }

  if (actionType === 'update_review_status') {
    if (!payload.review_id) {
      return { ok: false, blocked: true, reason_code: 'missing_review_id', message: 'Для обновления замечания нужен payload.review_id', next_step: 'Передайте review_id записи и целевой status.' };
    }
    if (!payload.status) {
      return { ok: false, blocked: true, reason_code: 'missing_status', message: 'Для обновления замечания нужен payload.status', next_step: 'Укажите status: open, in_progress, resolved или rejected.' };
    }
    return {
      ok: true,
      insertData: {
        project_id,
        user_id,
        action_type: 'update_review_status',
        agent_type: 'review_agent',
        payload: {
          review_id: payload.review_id,
          status: payload.status,
          note: payload.note || null,
        },
        status: 'pending',
      },
      message: 'Review Agent подготовил изменение статуса замечания.',
    };
  }

  return { ok: false, blocked: true, reason_code: 'unsupported_action', message: 'Неподдерживаемое review действие', next_step: 'Используйте create_review или update_review_status.' };
}

function buildTransmittalAction(actionType, project_id, user_id, payload = {}) {
  if (actionType === 'create_transmittal') {
    return {
      ok: true,
      insertData: {
        project_id,
        user_id,
        action_type: 'create_transmittal',
        agent_type: 'register_agent',
        payload: {
          number: payload.number || null,
          recipient: payload.recipient || null,
          note: payload.note || null,
          items: Array.isArray(payload.items) ? payload.items : [],
        },
        status: 'pending',
      },
      message: 'Register Agent подготовил трансмиттал.',
    };
  }

  if (actionType === 'update_transmittal_status') {
    if (!payload.transmittal_id) {
      return { ok: false, blocked: true, reason_code: 'missing_transmittal_id', message: 'Для обновления трансмиттала нужен payload.transmittal_id', next_step: 'Передайте transmittal_id и целевой status.' };
    }
    if (!payload.status) {
      return { ok: false, blocked: true, reason_code: 'missing_status', message: 'Для обновления трансмиттала нужен payload.status', next_step: 'Укажите status: draft, issued или cancelled.' };
    }
    return {
      ok: true,
      insertData: {
        project_id,
        user_id,
        action_type: 'update_transmittal_status',
        agent_type: 'register_agent',
        payload: {
          transmittal_id: payload.transmittal_id,
          status: payload.status,
        },
        status: 'pending',
      },
      message: 'Register Agent подготовил изменение статуса трансмиттала.',
    };
  }

  return { ok: false, blocked: true, reason_code: 'unsupported_action', message: 'Неподдерживаемое transmittal действие', next_step: 'Используйте create_transmittal или update_transmittal_status.' };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user_id, project_id, message, use_rag, action, query, role = 'engineer', payload = {} } = req.body;
    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
    const currentRole = ['gip', 'lead', 'engineer'].includes(role) ? role : 'engineer';
    const rolePrompt = ROLE_PROMPTS[currentRole] || ROLE_PROMPTS.engineer;

    if (action === 'search_normative') {
      if (!query || !query.trim()) return res.status(400).json({ error: 'query required' });
      if (!OPENAI_API_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
      const queryEmbedding = await createEmbedding(query.trim());
      const searchRes = await fetch(`${SURL}/rest/v1/rpc/search_normative`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ query_embedding: queryEmbedding, match_count: req.body.match_count || 20 }),
      });
      const results = await searchRes.json();
      return res.status(200).json(Array.isArray(results) ? results : []);
    }

    if (action && action !== 'search_normative' && action !== 'validate_workflow') {
      const allowedActions = ROLE_ALLOWED_ACTIONS[currentRole] || ROLE_ALLOWED_ACTIONS.engineer;
      if (!allowedActions.includes(action)) {
        return res.status(200).json(blockedResponse({
          agent: 'router',
          reason_code: 'action_not_allowed',
          message: `${rolePrompt} Операция "${action}" недоступна для роли ${currentRole}.`,
          next_step: `Доступные операции для роли ${currentRole}: ${allowedActions.join(', ')}.`,
        }));
      }
    }

    if (action === 'validate_workflow') {
      const fromStatus = payload.from_status;
      const toStatus = payload.to_status;
      if (!fromStatus || !toStatus) {
        return res.status(200).json(blockedResponse({
          agent: 'workflow_agent',
          reason_code: 'missing_status',
          message: 'Для проверки workflow нужны from_status и to_status.',
          next_step: 'Передайте payload.from_status и payload.to_status.',
        }));
      }
      const allowedNext = TASK_TRANSITIONS[fromStatus] || [];
      const allowed = (TASK_TRANSITIONS[fromStatus] || []).includes(toStatus);
      return res.status(200).json({
        success: allowed,
        agent: 'workflow_agent',
        blocked: !allowed,
        reason_code: allowed ? 'ok' : 'invalid_transition',
        allowed_next: allowedNext,
        next_step: allowed ? null : `Выберите один из допустимых переходов: ${allowedNext.join(', ') || 'нет переходов'}.`,
        message: allowed
          ? `Переход ${fromStatus} → ${toStatus} допустим.`
          : `Переход ${fromStatus} → ${toStatus} запрещён workflow. Допустимо: ${allowedNext.join(', ') || 'нет переходов'}.`,
      });
    }

    if (!user_id || !project_id || !message) {
      return res.status(400).json({ error: 'Missing required fields: user_id, project_id, message' });
    }

    if (use_rag && OPENAI_API_KEY && ANTHROPIC_API_KEY) {
      const queryEmbedding = await createEmbedding(message);
      const searchRes = await fetch(`${SURL}/rest/v1/rpc/search_normative`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ query_embedding: queryEmbedding, match_count: 5 }),
      });
      const chunks = await searchRes.json();
      const hasContext = Array.isArray(chunks) && chunks.length > 0;
      const contextText = hasContext ? chunks.map((c, i) => `[${i + 1}] ${c.doc_name}:\n${c.content}`).join('\n\n---\n\n') : '';
      const userMessage = hasContext ? `Фрагменты:\n${contextText}\n\nВопрос: ${message}` : message;
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: hasContext
            ? 'Отвечай только по предоставленным фрагментам, и указывай источники.'
            : 'Документов в базе по запросу не найдено. Дай общий ответ и предупреди об этом.',
          messages: [{ role: 'user', content: userMessage }],
        }),
      });
      if (!claudeRes.ok) throw new Error('Claude API failed');
      const claudeData = await claudeRes.json();
      return res.status(200).json({
        success: true,
        agent: 'rag_assistant',
        message: claudeData.content?.[0]?.text || 'Ответ недоступен',
        sources: hasContext ? [...new Set(chunks.map((c) => c.doc_name))].join(', ') : null,
        chunks_found: hasContext ? chunks.length : 0,
      });
    }

    // Explicit action contract for Copilot/clients
    if (action === 'create_drawing' || action === 'update_drawing' || action === 'create_drawing_revision' || action === 'create_revision') {
      const result = buildDrawingAction(action, project_id, user_id, payload);
      if (!result.ok) {
        return res.status(200).json(blockedResponse({
          agent: action === 'create_revision' || action === 'create_drawing_revision' ? 'revision_agent' : 'drawing_agent',
          reason_code: result.reason_code || 'drawing_action_blocked',
          message: result.message || 'Drawing action blocked',
          next_step: result.next_step || null,
        }));
      }
      const insertRes = await fetch(`${SURL}/rest/v1/ai_actions`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(result.insertData),
      });
      const inserted = await insertRes.json();
      return res.status(200).json({
        success: true,
        agent: result.insertData.agent_type,
        action_id: inserted?.[0]?.id,
        action_type: result.insertData.action_type,
        message: result.message,
      });
    }

    if (action === 'create_review' || action === 'update_review_status') {
      const result = buildReviewAction(action, project_id, user_id, payload);
      if (!result.ok) {
        return res.status(200).json(blockedResponse({
          agent: 'review_agent',
          reason_code: result.reason_code || 'review_action_blocked',
          message: result.message || 'Review action blocked',
          next_step: result.next_step || null,
        }));
      }
      const insertRes = await fetch(`${SURL}/rest/v1/ai_actions`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(result.insertData),
      });
      const inserted = await insertRes.json();
      return res.status(200).json({
        success: true,
        agent: 'review_agent',
        action_id: inserted?.[0]?.id,
        action_type: result.insertData.action_type,
        message: result.message,
      });
    }

    if (action === 'create_transmittal' || action === 'update_transmittal_status') {
      const result = buildTransmittalAction(action, project_id, user_id, payload);
      if (!result.ok) {
        return res.status(200).json(blockedResponse({
          agent: 'register_agent',
          reason_code: result.reason_code || 'transmittal_action_blocked',
          message: result.message || 'Transmittal action blocked',
          next_step: result.next_step || null,
        }));
      }
      const insertRes = await fetch(`${SURL}/rest/v1/ai_actions`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(result.insertData),
      });
      const inserted = await insertRes.json();
      return res.status(200).json({
        success: true,
        agent: 'register_agent',
        action_id: inserted?.[0]?.id,
        action_type: result.insertData.action_type,
        message: result.message,
      });
    }

    const intent = detectIntent(message);
    const allowedIntents = ROLE_ALLOWED_INTENTS[currentRole] || ROLE_ALLOWED_INTENTS.engineer;
    if (!allowedIntents.includes(intent)) {
      return res.status(200).json(blockedResponse({
        agent: 'router',
        reason_code: 'intent_not_allowed',
        message: `${rolePrompt} Намерение "${intent}" недоступно для роли ${currentRole}.`,
        next_step: `Разрешенные намерения: ${allowedIntents.join(', ')}.`,
      }));
    }

    if (intent === 'workflow_transition') {
      const fromStatus = payload.from_status;
      const toStatus = payload.to_status;
      if (!fromStatus || !toStatus) {
        return res.status(200).json(blockedResponse({
          agent: 'workflow_agent',
          reason_code: 'missing_status',
          message: 'Для проверки workflow нужны from_status и to_status.',
          next_step: 'Передайте payload.from_status и payload.to_status.',
        }));
      }
      const allowedNext = TASK_TRANSITIONS[fromStatus] || [];
      const allowed = (TASK_TRANSITIONS[fromStatus] || []).includes(toStatus);
      if (!allowed) {
        return res.status(200).json(blockedResponse({
          agent: 'workflow_agent',
          reason_code: 'invalid_transition',
          message: `Переход ${fromStatus} → ${toStatus} запрещён workflow. Допустимо: ${allowedNext.join(', ') || 'нет переходов'}.`,
          next_step: `Выберите один из допустимых переходов: ${allowedNext.join(', ') || 'нет переходов'}.`,
          extra: { allowed_next: allowedNext },
        }));
      }
      return res.status(200).json({
        success: true,
        agent: 'workflow_agent',
        reason_code: 'ok',
        allowed_next: allowedNext,
        message: `Переход ${fromStatus} → ${toStatus} допустим.`,
      });
    }

    const pRes = await fetch(`${SURL}/rest/v1/projects?id=eq.${project_id}`, { headers });
    const pData = await pRes.json();
    const depts = pData?.[0]?.depts || [];

    let insertData = null;
    let responseMessage = `${rolePrompt} Запрос принят.`;

    if (intent === 'create_tasks') {
      const tasks = depts.length > 0
        ? [
            { title: 'Анализ исходной документации (AI Draft)', dept_id: depts[0], priority: 'medium' },
            { title: 'Подготовка технических решений (AI Draft)', dept_id: depts[1] || depts[0], priority: 'high' },
          ]
        : [
            { title: 'Определить объемы работ', dept_id: null, priority: 'high' },
            { title: 'Запросить исходные данные у заказчика', dept_id: null, priority: 'medium' },
          ];
      insertData = { project_id, user_id, action_type: 'create_tasks', agent_type: 'task_manager', payload: { tasks }, status: 'pending' };
      responseMessage = 'Task Manager подготовил пакет задач на утверждение.';
    } else if (intent === 'create_drawing' || intent === 'update_drawing' || intent === 'drawing_revision') {
      const drawingActionType = intent === 'drawing_revision' ? 'create_revision' : intent;
      const result = buildDrawingAction(drawingActionType, project_id, user_id, payload);
      if (!result.ok) {
        return res.status(200).json(blockedResponse({
          agent: drawingActionType === 'create_revision' ? 'revision_agent' : 'drawing_agent',
          reason_code: result.reason_code || 'drawing_action_blocked',
          message: result.message || 'Drawing action blocked',
          next_step: result.next_step || null,
        }));
      }
      insertData = result.insertData;
      responseMessage = result.message;
    } else if (intent === 'create_review') {
      const result = buildReviewAction('create_review', project_id, user_id, { ...payload, title: payload.title || message });
      if (!result.ok) {
        return res.status(200).json(blockedResponse({
          agent: 'review_agent',
          reason_code: result.reason_code || 'review_action_blocked',
          message: result.message || 'Review action blocked',
          next_step: result.next_step || null,
        }));
      }
      insertData = result.insertData;
      responseMessage = result.message;
    } else if (intent === 'create_transmittal') {
      const result = buildTransmittalAction('create_transmittal', project_id, user_id, payload);
      if (!result.ok) {
        return res.status(200).json(blockedResponse({
          agent: 'register_agent',
          reason_code: result.reason_code || 'transmittal_action_blocked',
          message: result.message || 'Transmittal action blocked',
          next_step: result.next_step || null,
        }));
      }
      insertData = result.insertData;
      responseMessage = result.message;
    }

    if (!insertData) {
      return res.status(200).json({
        success: true,
        agent: 'router',
        message: `${rolePrompt} Уточните операцию: задачи, чертежи, ревизии, замечания или трансмитталы.`,
      });
    }

    const insertRes = await fetch(`${SURL}/rest/v1/ai_actions`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify(insertData),
    });
    const result = await insertRes.json();

    return res.status(200).json({
      success: true,
      agent: insertData.agent_type,
      action_id: result?.[0]?.id,
      action_type: insertData.action_type,
      message: responseMessage,
    });
  } catch (err) {
    console.error('Orchestrator Error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};
