import { Router, Request, Response } from 'express';
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

/**
 * GET /api/tasks/:projectId
 * List all tasks for a project (cached 30s)
 */
router.get('/tasks/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!projectId) {
      throw new ApiError(400, 'projectId is required');
    }

    // Check cache
    const cacheKey = `tasks:${projectId}`;
    const cached = cache.get<TaskRecord[]>(cacheKey);
    if (cached) {
      return res.json(cached);
    }

    const tasks = await listRecords<TaskRecord>('tasks', {
      filters: { 'project_id': `eq.${projectId}` },
      order: 'id',
      limit: 200, // Reduce from 500 to 200 - most projects don't have >200 tasks
      token,
      select: 'id,project_id,name,status,priority,assigned_to,created_at,deadline,rework_count',
    });

    // Increase cache TTL from 30s to 60s - tasks don't change frequently
    cache.set(cacheKey, tasks, 60);
    res.json(tasks);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error('Failed to list tasks:', err);
    throw new ApiError(500, 'Failed to list tasks', { message: (err as Error).message });
  }
});

/**
 * POST /api/tasks
 * Create a new task and publish event
 */
router.post('/tasks', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!req.body.name || !req.body.project_id) {
      throw new ApiError(400, 'name and project_id are required');
    }

    const task = await createRecord<TaskRecord>('tasks', req.body, token);

    // Publish task.created event if Redis is available
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
      // Don't fail the request if event publishing fails
    }

    res.status(201).json(task);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error('Failed to create task:', err);
    throw new ApiError(500, 'Failed to create task', { message: (err as Error).message });
  }
});

/**
 * PATCH /api/tasks/:id
 * Update a task and publish event
 */
router.patch('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!id) {
      throw new ApiError(400, 'id is required');
    }

    const task = await updateRecord<TaskRecord>('tasks', id, req.body, token);

    // Publish task.status_changed event if status was updated
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
    if (err instanceof ApiError) throw err;
    logger.error('Failed to update task:', err);
    throw new ApiError(500, 'Failed to update task', { message: (err as Error).message });
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task
 */
router.delete('/tasks/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!id) {
      throw new ApiError(400, 'id is required');
    }

    await deleteRecord('tasks', id, token);

    res.status(204).send();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error('Failed to delete task:', err);
    throw new ApiError(500, 'Failed to delete task', { message: (err as Error).message });
  }
});

export default router;
