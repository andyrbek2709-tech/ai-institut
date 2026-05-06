/**
 * API Rollout Configuration
 * Controls gradual migration from Vercel to Railway
 *
 * Stages:
 * 0% → All Vercel
 * 10% → 10% Railway (stable hash by userId)
 * 50% → 50% Railway
 * 100% → All Railway (Vercel disabled)
 */

export interface RolloutConfig {
  /**
   * Percentage of users routed to Railway (0-100)
   * Users are stably distributed based on userId hash
   */
  railwayPercentage: number;

  /**
   * Enable monitoring/logging
   */
  enableMonitoring: boolean;

  /**
   * Log all API decisions
   */
  verboseLogging: boolean;
}

/**
 * Default rollout config
 * Production: 100% Railway (migration complete)
 * Vercel kept as reserve but not used
 */
export const DEFAULT_ROLLOUT_CONFIG: RolloutConfig = {
  railwayPercentage: 100, // Stage 100: All Railway (migration complete)
  enableMonitoring: true,
  verboseLogging: false,
};

/**
 * Get rollout config from environment
 * Can be overridden via:
 * - REACT_APP_RAILWAY_ROLLOUT_PERCENTAGE env var
 * - localStorage (for testing)
 * - query param ?rollout=50
 */
export function getRolloutConfig(): RolloutConfig {
  const config = { ...DEFAULT_ROLLOUT_CONFIG };

  // 1. Check URL query param (?rollout=50)
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const rolloutParam = params.get('rollout');
    if (rolloutParam) {
      const percentage = parseInt(rolloutParam, 10);
      if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
        config.railwayPercentage = percentage;
      }
    }

    // 2. Check localStorage (persistent override for testing)
    try {
      const stored = localStorage.getItem('RAILWAY_ROLLOUT_PERCENTAGE');
      if (stored) {
        const percentage = parseInt(stored, 10);
        if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
          config.railwayPercentage = percentage;
        }
      }
    } catch {
      // localStorage not available (SSR, privacy mode)
    }
  }

  // 3. Check environment variable
  const envRollout = process.env.REACT_APP_RAILWAY_ROLLOUT_PERCENTAGE;
  if (envRollout) {
    const percentage = parseInt(envRollout, 10);
    if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
      config.railwayPercentage = percentage;
    }
  }

  return config;
}

/**
 * Set rollout percentage (for testing/admin)
 * Saves to localStorage
 */
export function setRolloutPercentage(percentage: number) {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Rollout percentage must be between 0 and 100');
  }

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('RAILWAY_ROLLOUT_PERCENTAGE', percentage.toString());
  }
}

/**
 * Clear rollout override (return to env/default)
 */
export function clearRolloutOverride() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('RAILWAY_ROLLOUT_PERCENTAGE');
  }
}
