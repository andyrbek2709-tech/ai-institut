/**
 * API Configuration
 * All traffic routed to Railway (migration from Vercel complete as of 2026-04)
 */

export interface RolloutConfig {
  railwayPercentage: number;
  enableMonitoring: boolean;
  verboseLogging: boolean;
}

export const DEFAULT_ROLLOUT_CONFIG: RolloutConfig = {
  railwayPercentage: 100,
  enableMonitoring: true,
  verboseLogging: false,
};

export function getRolloutConfig(): RolloutConfig {
  const config = { ...DEFAULT_ROLLOUT_CONFIG };

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const rolloutParam = params.get('rollout');
    if (rolloutParam) {
      const percentage = parseInt(rolloutParam, 10);
      if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
        config.railwayPercentage = percentage;
      }
    }

    try {
      const stored = localStorage.getItem('RAILWAY_ROLLOUT_PERCENTAGE');
      if (stored) {
        const percentage = parseInt(stored, 10);
        if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
          config.railwayPercentage = percentage;
        }
      }
    } catch {
      // localStorage not available
    }
  }

  const envRollout = process.env.REACT_APP_RAILWAY_ROLLOUT_PERCENTAGE;
  if (envRollout) {
    const percentage = parseInt(envRollout, 10);
    if (!isNaN(percentage) && percentage >= 0 && percentage <= 100) {
      config.railwayPercentage = percentage;
    }
  }

  return config;
}

export function setRolloutPercentage(percentage: number) {
  if (percentage < 0 || percentage > 100) {
    throw new Error('Rollout percentage must be between 0 and 100');
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('RAILWAY_ROLLOUT_PERCENTAGE', percentage.toString());
  }
}

export function clearRolloutOverride() {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('RAILWAY_ROLLOUT_PERCENTAGE');
  }
}
