import { Logger } from 'pino';
import { Database } from '../services/database';
import { NotificationService, NotificationChannel } from '../services/notifications';
import { StateMachine, TaskStatus } from '../services/state-machine';

export async function handleTaskReviewReturned(
  taskId: string,
  projectId: string,
  userId: string,
  metadata: any,
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
    stateMachine.validateReturn(task);

    // Update task status to rework
    const updated = await db.updateTaskStatus(taskId, TaskStatus.REWORK);

    // Increment rework count
    await db.createTaskHistory({
      task_id: taskId,
      event_type: 'rework_iteration',
      metadata: { rework_count: (task.rework_count || 0) + 1 },
      user_id: userId,
    });

    logger.info({ taskId, newStatus: TaskStatus.REWORK }, 'Task returned for rework');

    // Notify assignee
    if (task.assignee_id) {
      await notifications.send({
        userId: task.assignee_id,
        type: 'task_returned',
        title: 'Task returned for rework',
        message: `Task ${taskId} has been returned with comments: ${metadata?.comment || 'No comment provided'}`,
        taskId,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        severity: 'warning',
      });
    }

    // Create history record
    await db.createTaskHistory({
      task_id: taskId,
      event_type: 'review_returned',
      old_value: task.status,
      new_value: TaskStatus.REWORK,
      user_id: userId,
      metadata: { comment: metadata?.comment },
    });
  } catch (error) {
    logger.error({ error, taskId }, 'Error handling task_review_returned event');
    throw error;
  }
}
