import { apiGet } from './http';

export interface MetricsSummary {
  provider: 'vercel' | 'railway';
  endpoint: string;
  requests_count: number;
  error_rate: number;
  avg_latency: number;
  max_latency: number;
  min_latency: number;
  last_error?: string;
  last_request_at: string;
}

export interface DashboardData {
  vercel: MetricsSummary[];
  railway: MetricsSummary[];
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
    status: 'good' | 'warning' | 'critical';
  };
}

// Get overall metrics dashboard
export async function getDashboardData(): Promise<DashboardData> {
  try {
    return await apiGet('/metrics/summary?hours=1');
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    return {
      vercel: [],
      railway: [],
      aggregated: { total_requests: 0, error_rate: 0, avg_latency: 0 },
      timestamp: new Date().toISOString(),
    };
  }
}

// Get provider-specific metrics
export async function getProviderMetrics(provider: 'vercel' | 'railway'): Promise<MetricsSummary[]> {
  try {
    const response = await apiGet(`/metrics/${provider}`);
    return response.metrics || [];
  } catch (error) {
    console.error(`Failed to fetch ${provider} metrics:`, error);
    return [];
  }
}

// Get error rate for specific provider
export async function getErrorRate(provider: 'vercel' | 'railway', minutes: number = 5): Promise<number> {
  try {
    const response = await apiGet(`/metrics/error-rate/${provider}?minutes=${minutes}`);
    return response.error_rate || 0;
  } catch (error) {
    console.error(`Failed to fetch ${provider} error rate:`, error);
    return 0;
  }
}

// Get recommendation for safe rollout
export async function getRolloutRecommendation(): Promise<RolloutRecommendation> {
  try {
    return await apiGet('/metrics/recommendation');
  } catch (error) {
    console.error('Failed to fetch rollout recommendation:', error);
    return {
      safe: false,
      reason: 'Unable to fetch recommendation',
      metrics: { error_rate: 0, avg_latency: 0, status: 'critical' },
    };
  }
}

// Calculate comparison metrics between Vercel and Railway
export async function getComparisonMetrics(): Promise<{
  vercel: { error_rate: number; avg_latency: number };
  railway: { error_rate: number; avg_latency: number };
}> {
  try {
    const data = await getDashboardData();

    const vercelMetrics = data.vercel.length > 0
      ? {
        error_rate: data.vercel.reduce((sum, m) => sum + m.error_rate, 0) / data.vercel.length,
        avg_latency: data.vercel.reduce((sum, m) => sum + m.avg_latency, 0) / data.vercel.length,
      }
      : { error_rate: 0, avg_latency: 0 };

    const railwayMetrics = data.railway.length > 0
      ? {
        error_rate: data.railway.reduce((sum, m) => sum + m.error_rate, 0) / data.railway.length,
        avg_latency: data.railway.reduce((sum, m) => sum + m.avg_latency, 0) / data.railway.length,
      }
      : { error_rate: 0, avg_latency: 0 };

    return {
      vercel: vercelMetrics,
      railway: railwayMetrics,
    };
  } catch (error) {
    console.error('Failed to fetch comparison metrics:', error);
    return {
      vercel: { error_rate: 0, avg_latency: 0 },
      railway: { error_rate: 0, avg_latency: 0 },
    };
  }
}
