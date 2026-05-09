import { Logger } from 'pino';
import { Database } from '../services/database';
import { NotificationService, NotificationChannel } from '../services/notifications';

/**
 * agsk.standard.ready — нормативный документ полностью обработан и готов к поиску в RAG.
 */
export async function handleAgskStandardReady(
  standardId: string,
  projectId: string,
  userId: string,
  metadata: Record<string, any> | undefined,
  logger: Logger,
  db: Database,
  notifications: NotificationService,
): Promise<void> {
  try {
    const standardCode = metadata?.standard_code || 'AGSK-doc';
    const chunksCount = metadata?.chunks_count || 0;
    logger.info({ standardId, projectId, standardCode, chunksCount }, 'AGSK standard ready for search');

    const leadId = await db.getProjectLead(projectId);
    if (leadId) {
      await notifications.send({
        userId: leadId,
        type: 'agsk_ready',
        title: 'Нормативный документ готов к поиску',
        message: `${standardCode} проиндексирован (${chunksCount} фрагментов). Можно искать через ChatGPT 4.0 или AGSK поиск.`,
        taskId: standardId,
        channels: [NotificationChannel.IN_APP],
        severity: 'info',
      });
    }
  } catch (error) {
    logger.error({ error, standardId }, 'Error handling agsk.standard.ready');
    throw error;
  }
}
