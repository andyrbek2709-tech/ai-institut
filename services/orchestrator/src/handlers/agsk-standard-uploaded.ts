import { Logger } from 'pino';
import { Database } from '../services/database';
import { NotificationService, NotificationChannel } from '../services/notifications';

/**
 * agsk.standard.uploaded — PDF нормативного документа загружен, началась обработка.
 * Уведомляем GIP проекта (или активных пользователей org) что появился новый документ.
 */
export async function handleAgskStandardUploaded(
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
    const filename = metadata?.filename || 'document.pdf';
    logger.info({ standardId, projectId, standardCode, filename }, 'AGSK standard uploaded');

    // Уведомляем GIP проекта (если есть)
    const leadId = await db.getProjectLead(projectId);
    if (leadId) {
      await notifications.send({
        userId: leadId,
        type: 'agsk_uploaded',
        title: 'Загружен новый нормативный документ',
        message: `${standardCode} (${filename}) загружен и обрабатывается. Уведомим, когда будет готов к поиску.`,
        taskId: standardId,
        channels: [NotificationChannel.IN_APP],
        severity: 'info',
      });
    }
  } catch (error) {
    logger.error({ error, standardId }, 'Error handling agsk.standard.uploaded');
    throw error;
  }
}
