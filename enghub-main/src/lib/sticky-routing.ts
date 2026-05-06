import { getSupabaseAnonClient } from '../api/supabaseClient';

export interface StickySession {
  session_id: string;
  selected_provider: 'vercel' | 'railway';
  hash_value: number;
  expires_at: string;
}

let cachedProvider: 'vercel' | 'railway' | null = null;
let cachedSessionId: string | null = null;

function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function hashUserId(userId: string | undefined): number {
  if (!userId) return Math.floor(Math.random() * 100);
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % 100;
}

export async function getStickyRoutingProvider(
  userId: string | undefined,
  rolloutPercentage: number,
): Promise<'vercel' | 'railway'> {
  // Check sessionStorage first (fast path)
  if (typeof window !== 'undefined') {
    const cached = sessionStorage.getItem('sticky_provider');
    if (cached) {
      cachedProvider = cached as 'vercel' | 'railway';
      return cachedProvider;
    }
  }

  const sessionId = cachedSessionId || generateSessionId();
  cachedSessionId = sessionId;

  // Determine provider based on hash and rollout percentage
  const hashValue = hashUserId(userId);
  const provider = hashValue < rolloutPercentage ? 'railway' : 'vercel';

  // Save to sessionStorage for subsequent requests
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('sticky_provider', provider);
  }

  // Save to Supabase for persistence (async, non-blocking)
  if (userId) {
    saveStickySession(sessionId, userId, provider, hashValue).catch(err => {
      console.warn('Failed to save sticky session:', err);
    });
  }

  cachedProvider = provider;
  return provider;
}

async function saveStickySession(
  sessionId: string,
  userId: string,
  provider: 'vercel' | 'railway',
  hashValue: number,
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const sb = getSupabaseAnonClient();

    const { error } = await sb
      .from('sticky_routing_sessions')
      .insert({
        session_id: sessionId,
        user_id: userId,
        selected_provider: provider,
        hash_value: hashValue,
        expires_at: expiresAt,
      });

    if (error) {
      console.warn('Error saving sticky session:', error);
    }
  } catch (err) {
    console.warn('Error in saveStickySession:', err);
  }
}

export function getCachedStickyProvider(): 'vercel' | 'railway' | null {
  if (typeof window !== 'undefined') {
    const cached = sessionStorage.getItem('sticky_provider');
    if (cached) return cached as 'vercel' | 'railway';
  }
  return cachedProvider;
}

export function clearStickyRouting(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('sticky_provider');
  }
  cachedProvider = null;
  cachedSessionId = null;
}

export function forceStickyProvider(provider: 'vercel' | 'railway'): void {
  cachedProvider = provider;
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('sticky_provider', provider);
  }
}
