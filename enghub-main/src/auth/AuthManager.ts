// AuthManager — single authority for auth lifecycle
// All session operations go through this module.
// Supabase JS client is the sole source of truth for auth state.

import { getSupabaseAnonClient } from '../api/supabaseClient';

export type AuthChangeCallback = (token: string | null, email: string) => void;

class AuthManager {
  private callbacks: Set<AuthChangeCallback> = new Set();
  private unsubscribe: (() => void) | null = null;

  // Initialize once at app startup. Returns cleanup fn.
  initialize(): () => void {
    const sb = getSupabaseAnonClient();
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      const token = session?.access_token ?? null;
      const email = session?.user?.email ?? '';
      this.callbacks.forEach(cb => cb(token, email));
    });
    this.unsubscribe = () => subscription.unsubscribe();
    return this.unsubscribe;
  }

  // Subscribe to auth state changes. Returns unsubscribe fn.
  subscribe(cb: AuthChangeCallback): () => void {
    this.callbacks.add(cb);
    return () => this.callbacks.delete(cb);
  }

  // Always returns a fresh token from the Supabase JS session.
  async getToken(): Promise<string> {
    const sb = getSupabaseAnonClient();
    const { data } = await sb.auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
    // Session missing — attempt refresh (handles page reload edge case)
    const { data: refreshed } = await sb.auth.refreshSession();
    return refreshed.session?.access_token ?? '';
  }

  // Full sign-out: clears Supabase session + UI preferences.
  async signOut(): Promise<void> {
    const sb = getSupabaseAnonClient();
    await sb.auth.signOut().catch(() => {});
    localStorage.removeItem('enghub_email');
    localStorage.removeItem('enghub_screen');
    localStorage.removeItem('enghub_sidetab');
    localStorage.removeItem('enghub_admin_tab');
  }

  destroy(): void {
    this.unsubscribe?.();
    this.callbacks.clear();
  }
}

export const authManager = new AuthManager();
