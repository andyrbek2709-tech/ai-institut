import { Router, Request, Response } from 'express';
import { getRedisClient } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

interface PublishEventBody {
  event_type: string;
  task_id?: string;
  project_id?: string;
  user_id?: string;
  review_id?: string;
  metadata?: Record<string, any>;
}

router.post('/publish-event', async (req: Request, res: Response) => {
  try {
    const { event_type, task_id, project_id, user_id, review_id, metadata } = req.body as PublishEventBody;

    if (!event_type) {
      throw new ApiError(400, 'event_type is required');
    }

    const redis = getRedisClient();

    const messageId = await redis.xadd(
      'task-events',
      '*',
      'event_type', event_type,
      'task_id', task_id || '',
      'project_id', project_id || '',
      'user_id', user_id || '',
      'review_id', review_id || '',
      'metadata', JSON.stringify(metadata || {}),
      'timestamp', Date.now().toString()
    );

    logger.info(`Published event: ${event_type}`, { messageId, task_id, project_id });

    res.json({
      success: true,
      message_id: messageId,
      event_type,
    });
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error('Failed to publish event:', err);
    throw new ApiError(500, 'Failed to publish event', { message: (err as Error).message });
  }
});

export default router;
