import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';
import { proxyRequest } from '../services/supabase-proxy.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

/**
 * Generic proxy route that forwards requests to Supabase
 * POST /api/proxy
 * Body: { path, method, data?, headers? }
 */
router.post('/proxy', async (req: Request, res: Response) => {
  try {
    const { path, method, data, headers } = req.body;

    if (!path || !method) {
      throw new ApiError(400, 'path and method are required');
    }

    if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(method)) {
      throw new ApiError(400, `Invalid method: ${method}`);
    }

    // Get auth token from request headers
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '');

    const response = await proxyRequest({
      path,
      method: method as 'GET' | 'POST' | 'PATCH' | 'DELETE',
      data,
      token,
      headers,
    });

    res.status(response.status).json(response.data);
  } catch (err) {
    if (err instanceof ApiError) throw err;
    logger.error('Proxy request failed:', err);
    throw new ApiError(500, 'Proxy request failed', { message: (err as Error).message });
  }
});

export default router;
