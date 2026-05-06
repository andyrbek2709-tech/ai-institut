// HTTP helper с поддержкой rollout-based API routing
// Маршрутизирует между Vercel и Railway на основе rollout процента
// Включает мониторинг производительности и ошибок

import { getSupabaseAnonClient } from './supabaseClient';
import { getApiProvider, getApiBaseUrl, getApiSelectionReason } from '../config/api';
import { apiMonitor } from '../lib/api-monitoring';

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
 * All traffic now goes through Railway
 */
function resolveUrl(path: string): string {
  const baseUrl = getApiBaseUrl();
  if (path.startsWith('http')) {
    return path; // Absolute URL
  }
  return `${baseUrl}${path}`;
}

/**
 * Log API decision for debugging
 */
function logApiDecision(path: string) {
  const provider = getApiProvider();
  const reason = getApiSelectionReason();
  const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';

  if (isDev && typeof (window as any).__DEBUG_API !== 'undefined') {
    console.debug(`[API] ${provider.toUpperCase()}: ${path} (${reason})`);
  }
}

export async function apiFetch<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers = new Headers(opts.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && opts.body && !(opts.body instanceof FormData) && typeof opts.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  const url = resolveUrl(path);
  const provider = getApiProvider();
  const startTime = performance.now();

  logApiDecision(path);

  try {
    const r = await fetch(url, { ...opts, headers });
    const latency = performance.now() - startTime;

    if (r.ok) {
      apiMonitor.recordSuccess(provider, latency);
    } else {
      apiMonitor.recordError(provider, `HTTP ${r.status}`, r.status, latency);

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
  } catch (error) {
    const latency = performance.now() - startTime;
    apiMonitor.recordError(provider, error, undefined, latency);
    throw error;
  }
}

// Удобные обёртки
export const apiGet  = <T = any>(path: string) => apiFetch<T>(path, { method: 'GET' });
export const apiPost = <T = any>(path: string, body?: any) =>
  apiFetch<T>(path, { method: 'POST', body: body !== undefined ? JSON.stringify(body) : undefined });
export const apiDelete = <T = any>(path: string, body?: any) =>
  apiFetch<T>(path, { method: 'DELETE', body: body !== undefined ? JSON.stringify(body) : undefined });
