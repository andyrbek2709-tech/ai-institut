import { Router, Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { listRecords, createRecord, updateRecord, deleteRecord } from '../services/supabase-proxy.js';
import { ApiError } from '../middleware/errorHandler.js';
import { getRedisClient } from '../config/redis.js';
import { cache } from '../services/cache.js';

const router = Router();

interface TaskRecord {
  id: number;
  project_id: number;
  name: string;
  status: string;
  priority: string;
  [key: string]: any;
}

router.get('/tasks/:projectId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');

    const cacheKey = `tasks:${projectId}`;
    const cached = cache.get<TaskRecord[]>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const tasks = await listRecords<TaskRecord>('tasks', {
      filters: { 'project_id': `eq.${projectId}` },
      order: 'id',
      limit: 200,
      token,
      select: 'id,project_id,name,status,priority,assigned_to,created_at,deadline,rework_count',
    });

    cache.set(cacheKey, tasks, 60);
    res.json(tasks);
  } catch (err) {
    next(err);
  }
});

router.post('/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!req.body.name || !req.body.project_id) {
      return next(new ApiError(400, 'name and project_id are required'));
    }

    const task = await createRecord<TaskRecord>('tasks', req.body, token);

    try {
      const redis = getRedisClient();
      await redis.xadd(
        'task-events',
        '*',
        'event_type', 'task.created',
        'task_id', task.id.toString(),
        'project_id', task.project_id.toString(),
        'user_id', req.body.assigned_to || '',
        'metadata', JSON.stringify({ name: task.name, status: task.status }),
        'timestamp', Date.now().toString(),
      );
      logger.debug('Published task.created event', { task_id: task.id });
    } catch (redisErr) {
      logger.warn('Failed to publish event to Redis', redisErr);
    }

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
});

router.patch('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');

    const task = await updateRecord<TaskRecord>('tasks', id, req.body, token);

    if (req.body.status) {
      try {
        const redis = getRedisClient();
        await redis.xadd(
          'task-events',
          '*',
          'event_type', 'task.status_changed',
          'task_id', id,
          'project_id', task.project_id.toString(),
          'metadata', JSON.stringify({ old_status: '?', new_status: req.body.status }),
          'timestamp', Date.now().toString(),
        );
        logger.debug('Published task.status_changed event', { task_id: id });
      } catch (redisErr) {
        logger.warn('Failed to publish event to Redis', redisErr);
      }
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
});

router.delete('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');

    await deleteRecord('tasks', id, token);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
