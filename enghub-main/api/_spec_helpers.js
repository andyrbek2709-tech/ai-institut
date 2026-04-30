// Helpers extracted from spec-export.js: auth verification, project access
// checks, catalog matching, and the stamp-coordinate resolver.
// Kept as a CommonJS module so spec-export.js stays small and the Vercel
// bundler picks it up via require().

const SURL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_SERVICE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Single source of truth: name → fallback cell. Defined names in template.xlsx
// override these at runtime; the script scripts/add_stamp_defined_names.mjs
// writes them once. If the editor moves a stamp, they redefine the name in
// Excel — the code does not need a redeploy.
const STAMP_FIELDS = {
  stamp_project_code: { fallback: { row: 34, col: 17 }, label: 'Q34' },
  stamp_object_name:  { fallback: { row: 36, col: 17 }, label: 'Q36' },
  stamp_system_name:  { fallback: { row: 34, col: 7  }, label: 'G34' },
  stamp_stage:        { fallback: { row: 40, col: 21 }, label: 'U40' },
  stamp_developer:    { fallback: { row: 39, col: 12 }, label: 'L39' },
  stamp_checker:      { fallback: { row: 40, col: 12 }, label: 'L40' },
  stamp_norm_control: { fallback: { row: 43, col: 12 }, label: 'L43' },
  stamp_approver:     { fallback: { row: 44, col: 12 }, label: 'L44' },
  stamp_date:         { fallback: { row: 44, col: 16 }, label: 'P44' },
  stamp_title:        { fallback: { row: 42, col: 17 }, label: 'Q42' },
  stamp_sheet_no:     { fallback: { row: 40, col: 23 }, label: 'W40' },
  stamp_total_sheets: { fallback: { row: 40, col: 24 }, label: 'X40' },
};

function extractBearer(req) {
  const h = req.headers || {};
  const raw = h.authorization || h.Authorization || '';
  if (!raw || typeof raw !== 'string') return '';
  const m = raw.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : '';
}

async function verifyUserAndProfile(token) {
  if (!SURL || !SERVICE_KEY) {
    throw new Error('Server is missing SUPABASE_URL / SUPABASE_SERVICE_KEY');
  }
  if (!token) return { ok: false, status: 401, error: 'Authorization Bearer token is required' };

  // /auth/v1/user — пробуем сначала с ANON_KEY apikey, если он есть.
  // Если ANON_KEY пуст или вызов вернул не-OK — повторяем с SERVICE_KEY (он
  // тоже валиден как apikey для public auth-эндпоинтов в новой ключевой схеме).
  const tryFetchUser = async (apikey, label) => {
    if (!apikey) return { ok: false, status: 0, body: '', label };
    try {
      const r = await fetch(`${SURL}/auth/v1/user`, {
        headers: { apikey, Authorization: `Bearer ${token}` },
      });
      const body = await r.text().catch(() => '');
      return { ok: r.ok, status: r.status, body, label };
    } catch (e) {
      return { ok: false, status: 0, body: String(e && e.message || e), label };
    }
  };

  let userResult = await tryFetchUser(ANON_KEY, 'anon');
  if (!userResult.ok) {
    const fallback = await tryFetchUser(SERVICE_KEY, 'service');
    if (fallback.ok) userResult = fallback;
  }
  if (!userResult.ok) {
    try {
      console.error('[verifyUserAndProfile] /auth/v1/user failed:', JSON.stringify({
        anon_present: !!ANON_KEY, service_present: !!SERVICE_KEY,
        last_status: userResult.status, body: String(userResult.body || '').slice(0, 300),
      }));
    } catch (_e) {}
    return {
      ok: false,
      status: 401,
      error: `Invalid or expired token (auth/v1/user → ${userResult.status || 'network-error'})`,
    };
  }
  let authUser = null;
  try { authUser = userResult.body ? JSON.parse(userResult.body) : null; } catch (_e) { authUser = null; }
  const email = authUser && authUser.email;
  if (!email) return { ok: false, status: 401, error: 'Token does not resolve to a user' };

  const adminHeaders = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
  };
  const profRes = await fetch(
    `${SURL}/rest/v1/app_users?email=eq.${encodeURIComponent(email)}&select=id,full_name,email,role,dept_id&limit=1`,
    { headers: adminHeaders }
  );
  const profArr = await profRes.json().catch(() => []);
  let profile = Array.isArray(profArr) ? profArr[0] : null;

  if (!profile && email === 'admin@enghub.com') {
    profile = { id: null, email, role: 'admin', dept_id: null, full_name: 'Admin' };
  }
  if (!profile) {
    return { ok: false, status: 403, error: 'Профиль пользователя не найден в app_users' };
  }
  return { ok: true, user: Object.assign({}, profile, { email }), adminHeaders };
}

async function checkProjectAccess(projectId, profile, adminHeaders) {
  const role = String(profile.role || '').toLowerCase();
  if (role === 'admin' || role.includes('gip') || role.includes('гип')) return { ok: true };

  const isLead = role.includes('lead') || role.includes('head') || role.includes('руковод');
  if (!isLead) {
    return {
      ok: false,
      status: 403,
      error: 'Недостаточно прав: только ГИП или руководитель отдела могут формировать спецификацию',
    };
  }
  if (!projectId) {
    return { ok: false, status: 400, error: 'project_id обязателен для проверки доступа' };
  }

  let deptName = '';
  if (profile.dept_id) {
    const dRes = await fetch(
      `${SURL}/rest/v1/departments?id=eq.${encodeURIComponent(profile.dept_id)}&select=name&limit=1`,
      { headers: adminHeaders }
    );
    const dArr = await dRes.json().catch(() => []);
    deptName = Array.isArray(dArr) && dArr[0] && dArr[0].name ? String(dArr[0].name) : '';
  }
  if (!deptName) {
    return { ok: false, status: 403, error: 'Не удалось определить отдел руководителя' };
  }

  const tRes = await fetch(
    `${SURL}/rest/v1/tasks?project_id=eq.${encodeURIComponent(projectId)}&dept=eq.${encodeURIComponent(deptName)}&select=id&limit=1`,
    { headers: adminHeaders }
  );
  const tArr = await tRes.json().catch(() => []);
  if (Array.isArray(tArr) && tArr.length > 0) return { ok: true };
  return { ok: false, status: 403, error: 'Доступ к проекту закрыт: проект не относится к вашему отделу' };
}

