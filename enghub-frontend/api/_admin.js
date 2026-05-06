// Shared admin helpers for serverless API routes.
// Uses service_role key (server-only) and verifyUserAndProfile from _spec_helpers.

const { createClient } = require('@supabase/supabase-js');
const { verifyUserAndProfile, extractBearer } = require('./_spec_helpers');

const SURL = process.env.SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_SERVICE_KEY || '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY || '';

let _admin = null;
function getAdmin() {
  if (!_admin) {
    if (!SURL || !SERVICE_KEY) {
      throw new Error('Server is missing SUPABASE_URL / SUPABASE_SERVICE_KEY');
    }
    _admin = createClient(SURL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _admin;
}

// Admin REST headers (для прямых fetch, если SDK неудобен).
function adminHeaders() {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };
}

// Centralized auth-guard. Returns { user, adminHeaders } on success; sends HTTP error and returns null on failure.
async function requireAuth(req, res, opts = {}) {
  const token = extractBearer(req);
  const r = await verifyUserAndProfile(token);
  if (!r.ok) {
    res.status(r.status || 401).json({ error: r.error || 'Unauthorized' });
    return null;
  }
  if (opts.roles && Array.isArray(opts.roles) && opts.roles.length) {
    const role = String(r.user.role || '').toLowerCase();
    const allowed = opts.roles.map(x => String(x).toLowerCase());
    if (!allowed.some(a => role === a || role.includes(a))) {
      res.status(403).json({ error: 'Недостаточно прав' });
      return null;
    }
  }
  return r;
}

// Утилита: проверить, имеет ли профиль доступ к проекту (для GET endpoints без явных roles).
async function hasProjectAccess(profile, projectId) {
  const role = String(profile.role || '').toLowerCase();
  if (role === 'admin' || role.includes('gip')) return true;
  if (!projectId) return false;
  const headers = adminHeaders();

  // engineer: есть задача, где assigned_to = profile.id?
  if (role.includes('engineer') || role.includes('инжен')) {
    const r = await fetch(
      `${SURL}/rest/v1/tasks?project_id=eq.${encodeURIComponent(projectId)}&assigned_to=eq.${encodeURIComponent(profile.id)}&select=id&limit=1`,
      { headers }
    );
    const arr = await r.json().catch(() => []);
    return Array.isArray(arr) && arr.length > 0;
  }

  // lead/руководитель: задача его отдела в проекте
  if (role.includes('lead') || role.includes('head') || role.includes('руковод')) {
    if (!profile.dept_id) return false;
    const dRes = await fetch(
      `${SURL}/rest/v1/departments?id=eq.${encodeURIComponent(profile.dept_id)}&select=name&limit=1`,
      { headers }
    );
    const dArr = await dRes.json().catch(() => []);
    const deptName = Array.isArray(dArr) && dArr[0] && dArr[0].name ? String(dArr[0].name) : '';
    if (!deptName) return false;
    const tRes = await fetch(
      `${SURL}/rest/v1/tasks?project_id=eq.${encodeURIComponent(projectId)}&dept=eq.${encodeURIComponent(deptName)}&select=id&limit=1`,
      { headers }
    );
    const tArr = await tRes.json().catch(() => []);
    return Array.isArray(tArr) && tArr.length > 0;
  }

  return false;
}

// CORS / OPTIONS helper для serverless endpoints
function handleCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, apikey');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// Минимальный JSON body parser (Vercel runtime обычно сам парсит, но иногда даёт raw)
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

module.exports = {
  SURL,
  SERVICE_KEY,
  ANON_KEY,
  getAdmin,
  adminHeaders,
  requireAuth,
  hasProjectAccess,
  handleCors,
  readJsonBody,
};
