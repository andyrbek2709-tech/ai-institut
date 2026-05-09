import { Logger } from 'pino';
import { Database } from '../services/database';
import { NotificationService, NotificationChannel } from '../services/notifications';

/**
 * meeting.recorded — создан протокол совещания.
 * Уведомляем GIP проекта.
 */
export async function handleMeetingRecorded(
  meetingId: string,
  projectId: string,
  userId: string,
  metadata: Record<string, any> | undefined,
  logger: Logger,
  db: Database,
  notifications: NotificationService,
): Promise<void> {
  try {
    const title = metadata?.title || 'Совещание';
    logger.info({ meetingId, projectId, title }, 'Meeting recorded');

    const leadId = await db.getProjectLead(projectId);
    if (leadId) {
      await notifications.send({
        userId: leadId,
        type: 'meeting_recorded',
        title: 'Создан протокол совещания',
        message: `«${title}» — протокол сохранён в проекте.`,
        taskId: meetingId,
        channels: [NotificationChannel.IN_APP],
        severity: 'info',
      });
    }
  } catch (error) {
    logger.error({ error, meetingId }, 'Error handling meeting.recorded');
    throw error;
  }
}
