import { Request, Response, NextFunction } from 'express';
import { recordMetric } from '../services/metrics.js';
import { env } from '../config/environment.js';
import { logger } from '../utils/logger.js';

interface MetricsResponse extends Response {
  _startTime?: number;
}

export function metricsMiddleware() {
  return (req: Request, res: MetricsResponse, next: NextFunction) => {
    const startTime = Date.now();
    res._startTime = startTime;

    const originalEnd = res.end.bind(res);

    res.end = function(...args: any[]): Response {
      const responseTime = Date.now() - startTime;

      if (!req.path.includes('/health') && !req.path.includes('/ready') && !req.path.includes('/metrics')) {
        recordMetric({
          timestamp: new Date().toISOString(),
          provider: 'railway',
          endpoint: req.path,
          status_code: res.statusCode,
          response_time: responseTime,
          error: res.statusCode >= 400 ? (args[0] as string) : undefined,
          user_id: (req as any).user?.id,
        }).catch(err => {
          logger.error('Failed to record metric:', err);
        });
      }

      return originalEnd(...args);
    };

    next();
  };
}
