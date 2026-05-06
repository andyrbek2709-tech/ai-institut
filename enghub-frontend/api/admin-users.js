// /api/admin-users — единый endpoint для admin-операций над пользователями.
//   POST   { action: 'create', email, password, full_name, role, dept_id? }
//          → создаёт auth-юзера + INSERT в app_users
//   POST   { action: 'reset_password', supabase_uid, new_password }
//          → меняет пароль через Supabase Auth admin API
//   POST   { action: 'update_role', user_id, role, dept_id? }
//          → UPDATE app_users + sync user_metadata
//
// Все операции требуют auth + role=admin (или gip для create engineer'а — пока просто admin).
//
// 2026-04-30: hotfix admin password reset.
//  - Verbose диагностика (включаем upstream Supabase error в response + console.error).
//  - Снижен min длины пароля с 8 до 6 (frontend разрешал ≥6 — был mismatch).
//  - supabase-js SDK как primary путь для auth.admin.updateUserById (надёжнее
//    с новыми sb_secret_* ключами), REST как fallback.
//  - Sanity-чек ENV до requireAuth, чтобы не отдавать загадочный 401 при отсутствии ключей.
//  - Глобальный try/catch вокруг handler'а — никаких голых 500.

const { SURL, SERVICE_KEY, ANON_KEY, getAdmin, adminHeaders, requireAuth, handleCors, readJsonBody } = require('./_admin');

function logErr(label, info) {
  try { console.error(`[admin-users] ${label}:`, JSON.stringify(info).slice(0, 1000)); }
  catch (_e) { console.error(`[admin-users] ${label}:`, info); }
}

async function handleCreate(req, res, auth, body) {
  const { email, password, full_name, role, dept_id } = body || {};
  if (!email || !password || !full_name || !role) {
    return res.status(400).json({ error: 'email, password, full_name, role обязательны' });
  }

  const aRes = await fetch(`${SURL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: adminHeaders(),
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { role, full_name } }),
  });
  const aJson = await aRes.json().catch(() => ({}));
  if (!aRes.ok) {
    logErr('create:auth.admin.users', { status: aRes.status, body: aJson });
    return res.status(aRes.status).json({ error: aJson?.msg || aJson?.error_description || aJson?.error || `HTTP ${aRes.status}` });
  }
  const supabase_uid = aJson?.id || aJson?.user?.id;
  if (!supabase_uid) {
    logErr('create:no-uid', { body: aJson });
    return res.status(500).json({ error: 'Не получили supabase_uid из auth.admin.createUser' });
  }

  const profilePayload = { email, full_name, role, dept_id: dept_id || null, supabase_uid };
  const pRes = await fetch(`${SURL}/rest/v1/app_users`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(profilePayload),
  });
  const pJson = await pRes.json().catch(() => null);
  if (!pRes.ok) {
    logErr('create:app_users', { status: pRes.status, body: pJson });
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
  if (String(new_password).length < 6) {
    return res.status(400).json({ error: 'Пароль должен быть ≥6 символов' });
  }

  // Primary: supabase-js SDK (учитывает формат новых sb_secret_* ключей).
  try {
    const sb = getAdmin();
    const { data, error } = await sb.auth.admin.updateUserById(String(supabase_uid), {
      password: String(new_password),
    });
    if (!error && data) {
      return res.status(200).json({ ok: true, via: 'sdk' });
    }
    logErr('reset:sdk', {
      uid: supabase_uid,
      status: error?.status,
      name: error?.name,
      message: error?.message,
    });
    // SDK не справился → REST fallback ниже.
  } catch (e) {
    logErr('reset:sdk-throw', { uid: supabase_uid, message: e?.message, name: e?.name });
  }

  // Fallback: прямой REST вызов /auth/v1/admin/users/{uid}.
  try {
    const r = await fetch(`${SURL}/auth/v1/admin/users/${encodeURIComponent(supabase_uid)}`, {
      method: 'PUT',
      headers: adminHeaders(),
      body: JSON.stringify({ password: String(new_password) }),
    });
    const text = await r.text();
    let j = null;
    try { j = text ? JSON.parse(text) : null; } catch (_e) { /* not json */ }
    if (!r.ok) {
      logErr('reset:rest', { uid: supabase_uid, status: r.status, body: text?.slice(0, 500) });
      const msg = j?.msg || j?.error_description || j?.error || (text && text.slice(0, 200)) || `HTTP ${r.status}`;
      return res.status(r.status).json({ error: `Auth admin API: ${msg}`, status: r.status });
    }
    return res.status(200).json({ ok: true, via: 'rest' });
  } catch (e) {
    logErr('reset:rest-throw', { uid: supabase_uid, message: e?.message });
    return res.status(500).json({ error: `Сетевая ошибка при смене пароля: ${e?.message || 'unknown'}` });
  }
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
  if (!r.ok) {
    logErr('update_role:patch', { user_id, status: r.status, body: j });
    return res.status(r.status).json({ error: j?.message || j?.error || `HTTP ${r.status}` });
  }
  const profile = Array.isArray(j) ? j[0] : j;

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

  if (!SURL || !SERVICE_KEY) {
    logErr('env-missing', { has_url: !!SURL, has_service_key: !!SERVICE_KEY });
    return res.status(500).json({ error: 'Server misconfigured: SUPABASE_URL/SUPABASE_SERVICE_KEY отсутствуют' });
  }

  try {
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
  } catch (e) {
    logErr('handler-throw', { message: e?.message, stack: e?.stack?.slice(0, 500) });
    if (!res.headersSent) {
      return res.status(500).json({ error: `Внутренняя ошибка: ${e?.message || 'unknown'}` });
    }
  }
};
