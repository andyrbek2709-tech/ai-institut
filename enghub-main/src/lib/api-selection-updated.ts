/**
 * API Selection Logic (Updated)
 * - Stably distributes users between Vercel and Railway based on userId hash
 * - Integrates sticky routing to ensure same user stays on same provider per session
 * - Respects feature flags and auto-rollback settings
 */

import { getRolloutConfig } from '../config/api-rollout';
import { getStickyRoutingProvider, getCachedStickyProvider } from './sticky-routing';
import type { ApiProvider } from '../config/api';

interface SelectionContext {
  userId?: number | string;
  sessionId?: string;
  forceProvider?: ApiProvider;
}

/**
 * Simple hash function to distribute users stably
 * Same userId always produces same hash value
 */
function hashUserId(userId: number | string): number {
  const str = String(userId);
  let hash = 0;

  for (let i = 0; i < str.length; i++) {
    hash = (hash + str.charCodeAt(i)) % 100;
  }

  return hash;
}

/**
 * Determine which API provider to use for a user
 * 
 * Flow:
 * 1. Check force override (testing)
 * 2. Check localStorage override (dev testing)
 * 3. Check query param override (testing)
 * 4. Check sticky routing cache (fast path)
 * 5. Check sticky routing DB (sticky session)
 * 6. Use stable hash distribution based on rollout percentage
 */
export async function selectApiProvider(
  context: SelectionContext = {},
): Promise<{ provider: ApiProvider; reason: string }> {
  const { userId, sessionId, forceProvider } = context;
  const config = getRolloutConfig();

  // 1. Force override (for testing)
  if (forceProvider) {
    return {
      provider: forceProvider,
      reason: 'forced override',
    };
  }

  // 2. localStorage override (persistent test flag)
  if (typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem('FORCE_API_PROVIDER');
      if (stored === 'vercel' || stored === 'railway') {
        return {
          provider: stored,
          reason: 'localStorage override',
        };
      }
    } catch {
      // Ignore localStorage errors (SSR, privacy mode)
    }
  }

  // 3. Query param override (?api=railway)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const apiParam = params.get('api');
    if (apiParam === 'vercel' || apiParam === 'railway') {
      return {
        provider: apiParam,
        reason: 'query param override',
      };
    }
  }

  // 4. Check sticky routing cache (no DB call)
  const cachedProvider = getCachedStickyProvider();
  if (cachedProvider) {
    return {
      provider: cachedProvider,
      reason: 'sticky routing (cached)',
    };
  }

  // 5. Stable hash distribution (production logic)
  if (config.railwayPercentage === 0) {
    return {
      provider: 'vercel',
      reason: 'rollout: 0% (all Vercel)',
    };
  }

  if (config.railwayPercentage === 100) {
    return {
      provider: 'railway',
      reason: 'rollout: 100% (all Railway)',
    };
  }

  // Use userId for stable distribution
  const hashValue = userId ? hashUserId(userId) : Math.floor(Math.random() * 100);
  const threshold = 100 - config.railwayPercentage; // 90 for 10% rollout
  const selectedProvider: ApiProvider = hashValue >= threshold ? 'railway' : 'vercel';

  // 6. Check sticky routing DB and cache result
  let provider = selectedProvider;
  const reason = `rollout: ${config.railwayPercentage}% (${selectedProvider} @ hash=${hashValue})`;

  if (userId && config.stickyRoutingEnabled) {
    try {
      provider = await getStickyRoutingProvider(
        String(userId),
        selectedProvider,
        hashValue,
      );
      
      if (provider !== selectedProvider) {
        return {
          provider,
          reason: 'sticky routing (DB)',
        };
      }
    } catch (err) {
      console.error('Sticky routing error:', err);
      // Fall back to hash-based selection
    }
  }

  return {
    provider,
    reason,
  };
}

/**
 * Force API provider (for testing)
 * Saves to localStorage
 */
export function forceApiProvider(provider: ApiProvider | null) {
  if (typeof localStorage === 'undefined') return;

  if (provider === null) {
    localStorage.removeItem('FORCE_API_PROVIDER');
  } else {
    localStorage.setItem('FORCE_API_PROVIDER', provider);
  }
}

/**
 * Log API selection decision
 */
export function logApiSelection(
  userId: number | string | undefined,
  result: { provider: ApiProvider; reason: string },
) {
  const config = getRolloutConfig();

  if (!config.enableMonitoring) return;

  const level = config.verboseLogging ? 'debug' : 'info';
  const timestamp = new Date().toISOString();

  console.log(
    `[${timestamp}] API Selection: user=${userId} → ${result.provider.toUpperCase()} (${result.reason})`,
  );
}

/**
 * Get selection metrics (for monitoring)
 */
export function getSelectionMetrics() {
  const config = getRolloutConfig();
  return {
    railwayPercentage: config.railwayPercentage,
    stickyRoutingEnabled: config.stickyRoutingEnabled,
    enableMonitoring: config.enableMonitoring,
    verboseLogging: config.verboseLogging,
    stage:
      config.railwayPercentage === 0
        ? '0% (baseline)'
        : config.railwayPercentage === 10
          ? '10% (canary)'
          : config.railwayPercentage === 50
            ? '50% (ramp up)'
            : config.railwayPercentage === 100
              ? '100% (complete)'
              : `${config.railwayPercentage}% (custom)`,
  };
}
