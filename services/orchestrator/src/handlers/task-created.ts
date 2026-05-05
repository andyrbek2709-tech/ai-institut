import { Logger } from 'pino';
import { Database } from '../services/database';
import { NotificationService, NotificationChannel } from '../services/notifications';
import { TaskStatus } from '../services/state-machine';

export async function handleTaskCreated(
  taskId: string,
  projectId: string,
  userId: string,
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

    logger.info({ taskId, status: task.status }, 'Task created');

    // Get project lead
    const leadId = await db.getProjectLead(projectId);

    if (leadId) {
      await notifications.send({
        userId: leadId,
        type: 'task_created',
        title: 'New task assigned',
        message: `A new task has been created in project ${projectId}`,
        taskId,
        channels: [NotificationChannel.IN_APP],
        severity: 'info',
      });
    }

    // Create history record
    await db.createTaskHistory({
      task_id: taskId,
      event_type: 'task_created',
      new_value: TaskStatus.CREATED,
      user_id: userId,
    });
  } catch (error) {
    logger.error({ error, taskId }, 'Error handling task_created event');
    throw error;
  }
}
