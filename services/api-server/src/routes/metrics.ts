import { Router, Request, Response, NextFunction } from 'express';
import {
  getMetricsSummary,
  getProviderMetrics,
  getRolloutRecommendation,
  getErrorRate,
} from '../services/metrics.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/metrics/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hours = parseInt(req.query.hours as string) || 1;
    const data = await getMetricsSummary(hours);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

router.get('/metrics/railway', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const metrics = await getProviderMetrics('railway' as any);
    res.json({
      provider: 'railway',
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/metrics/error-rate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const minutes = parseInt(req.query.minutes as string) || 5;
    const errorRate = await getErrorRate('railway' as any, minutes);
    res.json({
      provider: 'railway',
      error_rate: errorRate,
      minutes,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/metrics/recommendation', async (req: Request, res: Response) => {
  try {
    const recommendation = await getRolloutRecommendation();
    res.json(recommendation);
  } catch (err) {
    logger.error('Error getting rollout recommendation:', err);
    res.status(500).json({ error: 'Failed to get recommendation' });
  }
});

router.get('/metrics/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

export default router;
