/**
 * AGSK Ingestion Service entry point.
 * Listens to Redis stream agsk-ingestion-jobs and processes each job
 * through the full PDF → parse → chunk → embed → store pipeline.
 */

import { logger } from './utils/logger.js';
import { env } from './config/environment.js';
import {
  ensureConsumerGroup,
  readJobs,
  ackJob,
  deadLetterJob,
  closeRedis,
  STREAM_NAME,
  CONSUMER_GROUP,
} from './services/queue.js';
import { handleStandardsIngest } from './handlers/standards-ingest.js';
import { getSupabaseAdmin } from './services/supabase.js';

const CONSUMER_NAME = `ingestion-worker-${process.pid}`;
const MAX_RETRIES   = 3;

async function processLoop(): Promise<void> {
  await ensureConsumerGroup();
  logger.info({ stream: STREAM_NAME, group: CONSUMER_GROUP, worker: CONSUMER_NAME },
    'AGSK Ingestion worker started');

  let running = true;
  const shutdown = async () => {
    logger.info('Shutdown signal received');
    running = false;
    await closeRedis();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  while (running) {
    try {
      const messages = await readJobs(CONSUMER_NAME, env.INGESTION_CONCURRENCY, 5000);

      for (const { id: msgId, data: jobMsg } of messages) {
        const sb = getSupabaseAdmin();

        // Create or find the ingestion job record in DB
        const { data: job, error: jobErr } = await sb
          .from('agsk_ingestion_jobs')
          .upsert({
            id:          jobMsg.job_id,
            standard_id: jobMsg.standard_id,
            org_id:      jobMsg.org_id,
            status:      'parsing',
            started_at:  new Date().toISOString(),
            worker_id:   CONSUMER_NAME,
          }, { onConflict: 'id' })
          .select('id, retry_count')
          .single();

        if (jobErr) {
          logger.error({ err: jobErr, msg_id: msgId }, 'Failed to upsert job record');
          await deadLetterJob(msgId, jobErr.message);
          continue;
        }

        const retryCount = (job as any).retry_count ?? 0;

        try {
          await handleStandardsIngest(jobMsg, jobMsg.job_id);
          await ackJob(msgId);
        } catch (err: any) {
          if (retryCount < MAX_RETRIES) {
            logger.warn({ err, retry: retryCount + 1 }, 'Job failed, will retry');
            await sb.from('agsk_ingestion_jobs')
              .update({ retry_count: retryCount + 1, status: 'queued' })
              .eq('id', jobMsg.job_id);
            // Re-ack so it goes back to pending claim pool after 30s
          } else {
            logger.error({ err, msg_id: msgId }, 'Job exceeded max retries, moving to DLQ');
            await deadLetterJob(msgId, `Max retries exceeded: ${err.message}`);
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Error in ingestion loop');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

processLoop().catch(err => {
  logger.error({ err }, 'Fatal error in ingestion service');
  process.exit(1);
});
