import { getSupabaseAdmin } from '../config/supabase.js';
import { getErrorRate } from './metrics.js';
import { logger } from '../utils/logger.js';
import { cache } from './cache.js';

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
    // Check cache first with aggressive 120s TTL
    const cacheKey = 'auto-rollback:check';
    const cached = cache.get<RollbackCheck>(cacheKey);
    if (cached) {
      return cached;
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Fetch feature flags (only needed columns)
    const { data: flags, error: flagError } = await supabaseAdmin
      .from('feature_flags')
      .select('auto_rollback_enabled,rollout_percentage,monitoring_window_minutes,error_rate_threshold,latency_threshold_ms')
      .eq('flag_name', 'api_railway_rollout')
      .single() as any;

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
      const result = {
        status: 'ok',
        message: 'Auto-rollback not enabled or already at 0%',
        metrics: { error_rate: 0, avg_latency: 0 },
        rollback_triggered: false,
      };
      // Cache longer when feature is disabled (nothing can change this state)
      cache.set(cacheKey, result, 120);
      return result;
    }

    // Parallel: fetch error rate and metrics using optimized SQL aggregate
    const [errorRate, { data: metrics, error: metricsError }] = await Promise.all([
      getErrorRate('railway', flags.monitoring_window_minutes),
      // Use PostgreSQL aggregate instead of JS reduce() - much faster for large datasets
      supabaseAdmin
        .from('api_metrics')
        .select('avg_response_time:response_time.avg(), count:count()', { count: 'exact' })
        .eq('provider', 'railway')
        .gte('timestamp', new Date(Date.now() - flags.monitoring_window_minutes * 60 * 1000).toISOString()),
    ]);

    // If PostgreSQL aggregates not available, use fallback
    let avgLatency = 0;
    if (metrics && Array.isArray(metrics) && metrics.length > 0) {
      // Try to get aggregated result from view
      avgLatency = (metrics[0] as any)?.avg_response_time || 0;
    }

    // Fallback to slower client-side calculation if needed
    if (avgLatency === 0 && metricsError) {
      const { data: allMetrics } = await supabaseAdmin
        .from('api_metrics')
        .select('response_time')
        .eq('provider', 'railway')
        .gte('timestamp', new Date(Date.now() - flags.monitoring_window_minutes * 60 * 1000).toISOString())
        .limit(1000); // Limit to avoid huge dataset

      if (allMetrics && allMetrics.length > 0) {
        avgLatency = allMetrics.reduce((sum: number, m: any) => sum + m.response_time, 0) / allMetrics.length;
      }
    }

    const shouldRollback = errorRate > flags.error_rate_threshold || avgLatency > flags.latency_threshold_ms;

    if (shouldRollback) {
      logger.warn(`Auto-rollback triggered: error_rate=${errorRate}%, latency=${avgLatency}ms`);
      const result = {
        status: 'warning',
        message: `Auto-rollback condition met: error_rate=${errorRate.toFixed(2)}%, latency=${avgLatency.toFixed(0)}ms`,
        metrics: { error_rate: errorRate, avg_latency: avgLatency },
        rollback_triggered: true,
      };
      // Cache shorter when warning state
      cache.set(cacheKey, result, 30);
      return result;
    }

    const result = {
      status: 'ok',
      message: 'All metrics within acceptable ranges',
      metrics: { error_rate: errorRate, avg_latency: avgLatency },
      rollback_triggered: false,
    };
    // Cache longer when all is good
    cache.set(cacheKey, result, 120);
    return result;
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
    const supabaseAdmin = getSupabaseAdmin();
    const { data: flags, error: flagError } = await supabaseAdmin
      .from('feature_flags')
      .select('rollout_percentage')
      .eq('flag_name', 'api_railway_rollout')
      .single() as any;

    if (flagError || !flags) {
      logger.error('Failed to fetch rollout flag:', flagError);
      return false;
    }

    const previousPercentage = flags.rollout_percentage;

    // Update feature_flags
    const { error: updateError } = await supabaseAdmin
      .from('feature_flags')
      .update({ rollout_percentage: 0 } as any)
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
        } as any,
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
