import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export interface MetricData {
  timestamp: string;
  provider: 'vercel' | 'railway';
  endpoint: string;
  status_code: number;
  response_time: number;
  error?: string;
  user_id?: string;
}

export interface MetricsSummary {
  vercel: any[];
  railway: any[];
  aggregated: {
    total_requests: number;
    error_rate: number;
    avg_latency: number;
  };
  timestamp: string;
}

export interface RolloutRecommendation {
  safe: boolean;
  reason: string;
  metrics: {
    error_rate: number;
    avg_latency: number;
    status: string;
  };
}

export async function recordMetric(data: MetricData): Promise<void> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { error } = await supabaseAdmin
      .from('api_metrics')
      .insert([data]) as any;

    if (error) {
      logger.error('Failed to record metric:', error);
    }
  } catch (err) {
    logger.error('Error recording metric:', err);
  }
}

export async function getMetricsSummary(hours: number = 1): Promise<MetricsSummary> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('api_metrics')
      .select('provider, endpoint, status_code, response_time, error')
      .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());

    if (error) {
      logger.error('Error fetching metrics:', error);
      return getDefaultMetrics();
    }

    const vercelMetrics = (data || [])
      .filter((m: any) => m.provider === 'vercel')
      .reduce((acc: any, m: any) => {
        const existing = acc.find((x: any) => x.endpoint === m.endpoint);
        if (existing) {
          existing.request_count += 1;
          existing.error_count += m.status_code >= 400 ? 1 : 0;
          existing.total_response_time += m.response_time;
        } else {
          acc.push({
            endpoint: m.endpoint,
            request_count: 1,
            error_count: m.status_code >= 400 ? 1 : 0,
            total_response_time: m.response_time,
            last_error: m.status_code >= 400 ? m.error : null,
          });
        }
        return acc;
      }, []);

    const railwayMetrics = (data || [])
      .filter((m: any) => m.provider === 'railway')
      .reduce((acc: any, m: any) => {
        const existing = acc.find((x: any) => x.endpoint === m.endpoint);
        if (existing) {
          existing.request_count += 1;
          existing.error_count += m.status_code >= 400 ? 1 : 0;
          existing.total_response_time += m.response_time;
        } else {
          acc.push({
            endpoint: m.endpoint,
            request_count: 1,
            error_count: m.status_code >= 400 ? 1 : 0,
            total_response_time: m.response_time,
            last_error: m.status_code >= 400 ? m.error : null,
          });
        }
        return acc;
      }, []);

    // Calculate aggregated metrics
    const allMetrics = data || [];
    const totalRequests = allMetrics.length;
    const errorCount = allMetrics.filter((m: any) => m.status_code >= 400).length;
    const avgLatency = allMetrics.length > 0
      ? allMetrics.reduce((sum: number, m: any) => sum + m.response_time, 0) / allMetrics.length
      : 0;

    return {
      vercel: vercelMetrics,
      railway: railwayMetrics,
      aggregated: {
        total_requests: totalRequests,
        error_rate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
        avg_latency: Math.round(avgLatency * 100) / 100,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    logger.error('Error in getMetricsSummary:', err);
    return getDefaultMetrics();
  }
}

export async function getProviderMetrics(provider: 'vercel' | 'railway'): Promise<any[]> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('api_metrics')
      .select('*')
      .eq('provider', provider)
      .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (error) {
      logger.error(`Error fetching ${provider} metrics:`, error);
      return [];
    }

    return data || [];
  } catch (err) {
    logger.error(`Error in getProviderMetrics:`, err);
    return [];
  }
}

export async function getErrorRate(provider: 'vercel' | 'railway', minutes: number = 5): Promise<number> {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('api_metrics')
      .select('status_code')
      .eq('provider', provider)
      .gte('timestamp', new Date(Date.now() - minutes * 60 * 1000).toISOString());

    if (error) {
      logger.error('Error calculating error rate:', error);
      return 0;
    }

    const metrics = data || [];
    if (metrics.length === 0) return 0;

    const errorCount = metrics.filter((m: any) => m.status_code >= 400).length;
    return (errorCount / metrics.length) * 100;
  } catch (err) {
    logger.error('Error in getErrorRate:', err);
    return 0;
  }
}

export async function getRolloutRecommendation(): Promise<RolloutRecommendation> {
  try {
    const summary = await getMetricsSummary(1);

    const errorRate = summary.aggregated.error_rate;
    const avgLatency = summary.aggregated.avg_latency;

    const safe = errorRate < 1 && avgLatency < 1000;
    const reason = safe
      ? '✅ Safe to increase traffic'
      : `⚠️ Issues detected: ${errorRate >= 1 ? `error rate ${errorRate.toFixed(2)}%` : ''} ${avgLatency >= 1000 ? `latency ${avgLatency.toFixed(0)}ms` : ''}`;

    return {
      safe,
      reason,
      metrics: {
        error_rate: errorRate,
        avg_latency: avgLatency,
        status: safe ? 'good' : 'warning',
      },
    };
  } catch (err) {
    logger.error('Error in getRolloutRecommendation:', err);
    return {
      safe: false,
      reason: '⚠️ Unable to determine recommendation',
      metrics: { error_rate: 0, avg_latency: 0, status: 'unknown' },
    };
  }
}

function getDefaultMetrics(): MetricsSummary {
  return {
    vercel: [],
    railway: [],
    aggregated: {
      total_requests: 0,
      error_rate: 0,
      avg_latency: 0,
    },
    timestamp: new Date().toISOString(),
  };
}
