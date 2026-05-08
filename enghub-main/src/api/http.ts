// HTTP helper — all /api/* calls route to Railway API Server
// REACT_APP_RAILWAY_API_URL must be set in production build args

import { getSupabaseAnonClient } from './supabaseClient';

async function getAccessToken(): Promise<string> {
  // Single source of truth: Supabase JS client session (auto-refreshed by autoRefreshToken:true).
  // No localStorage fallback — stale tokens were the root cause of "Invalid token" 401s.
  try {
    const sb = getSupabaseAnonClient();
    const { data } = await sb.auth.getSession();
    const token = data?.session?.access_token;
    console.log('[TRACE] getAccessToken:', token ? 'TOKEN_RETRIEVED' : 'NO_TOKEN');
    if (token) return token;
  } catch (e) {
    console.log('[TRACE] getAccessToken: ERROR:', e instanceof Error ? e.message : String(e));
  }
  return '';
}

function resolveUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const base = process.env.REACT_APP_RAILWAY_API_URL || '';
  if (base && path.startsWith('/api/')) return `${base}${path}`;
  return path;
}

export async function apiFetch<T = any>(path: string, opts: RequestInit = {}, _retry = true): Promise<T> {
  console.log('[TRACE] apiFetch: START path=' + path);
  const token = await getAccessToken();
  console.log('[TRACE] apiFetch: GOT TOKEN, hasToken=' + !!token);

  const headers = new Headers(opts.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && opts.body && !(opts.body instanceof FormData) && typeof opts.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const url = resolveUrl(path);
  console.log('[TRACE] apiFetch: RESOLVED_URL=' + url);
  console.log('[TRACE] apiFetch: CALLING fetch()');

  const r = await fetch(url, { ...opts, headers });
  console.log('[TRACE] apiFetch: FETCH RETURNED status=' + r.status);

  // 401: attempt one session refresh then retry
  if (r.status === 401 && _retry) {
    console.log('[TRACE] apiFetch: 401 DETECTED, REFRESHING SESSION');
    try {
      await getSupabaseAnonClient().auth.refreshSession();
    } catch { /* ignore */ }
    return apiFetch(path, opts, false);
  }

  if (r.ok) {
    console.log('[TRACE] apiFetch: r.ok=true');
    if (r.status === 204) return undefined as any;
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) return r.json();
    return r.text() as any;
  }

  console.log('[TRACE] apiFetch: r.ok=false, status=' + r.status);
  let msg = `API ${r.status} ${r.statusText}`;
  try {
    const j = await r.json();
    msg = j?.error || j?.message || msg;
  } catch {}
  console.log('[TRACE] apiFetch: THROWING ERROR: ' + msg);
  throw new Error(msg);
}

export const apiGet    = <T = any>(path: string) => apiFetch<T>(path, { method: 'GET' });
export const apiPost   = <T = any>(path: string, body?: any) =>
  apiFetch<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiPatch  = <T = any>(path: string, body?: any) =>
  apiFetch<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiDelete = <T = any>(path: string, body?: any) =>
  apiFetch<T>(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined });
