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
  gip: ['create_tasks', 'create_drawing', 'update_drawing', 'drawing_revision', 'create_review', 'create_transmittal', 'workflow_transition', 'project_insights', 'smart_decompose', 'compliance_check', 'generate_report', 'nl_search', 'risk_forecast', 'unknown'],
  lead: ['create_tasks', 'create_drawing', 'update_drawing', 'drawing_revision', 'create_review', 'create_transmittal', 'workflow_transition', 'project_insights', 'smart_decompose', 'compliance_check', 'generate_report', 'nl_search', 'risk_forecast', 'unknown'],
  engineer: ['create_tasks', 'create_review', 'workflow_transition', 'project_insights', 'compliance_check', 'nl_search', 'unknown'],
};

const ROLE_ALLOWED_ACTIONS = {
  gip: ['search_normative', 'validate_workflow', 'task_suggest', 'analyze_drawing', 'norm_control', 'create_drawing', 'update_drawing', 'create_drawing_revision', 'create_revision', 'create_review', 'update_review_status', 'create_transmittal', 'update_transmittal_status'],
  lead: ['search_normative', 'validate_workflow', 'task_suggest', 'analyze_drawing', 'norm_control', 'create_drawing', 'update_drawing', 'create_drawing_revision', 'create_revision', 'create_review', 'update_review_status', 'create_transmittal', 'update_transmittal_status'],
  engineer: ['search_normative', 'validate_workflow', 'task_suggest', 'analyze_drawing', 'norm_control', 'create_review', 'update_review_status'],
};

const COPILOT_BASE_SYSTEM_PROMPT = `You are an AI Copilot inside EngHub — an engineering project management system.

Your role is ASSISTANT, not decision-maker.

CORE PRINCIPLE:
You NEVER execute actions.
You ONLY suggest.
The user ALWAYS confirms.

---

ACTION LEVELS:

LEVEL 1 — INFO:

* analyze project data
* answer questions
* identify risks
* generate reports

Rules:

* text only
* no JSON actions
* no database changes

---

LEVEL 2 — SUGGEST:

* creating tasks
* creating reviews
* generating plans
* suggesting deadlines

Rules:

* ALWAYS return structured JSON
* MUST be confirmed by user
* NEVER assume execution

JSON format:
{
"type": "<action_type>",
"items": [...]
}

---

LEVEL 3 — ACTION (FORBIDDEN):

* change task statuses
* assign users
* delete anything
* write to database

---

LANGUAGE RULES:
Use:

* "Предположительно"
* "Рекомендую"
* "На основе текущих данных"
* "Возможно"

Do NOT say:

* "Я создал"
* "Готово"
* "Выполнено"

---

DATA RULES:
Use ONLY provided data:

* tasks
* drawings
* reviews
* deadlines
* time_entries

If data is missing:
Respond:
"Недостаточно данных для точного анализа."

---

RESPONSE STRUCTURE:

For INFO:
Анализ:
Риски:
Рекомендации:
Confidence: low | medium | high

---

For SUGGEST:

1. Short explanation
2. JSON action

---

FAIL-SAFE:
If unsure → do NOT guess → say insufficient data

---

OUTPUT STYLE:

* concise
* structured
* professional

---

FINAL RULE:
If there is ANY doubt → DO NOT act → ONLY suggest or decline.`;

function buildSystemPrompt(agentSpecificPrompt = '') {
  const specific = String(agentSpecificPrompt || '').trim();
  if (!specific) return COPILOT_BASE_SYSTEM_PROMPT;
  return `${COPILOT_BASE_SYSTEM_PROMPT}\n\n---\n\nAGENT-SPECIFIC CONTEXT:\n${specific}`;
}

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
  // New AI agents — checked first to avoid conflicts with generic patterns
  if (/нормоконтроль|проверь.{0,25}норм|соответстви.{0,20}норм|проверка.{0,20}нормам/.test(msg)) return 'compliance_check';
  if (/еженедельн|недельн.*отчет|сформируй.*отчет|generate.report|status.report/.test(msg)) return 'generate_report';
  if (/риск.*проект|прогноз.*риск|когда завершим|velocity|отстаём|срыв.*срок|анализ.*риск/.test(msg)) return 'risk_forecast';
  if (/как дела|состояние проект|аналитик|что происходит|покажи состоян|анализ проект/.test(msg)) return 'project_insights';
  if (/план задач|декомпозиц|разбей на задач|разработай план|составь задач|список задач/.test(msg)) return 'smart_decompose';
  if (/найди задач|покажи задач|задачи.{0,20}(где|которые|с|без|просроч)|поиск.{0,20}задач/.test(msg)) return 'nl_search';
  // Existing patterns
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

