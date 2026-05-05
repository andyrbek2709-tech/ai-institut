import { getSupabaseClient } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { getErrorRate, getMetricsSummary } from './metrics.js';

export interface RollbackThresholds {
  error_rate_threshold: number;
  latency_threshold_ms: number;
  monitoring_window_minutes: number;
}

export interface RollbackCheck {
  should_rollback: boolean;
  trigger_reason?: 'error_rate' | 'latency' | 'none';
  error_rate?: number;
  avg_latency?: number;
  message: string;
}

/**
 * Check if we should auto-rollback Railway traffic
 * Returns true if metrics exceed thresholds
 */
export async function checkAutoRollback(): Promise<RollbackCheck> {
  try {
    const supabase = getSupabaseClient();

    // Get auto-rollback feature flag settings
    const { data: flagData, error: flagError } = await supabase
      .from('feature_flags')
      .select('auto_rollback_enabled, error_rate_threshold, latency_threshold_ms, monitoring_window_minutes')
      .eq('flag_name', 'auto_rollback')
      .single();

    if (flagError || !flagData?.auto_rollback_enabled) {
      return {
        should_rollback: false,
        trigger_reason: 'none',
        message: 'Auto-rollback disabled',
      };
    }

    const thresholds = flagData as RollbackThresholds;

    // Get Railway metrics
    const metricsData = await getMetricsSummary(1);
    const railwayMetrics = metricsData.railway;

    if (railwayMetrics.length === 0) {
      return {
        should_rollback: false,
        trigger_reason: 'none',
        message: 'No Railway metrics available',
      };
    }

    // Calculate average metrics
    const avgErrorRate = railwayMetrics.reduce((sum, m) => sum + m.error_rate, 0) / railwayMetrics.length;
    const avgLatency = railwayMetrics.reduce((sum, m) => sum + m.avg_latency, 0) / railwayMetrics.length;

    // Check thresholds
    if (avgErrorRate > thresholds.error_rate_threshold) {
      return {
        should_rollback: true,
        trigger_reason: 'error_rate',
        error_rate: avgErrorRate,
        avg_latency: avgLatency,
        message: `Error rate ${avgErrorRate.toFixed(2)}% exceeds threshold ${thresholds.error_rate_threshold}%`,
      };
    }

    if (avgLatency > thresholds.latency_threshold_ms) {
      return {
        should_rollback: true,
        trigger_reason: 'latency',
        error_rate: avgErrorRate,
        avg_latency: avgLatency,
        message: `Average latency ${avgLatency.toFixed(0)}ms exceeds threshold ${thresholds.latency_threshold_ms}ms`,
      };
    }

    return {
      should_rollback: false,
      trigger_reason: 'none',
      error_rate: avgErrorRate,
      avg_latency: avgLatency,
      message: 'Metrics within acceptable range',
    };
  } catch (err) {
    logger.error('Error checking auto-rollback:', err);
    return {
      should_rollback: false,
      trigger_reason: 'none',
      message: 'Error during rollback check',
    };
  }
}

/**
 * Execute auto-rollback: set rolloutPercentage to 0
 */
export async function executeAutoRollback(
  reason: 'error_rate' | 'latency',
  errorRate?: number,
  avgLatency?: number,
): Promise<boolean> {
  try {
    const supabase = getSupabaseClient();

    // Get current rollout percentage
    const { data: currentFlag } = await supabase
      .from('feature_flags')
      .select('rollout_percentage')
      .eq('flag_name', 'api_railway_rollout')
      .single();

    if (!currentFlag || currentFlag.rollout_percentage === 0) {
      logger.warn('Already at 0%, no rollback needed');
      return false;
    }

    const previousPercentage = currentFlag.rollout_percentage;

    // Update rollout percentage to 0
    const { error: updateError } = await supabase
      .from('feature_flags')
      .update({
        rollout_percentage: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('flag_name', 'api_railway_rollout');

    if (updateError) {
      throw updateError;
    }

    // Log rollback event
    await supabase.from('feature_rollback_events').insert({
      flag_name: 'api_railway_rollout',
      previous_rollout_percentage: previousPercentage,
      new_rollout_percentage: 0,
      trigger_reason: reason,
      error_rate: errorRate,
      avg_latency: avgLatency,
    });

    logger.warn(`🚨 AUTO-ROLLBACK TRIGGERED: ${reason}`, {
      previous_percentage: previousPercentage,
      error_rate: errorRate,
      avg_latency: avgLatency,
    });

    return true;
  } catch (err) {
    logger.error('Error executing auto-rollback:', err);
    return false;
  }
}

/**
 * Check and execute auto-rollback in one call
 */
export async function checkAndExecuteAutoRollback(): Promise<boolean> {
  const check = await checkAutoRollback();

  if (check.should_rollback && check.trigger_reason) {
    return await executeAutoRollback(
      check.trigger_reason,
      check.error_rate,
      check.avg_latency,
    );
  }

  return false;
}
