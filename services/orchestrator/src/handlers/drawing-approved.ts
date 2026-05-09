import { Logger } from 'pino';
import { Database } from '../services/database';
import { NotificationService, NotificationChannel } from '../services/notifications';

/**
 * drawing.approved — чертёж утверждён ГИП/руководителем.
 * Уведомляем автора (userId).
 */
export async function handleDrawingApproved(
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
    const authorId = metadata?.author_id || userId;
    logger.info({ drawingId, projectId, drawingCode }, 'Drawing approved');

    if (authorId) {
      await notifications.send({
        userId: authorId,
        type: 'drawing_approved',
        title: 'Чертёж утверждён',
        message: `Ваш чертёж ${drawingCode} утверждён.`,
        taskId: drawingId,
        channels: [NotificationChannel.IN_APP],
        severity: 'info',
      });
    }
  } catch (error) {
    logger.error({ error, drawingId }, 'Error handling drawing.approved');
    throw error;
  }
}