// ── AI Agent Handlers ────────────────────────────────────────────────────────

async function callClaude(agentSpecificPrompt, userContent, maxTokens = 600) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system: buildSystemPrompt(agentSpecificPrompt),
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!res.ok) throw new Error('Claude API failed: ' + res.status);
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

async function handleProjectInsights(project_id, role, headers) {
  if (!ANTHROPIC_API_KEY) return { message: 'Anthropic API не настроен.' };
  const [tasksRes, drawingsRes, reviewsRes, transmittalsRes, projectRes] = await Promise.all([
    fetch(`${SURL}/rest/v1/tasks?project_id=eq.${project_id}&select=status,deadline`, { headers }),
    fetch(`${SURL}/rest/v1/drawings?project_id=eq.${project_id}&select=status`, { headers }),
    fetch(`${SURL}/rest/v1/reviews?project_id=eq.${project_id}&select=status`, { headers }),
    fetch(`${SURL}/rest/v1/transmittals?project_id=eq.${project_id}&select=status`, { headers }),
    fetch(`${SURL}/rest/v1/projects?id=eq.${project_id}&select=name,deadline`, { headers }),
  ]);
  const tasks = await tasksRes.json();
  const drawings = await drawingsRes.json();
  const reviews = await reviewsRes.json();
  const transmittals = await transmittalsRes.json();
  const project = (await projectRes.json())?.[0] || {};
  const now = new Date();
  const tasksByStatus = {};
  let overdueTasks = 0;
  if (Array.isArray(tasks)) {
    for (const t of tasks) {
      tasksByStatus[t.status] = (tasksByStatus[t.status] || 0) + 1;
      if (t.deadline && new Date(t.deadline) < now && t.status !== 'done') overdueTasks++;
    }
  }
  const drawingsByStatus = {};
  if (Array.isArray(drawings)) for (const d of drawings) drawingsByStatus[d.status] = (drawingsByStatus[d.status] || 0) + 1;
  const openReviews = Array.isArray(reviews) ? reviews.filter(r => r.status === 'open' || r.status === 'in_progress').length : 0;
  const draftTransmittals = Array.isArray(transmittals) ? transmittals.filter(t => t.status === 'draft').length : 0;
  let daysLeft = project.deadline ? Math.ceil((new Date(project.deadline).getTime() - now.getTime()) / 86400000) : null;
  const ctx = {
    project: project.name || 'Проект',
    deadline: daysLeft !== null ? (daysLeft < 0 ? `ПРОСРОЧЕН на ${-daysLeft} дн.` : `через ${daysLeft} дн.`) : 'не задан',
    tasks: { ...tasksByStatus, overdue: overdueTasks, total: Array.isArray(tasks) ? tasks.length : 0 },
    drawings: { ...drawingsByStatus, total: Array.isArray(drawings) ? drawings.length : 0 },
    reviews_open: openReviews,
    transmittals_draft: draftTransmittals,
  };
  const text = await callClaude(
    'Ты AI-аналитик проектного института. Дан срез данных проекта. Дай краткий структурированный анализ: общий статус, ключевые риски, конкретные рекомендации. Максимум 150 слов. По-русски.',
    `Данные проекта:\n${JSON.stringify(ctx, null, 2)}`,
    600
  );
  return { message: text, agent: 'project_insights_agent' };
}

