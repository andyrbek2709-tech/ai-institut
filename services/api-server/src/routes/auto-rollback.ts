import { Router, Request, Response } from 'express';
import { checkAutoRollback, executeAutoRollback } from '../services/auto-rollback.js';
import { logger } from '../utils/logger.js';

const router = Router();

router.get('/auto-rollback/check', async (req: Request, res: Response) => {
  try {
    const check = await checkAutoRollback();
    res.json(check);
  } catch (err) {
    logger.error('Error in auto-rollback check:', err);
    res.status(500).json({ error: 'Failed to check auto-rollback status' });
  }
});

router.post('/auto-rollback/execute', async (req: Request, res: Response) => {
  try {
    const { reason = 'manual' } = req.body;
    const success = await executeAutoRollback(reason);
    res.json({ success, message: success ? 'Rollback executed' : 'Rollback failed' });
  } catch (err) {
    logger.error('Error executing auto-rollback:', err);
    res.status(500).json({ error: 'Failed to execute auto-rollback' });
  }
});

export default router;
