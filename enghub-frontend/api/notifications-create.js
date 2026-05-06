// POST /api/notifications-create
// body: { user_id, project_id?, action_type, target_id?, message?, payload? }
// Создаёт запись в notifications. Любой аутентифицированный пользователь.
// Authoritative actor = текущий profile.id (его подставляем как actor_id, игнорируя клиентский payload).

const { SURL, adminHeaders, requireAuth, handleCors, readJsonBody } = require('./_admin');

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res);
  if (!auth) return;

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const { user_id, project_id, action_type, target_id, message, payload, action } = body || {};

  // Поддерживаем оба формата: новый (action_type) и legacy (action) — фронт пока шлёт legacy.
  const at = action_type || action;
  if (!user_id || !at) {
    return res.status(400).json({ error: 'user_id и action_type обязательны' });
  }

  const row = {
    user_id,
    actor_id: auth.user.id || null,
    project_id: project_id || null,
    action_type: at,
    target_id: target_id || null,
    message: message || null,
    payload: payload || null,
    is_read: false,
    created_at: new Date().toISOString(),
  };

  try {
    const r = await fetch(`${SURL}/rest/v1/notifications`, {
      method: 'POST',
      headers: { ...adminHeaders(), Prefer: 'return=minimal' },
      body: JSON.stringify(row),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      // Если в схеме нет actor_id/payload — повторяем без них (legacy совместимость)
      if (r.status === 400 || r.status === 422) {
        const fallback = {
          user_id,
          project_id: project_id || null,
          action: at,
          target_id: target_id || null,
          message: message || null,
          is_read: false,
          created_at: row.created_at,
        };
        const r2 = await fetch(`${SURL}/rest/v1/notifications`, {
          method: 'POST',
          headers: { ...adminHeaders(), Prefer: 'return=minimal' },
          body: JSON.stringify(fallback),
        });
        if (!r2.ok) {
          const t2 = await r2.text().catch(() => '');
          return res.status(r2.status).json({ error: t2 || `HTTP ${r2.status}` });
        }
        return res.status(201).json({ ok: true });
      }
      return res.status(r.status).json({ error: txt || `HTTP ${r.status}` });
    }
    return res.status(201).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: String(e && e.message || e) });
  }
};