async function handleSmartDecompose(message, project_id, user_id, headers) {
  if (!ANTHROPIC_API_KEY) return { message: 'Anthropic API не настроен.' };
  const pData = (await (await fetch(`${SURL}/rest/v1/projects?id=eq.${project_id}&select=name,depts`, { headers })).json())?.[0] || {};
  const depts = pData.depts || [];
  const rawText = await callClaude(
    'Ты планировщик проектного института. Сформируй список задач на основе запроса. Отвечай ТОЛЬКО JSON-массивом без пояснений. Формат: [{"title":"...","priority":"high|medium|low"}]. От 3 до 7 задач. Задачи конкретные, реалистичные для инженерного проектирования.',
    `Проект: "${pData.name || 'Проект'}"\nОтделы: ${depts.length > 0 ? depts.join(', ') : 'не указаны'}\nЗапрос: ${message}`,
    700
  );
  let tasks = [];
  try { const m = rawText.match(/\[[\s\S]*\]/); tasks = m ? JSON.parse(m[0]) : []; } catch (e) { tasks = []; }
  if (!Array.isArray(tasks) || tasks.length === 0) return { message: 'AI не смог сформировать список задач. Уточните запрос.', agent: 'smart_decompose_agent' };
  const insertRes = await fetch(`${SURL}/rest/v1/ai_actions`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ project_id, user_id, action_type: 'create_tasks', agent_type: 'smart_decompose_agent', payload: { tasks: tasks.map(t => ({ title: t.title, priority: t.priority || 'medium' })) }, status: 'pending' }),
  });
  const inserted = await insertRes.json();
  return { message: `Планировщик сформировал ${tasks.length} задач(и). Подтвердите или отклоните ниже.`, agent: 'smart_decompose_agent', action_id: inserted?.[0]?.id };
}

async function handleComplianceCheck(message, project_id, user_id, headers) {
  if (!ANTHROPIC_API_KEY || !OPENAI_API_KEY) return { message: 'API не настроены.' };
  const codeMatch = message.match(/[А-ЯA-ZЁ]{2,4}[-–]\d{2,4}/i);
  let drawing = null;
  let discipline = '';
  let drawingTitle = message;
  if (codeMatch) {
    const dData = await (await fetch(`${SURL}/rest/v1/drawings?project_id=eq.${project_id}&code=ilike.*${encodeURIComponent(codeMatch[0])}*&select=id,code,title,discipline&limit=1`, { headers })).json();
    drawing = Array.isArray(dData) ? dData[0] : null;
    if (drawing) { discipline = drawing.discipline || ''; drawingTitle = `${drawing.code} — ${drawing.title}`; }
  }
  const queryEmbedding = await createEmbedding(`${discipline} нормы требования ${drawingTitle}`.trim());
  const chunks = await (await fetch(`${SURL}/rest/v1/rpc/search_normative`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ query_embedding: queryEmbedding, match_count: 4 }) })).json();
  const hasCtx = Array.isArray(chunks) && chunks.length > 0;
  const ctxText = hasCtx ? chunks.map((c, i) => `[${i + 1}] ${c.doc_name}:\n${c.content}`).join('\n\n') : '';
  const rawText = await callClaude(
    `Ты нормоконтролёр проектного института. Сформируй чеклист проверки чертежа на соответствие нормам. Отвечай ТОЛЬКО JSON-массивом без пояснений. Формат: [{"title":"Пункт проверки","severity":"major|minor"}]. От 4 до 6 пунктов.${hasCtx ? ' Основывайся на предоставленных нормативах.' : ' Используй общие требования для данной дисциплины.'}`,
    `Чертёж: "${drawingTitle}"${discipline ? `, дисциплина: ${discipline}` : ''}\n${hasCtx ? `\nНормативы:\n${ctxText}` : ''}`,
    700
  );
  let items = [];
  try { const m = rawText.match(/\[[\s\S]*\]/); items = m ? JSON.parse(m[0]) : []; } catch (e) { items = []; }
  if (!Array.isArray(items) || items.length === 0) return { message: 'Чеклист пуст. Уточните название или код чертежа.', agent: 'compliance_agent' };
  let inserted = 0;
  for (const item of items) {
    await fetch(`${SURL}/rest/v1/ai_actions`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ project_id, user_id, action_type: 'create_review', agent_type: 'compliance_agent', payload: { title: item.title, severity: item.severity || 'major', drawing_id: drawing?.id || null }, status: 'pending' }),
    });
    inserted++;
  }
  const sources = hasCtx ? `\n📚 ${[...new Set(chunks.map(c => c.doc_name))].join(', ')}` : '';
  return { message: `Нормоконтроль: ${inserted} пунктов чеклиста для "${drawingTitle}". Подтвердите замечания ниже.${sources}`, agent: 'compliance_agent' };
}

