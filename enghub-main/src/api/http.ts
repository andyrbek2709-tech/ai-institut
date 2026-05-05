// HTTP helper для вызовов /api/* и /rest/v1/* endpoints
// Поддерживает маршрутизацию между Vercel и Railway API
// Всегда подставляет user JWT из текущей Supabase-сессии.

import { getSupabaseAnonClient } from './supabaseClient';
import { getApiProvider, getApiBaseUrl } from '../config/api';

async function getAccessToken(): Promise<string> {
  // Primary: токен сохранённый LoginPage через прямой fetch /auth/v1/token (см. signIn в supabase.ts).
  // Этот путь активен прямо сейчас на проде — supabase-js клиент сессию НЕ знает.
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem('enghub_token');
      if (stored) return stored;
    }
  } catch {
    /* SSR / privacy mode */
  }
  // Fallback: на случай миграции на supabase-js sign-in.
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
 * - Vercel API: relative URLs (/api/tasks) stay relative
 * - Railway API: prepend base URL for all requests
 */
function resolveUrl(path: string): string {
  const provider = getApiProvider();

  if (provider === 'railway') {
    const baseUrl = getApiBaseUrl();
    if (path.startsWith('http')) {
      return path; // Absolute URL, use as-is
    }
    return `${baseUrl}${path}`;
  }

  // Vercel: use relative URLs
  return path;
}

export async function apiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(opts.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && opts.body && !(opts.body instanceof FormData) && typeof opts.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const url = resolveUrl(path);
  const r = await fetch(url, { ...opts, headers });

  if (!r.ok) {
    let msg = `API ${r.status} ${r.statusText}`;
    try {
      const j = await r.json();
      msg = j?.error || j?.message || msg;
    } catch {}
    throw new Error(msg);
  }
  if (r.status === 204) return undefined as any;
  const ct = r.headers.get('content-type') || '';
  if (ct.includes('application/json')) return r.json();
  return r.text() as any;
}

// Удобные обёртки
export const apiGet  = <T = any>(path: string) => apiFetch<T>(path, { method: 'GET' });
export const apiPost = <T = any>(path: string, body?: any) =>
  apiFetch<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiDelete = <T = any>(path: string, body?: any) =>
  apiFetch<T>(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined });
