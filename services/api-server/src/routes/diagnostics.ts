import { Router, Request, Response } from 'express';
import { getRedisClient } from '../config/redis.js';
import { env } from '../config/environment.js';
import { logger } from '../utils/logger.js';

const router = Router();
const START_TIME = Date.now();

async function checkRedis(): Promise<{ status: string; latency_ms?: number; error?: string }> {
  try {
    const redis = getRedisClient();
    const t0 = Date.now();
    await redis.ping();
    return { status: 'ok', latency_ms: Date.now() - t0 };
  } catch (err) {
    return { status: 'error', error: (err as Error).message };
  }
}

async function checkSupabase(): Promise<{ status: string; latency_ms?: number; error?: string }> {
  try {
    const t0 = Date.now();
    const resp = await fetch(
      `${env.SUPABASE_URL}/rest/v1/app_users?select=id&limit=1`,
      {
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
        signal: AbortSignal.timeout(5000),
      },
    );
    const latency = Date.now() - t0;
    if (!resp.ok) return { status: 'error', error: `HTTP ${resp.status}` };
    return { status: 'ok', latency_ms: latency };
  } catch (err) {
    return { status: 'error', error: (err as Error).message };
  }
}

async function checkRedisQueueLag(): Promise<{ stream: string; pending?: number; error?: string }> {
  try {
    const redis = getRedisClient();
    const info = await redis.xinfo('GROUPS', 'task-events') as any[];
    const group = info.find((g: any) => g[1] === 'orchestrator-group' || (Array.isArray(g) && g.includes('orchestrator-group')));
    if (!group) return { stream: 'task-events', pending: 0 };
    const pendingIdx = Array.isArray(group) ? group.indexOf('pel-count') + 1 : -1;
    const pending = pendingIdx > 0 ? group[pendingIdx] : 0;
    return { stream: 'task-events', pending: Number(pending) };
  } catch (err) {
    return { stream: 'task-events', error: (err as Error).message };
  }
}

router.get('/diagnostics', async (req: Request, res: Response) => {
  const startMs = Date.now();

  const [redis, supabase, queueLag] = await Promise.all([
    checkRedis(),
    checkSupabase(),
    checkRedisQueueLag(),
  ]);

  const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
  const mem = process.memoryUsage();

  const allOk = redis.status === 'ok' && supabase.status === 'ok';

  const diagnostics = {
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime_seconds: uptimeSec,
    check_duration_ms: Date.now() - startMs,
    environment: env.NODE_ENV,
    platform: 'railway',
    services: {
      api_server: { status: 'ok', version: '1.0.0' },
      redis: redis,
      supabase: supabase,
    },
    queue: queueLag,
    memory: {
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      rss_mb: Math.round(mem.rss / 1024 / 1024),
    },
    urls: {
      api_server: 'https://api-server-production-8157.up.railway.app',
      frontend: 'https://enghub-frontend-production.up.railway.app',
      supabase: env.SUPABASE_URL,
    },
    architecture_constraints: {
      vercel: 'DECOMMISSIONED',
      deployment_platform: 'railway-only',
      api_routing: 'absolute-urls-only',
    },
  };

  logger.debug('Diagnostics check complete', { status: diagnostics.status });
  res.status(allOk ? 200 : 503).json(diagnostics);
});

router.get('/system-status', async (req: Request, res: Response) => {
  const [redis, supabase] = await Promise.all([checkRedis(), checkSupabase()]);

  const allOk = redis.status === 'ok' && supabase.status === 'ok';

  res.status(allOk ? 200 : 503).json({
    status: allOk ? 'operational' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      api: 'ok',
      redis: redis.status,
      supabase: supabase.status,
    },
    uptime_seconds: Math.floor((Date.now() - START_TIME) / 1000),
  });
});

export default router;
