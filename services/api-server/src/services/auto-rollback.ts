import { supabaseAdmin } from '../config/supabase.js';
import { getErrorRate } from './metrics.js';
import { logger } from '../utils/logger.js';

export interface RollbackCheck {
  status: string;
  message: string;
  metrics: {
    error_rate: number;
    avg_latency: number;
  };
  rollback_triggered: boolean;
}

export async function checkAutoRollback(): Promise<RollbackCheck> {
  try {
    const { data: flags, error: flagError } = await supabaseAdmin
      .from('feature_flags')
      .select('*')
      .eq('flag_name', 'api_railway_rollout')
      .single();

    if (flagError || !flags) {
      logger.error('Failed to fetch feature flags:', flagError);
      return {
        status: 'error',
        message: 'Failed to check feature flags',
        metrics: { error_rate: 0, avg_latency: 0 },
        rollback_triggered: false,
      };
    }

    if (!flags.auto_rollback_enabled || flags.rollout_percentage === 0) {
      return {
        status: 'ok',
        message: 'Auto-rollback not enabled or already at 0%',
        metrics: { error_rate: 0, avg_latency: 0 },
        rollback_triggered: false,
      };
    }

    const errorRate = await getErrorRate('railway', flags.monitoring_window_minutes);

    // Simulate avg_latency for now (would come from metrics in full implementation)
    const { data: metrics, error: metricsError } = await supabaseAdmin
      .from('api_metrics')
      .select('response_time')
      .eq('provider', 'railway')
      .gte('timestamp', new Date(Date.now() - flags.monitoring_window_minutes * 60 * 1000).toISOString());

    const avgLatency = (metrics && metrics.length > 0)
      ? metrics.reduce((sum: number, m: any) => sum + m.response_time, 0) / metrics.length
      : 0;

    const shouldRollback = errorRate > flags.error_rate_threshold || avgLatency > flags.latency_threshold_ms;

    if (shouldRollback) {
      logger.warn(`Auto-rollback triggered: error_rate=${errorRate}%, latency=${avgLatency}ms`);
      return {
        status: 'warning',
        message: `Auto-rollback condition met: error_rate=${errorRate.toFixed(2)}%, latency=${avgLatency.toFixed(0)}ms`,
        metrics: { error_rate: errorRate, avg_latency: avgLatency },
        rollback_triggered: true,
      };
    }

    return {
      status: 'ok',
      message: 'All metrics within acceptable ranges',
      metrics: { error_rate: errorRate, avg_latency: avgLatency },
      rollback_triggered: false,
    };
  } catch (err) {
    logger.error('Error in checkAutoRollback:', err);
    return {
      status: 'error',
      message: 'Error checking auto-rollback conditions',
      metrics: { error_rate: 0, avg_latency: 0 },
      rollback_triggered: false,
    };
  }
}

export async function executeAutoRollback(
  reason: string,
  errorRate?: number,
  avgLatency?: number
): Promise<boolean> {
  try {
    const { data: flags, error: flagError } = await supabaseAdmin
      .from('feature_flags')
      .select('rollout_percentage')
      .eq('flag_name', 'api_railway_rollout')
      .single();

    if (flagError || !flags) {
      logger.error('Failed to fetch rollout flag:', flagError);
      return false;
    }

    const previousPercentage = flags.rollout_percentage;

    // Update feature_flags
    const { error: updateError } = await supabaseAdmin
      .from('feature_flags')
      .update({ rollout_percentage: 0 })
      .eq('flag_name', 'api_railway_rollout');

    if (updateError) {
      logger.error('Failed to update rollout percentage:', updateError);
      return false;
    }

    // Log to feature_rollback_events
    const { error: logError } = await supabaseAdmin
      .from('feature_rollback_events')
      .insert([
        {
          flag_name: 'api_railway_rollout',
          previous_rollout_percentage: previousPercentage,
          new_rollout_percentage: 0,
          trigger_reason: reason,
          error_rate: errorRate,
          avg_latency: avgLatency,
        },
      ]);

    if (logError) {
      logger.error('Failed to log rollback event:', logError);
      return false;
    }

    logger.warn(`Auto-rollback executed: ${previousPercentage}% → 0% (reason: ${reason})`);
    return true;
  } catch (err) {
    logger.error('Error in executeAutoRollback:', err);
    return false;
  }
}

export async function checkAndExecuteAutoRollback(): Promise<boolean> {
  const check = await checkAutoRollback();
  if (check.rollback_triggered) {
    return executeAutoRollback('error_rate', check.metrics.error_rate, check.metrics.avg_latency);
  }
  return false;
}
