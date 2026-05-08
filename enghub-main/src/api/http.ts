// HTTP helper — all /api/* calls route to Railway API Server
// REACT_APP_RAILWAY_API_URL must be set in production build args

import { getSupabaseAnonClient } from './supabaseClient';

async function getAccessToken(): Promise<string> {
  // Single source of truth: Supabase JS client session (auto-refreshed by autoRefreshToken:true).
  // No localStorage fallback — stale tokens were the root cause of "Invalid token" 401s.
  try {
    const sb = getSupabaseAnonClient();
    const { data } = await sb.auth.getSession();
    if (data?.session?.access_token) return data.session.access_token;
  } catch { /* ignore */ }
  return '';
}

function resolveUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const base = process.env.REACT_APP_RAILWAY_API_URL || '';
  if (base && path.startsWith('/api/')) return `${base}${path}`;
  return path;
}

export async function apiFetch<T = any>(path: string, opts: RequestInit = {}, _retry = true): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(opts.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && opts.body && !(opts.body instanceof FormData) && typeof opts.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const url = resolveUrl(path);
  const r = await fetch(url, { ...opts, headers });

  // 401: attempt one session refresh then retry
  if (r.status === 401 && _retry) {
    try {
      await getSupabaseAnonClient().auth.refreshSession();
    } catch { /* ignore */ }
    return apiFetch(path, opts, false);
  }

  if (r.ok) {
    if (r.status === 204) return undefined as any;
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('application/json')) return r.json();
    return r.text() as any;
  }

  let msg = `API ${r.status} ${r.statusText}`;
  try {
    const j = await r.json();
    msg = j?.error || j?.message || msg;
  } catch {}
  throw new Error(msg);
}

export const apiGet    = <T = any>(path: string) => apiFetch<T>(path, { method: 'GET' });
export const apiPost   = <T = any>(path: string, body?: any) =>
  apiFetch<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiPatch  = <T = any>(path: string, body?: any) =>
  apiFetch<T>(path, { method: 'PATCH', body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiDelete = <T = any>(path: string, body?: any) =>
  apiFetch<T>(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined });
