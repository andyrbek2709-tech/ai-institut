import Redis from 'ioredis';
import { Logger } from 'pino';
import { STREAM_NAME, CONSUMER_GROUP, StreamEvent, EventType } from './stream';

export class RedisStreamClient {
  private redis: Redis;
  private logger: Logger;

  constructor(redisUrl: string, logger: Logger) {
    this.redis = new Redis(redisUrl);
    this.logger = logger;
  }

  async init(): Promise<void> {
    try {
      await this.redis.ping();
      this.logger.info('Redis connection established');

      // Create consumer group if it doesn't exist
      try {
        await (this.redis as any).xgroup('CREATE', STREAM_NAME, CONSUMER_GROUP, '$', 'MKSTREAM');
        this.logger.info(`Consumer group '${CONSUMER_GROUP}' created`);
      } catch (error: any) {
        if (error.message && error.message.includes('BUSYGROUP')) {
          this.logger.info(`Consumer group '${CONSUMER_GROUP}' already exists`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      this.logger.error(error, 'Failed to initialize Redis');
      throw error;
    }
  }

  async readMessages(
    consumerName: string,
    blockMs: number = 5000,
  ): Promise<Array<{ id: string; data: Record<string, string> }>> {
    try {
      const messages = await this.redis.xreadgroup(
        'GROUP',
        CONSUMER_GROUP,
        consumerName,
        'COUNT',
        '10',
        'BLOCK',
        blockMs.toString(),
        'STREAMS',
        STREAM_NAME,
        '>',
      );

      if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return [];
      }

      const streamMessages = messages[0];
      if (!Array.isArray(streamMessages) || streamMessages.length < 2) {
        return [];
      }

      const msgArray = streamMessages[1];
      return Array.isArray(msgArray)
        ? msgArray.map((msg: any) => ({
            id: msg[0] as string,
            data: (msg[1] as string[]).reduce((acc: Record<string, string>, val: string, i: number) => {
              if (i % 2 === 0) {
                acc[val] = (msg[1] as string[])[i + 1];
              }
              return acc;
            }, {}),
          }))
        : [];
    } catch (error) {
      this.logger.error(error, 'Failed to read messages from Redis Stream');
      throw error;
    }
  }

  async acknowledgeMessage(messageId: string): Promise<void> {
    try {
      await this.redis.xack(STREAM_NAME, CONSUMER_GROUP, messageId);
    } catch (error) {
      this.logger.error({ error, messageId }, 'Failed to acknowledge message');
      throw error;
    }
  }

  async publishEvent(event: StreamEvent): Promise<string> {
    try {
      const messageId = await this.redis.xadd(
        STREAM_NAME,
        '*',
        'event_type',
        event.event_type,
        'task_id',
        event.task_id,
        'project_id',
        event.project_id,
        'user_id',
        event.user_id || '',
        'metadata',
        JSON.stringify(event.metadata || {}),
        'timestamp',
        event.timestamp.toString(),
      );
      return messageId || '';
    } catch (error) {
      this.logger.error({ error, event }, 'Failed to publish event');
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
    this.logger.info('Redis connection closed');
  }
}