async function handleGenerateReport(project_id, role, headers) {
  if (!ANTHROPIC_API_KEY) return { message: 'Anthropic API не настроен.' };
  const [tasksRes, drawingsRes, reviewsRes, transmittalsRes, projectRes] = await Promise.all([
    fetch(`${SURL}/rest/v1/tasks?project_id=eq.${project_id}&select=name,status,deadline`, { headers }),
    fetch(`${SURL}/rest/v1/drawings?project_id=eq.${project_id}&select=code,status`, { headers }),
    fetch(`${SURL}/rest/v1/reviews?project_id=eq.${project_id}&select=title,status,severity`, { headers }),
    fetch(`${SURL}/rest/v1/transmittals?project_id=eq.${project_id}&select=number,status`, { headers }),
    fetch(`${SURL}/rest/v1/projects?id=eq.${project_id}&select=name,deadline`, { headers }),
  ]);
  const tasks = await tasksRes.json();
  const drawings = await drawingsRes.json();
  const reviews = await reviewsRes.json();
  const transmittals = await transmittalsRes.json();
  const project = (await projectRes.json())?.[0] || {};
  const now = new Date();
  const doneTasks = Array.isArray(tasks) ? tasks.filter(t => t.status === 'done') : [];
  const activeTasks = Array.isArray(tasks) ? tasks.filter(t => ['inprogress', 'review_lead', 'review_gip'].includes(t.status)) : [];
  const overdueTasks = Array.isArray(tasks) ? tasks.filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'done').map(t => t.name) : [];
  const openReviews = Array.isArray(reviews) ? reviews.filter(r => r.status === 'open').map(r => `[${r.severity}] ${r.title}`) : [];
  let daysLeft = project.deadline ? Math.ceil((new Date(project.deadline).getTime() - now.getTime()) / 86400000) : null;
  const reportData = {
    project: project.name || 'Проект',
    deadline: daysLeft !== null ? (daysLeft < 0 ? `просрочен на ${-daysLeft} дн.` : `через ${daysLeft} дн.`) : 'не задан',
    tasks: { total: Array.isArray(tasks) ? tasks.length : 0, done: doneTasks.length, active: activeTasks.length, overdue: overdueTasks },
    drawings: { total: Array.isArray(drawings) ? drawings.length : 0, issued: Array.isArray(drawings) ? drawings.filter(d => d.status === 'issued').length : 0 },
    open_reviews: openReviews,
    transmittals: Array.isArray(transmittals) ? transmittals.length : 0,
  };
  const text = await callClaude(
    'Ты составляешь еженедельный статус-отчёт для проектного института. Напиши структурированный отчёт с разделами: 1) Общий статус, 2) Выполнено, 3) В работе, 4) Проблемы и риски, 5) Рекомендации ГИПу. Стиль деловой, лаконичный. По-русски. Максимум 200 слов.',
    `Данные:\n${JSON.stringify(reportData, null, 2)}`,
    800
  );
  return { message: text, agent: 'report_agent' };
}

