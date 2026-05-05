import { Router, Request, Response } from 'express';
import {
  getMetricsSummary,
  getProviderMetrics,
  getRolloutRecommendation,
  getErrorRate,
} from '../services/metrics.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/metrics/summary', async (req: Request, res: Response) => {
  try {
    const hours = parseInt(req.query.hours as string) || 1;
    const data = await getMetricsSummary(hours);
    res.json(data);
  } catch (err) {
    logger.error('Error fetching metrics summary:', err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

router.get('/metrics/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;

    if (provider !== 'vercel' && provider !== 'railway') {
      return res.status(400).json({ error: 'Invalid provider. Must be "vercel" or "railway"' });
    }

    const metrics = await getProviderMetrics(provider as any);
    res.json({
      provider,
      metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`Error fetching ${req.params.provider} metrics:`, err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

router.get('/metrics/error-rate/:provider', async (req: Request, res: Response) => {
  try {
    const { provider } = req.params;
    const minutes = parseInt(req.query.minutes as string) || 5;

    if (provider !== 'vercel' && provider !== 'railway') {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    const errorRate = await getErrorRate(provider as 'vercel' | 'railway', minutes);
    res.json({
      provider,
      error_rate: errorRate,
      minutes,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Error calculating error rate:', err);
    res.status(500).json({ error: 'Failed to calculate error rate' });
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
