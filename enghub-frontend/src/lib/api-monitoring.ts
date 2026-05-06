/**
 * API Monitoring and Metrics
 * Tracks which API is used, performance, and errors
 */

export interface ApiMetrics {
  provider: 'vercel' | 'railway';
  requestCount: number;
  errorCount: number;
  totalLatency: number; // in ms
  avgLatency: number; // in ms
  errorRate: number; // 0-100
  lastError?: {
    message: string;
    timestamp: number;
    status?: number;
  };
}

class ApiMonitor {
  private metrics: Map<string, ApiMetrics> = new Map();

  constructor() {
    this.metrics.set('vercel', {
      provider: 'vercel',
      requestCount: 0,
      errorCount: 0,
      totalLatency: 0,
      avgLatency: 0,
      errorRate: 0,
    });

    this.metrics.set('railway', {
      provider: 'railway',
      requestCount: 0,
      errorCount: 0,
      totalLatency: 0,
      avgLatency: 0,
      errorRate: 0,
    });
  }

  /**
   * Record a successful API request
   */
  recordSuccess(provider: 'vercel' | 'railway', latencyMs: number) {
    const metrics = this.metrics.get(provider);
    if (!metrics) return;

    metrics.requestCount++;
    metrics.totalLatency += latencyMs;
    metrics.avgLatency = Math.round(metrics.totalLatency / metrics.requestCount);
    metrics.errorRate = Math.round((metrics.errorCount / metrics.requestCount) * 100);
  }

  /**
   * Record a failed API request
   */
  recordError(
    provider: 'vercel' | 'railway',
    error: Error | string,
    status?: number,
    latencyMs?: number,
  ) {
    const metrics = this.metrics.get(provider);
    if (!metrics) return;

    metrics.requestCount++;
    metrics.errorCount++;
    metrics.errorRate = Math.round((metrics.errorCount / metrics.requestCount) * 100);

    if (latencyMs) {
      metrics.totalLatency += latencyMs;
      metrics.avgLatency = Math.round(metrics.totalLatency / metrics.requestCount);
    }

    metrics.lastError = {
      message: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      status,
    };

    // Log error with metrics
    this.logError(provider, metrics.lastError);
  }

  /**
   * Get metrics for a provider
   */
  getMetrics(provider: 'vercel' | 'railway'): ApiMetrics | undefined {
    return this.metrics.get(provider);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): ApiMetrics[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get comparison (Vercel vs Railway)
   */
  getComparison(): {
    vercel: ApiMetrics;
    railway: ApiMetrics;
    recommendation: string;
  } {
    const vercel = this.metrics.get('vercel')!;
    const railway = this.metrics.get('railway')!;

    let recommendation = 'collect more data';

    // Need enough requests for meaningful comparison
    if (vercel.requestCount >= 100 && railway.requestCount >= 100) {
      if (railway.errorRate <= vercel.errorRate * 1.1 && railway.avgLatency <= vercel.avgLatency * 1.2) {
        recommendation = '✅ Railway looks good, safe to increase rollout';
      } else if (railway.errorRate > vercel.errorRate * 1.5 || railway.avgLatency > vercel.avgLatency * 1.5) {
        recommendation = '⚠️ Railway has issues, reduce rollout or investigate';
      }
    }

    return { vercel, railway, recommendation };
  }

  /**
   * Reset metrics (for testing)
   */
  reset() {
    this.metrics.forEach((m) => {
      m.requestCount = 0;
      m.errorCount = 0;
      m.totalLatency = 0;
      m.avgLatency = 0;
      m.errorRate = 0;
      m.lastError = undefined;
    });
  }

  /**
   * Log error for debugging
   */
  private logError(
    provider: string,
    error: {
      message: string;
      timestamp: number;
      status?: number;
    },
  ) {
    const timestamp = new Date(error.timestamp).toISOString();
    const statusStr = error.status ? ` (HTTP ${error.status})` : '';
    console.error(`[${timestamp}] ${provider.toUpperCase()} API error${statusStr}: ${error.message}`);
  }

  /**
   * Export metrics as JSON (for dashboards)
   */
  export(): {
    timestamp: string;
    metrics: ApiMetrics[];
    comparison: ReturnType<ApiMonitor['getComparison']>;
  } {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.getAllMetrics(),
      comparison: this.getComparison(),
    };
  }
}

// Singleton instance
export const apiMonitor = new ApiMonitor();

/**
 * Decorator for fetch monitoring
 * Usage: wrap apiFetch calls to track metrics
 */
export function createMonitoredFetch(
  originalFetch: (url: string, opts?: RequestInit) => Promise<Response>,
) {
  return async (url: string, opts?: RequestInit): Promise<Response> => {
    // Determine provider from URL
    const provider: 'vercel' | 'railway' = url.includes('localhost:3001') || url.includes('railway.app')
      ? 'railway'
      : 'vercel';

    const startTime = performance.now();

    try {
      const response = await originalFetch(url, opts);
      const latency = performance.now() - startTime;

      if (response.ok) {
        apiMonitor.recordSuccess(provider, latency);
      } else {
        apiMonitor.recordError(provider, `HTTP ${response.status}`, response.status, latency);
      }

      return response;
    } catch (error) {
      const latency = performance.now() - startTime;
      apiMonitor.recordError(provider, error, undefined, latency);
      throw error;
    }
  };
}

/**
 * Get dashboard data for UI display
 */
export function getDashboardData() {
  const metrics = apiMonitor.getAllMetrics();
  const comparison = apiMonitor.getComparison();

  return {
    vercelMetrics: metrics[0],
    railwayMetrics: metrics[1],
    recommendation: comparison.recommendation,
    safeToIncreaseRollout:
      comparison.railway.errorRate <= comparison.vercel.errorRate * 1.1 &&
      comparison.railway.avgLatency <= comparison.vercel.avgLatency * 1.2,
  };
}
