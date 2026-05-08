/**
 * Redis-based ingestion queue.
 * Stream name: agsk-ingestion-jobs
 * Consumer group: agsk-ingestion-workers
 */

import Redis from 'ioredis';
import { env } from '../config/environment.js';
import { logger } from '../utils/logger.js';

export const STREAM_NAME     = 'agsk-ingestion-jobs';
export const CONSUMER_GROUP  = 'agsk-ingestion-workers';
export const DEAD_LETTER     = 'agsk-ingestion-dlq';

export interface IngestionJobMessage {
  job_id:       string;
  standard_id:  string;
  org_id:       string;
  file_path:    string;
  filename:     string;
  user_id:      string;
  timestamp:    string;
}

let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    redisClient.on('error', err => logger.error({ err }, 'Redis error'));
  }
  return redisClient;
}

export async function ensureConsumerGroup(): Promise<void> {
  const redis = getRedis();
  try {
    await redis.xgroup('CREATE', STREAM_NAME, CONSUMER_GROUP, '$', 'MKSTREAM');
    logger.info({ stream: STREAM_NAME, group: CONSUMER_GROUP }, 'Consumer group created');
  } catch (err: any) {
    if (!err.message?.includes('BUSYGROUP')) throw err;
    // Group already exists — OK
  }
}

export async function enqueueJob(msg: IngestionJobMessage): Promise<string> {
  const redis = getRedis();
  return redis.xadd(
    STREAM_NAME,
    '*',
    'job_id',      msg.job_id,
    'standard_id', msg.standard_id,
    'org_id',      msg.org_id,
    'file_path',   msg.file_path,
    'filename',    msg.filename,
    'user_id',     msg.user_id,
    'timestamp',   msg.timestamp,
  ) as Promise<string>;
}

export async function readJobs(
  consumerName: string,
  count = 1,
  blockMs = 5000,
): Promise<Array<{ id: string; data: IngestionJobMessage }>> {
  const redis = getRedis();

  // First try to claim any pending (failed) messages older than 30s
  const pending = await redis.xautoclaim(
    STREAM_NAME, CONSUMER_GROUP, consumerName,
    30_000, '0-0', 'COUNT', count,
  ) as [string, Array<[string, string[]]>];

  const pendingMsgs = pending[1] ?? [];
  if (pendingMsgs.length > 0) {
    return parseMsgs(pendingMsgs);
  }

  // Then read new messages
  const fresh = await redis.xreadgroup(
    'GROUP', CONSUMER_GROUP, consumerName,
    'COUNT', count,
    'BLOCK', blockMs,
    'STREAMS', STREAM_NAME, '>',
  ) as Array<[string, Array<[string, string[]]>]> | null;

  const msgs = fresh?.[0]?.[1] ?? [];
  return parseMsgs(msgs);
}

export async function ackJob(messageId: string): Promise<void> {
  await getRedis().xack(STREAM_NAME, CONSUMER_GROUP, messageId);
}

export async function deadLetterJob(messageId: string, reason: string): Promise<void> {
  const redis = getRedis();
  await redis.xadd(DEAD_LETTER, '*', 'original_id', messageId, 'reason', reason);
  await redis.xack(STREAM_NAME, CONSUMER_GROUP, messageId);
}

function parseMsgs(
  raw: Array<[string, string[]]>,
): Array<{ id: string; data: IngestionJobMessage }> {
  return raw.map(([id, fields]) => {
    const data: Record<string, string> = {};
    for (let i = 0; i < fields.length; i += 2) {
      data[fields[i]] = fields[i + 1];
    }
    return { id, data: data as unknown as IngestionJobMessage };
  });
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}
