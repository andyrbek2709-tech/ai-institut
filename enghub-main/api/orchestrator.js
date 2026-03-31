const SURL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

module.exports = async function handler(req, res) {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { user_id, project_id, message, use_rag, action, query } = req.body;

    // --- Семантический поиск по нормативной базе (из UI Нормативки) ---
    if (action === 'search_normative') {
      if (!query || !query.trim()) {
        return res.status(400).json({ error: 'query required' });
      }
      if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: 'OPENAI_API_KEY not configured' });
      }
      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: query.trim() }),
      });
      if (!embRes.ok) throw new Error('OpenAI embeddings failed');
      const embData = await embRes.json();
      const queryEmbedding = embData.data[0].embedding;

      const searchRes = await fetch(`${SURL}/rest/v1/rpc/search_normative`, {
        method: 'POST',
        headers: { 'apikey': SERVICE_KEY, 'Authorization': `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify({ query_embedding: queryEmbedding, match_count: req.body.match_count || 20 }),
      });
      const results = await searchRes.json();
      return res.status(200).json(Array.isArray(results) ? results : []);
    }

    if (!user_id || !project_id || !message) {
      return res.status(400).json({ error: 'Missing required fields: user_id, project_id, message' });
    }

    const headers = {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json'
    };

    // --- RAG Mode: поиск по нормативной базе ---
    if (use_rag && OPENAI_API_KEY && ANTHROPIC_API_KEY) {
      // 1. Векторизовать вопрос через OpenAI
      const embRes = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'text-embedding-3-small', input: message }),
      });

      if (!embRes.ok) throw new Error('OpenAI embeddings failed');
      const embData = await embRes.json();
      const queryEmbedding = embData.data[0].embedding;

      // 2. Семантический поиск в normative_chunks через pgvector
      const searchRes = await fetch(`${SURL}/rest/v1/rpc/search_normative`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify({ query_embedding: queryEmbedding, match_count: 5 }),
      });

      const chunks = await searchRes.json();
      const hasContext = Array.isArray(chunks) && chunks.length > 0;

      // 3. Сформировать ответ через Claude
      const systemPrompt = hasContext
        ? 'Ты — AI-помощник для инженеров проектного института. Отвечай ТОЛЬКО на основе предоставленных фрагментов нормативных документов. Если ответ не найден в документах — скажи об этом явно. Всегда указывай источник (название документа).'
        : 'Ты — AI-помощник для инженеров проектного института. Нормативная база не содержит информации по данному запросу. Дай общий ответ на основе своих знаний, но предупреди пользователя, что в базе документы не найдены.';

      const contextText = hasContext
        ? chunks.map((c, i) => `[${i + 1}] ${c.doc_name}:\n${c.content}`).join('\n\n---\n\n')
        : '';

      const userMessage = hasContext
        ? `Фрагменты из нормативной базы:\n\n${contextText}\n\n---\n\nВопрос: ${message}`
        : message;

      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (!claudeRes.ok) throw new Error('Claude API failed');
      const claudeData = await claudeRes.json();
      const answer = claudeData.content[0].text;
      const sources = hasContext ? [...new Set(chunks.map(c => c.doc_name))].join(', ') : null;

      return res.status(200).json({
        success: true,
        agent: 'rag_assistant',
        message: answer,
        sources,
        chunks_found: hasContext ? chunks.length : 0,
      });
    }

    // --- Task Mode: создание задач ---
    const pRes = await fetch(`${SURL}/rest/v1/projects?id=eq.${project_id}`, { headers });
    const pData = await pRes.json();
    const depts = pData?.[0]?.depts || [];

    const msgLower = message.toLowerCase();
    let intent = 'unknown';

    if (/задач|сделай|создай|task|план|график/.test(msgLower)) {
      intent = 'create_tasks';
    }

    if (intent === 'create_tasks') {
      let generatedTasks = [];

      if (depts.length > 0) {
        generatedTasks.push({ title: 'Анализ исходной документации (AI Draft)', dept_id: depts[0], priority: 'medium' });
        if (depts.length > 1) {
          generatedTasks.push({ title: 'Подготовка технических решений (AI Draft)', dept_id: depts[1], priority: 'high' });
          generatedTasks.push({ title: 'Выпуск чертежей стадии П (AI Draft)', dept_id: depts[1], priority: 'high' });
        } else {
          generatedTasks.push({ title: 'Разработка проектной документации', dept_id: depts[0], priority: 'high' });
        }
      } else {
        generatedTasks = [
          { title: 'Определить объемы работ', dept_id: null, priority: 'high' },
          { title: 'Запросить исходные данные у заказчика', dept_id: null, priority: 'medium' }
        ];
      }

      const payload = {
        tasks: generatedTasks,
        reasoning: 'Сгенерировано агентом Task_Manager на основе списка профильных отделов проекта.'
      };

      const insertData = {
        project_id,
        user_id,
        action_type: 'create_tasks',
        agent_type: 'task_manager',
        payload,
        status: 'pending'
      };

      const insertRes = await fetch(`${SURL}/rest/v1/ai_actions`, {
        method: 'POST',
        headers: { ...headers, 'Prefer': 'return=representation' },
        body: JSON.stringify(insertData)
      });

      const result = await insertRes.json();

      return res.status(200).json({
        success: true,
        agent: 'task_manager',
        action_id: result[0]?.id,
        message: 'Я проанализировал запрос. Delegate: Task_Manager_Agent. Высылаю план действий на утверждение.'
      });
    }

    return res.status(200).json({
      success: true,
      agent: 'router',
      message: 'Понял вас. Если потребуется создать задачи, проверить конфликты или сгенерировать отчет — просто напишите мне. Для поиска по нормативной базе включите переключатель "База знаний".'
    });

  } catch (err) {
    console.error('Orchestrator Error:', err);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};
