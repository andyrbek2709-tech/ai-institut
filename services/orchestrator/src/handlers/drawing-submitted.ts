import { Logger } from 'pino';
import { Database } from '../services/database';
import { NotificationService, NotificationChannel } from '../services/notifications';

/**
 * drawing.submitted_for_review — чертёж отправлен на проверку.
 * Уведомляем руководителя отдела по дисциплине.
 */
export async function handleDrawingSubmittedForReview(
  drawingId: string,
  projectId: string,
  userId: string,
  metadata: Record<string, any> | undefined,
  logger: Logger,
  db: Database,
  notifications: NotificationService,
): Promise<void> {
  try {
    const drawingCode = metadata?.code || 'чертёж';
    const discipline = metadata?.discipline || '';
    logger.info({ drawingId, projectId, drawingCode, discipline }, 'Drawing submitted for review');

    const leadId = await db.getProjectLead(projectId);
    if (leadId) {
      await notifications.send({
        userId: leadId,
        type: 'drawing_submitted',
        title: 'Чертёж на проверку',
        message: `Чертёж ${drawingCode}${discipline ? ' (' + discipline + ')' : ''} отправлен на проверку.`,
        taskId: drawingId,
        channels: [NotificationChannel.IN_APP],
        severity: 'info',
      });
    }
  } catch (error) {
    logger.error({ error, drawingId }, 'Error handling drawing.submitted_for_review');
    throw error;
  }
}
