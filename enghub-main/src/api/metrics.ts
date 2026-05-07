import { apiGet } from './http';

export interface MetricsSummary {
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

export async function getDashboardData(): Promise<DashboardData> {
  try {
    return await apiGet('/metrics/summary?hours=1');
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);
    return {
      railway: [],
      aggregated: { total_requests: 0, error_rate: 0, avg_latency: 0 },
      timestamp: new Date().toISOString(),
    };
  }
}

export async function getRailwayMetrics(): Promise<MetricsSummary[]> {
  try {
    const response = await apiGet('/metrics/railway');
    return response.metrics || [];
  } catch (error) {
    console.error('Failed to fetch railway metrics:', error);
    return [];
  }
}

export async function getErrorRate(minutes: number = 5): Promise<number> {
  try {
    const response = await apiGet(`/metrics/error-rate/railway?minutes=${minutes}`);
    return response.error_rate || 0;
  } catch (error) {
    console.error('Failed to fetch error rate:', error);
    return 0;
  }
}

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
