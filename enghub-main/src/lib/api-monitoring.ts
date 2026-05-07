export interface ApiMetrics {
  requestCount: number;
  errorCount: number;
  totalLatency: number;
  avgLatency: number;
  errorRate: number;
  lastError?: {
    message: string;
    timestamp: number;
    status?: number;
  };
}

class ApiMonitor {
  private metrics: ApiMetrics = {
    requestCount: 0,
    errorCount: 0,
    totalLatency: 0,
    avgLatency: 0,
    errorRate: 0,
  };

  recordSuccess(latencyMs: number) {
    this.metrics.requestCount++;
    this.metrics.totalLatency += latencyMs;
    this.metrics.avgLatency = Math.round(this.metrics.totalLatency / this.metrics.requestCount);
    this.metrics.errorRate = Math.round((this.metrics.errorCount / this.metrics.requestCount) * 100);
  }

  recordError(error: Error | string, status?: number, latencyMs?: number) {
    this.metrics.requestCount++;
    this.metrics.errorCount++;
    this.metrics.errorRate = Math.round((this.metrics.errorCount / this.metrics.requestCount) * 100);

    if (latencyMs) {
      this.metrics.totalLatency += latencyMs;
      this.metrics.avgLatency = Math.round(this.metrics.totalLatency / this.metrics.requestCount);
    }

    this.metrics.lastError = {
      message: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      status,
    };

    const timestamp = new Date(this.metrics.lastError.timestamp).toISOString();
    const statusStr = status ? ` (HTTP ${status})` : '';
    console.error(`[${timestamp}] RAILWAY API error${statusStr}: ${this.metrics.lastError.message}`);
  }

  getMetrics(): ApiMetrics {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      totalLatency: 0,
      avgLatency: 0,
      errorRate: 0,
    };
  }

  export(): { timestamp: string; metrics: ApiMetrics } {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.getMetrics(),
    };
  }
}

export const apiMonitor = new ApiMonitor();

export function createMonitoredFetch(
  originalFetch: (url: string, opts?: RequestInit) => Promise<Response>,
) {
  return async (url: string, opts?: RequestInit): Promise<Response> => {
    const startTime = performance.now();

    try {
      const response = await originalFetch(url, opts);
      const latency = performance.now() - startTime;

      if (response.ok) {
        apiMonitor.recordSuccess(latency);
      } else {
        apiMonitor.recordError(`HTTP ${response.status}`, response.status, latency);
      }

      return response;
    } catch (error) {
      const latency = performance.now() - startTime;
      apiMonitor.recordError(error as Error, undefined, latency);
      throw error;
    }
  };
}

export function getDashboardData() {
  const metrics = apiMonitor.getMetrics();

  return {
    railwayMetrics: metrics,
    healthy: metrics.errorRate < 5,
  };
}
