import { Logger } from 'pino';
import { Database } from '../services/database';
import { NotificationService, NotificationChannel } from '../services/notifications';
import { StateMachine, TaskStatus } from '../services/state-machine';

export async function handleTaskSubmitted(
  taskId: string,
  projectId: string,
  userId: string,
  logger: Logger,
  db: Database,
  notifications: NotificationService,
  stateMachine: StateMachine,
): Promise<void> {
  try {
    const task = await db.getTask(taskId);

    if (!task) {
      logger.warn({ taskId }, 'Task not found');
      return;
    }

    // Validate state transition
    stateMachine.validateSubmit(task);

    // Update task status to review_lead
    const updated = await db.updateTaskStatus(taskId, TaskStatus.REVIEW_LEAD);

    logger.info({ taskId, newStatus: TaskStatus.REVIEW_LEAD }, 'Task submitted for review');

    // Notify lead
    const leadId = await db.getProjectLead(projectId);

    if (leadId) {
      await notifications.send({
        userId: leadId,
        type: 'task_submitted_for_review',
        title: 'Task awaiting your review',
        message: `Task ${taskId} from ${task.assignee_id} is ready for your review`,
        taskId,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        severity: 'info',
      });
    }

    // Create history record
    await db.createTaskHistory({
      task_id: taskId,
      event_type: 'submitted_for_review',
      old_value: task.status,
      new_value: TaskStatus.REVIEW_LEAD,
      user_id: userId,
    });
  } catch (error) {
    logger.error({ error, taskId }, 'Error handling task_submitted event');
    throw error;
  }
}
