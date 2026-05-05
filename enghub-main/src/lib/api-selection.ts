/**
 * API Selection Logic
 * Stably distributes users between Vercel and Railway
 * based on userId hash
 */

import { getRolloutConfig } from '../config/api-rollout';

export type ApiProvider = 'vercel' | 'railway';

interface SelectionContext {
  userId?: number;
  sessionId?: string;
  forceProvider?: ApiProvider;
}

/**
 * Simple hash function to distribute users stably
 * Same userId always produces same hash value
 * Implementation: sum of character codes modulo 100
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
 * Logic:
 * 1. Check force override (testing)
 * 2. Check localStorage override (dev testing)
 * 3. Check query param override (testing)
 * 4. Use stable hash to distribute users based on rollout percentage
 *
 * Example:
 * - rolloutPercentage = 10
 * - userId = 123
 * - hash(123) = 45
 * - 45 >= 90 (100 - 10) → Railway (45 in top 10%)
 * - userId = 456
 * - hash(456) = 12
 * - 12 < 90 → Vercel (12 in bottom 90%)
 */
export function selectApiProvider(
  context: SelectionContext = {},
): { provider: ApiProvider; reason: string } {
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

  // 4. Stable hash distribution (production logic)
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
  const hashValue = userId ? hashUserId(userId) : 0;
  const threshold = 100 - config.railwayPercentage; // 90 for 10% rollout

  const provider: ApiProvider = hashValue >= threshold ? 'railway' : 'vercel';
  const rolloutReason = `rollout: ${config.railwayPercentage}% (${provider} @ hash=${hashValue})`;

  return {
    provider,
    reason: rolloutReason,
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
  userId: number | undefined,
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
