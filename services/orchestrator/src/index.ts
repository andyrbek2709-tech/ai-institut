import { createLogger } from './utils/logger';
import { loadEnvironment } from './config/environment';
import { RedisStreamClient } from './redis/client';
import { Database } from './services/database';
import { NotificationService } from './services/notifications';
import { StateMachine } from './services/state-machine';
import { processEvent } from './handlers';
import { StreamEvent } from './redis/stream';
import { withRetry } from './utils/errors';

const logger = createLogger();

async function main() {
  try {
    const env = loadEnvironment(logger);

    // Initialize services
    const redisClient = new RedisStreamClient(env.redis.url, logger);
    const db = new Database(env.supabase.url, env.supabase.serviceKey, logger);
    const notifications = new NotificationService(logger, env.telegram);
    const stateMachine = new StateMachine(logger);

    await redisClient.init();

    logger.info('Orchestrator service started');

    // Main event loop
    const consumerName = `orchestrator-${process.pid}`;
    let isRunning = true;

    // Graceful shutdown handlers
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');
      isRunning = false;
      await redisClient.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);

    // Event processing loop
    while (isRunning) {
      try {
        const messages = await redisClient.readMessages(consumerName, 5000);

        for (const message of messages) {
          try {
            const event: Partial<StreamEvent> = {
              event_type: message.data.event_type as any,
              task_id: message.data.task_id,
              project_id: message.data.project_id,
              user_id: message.data.user_id,
              timestamp: parseInt(message.data.timestamp || String(Date.now()), 10),
            };

            if (message.data.metadata) {
              try {
                event.metadata = JSON.parse(message.data.metadata);
              } catch {
                event.metadata = {};
              }
            }

            // Process event with retry logic
            await withRetry(
              () =>
                processEvent(
                  event,
                  logger,
                  db,
                  notifications,
                  stateMachine,
                  redisClient,
                ),
              env.orchestrator.maxRetries,
              env.orchestrator.retryDelayMs,
              logger,
            );

            // Acknowledge message after successful processing
            await redisClient.acknowledgeMessage(message.id);

            logger.debug({ messageId: message.id, eventType: event.event_type }, 'Event processed');
          } catch (error) {
            logger.error({ error, messageId: message.id }, 'Failed to process message after retries');
            // Message will be retried by consumer group on next read
          }
        }
      } catch (error) {
        logger.error({ error }, 'Error in event loop');
        // Continue event loop even if there's an error reading from stream
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    logger.error({ error }, 'Fatal error in orchestrator service');
    process.exit(1);
  }
}

main().catch(error => {
  logger.error({ error }, 'Uncaught error');
  process.exit(1);
});
