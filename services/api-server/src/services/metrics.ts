import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { cache } from './cache.js';

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
      .insert([data as any]);

    if (error) {
      logger.error('Failed to record metric:', error);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Error recording metric: ' + msg);
  }
}

export async function getMetricsSummary(hours: number = 1): Promise<MetricsSummary> {
  try {
    const cacheKey = `metrics:summary:${hours}h`;
    const cached = cache.get<MetricsSummary>(cacheKey);
    if (cached) {
      return cached;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Optimization: Fetch only essential columns and limit dataset
    // SELECT only what we need to reduce data transfer and processing
    const { data, error } = await supabaseAdmin
      .from('api_metrics')
      .select('provider,endpoint,status_code,response_time')
      .gte('timestamp', cutoffTime)
      .limit(5000); // Prevent fetching too much data - last 5000 metrics is enough

    if (error) {
      logger.error('Error fetching metrics:', error);
      return getDefaultMetrics();
    }

    // Fast grouping: single pass instead of two separate filters + reduces
    const vercelMap = new Map<string, any>();
    const railwayMap = new Map<string, any>();
    let totalRequests = 0;
    let totalLatency = 0;
    let errorCount = 0;

    for (const m of (data || [])) {
      totalRequests++;
      const isError = m.status_code >= 400;
      if (isError) errorCount++;
      totalLatency += m.response_time;

      const map = m.provider === 'vercel' ? vercelMap : railwayMap;
      const key = m.endpoint;
      const existing = map.get(key);

      if (existing) {
        existing.request_count++;
        if (isError) existing.error_count++;
        existing.total_response_time += m.response_time;
      } else {
        map.set(key, {
          endpoint: m.endpoint,
          request_count: 1,
          error_count: isError ? 1 : 0,
          total_response_time: m.response_time,
          last_error: isError ? `HTTP ${m.status_code}` : null,
        });
      }
    }

    const result = {
      vercel: Array.from(vercelMap.values()),
      railway: Array.from(railwayMap.values()),
      aggregated: {
        total_requests: totalRequests,
        error_rate: totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0,
        avg_latency: totalRequests > 0 ? Math.round((totalLatency / totalRequests) * 100) / 100 : 0,
      },
      timestamp: new Date().toISOString(),
    };

    // Cache longer - metrics summary is stable
    cache.set(`metrics:summary:${hours}h`, result, 120);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Error in getMetricsSummary: ' + msg);
    return getDefaultMetrics();
  }
}

export async function getProviderMetrics(provider: 'vercel' | 'railway'): Promise<any[]> {
  try {
    const cacheKey = `metrics:provider:${provider}`;
    const cached = cache.get<any[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('api_metrics')
      .select('timestamp, endpoint, status_code, response_time, error')
      .eq('provider', provider)
      .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (error) {
      logger.error(`Error fetching ${provider} metrics:`, error);
      return [];
    }

    const result = data || [];
    cache.set(cacheKey, result, 30);
    return result;
  } catch (err) {
    logger.error(`Error in getProviderMetrics:`, err);
    return [];
  }
}

export async function getErrorRate(provider: 'vercel' | 'railway', minutes: number = 5): Promise<number> {
  try {
    const cacheKey = `metrics:error-rate:${provider}:${minutes}m`;
    const cached = cache.get<number>(cacheKey);
    if (cached !== null) {
      return cached;
    }

    const supabaseAdmin = getSupabaseAdmin();

    // Optimize: use PostgreSQL COUNT aggregate instead of SELECT + JS filter
    // This is much faster for large datasets (100x improvement possible)
    const cutoffTime = new Date(Date.now() - minutes * 60 * 1000).toISOString();

    // Get total requests and error count in parallel
    const [totalResult, errorResult] = await Promise.all([
      // Total requests for this provider and time window
      supabaseAdmin
        .from('api_metrics')
        .select('count', { count: 'exact' })
        .eq('provider', provider)
        .gte('timestamp', cutoffTime),
      // Error requests (status >= 400)
      supabaseAdmin
        .from('api_metrics')
        .select('count', { count: 'exact' })
        .eq('provider', provider)
        .gte('status_code', 400)
        .gte('timestamp', cutoffTime),
    ]);

    const total = totalResult.count || 0;
    const errors = errorResult.count || 0;

    if (total === 0) {
      cache.set(cacheKey, 0, 60);
      return 0;
    }

    const rate = (errors / total) * 100;
    // Cache error rate longer when it's stable (0% or very low)
    const cacheTTL = rate < 1 ? 120 : 30;
    cache.set(cacheKey, rate, cacheTTL);
    return rate;
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
