import { Logger } from 'pino';
import { Database } from '../services/database';
import { NotificationService, NotificationChannel } from '../services/notifications';

export async function handleDeadlineApproaching(
  taskId: string,
  projectId: string,
  daysRemaining: number,
  logger: Logger,
  db: Database,
  notifications: NotificationService,
): Promise<void> {
  try {
    const task = await db.getTask(taskId);

    if (!task) {
      logger.warn({ taskId }, 'Task not found');
      return;
    }

    // Determine color based on days remaining
    let color: 'green' | 'yellow' | 'red' | 'black';
    if (daysRemaining > 3) {
      color = 'green';
    } else if (daysRemaining > 1) {
      color = 'yellow';
    } else if (daysRemaining > 0) {
      color = 'red';
    } else {
      color = 'black';
    }

    // Update deadline color
    await db.updateTaskDeadlineColor(taskId, color);

    logger.info({ taskId, daysRemaining, color }, 'Deadline color updated');

    // Notify assignee
    if (task.assignee_id) {
      let message = `Task ${taskId} deadline is approaching`;
      let severity: 'info' | 'warning' | 'error' = 'info';

      if (daysRemaining <= 0) {
        message = `Task ${taskId} deadline has been exceeded`;
        severity = 'error';
      } else if (daysRemaining <= 1) {
        message = `Task ${taskId} deadline is in less than 1 day`;
        severity = 'error';
      } else if (daysRemaining <= 3) {
        message = `Task ${taskId} deadline is in ${daysRemaining} days`;
        severity = 'warning';
      }

      const channels = daysRemaining <= 1
        ? [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.TELEGRAM]
        : [NotificationChannel.IN_APP, NotificationChannel.EMAIL];

      await notifications.send({
        userId: task.assignee_id,
        type: 'deadline_approaching',
        title: 'Deadline approaching',
        message,
        taskId,
        channels,
        severity,
      });
    }

    // Notify lead if deadline is critical
    if (daysRemaining <= 1) {
      const leadId = await db.getProjectLead(projectId);

      if (leadId) {
        await notifications.send({
          userId: leadId,
          type: 'deadline_critical',
          title: 'Critical deadline',
          message: `Task ${taskId} deadline is critical (${daysRemaining <= 0 ? 'OVERDUE' : 'in less than 1 day'})`,
          taskId,
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.TELEGRAM],
          severity: 'error',
        });
      }
    }
  } catch (error) {
    logger.error({ error, taskId }, 'Error handling deadline_approaching event');
    throw error;
  }
}
