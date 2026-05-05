/**
 * Sticky Routing
 * Ensures the same user gets the same provider throughout their session
 * Prevents user from switching between Vercel and Railway mid-session
 */

import { supabase } from '../lib/supabase';
import type { ApiProvider } from '../config/api';

const SESSION_STORAGE_KEY = 'STICKY_ROUTING_SESSION_ID';
const PROVIDER_STORAGE_KEY = 'STICKY_ROUTING_PROVIDER';
const COOKIE_NAME = 'sr_session_id';
const COOKIE_MAX_AGE = 86400; // 24 hours

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get or create session ID
 * Persisted in sessionStorage (survives page refresh within same tab)
 */
function getSessionId(): string {
  if (typeof sessionStorage === 'undefined') {
    return generateSessionId();
  }

  let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId);
  }

  return sessionId;
}

/**
 * Get or create sticky routing session in database
 * Returns the provider that was selected for this session
 */
export async function getStickyRoutingProvider(
  userId: string | undefined,
  selectedProvider: ApiProvider,
  hashValue: number,
): Promise<ApiProvider> {
  // If no user ID, can't use sticky routing
  if (!userId) {
    return selectedProvider;
  }

  try {
    const sessionId = getSessionId();

    // Check if session exists
    const { data: existing, error: selectError } = await supabase
      .from('sticky_routing_sessions')
      .select('selected_provider')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      // PGRST116 = no rows returned (expected on first visit)
      throw selectError;
    }

    // Session exists, use stored provider
    if (existing) {
      return existing.selected_provider as ApiProvider;
    }

    // Create new sticky routing session
    const { error: insertError } = await supabase.from('sticky_routing_sessions').insert({
      session_id: sessionId,
      user_id: userId,
      selected_provider: selectedProvider,
      hash_value: hashValue,
      expires_at: new Date(Date.now() + COOKIE_MAX_AGE * 1000).toISOString(),
    });

    if (insertError) {
      console.error('Failed to create sticky routing session:', insertError);
    }

    // Store in memory as well for quick access
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(PROVIDER_STORAGE_KEY, selectedProvider);
    }

    return selectedProvider;
  } catch (err) {
    console.error('Error in sticky routing:', err);
    // Fallback to selected provider if sticky routing fails
    return selectedProvider;
  }
}

/**
 * Get cached provider from session storage (no DB call)
 * Used for immediate response
 */
export function getCachedStickyProvider(): ApiProvider | null {
  if (typeof sessionStorage === 'undefined') {
    return null;
  }

  const cached = sessionStorage.getItem(PROVIDER_STORAGE_KEY);
  if (cached === 'vercel' || cached === 'railway') {
    return cached;
  }

  return null;
}

/**
 * Clear sticky routing session (on logout)
 */
export function clearStickyRouting(): void {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(SESSION_STORAGE_KEY);
    sessionStorage.removeItem(PROVIDER_STORAGE_KEY);
  }
}

/**
 * Force sticky provider for testing
 */
export function forceStickyProvider(provider: ApiProvider | null): void {
  if (typeof sessionStorage === 'undefined') return;

  if (provider === null) {
    sessionStorage.removeItem(PROVIDER_STORAGE_KEY);
  } else {
    sessionStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  }
}
