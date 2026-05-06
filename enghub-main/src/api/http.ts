// HTTP helper for API calls via Vercel functions
// All API calls go through /api/* endpoints
// Tasks and main data come directly from Supabase

import { getSupabaseAnonClient } from './supabaseClient';

async function getAccessToken(): Promise<string> {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('enghub_token');
      if (stored) return stored;
    }
  } catch {
    /* SSR / privacy mode */
  }

  try {
    const sb = getSupabaseAnonClient();
    const { data } = await sb.auth.getSession();
    return data?.session?.access_token || '';
  } catch {
    return '';
  }
}

/**
 * Resolve the full URL for a request
 * All API calls use relative paths (/api/*)
 */
function resolveUrl(path: string): string {
  if (path.startsWith('http')) {
    return path; // Absolute URL
  }
  return path;  // Relative path, will be served by same origin
}

export async function apiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(opts.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && opts.body && !(opts.body instanceof FormData) && typeof opts.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const url = resolveUrl(path);

  try {
    const r = await fetch(url, { ...opts, headers });

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
  } catch (error) {
    throw error;
  }
}

// Удобные обёртки
export const apiGet  = <T = any>(path: string) => apiFetch<T>(path, { method: 'GET' });
export const apiPost = <T = any>(path: string, body?: any) =>
  apiFetch<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiDelete = <T = any>(path: string, body?: any) =>
  apiFetch<T>(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined });
