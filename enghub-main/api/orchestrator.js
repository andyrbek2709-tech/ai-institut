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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { user_id, project_id, message, use_rag, action, query, role = 'engineer', payload = {} } = req.body;
    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };

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

    if (action === 'validate_workflow') {
      const fromStatus = payload.from_status;
      const toStatus = payload.to_status;
      const allowed = (TASK_TRANSITIONS[fromStatus] || []).includes(toStatus);
      return res.status(200).json({
        success: allowed,
        agent: 'workflow_agent',
        blocked: !allowed,
        message: allowed
          ? `Переход ${fromStatus} → ${toStatus} допустим.`
          : `Переход ${fromStatus || '?'} → ${toStatus || '?'} запрещён workflow.`,
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

    const intent = detectIntent(message);

    if (intent === 'workflow_transition') {
      const fromStatus = payload.from_status;
      const toStatus = payload.to_status;
      const allowed = (TASK_TRANSITIONS[fromStatus] || []).includes(toStatus);
      if (!allowed) {
        return res.status(200).json({
          success: false,
          agent: 'workflow_agent',
          blocked: true,
          message: `Переход ${fromStatus || '?'} → ${toStatus || '?'} запрещён workflow.`,
        });
      }
      return res.status(200).json({
        success: true,
        agent: 'workflow_agent',
        message: `Переход ${fromStatus} → ${toStatus} допустим.`,
      });
    }

    const pRes = await fetch(`${SURL}/rest/v1/projects?id=eq.${project_id}`, { headers });
    const pData = await pRes.json();
    const depts = pData?.[0]?.depts || [];

    let insertData = null;
    let responseMessage = `${ROLE_PROMPTS[role] || ROLE_PROMPTS.engineer} Запрос принят.`;

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
    } else if (intent === 'create_drawing') {
      const autoCode = `AI-${String(project_id)}-${Date.now().toString().slice(-6)}`;
      insertData = {
        project_id,
        user_id,
        action_type: 'create_drawing',
        agent_type: 'drawing_agent',
        payload: { code: payload.code || autoCode, title: payload.title || 'Новый чертеж', discipline: payload.discipline || null },
        status: 'pending',
      };
      responseMessage = 'Drawing Agent подготовил карточку нового чертежа.';
    } else if (intent === 'update_drawing') {
      if (!payload.drawing_id) {
        return res.status(200).json({
          success: false,
          agent: 'drawing_agent',
          blocked: true,
          message: 'Для обновления чертежа нужен payload.drawing_id',
        });
      }
      insertData = {
        project_id,
        user_id,
        action_type: 'update_drawing',
        agent_type: 'drawing_agent',
        payload: { drawing_id: payload.drawing_id, updates: payload.updates || {} },
        status: 'pending',
      };
      responseMessage = 'Drawing Agent подготовил обновление чертежа.';
    } else if (intent === 'drawing_revision') {
      if (!payload.drawing_id) {
        return res.status(200).json({
          success: false,
          agent: 'drawing_agent',
          blocked: true,
          message: 'Для выпуска ревизии нужен payload.drawing_id',
        });
      }
      insertData = {
        project_id,
        user_id,
        action_type: 'create_drawing_revision',
        agent_type: 'drawing_agent',
        payload: { drawing_id: payload.drawing_id, note: payload.note || 'Ревизия по запросу Copilot' },
        status: 'pending',
      };
      responseMessage = 'Drawing Agent подготовил выпуск новой ревизии.';
    } else if (intent === 'create_review') {
      insertData = {
        project_id,
        user_id,
        action_type: 'create_review',
        agent_type: 'review_agent',
        payload: { title: payload.title || message, severity: payload.severity || 'major', drawing_id: payload.drawing_id || null },
        status: 'pending',
      };
      responseMessage = 'Review Agent подготовил замечание на подтверждение.';
    } else if (intent === 'create_transmittal') {
      insertData = {
        project_id,
        user_id,
        action_type: 'create_transmittal',
        agent_type: 'register_agent',
        payload: { number: payload.number || null, recipient: payload.recipient || null, note: payload.note || null },
        status: 'pending',
      };
      responseMessage = 'Register Agent подготовил трансмиттал.';
    }

    if (!insertData) {
      return res.status(200).json({
        success: true,
        agent: 'router',
        message: `${ROLE_PROMPTS[role] || ROLE_PROMPTS.engineer} Уточните операцию: задачи, чертежи, ревизии, замечания или трансмитталы.`,
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