// ── A4: NL Search ─────────────────────────────────────────────────────────────
async function handleNlSearch(message, project_id, headers) {
  if (!ANTHROPIC_API_KEY) return { message: 'Anthropic API не настроен.' };
  const now = new Date().toISOString().slice(0, 10);
  const rawText = await callClaude(
    `Ты конвертируешь поисковый запрос на русском в JSON-фильтры для базы задач проектного института.
Доступные поля задачи: status (todo|inprogress|review_lead|review_gip|revision|done), priority (high|medium|low), dept (строка, напр. "КМ"), overdue (bool — дедлайн < сегодня и статус != done), assigned_name (строка — часть имени исполнителя).
Отвечай ТОЛЬКО валидным JSON без пояснений. Пример: {"status":"inprogress","dept":"КМ"} или {"overdue":true}.
Сегодня: ${now}.`,
    `Запрос: ${message}`,
    200
  );
  let filters = {};
  try { const m = rawText.match(/\{[\s\S]*?\}/); filters = m ? JSON.parse(m[0]) : {}; } catch (e) { filters = {}; }

  // Fetch tasks with filters
  let url = `${SURL}/rest/v1/tasks?project_id=eq.${project_id}&select=id,name,status,priority,dept,deadline,assigned_to`;
  if (filters.status) url += `&status=eq.${filters.status}`;
  if (filters.priority) url += `&priority=eq.${filters.priority}`;
  if (filters.dept) url += `&dept=ilike.*${encodeURIComponent(filters.dept)}*`;
  const tasks = await (await fetch(url, { headers })).json();

  let result = Array.isArray(tasks) ? tasks : [];
  if (filters.overdue) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    result = result.filter(t => t.deadline && new Date(t.deadline) < today && t.status !== 'done');
  }

  if (result.length === 0) return { message: `По запросу "${message}" задач не найдено.`, agent: 'nl_search_agent', filters, tasks: [] };
  const lines = result.slice(0, 10).map(t => `• ${t.name} [${t.status}${t.dept ? ', ' + t.dept : ''}${t.deadline ? ', до ' + t.deadline.slice(0, 10) : ''}]`).join('\n');
  return {
    message: `**Найдено ${result.length} задач${result.length > 10 ? ` (показаны 10)` : ''}:**\n${lines}`,
    agent: 'nl_search_agent',
    filters,
    tasks: result,
  };
}

// ── A6: Task Suggest (AI form assistant) ─────────────────────────────────────
async function handleTaskSuggest(body, project_id, headers) {
  if (!ANTHROPIC_API_KEY) return { deadline: null, assignee: null };
  const { task_name, dept } = body;
  // Fetch completed similar tasks for velocity reference
  const doneTasks = await (await fetch(
    `${SURL}/rest/v1/tasks?project_id=eq.${project_id}&status=eq.done&dept=eq.${encodeURIComponent(dept || '')}&select=name,deadline,created_at&order=created_at.desc&limit=5`,
    { headers }
  )).json();
  const rawText = await callClaude(
    `Ты помощник при создании задачи в проектном институте. Предложи: 1) срок выполнения (дней от сегодня), 2) краткое обоснование. Отвечай ТОЛЬКО JSON: {"days":N,"reason":"..."}. Сегодня: ${new Date().toISOString().slice(0, 10)}.`,
    `Задача: "${task_name || 'Новая задача'}"\nОтдел: ${dept || 'не указан'}\nПохожие завершённые: ${Array.isArray(doneTasks) ? doneTasks.map(t => t.name).join(', ') : 'нет данных'}`,
    150
  );
  let suggestion = {};
  try { const m = rawText.match(/\{[\s\S]*?\}/); suggestion = m ? JSON.parse(m[0]) : {}; } catch (e) {}
  const deadline = suggestion.days
    ? new Date(Date.now() + suggestion.days * 86400000).toISOString().slice(0, 10)
    : null;
  return { deadline, reason: suggestion.reason || null, agent: 'task_suggest_agent' };
}

