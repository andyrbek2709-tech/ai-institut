import express, { Request, Response, NextFunction } from 'express';
import pinoHttp from 'pino-http';
import { env } from './config/environment.js';
import { getRedisClient, closeRedis } from './config/redis.js';
import { corsMiddleware } from './middleware/cors.js';
import { metricsMiddleware } from './middleware/metrics.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import publishEventRouter from './routes/publish-event.js';
import proxyRouter from './routes/proxy.js';
import tasksRouter from './routes/tasks.js';
import metricsRouter from './routes/metrics.js';
import autoRollbackRouter from './routes/auto-rollback.js';
import diagnosticsRouter from './routes/diagnostics.js';
import adminRouter from './routes/admin.js';
import agskRouter from './routes/agsk.js';

const app = express();

// Middleware
app.use(pinoHttp({
  logger,
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 400) return 'error';
    if (res.statusCode >= 300) return 'info';
    return 'debug';
  },
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(corsMiddleware);
app.use(metricsMiddleware());

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'EngHub API Server',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Ready check (checks dependencies)
app.get('/ready', async (req: Request, res: Response) => {
  try {
    const redis = getRedisClient();
    await redis.ping();

    res.json({
      status: 'ready',
      redis: 'ok',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'not ready',
      error: (err as Error).message,
    });
  }
});

// Routes
app.use('/api', publishEventRouter);
app.use('/api', proxyRouter);
app.use('/api', tasksRouter);
app.use('/api', metricsRouter);
app.use('/api', autoRollbackRouter);
app.use('/api', adminRouter);
app.use('/api', agskRouter);
app.use('/', diagnosticsRouter);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully...`);

  try {
    await closeRedis();
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const PORT = env.PORT;
const server = app.listen(PORT, () => {
  logger.info(`API Server listening on port ${PORT}`, {
    env: env.NODE_ENV,
    redis: env.REDIS_URL.includes('localhost') ? 'local' : 'remote',
  });
});

server.on('error', (err) => {
  logger.error('Server error:', err);
  process.exit(1);
});

export default app;
