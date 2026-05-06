import { getRolloutConfig } from '../config/api-rollout';
import { getSupabaseAnonClient } from '../api/supabaseClient';
import { getStickyRoutingProvider, getCachedStickyProvider } from './sticky-routing';

export type ApiProvider = 'vercel' | 'railway';

interface ApiSelection {
  provider: ApiProvider;
  reason: string;
  rolloutPercentage: number;
}

let cachedSelection: ApiSelection | null = null;
let lastCheckTime = 0;
const CACHE_TTL_MS = 60000; // 1 minute

export async function selectApiProvider(userId: string | undefined): Promise<ApiSelection> {
  // Check if selection is cached and still valid
  if (cachedSelection && Date.now() - lastCheckTime < CACHE_TTL_MS) {
    return cachedSelection;
  }

  // Check for overrides
  if (typeof window !== 'undefined') {
    const forceProvider = sessionStorage.getItem('force_api_provider');
    if (forceProvider === 'vercel' || forceProvider === 'railway') {
      cachedSelection = {
        provider: forceProvider,
        reason: 'Force override (dev)',
        rolloutPercentage: 0,
      };
      return cachedSelection;
    }
  }

  try {
    // Get rollout percentage from feature flags
    const sb = getSupabaseAnonClient();
    const { data: flagData, error: flagError } = await sb
      .from('feature_flags')
      .select('rollout_percentage, enabled')
      .eq('flag_name', 'api_railway_rollout')
      .single();

    if (flagError || !flagData) {
      console.warn('Failed to fetch feature flags, defaulting to Vercel');
      cachedSelection = {
        provider: 'vercel',
        reason: 'Feature flags unavailable',
        rolloutPercentage: 0,
      };
      lastCheckTime = Date.now();
      return cachedSelection;
    }

    if (!flagData.enabled) {
      cachedSelection = {
        provider: 'vercel',
        reason: 'Railway rollout disabled',
        rolloutPercentage: 0,
      };
      lastCheckTime = Date.now();
      return cachedSelection;
    }

    // Check sticky routing first (fast path)
    const cachedSticky = getCachedStickyProvider();
    if (cachedSticky) {
      cachedSelection = {
        provider: cachedSticky,
        reason: 'Sticky routing (cached)',
        rolloutPercentage: flagData.rollout_percentage,
      };
      lastCheckTime = Date.now();
      return cachedSelection;
    }

    // Determine provider using sticky routing
    const provider = await getStickyRoutingProvider(userId, flagData.rollout_percentage);

    cachedSelection = {
      provider,
      reason: `Sticky routing (${provider === 'railway' ? 'Railway' : 'Vercel'})`,
      rolloutPercentage: flagData.rollout_percentage,
    };
    lastCheckTime = Date.now();

    return cachedSelection;
  } catch (err) {
    console.error('Error selecting API provider:', err);
    cachedSelection = {
      provider: 'vercel',
      reason: 'Error during selection, defaulting to Vercel',
      rolloutPercentage: 0,
    };
    lastCheckTime = Date.now();
    return cachedSelection;
  }
}

export function getApiProvider(): ApiProvider {
  return cachedSelection?.provider || 'vercel';
}

export function getApiSelectionReason(): string {
  return cachedSelection?.reason || 'No selection made yet';
}

export function getRolloutPercentage(): number {
  return cachedSelection?.rolloutPercentage || 0;
}

export function setApiProvider(provider: ApiProvider): void {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('force_api_provider', provider);
  }
}

export function clearApiProvider(): void {
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('force_api_provider');
  }
}

export interface SelectionMetrics {
  stage: string;
  enableMonitoring: boolean;
  verboseLogging: boolean;
}

export function getSelectionMetrics(): SelectionMetrics {
  const config = getRolloutConfig();
  const provider = getApiProvider();
  const rolloutPercentage = getRolloutPercentage();

  let stage = 'Stage 0';
  if (rolloutPercentage > 0 && rolloutPercentage <= 10) {
    stage = 'Stage 1: 10% Railway';
  } else if (rolloutPercentage > 10 && rolloutPercentage <= 50) {
    stage = 'Stage 2: 50% Railway';
  } else if (rolloutPercentage > 50 && rolloutPercentage < 100) {
    stage = 'Stage 3: >50% Railway';
  } else if (rolloutPercentage === 100) {
    stage = 'Stage 4: 100% Railway (Migration Complete)';
  }

  return {
    stage,
    enableMonitoring: config.enableMonitoring,
    verboseLogging: config.verboseLogging,
  };
}