// ── A2+G6: Risk Forecast ──────────────────────────────────────────────────────
async function handleRiskForecast(project_id, headers) {
  if (!ANTHROPIC_API_KEY) return { message: 'Anthropic API не настроен.' };
  const now = new Date();
  const [tasksRes, projectRes] = await Promise.all([
    fetch(`${SURL}/rest/v1/tasks?project_id=eq.${project_id}&select=id,name,status,deadline,dept`, { headers }),
    fetch(`${SURL}/rest/v1/projects?id=eq.${project_id}&select=name,deadline`, { headers }),
  ]);
  const tasks = await tasksRes.json();
  const project = (await projectRes.json())?.[0] || {};
  if (!Array.isArray(tasks) || tasks.length === 0) return { message: 'Задач для анализа рисков нет.', agent: 'risk_forecast_agent' };

  const total = tasks.length;
  const done = tasks.filter(t => t.status === 'done').length;
  const overdue = tasks.filter(t => t.deadline && new Date(t.deadline) < now && t.status !== 'done').length;
  const inProgress = tasks.filter(t => ['inprogress', 'review_lead', 'review_gip'].includes(t.status)).length;
  const blocked = tasks.filter(t => t.status === 'revision').length;

  // Velocity: tasks done in last 14 days
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000).toISOString();
  const recentDone = await (await fetch(
    `${SURL}/rest/v1/task_history?field_name=eq.status&new_value=eq.done&changed_at=gte.${twoWeeksAgo}&task_id=in.(${tasks.map(t => t.id).join(',')})&select=task_id`,
    { headers }
  )).json();
  const velocity = Array.isArray(recentDone) ? recentDone.length / 2 : 0; // tasks/week

  const remaining = total - done;
  const weeksLeft = velocity > 0 ? (remaining / velocity).toFixed(1) : null;
  let daysToDeadline = project.deadline ? Math.ceil((new Date(project.deadline).getTime() - now.getTime()) / 86400000) : null;

  // Dept breakdown
  const deptRisk = {};
  tasks.forEach(t => {
    const d = t.dept || 'Без отдела';
    if (!deptRisk[d]) deptRisk[d] = { total: 0, done: 0, overdue: 0 };
    deptRisk[d].total++;
    if (t.status === 'done') deptRisk[d].done++;
    if (t.deadline && new Date(t.deadline) < now && t.status !== 'done') deptRisk[d].overdue++;
  });

  const ctx = {
    project: project.name, deadline_days: daysToDeadline,
    total, done, remaining, overdue, in_progress: inProgress, blocked,
    velocity_per_week: velocity.toFixed(1), weeks_to_finish: weeksLeft,
    dept_breakdown: deptRisk,
  };

  const text = await callClaude(
    'Ты риск-аналитик проектного института. На основе данных дай: 1) общий уровень риска (🟢/🟡/🔴), 2) прогноз завершения, 3) топ-3 риска, 4) рекомендации. Лаконично, по-русски, до 150 слов.',
    `Данные проекта:\n${JSON.stringify(ctx, null, 2)}`,
    600
  );
  return { message: text, agent: 'risk_forecast_agent', risk_data: ctx };
}

// ── A3: Smart Decompose with dates ────────────────────────────────────────────
async function handleSmartDecomposeV2(message, project_id, user_id, headers) {
  if (!ANTHROPIC_API_KEY) return { message: 'Anthropic API не настроен.' };
  const pData = (await (await fetch(`${SURL}/rest/v1/projects?id=eq.${project_id}&select=name,depts,deadline`, { headers })).json())?.[0] || {};
  const today = new Date().toISOString().slice(0, 10);
  const rawText = await callClaude(
    `Ты планировщик проектного института. Сформируй список задач с дедлайнами. Отвечай ТОЛЬКО JSON-массивом. Формат: [{"title":"...","priority":"high|medium|low","dept":"...","deadline":"YYYY-MM-DD","duration_days":N}]. От 4 до 10 задач. Дедлайны рассчитай от сегодня (${today}) с учётом последовательности работ.`,
    `Проект: "${pData.name || 'Проект'}"\nДедлайн проекта: ${pData.deadline || 'не задан'}\nОтделы: ${(pData.depts || []).join(', ') || 'не указаны'}\nЗапрос: ${message}`,
    900
  );
  let tasks = [];
  try { const m = rawText.match(/\[[\s\S]*\]/); tasks = m ? JSON.parse(m[0]) : []; } catch (e) { tasks = []; }
  if (!Array.isArray(tasks) || tasks.length === 0) return { message: 'AI не смог сформировать план. Уточните запрос.', agent: 'smart_decompose_v2_agent' };
  const insertRes = await fetch(`${SURL}/rest/v1/ai_actions`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ project_id, user_id, action_type: 'create_tasks', agent_type: 'smart_decompose_v2_agent', payload: { tasks }, status: 'pending' }),
  });
  const inserted = await insertRes.json();
  const preview = tasks.slice(0, 5).map(t => `• ${t.title} [${t.priority}${t.deadline ? ', до ' + t.deadline : ''}]`).join('\n');
  return { message: `**AI-планировщик сформировал ${tasks.length} задач с дедлайнами:**\n${preview}${tasks.length > 5 ? `\n...и ещё ${tasks.length - 5}` : ''}\n\nПодтвердите ниже.`, agent: 'smart_decompose_v2_agent', action_id: inserted?.[0]?.id };
}

