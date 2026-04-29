// /api/admin-users — единый endpoint для admin-операций над пользователями.
//   POST   { action: 'create', email, password, full_name, role, dept_id? }
//          → создаёт auth-юзера + INSERT в app_users
//   POST   { action: 'reset_password', supabase_uid, new_password }
//          → меняет пароль через Supabase Auth admin API
//   POST   { action: 'update_role', user_id, role, dept_id? }
//          → UPDATE app_users + sync user_metadata
//
// Все операции требуют auth + role=admin (или gip для create engineer'а — пока просто admin).

const { SURL, SERVICE_KEY, ANON_KEY, adminHeaders, requireAuth, handleCors, readJsonBody } = require('./_admin');

async function handleCreate(req, res, auth, body) {
  const { email, password, full_name, role, dept_id } = body || {};
  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'email, password, full_name, role обязательны' });
  }

  // 1. Создаём auth-юзера
  const aRes = await fetch(`${SURL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { role, full_name } }),
  });
  const aJson = await aRes.json().catch(() => ({}));
  if (!aRes.ok) {
    return res.status(aRes.status).json({ error: aJson?.msg || aJson?.error || `HTTP ${aRes.status}` });
  }
  const supabase_uid = aJson?.id || aJson?.user?.id;
  if (!supabase_uid) {
    return res.status(500).json({ error: 'Не получили supabase_uid из auth.admin.createUser' });
  }

  // 2. INSERT в app_users
  const profilePayload = { email, full_name, role, dept_id: dept_id || null, supabase_uid };
  const pRes = await fetch(`${SURL}/rest/v1/app_users`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(profilePayload),
  });
  const pJson = await pRes.json().catch(() => null);
  if (!pRes.ok) {
    // откат auth-юзера
    await fetch(`${SURL}/auth/v1/admin/users/${supabase_uid}`, {
      method: 'DELETE',
      headers: adminHeaders(),
    }).catch(() => null);
    return res.status(pRes.status).json({
      error: (pJson && (pJson.message || pJson.error)) || `Не удалось создать профиль (HTTP ${pRes.status})`,
    });
  }
  const profile = Array.isArray(pJson) ? pJson[0] : pJson;
  return res.status(201).json(profile);
}

async function handleResetPassword(req, res, auth, body) {
  const { supabase_uid, new_password } = body || {};
  if (!supabase_uid || !new_password) {
    return res.status(400).json({ error: 'supabase_uid и new_password обязательны' });
  }
  if (String(new_password).length < 8) {
    return res.status(400).json({ error: 'Пароль должен быть ≥8 символов' });
  }
  const r = await fetch(`${SURL}/auth/v1/admin/users/${encodeURIComponent(supabase_uid)}`, {
    method: 'PUT',
    headers: adminHeaders(),
    body: JSON.stringify({ password: new_password }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(r.status).json({ error: j?.msg || j?.error || `HTTP ${r.status}` });
  return res.status(200).json({ ok: true });
}

async function handleUpdateRole(req, res, auth, body) {
  const { user_id, role, dept_id } = body || {};
  if (!user_id || !role) return res.status(400).json({ error: 'user_id и role обязательны' });

  const update = { role, dept_id: dept_id !== undefined ? dept_id : undefined };
  Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);
  update.updated_at = new Date().toISOString();

  const r = await fetch(`${SURL}/rest/v1/app_users?id=eq.${encodeURIComponent(user_id)}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(update),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return res.status(r.status).json({ error: j?.message || j?.error || `HTTP ${r.status}` });
  const profile = Array.isArray(j) ? j[0] : j;

  // Sync user_metadata.role в Supabase Auth (best-effort)
  if (profile?.supabase_uid) {
    fetch(`${SURL}/auth/v1/admin/users/${encodeURIComponent(profile.supabase_uid)}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({ user_metadata: { role } }),
    }).catch(() => null);
  }

  return res.status(200).json(profile);
}

module.exports = async (req, res) => {
  if (handleCors(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireAuth(req, res, { roles: ['admin'] });
  if (!auth) return;

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return res.status(400).json({ error: 'Invalid JSON body' }); }

  const action = body?.action;
  switch (action) {
    case 'create':         return handleCreate(req, res, auth, body);
    case 'reset_password': return handleResetPassword(req, res, auth, body);
    case 'update_role':    return handleUpdateRole(req, res, auth, body);
    default: return res.status(400).json({ error: 'Unknown action. Allowed: create, reset_password, update_role' });
  }
};
