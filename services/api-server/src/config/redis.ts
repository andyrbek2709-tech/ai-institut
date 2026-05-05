import Redis from 'ioredis';
import { env } from './environment.js';
import { logger } from '../utils/logger.js';

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisClient) {
    try {
      redisClient = new Redis(env.REDIS_URL, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
      });

      redisClient.on('error', (err) => {
        logger.error('Redis error:', err);
      });

      redisClient.on('connect', () => {
        logger.info('Redis connected');
      });

      redisClient.on('ready', () => {
        logger.info('Redis ready');
      });
    } catch (err) {
      logger.error('Failed to create Redis client:', err);
      throw err;
    }
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
}