// ── A8: AI Norm Control — text ПЗ → structured GOST compliance findings ──────
async function handleNormControl(body, project_id, user_id, headers) {
  if (!ANTHROPIC_API_KEY) return { message: 'Anthropic API не настроен.' };
  const { text, doc_title = 'ПЗ', discipline = '' } = body;
  if (!text || !String(text).trim()) return { message: 'Текст документа не предоставлен.', agent: 'norm_control_agent' };

  // Try RAG if OpenAI available
  let ctxText = '';
  if (OPENAI_API_KEY) {
    try {
      const embedding = await (async () => {
        const r = await fetch('https://api.openai.com/v1/embeddings', {
          method: 'POST',
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'text-embedding-3-small', input: `${discipline} ГОСТ нормы ${doc_title}`.trim() }),
        });
        const d = await r.json(); return d.data[0].embedding;
      })();
      const chunks = await (await fetch(`${SURL}/rest/v1/rpc/search_normative`, {
        method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify({ query_embedding: embedding, match_count: 4 }),
      })).json();
      if (Array.isArray(chunks) && chunks.length > 0) {
        ctxText = chunks.map((c, i) => `[${i + 1}] ${c.doc_name}:\n${c.content}`).join('\n\n');
      }
    } catch (e) { /* skip RAG on error */ }
  }

  const textSnippet = String(text).slice(0, 2000); // limit context
  const rawText = await callClaude(
    `Ты нормоконтролёр. Проверь текст документа на соответствие нормативным требованиям. Верни ТОЛЬКО JSON-массив замечаний без пояснений. Формат: [{"clause":"ГОСТ/СП/...","title":"Суть замечания","severity":"major|minor","quote":"цитата из текста"}]. От 3 до 8 замечаний.${ctxText ? ' Основывайся на предоставленных нормативах.' : ' Используй общие нормы для данного типа документа.'}`,
    `Документ: "${doc_title}"${discipline ? `, дисциплина: ${discipline}` : ''}\nТекст:\n${textSnippet}${ctxText ? `\n\nНормативы:\n${ctxText}` : ''}`,
    1000
  );
  let items = [];
  try { const m = rawText.match(/\[[\s\S]*\]/); items = m ? JSON.parse(m[0]) : []; } catch (e) { items = []; }
  if (!Array.isArray(items) || items.length === 0) return { message: 'Замечаний не найдено или не удалось разобрать ответ AI.', agent: 'norm_control_agent' };

  // Save to ai_actions for confirmation
  const insertRes = await fetch(`${SURL}/rest/v1/ai_actions`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({ project_id, user_id, action_type: 'create_review', agent_type: 'norm_control_agent', payload: { items, doc_title }, status: 'pending' }),
  });
  const inserted = await insertRes.json();
  const preview = items.slice(0, 4).map(it => `• [${it.severity === 'major' ? '🔴' : '🟡'}] ${it.clause}: ${it.title}`).join('\n');
  const sources = ctxText ? '\n\n📚 Использованы нормативы из базы знаний.' : '';
  return {
    message: `**Нормоконтроль "${doc_title}": ${items.length} замечаний**\n${preview}${items.length > 4 ? `\n...и ещё ${items.length - 4}` : ''}${sources}\n\nПодтвердите ниже.`,
    agent: 'norm_control_agent',
    action_id: inserted?.[0]?.id,
    items,
  };
}

