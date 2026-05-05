import { Router, Request, Response } from 'express';
import { checkAutoRollback, checkAndExecuteAutoRollback } from '../services/auto-rollback.js';
import { logger } from '../utils/logger.js';

const router = Router();

// GET /api/auto-rollback/check - Check if rollback is needed (read-only)
router.get('/auto-rollback/check', async (req: Request, res: Response) => {
  try {
    const check = await checkAutoRollback();
    res.json({
      should_rollback: check.should_rollback,
      trigger_reason: check.trigger_reason,
      error_rate: check.error_rate,
      avg_latency: check.avg_latency,
      message: check.message,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Error checking auto-rollback:', err);
    res.status(500).json({ error: 'Failed to check rollback status' });
  }
});

// POST /api/auto-rollback/execute - Force execute rollback (admin only)
router.post('/auto-rollback/execute', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authorization check
    const result = await checkAndExecuteAutoRollback();
    res.json({
      executed: result,
      message: result ? '🚨 Auto-rollback executed' : 'No rollback needed',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error('Error executing auto-rollback:', err);
    res.status(500).json({ error: 'Failed to execute rollback' });
  }
});

export default router;
