const SURL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// E3: Telegram Bot — webhook handler
// Commands: /start, /mytasks, /deadlines [N], /status <код>, /help

const BOT_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

async function sendMessage(chat_id, text, parse_mode = 'HTML') {
  if (!TELEGRAM_BOT_TOKEN) return;
  await fetch(`${BOT_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id, text, parse_mode }),
  });
}

async function getUserByTelegramId(telegram_id, headers) {
  const res = await fetch(`${SURL}/rest/v1/app_users?telegram_id=eq.${telegram_id}&select=id,full_name,role,dept_id&limit=1`, { headers });
  const data = await res.json();
  return Array.isArray(data) ? data[0] : null;
}

async function handleMyTasks(chat_id, user, headers) {
  const res = await fetch(
    `${SURL}/rest/v1/tasks?assigned_to=eq.${user.id}&status=neq.done&order=deadline.asc.nullslast&select=name,status,deadline,dept&limit=10`,
    { headers }
  );
  const tasks = await res.json();
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return sendMessage(chat_id, '✅ У вас нет активных задач.');
  }
  const now = new Date();
  const lines = tasks.map(t => {
    const overdue = t.deadline && new Date(t.deadline) < now;
    const dl = t.deadline ? ` — до ${new Date(t.deadline).toLocaleDateString('ru-RU')}` : '';
    return `${overdue ? '🔴' : '🔵'} <b>${t.name}</b> [${t.status}]${dl}`;
  }).join('\n');
  return sendMessage(chat_id, `📋 <b>Ваши задачи (${tasks.length}):</b>\n\n${lines}`);
}

async function handleDeadlines(chat_id, user, headers, days = 7) {
  const until = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const res = await fetch(
    `${SURL}/rest/v1/tasks?assigned_to=eq.${user.id}&status=neq.done&deadline=lte.${until}&order=deadline.asc&select=name,status,deadline,dept&limit=10`,
    { headers }
  );
  const tasks = await res.json();
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return sendMessage(chat_id, `✅ Нет дедлайнов в ближайшие ${days} дней.`);
  }
  const now = new Date();
  const lines = tasks.map(t => {
    const overdue = t.deadline && new Date(t.deadline) < now;
    const dl = t.deadline ? new Date(t.deadline).toLocaleDateString('ru-RU') : '—';
    return `${overdue ? '🔴 Просрочено' : '⏰'} <b>${t.name}</b>\nСрок: ${dl} · ${t.status}`;
  }).join('\n\n');
  return sendMessage(chat_id, `📅 <b>Дедлайны (${days} дн.):</b>\n\n${lines}`);
}

async function handleStatus(chat_id, user, code, headers) {
  if (!code) return sendMessage(chat_id, '⚠️ Укажите код чертежа: /status АР-001');

  // Find user's projects
  const tasksRes = await fetch(`${SURL}/rest/v1/tasks?assigned_to=eq.${user.id}&select=project_id&limit=1`, { headers });
  const taskList = await tasksRes.json();
  const project_id = Array.isArray(taskList) && taskList.length > 0 ? taskList[0].project_id : null;

  const query = project_id
    ? `${SURL}/rest/v1/drawings?code=ilike.*${encodeURIComponent(code)}*&project_id=eq.${project_id}&select=code,title,status,revision&limit=3`
    : `${SURL}/rest/v1/drawings?code=ilike.*${encodeURIComponent(code)}*&select=code,title,status,revision&limit=3`;
  const res = await fetch(query, { headers });
  const drawings = await res.json();
  if (!Array.isArray(drawings) || drawings.length === 0) {
    return sendMessage(chat_id, `🔍 Чертёж <b>${code}</b> не найден.`);
  }
  const lines = drawings.map(d => `📐 <b>${d.code}</b> — ${d.title}\nРевизия: ${d.revision || 'R0'} · Статус: ${d.status || 'draft'}`).join('\n\n');
  return sendMessage(chat_id, lines);
}

async function handleStart(chat_id, telegram_id, username, headers) {
  const user = await getUserByTelegramId(telegram_id, headers);
  if (user) {
    return sendMessage(chat_id, `👋 Привет, <b>${user.full_name}</b>!\n\nВы уже привязаны к системе EngHub как <b>${user.role}</b>.\n\nКоманды:\n/mytasks — мои задачи\n/deadlines — дедлайны на 7 дней\n/status &lt;код&gt; — статус чертежа\n/help — справка`);
  }
  return sendMessage(chat_id, `👋 Привет!\n\nЯ бот системы <b>EngHub</b>.\n\nДля работы попросите администратора привязать ваш Telegram к профилю.\n\nВаш Telegram ID: <code>${telegram_id}</code>`);
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'GET') return res.status(200).json({ ok: true, info: 'Telegram webhook is active' });
  if (req.method !== 'POST') return res.status(405).end();

  if (!TELEGRAM_BOT_TOKEN || !SURL || !SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  try {
    const update = req.body;
    const message = update.message || update.edited_message;
    if (!message || !message.text) return res.status(200).end();

    const chat_id = message.chat.id;
    const telegram_id = message.from.id;
    const username = message.from.username || '';
    const text = (message.text || '').trim();

    const headers = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' };
    const user = await getUserByTelegramId(telegram_id, headers);

    if (text.startsWith('/start')) {
      await handleStart(chat_id, telegram_id, username, headers);
    } else if (text.startsWith('/help')) {
      await sendMessage(chat_id, `📖 <b>Команды EngHub Bot:</b>\n\n/mytasks — ваши активные задачи\n/deadlines [N] — дедлайны на N дней (по умолчанию 7)\n/status &lt;код&gt; — статус чертежа (напр. /status АР-001)\n/help — это сообщение`);
    } else if (!user) {
      await sendMessage(chat_id, `⚠️ Ваш Telegram не привязан к профилю EngHub.\nСвяжитесь с администратором.\n\nВаш ID: <code>${telegram_id}</code>`);
    } else if (text.startsWith('/mytasks')) {
      await handleMyTasks(chat_id, user, headers);
    } else if (text.startsWith('/deadlines')) {
      const parts = text.split(' ');
      const days = parseInt(parts[1]) || 7;
      await handleDeadlines(chat_id, user, headers, Math.min(days, 30));
    } else if (text.startsWith('/status')) {
      const code = text.replace('/status', '').trim();
      await handleStatus(chat_id, user, code, headers);
    } else {
      await sendMessage(chat_id, `Неизвестная команда. Напишите /help для справки.`);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Telegram webhook error:', err);
    return res.status(200).json({ ok: false });
  }
};