// ── A1: AI Drawing Analysis (Claude Vision) ───────────────────────────────────
async function handleAnalyzeDrawing(body) {
  if (!ANTHROPIC_API_KEY) return { message: 'Anthropic API не настроен.' };
  const { image_base64, media_type = 'image/png', drawing_code, drawing_title, discipline } = body;
  if (!image_base64) return { message: 'Изображение не предоставлено.', agent: 'drawing_vision_agent' };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system: buildSystemPrompt('Ты эксперт-нормоконтролёр проектного института. Анализируй инженерные чертежи и давай структурированную оценку: 1) Заполнение основной надписи (штамп), 2) Масштаб и форматирование, 3) Наличие размеров и обозначений, 4) Замечания по содержанию, 5) Итоговая оценка (Approved/Revision Required/Rejected). По-русски, до 200 слов.'),
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type, data: image_base64 },
          },
          {
            type: 'text',
            text: `Чертёж: "${drawing_code || 'Без кода'} — ${drawing_title || 'Без названия'}"${discipline ? `, дисциплина: ${discipline}` : ''}. Проведи нормоконтроль.`,
          },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error('Claude Vision API failed: ' + res.status);
  const data = await res.json();
  const text = data.content?.[0]?.text || 'Анализ недоступен.';
  return { message: text, agent: 'drawing_vision_agent' };
}

// ── Drawing / Revision / Review / Transmittal Action Builders ────────────────

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

    if (action === 'task_suggest') {
      const result = await handleTaskSuggest(req.body, project_id, headers);
      return res.status(200).json({ success: true, ...result });
    }

    if (action === 'analyze_drawing') {
      const result = await handleAnalyzeDrawing(req.body);
      return res.status(200).json({ success: true, ...result });
    }

    if (action === 'norm_control') {
      const result = await handleNormControl(req.body, project_id, user_id, headers);
      return res.status(200).json({ success: true, ...result });
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
          system: buildSystemPrompt(
            hasContext
              ? 'Отвечай только по предоставленным фрагментам, и указывай источники.'
              : 'Документов в базе по запросу не найдено. Дай общий ответ и предупреди об этом.'
          ),
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

    // ── New AI Agent intents ─────────────────────────────────────────────────
    if (intent === 'project_insights') {
      const result = await handleProjectInsights(project_id, currentRole, headers);
      return res.status(200).json({ success: true, ...result });
    }
    if (intent === 'generate_report') {
      const result = await handleGenerateReport(project_id, currentRole, headers);
      return res.status(200).json({ success: true, ...result });
    }
    if (intent === 'smart_decompose') {
      const result = await handleSmartDecomposeV2(message, project_id, user_id, headers);
      return res.status(200).json({ success: true, ...result });
    }
    if (intent === 'compliance_check') {
      const result = await handleComplianceCheck(message, project_id, user_id, headers);
      return res.status(200).json({ success: true, ...result });
    }
    if (intent === 'nl_search') {
      const result = await handleNlSearch(message, project_id, headers);
      return res.status(200).json({ success: true, ...result });
    }
    if (intent === 'risk_forecast') {
      const result = await handleRiskForecast(project_id, headers);
      return res.status(200).json({ success: true, ...result });
    }
    // ── Legacy intents ────────────────────────────────────────────────────────
    const pRes = await fetch(`${SURL}/rest/v1/projects?id=eq.${project_id}`, { headers });
    const pData = await pRes.json();
    const depts = pData?.[0]?.depts || [];

    let insertData = null;
    let responseMessage = `${rolePrompt} Запрос принят.`;

    if (intent === 'create_tasks') {
      const tasks = depts.length > 0
        ? [
            { title: 'Анализ исходной документации (AI Draft)', dept: depts[0], priority: 'medium' },
            { title: 'Подготовка технических решений (AI Draft)', dept: depts[1] || depts[0], priority: 'high' },
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