async function matchItemsAgainstCatalog(items, adminHeaders) {
  const out = (Array.isArray(items) ? items : []).map((it) =>
    Object.assign({}, it, { _from_catalog: false, _catalog_id: null })
  );
  if (!SURL || !SERVICE_KEY) return out;

  const idsToFetch = Array.from(
    new Set(out.map((r) => r.item_id).filter((v) => v !== null && v !== undefined && v !== ''))
  ).map(String);

  const idToCatalog = new Map();
  if (idsToFetch.length) {
    const url = `${SURL}/rest/v1/catalog_items?id=in.(${idsToFetch.join(',')})&select=id,code,name,unit,standard,group_id`;
    try {
      const r = await fetch(url, { headers: adminHeaders });
      const arr = await r.json().catch(() => []);
      if (Array.isArray(arr)) for (const c of arr) idToCatalog.set(String(c.id), c);
    } catch (_e) { /* best effort */ }
  }

  const nameKeys = [];
  for (const r of out) {
    if (r.item_id && idToCatalog.has(String(r.item_id))) continue;
    const nm = String(r.name || '').trim();
    if (nm.length >= 3) nameKeys.push({ row: r, name: nm, type: String(r.type || '').trim() });
  }

  const nameToCatalog = new Map();
  if (nameKeys.length) {
    const uniqNames = Array.from(new Set(nameKeys.map((x) => x.name))).slice(0, 200);
    if (uniqNames.length) {
      const orParts = uniqNames.map((n) => `name.ilike.${encodeURIComponent(n)}`);
      const url = `${SURL}/rest/v1/catalog_items?or=(${orParts.join(',')})&select=id,code,name,unit,standard,group_id&limit=600`;
      try {
        const r = await fetch(url, { headers: adminHeaders });
        const arr = await r.json().catch(() => []);
        if (Array.isArray(arr)) {
          for (const c of arr) {
            const key = String(c.name || '').trim().toLowerCase();
            if (!nameToCatalog.has(key)) nameToCatalog.set(key, []);
            nameToCatalog.get(key).push(c);
          }
        }
      } catch (_e) { /* best effort */ }
    }
  }

  for (const r of out) {
    if (r.item_id && idToCatalog.has(String(r.item_id))) {
      const c = idToCatalog.get(String(r.item_id));
      r._from_catalog = true;
      r._catalog_id = c.id;
      if (!String(r.code || '').trim() && c.code) r.code = c.code;
      if (!String(r.unit || '').trim() && c.unit) r.unit = c.unit;
      if (!String(r.type || '').trim() && c.standard) r.type = c.standard;
      continue;
    }
    const key = String(r.name || '').trim().toLowerCase();
    const candidates = nameToCatalog.get(key) || [];
    if (!candidates.length) continue;
    const tStd = String(r.type || '').trim().toLowerCase();
    let pick = candidates[0];
    if (tStd) {
      const better = candidates.find((c) => String(c.standard || '').trim().toLowerCase() === tStd);
      if (better) pick = better;
    }
    r._from_catalog = true;
    r._catalog_id = pick.id;
    if (!String(r.code || '').trim() && pick.code) r.code = pick.code;
    if (!String(r.unit || '').trim() && pick.unit) r.unit = pick.unit;
    if (!String(r.type || '').trim() && pick.standard) r.type = pick.standard;
  }
  return out;
}

function colLetterToIndex(letters) {
  let n = 0;
  for (const ch of String(letters).toUpperCase()) {
    const code = ch.charCodeAt(0) - 64;
    if (code < 1 || code > 26) return 0;
    n = n * 26 + code;
  }
  return n;
}

function parseAddress(address) {
  let raw = String(address || '').replace(/\$/g, '');
  const bang = raw.lastIndexOf('!');
  if (bang >= 0) raw = raw.slice(bang + 1);
  const colonIdx = raw.indexOf(':');
  if (colonIdx >= 0) raw = raw.slice(0, colonIdx);
  const m = raw.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return null;
  return { row: Number(m[2]), col: colLetterToIndex(m[1]) };
}

function buildStampMap(workbook) {
  const result = {};
  for (const [key, def] of Object.entries(STAMP_FIELDS)) {
    let resolved = null;
    try {
      const ranges = workbook && workbook.definedNames && workbook.definedNames.getRanges
        ? workbook.definedNames.getRanges(key)
        : null;
      const first = ranges && ranges.ranges && ranges.ranges[0];
      if (first) resolved = parseAddress(first);
    } catch (_e) { /* ignore */ }
    result[key] = resolved || def.fallback;
  }
  return result;
}

module.exports = {
  STAMP_FIELDS,
  extractBearer,
  verifyUserAndProfile,
  checkProjectAccess,
  matchItemsAgainstCatalog,
  buildStampMap,
};
