import { Logger } from 'pino';
import { Database } from '../services/database';
import { NotificationService, NotificationChannel } from '../services/notifications';
import { StateMachine, TaskStatus } from '../services/state-machine';
import { RedisStreamClient } from '../redis/client';
import { EventType } from '../redis/stream';

export async function handleTaskApproved(
  taskId: string,
  projectId: string,
  userId: string,
  metadata: any,
  logger: Logger,
  db: Database,
  notifications: NotificationService,
  stateMachine: StateMachine,
  redisClient: RedisStreamClient,
): Promise<void> {
  try {
    const task = await db.getTask(taskId);

    if (!task) {
      logger.warn({ taskId }, 'Task not found');
      return;
    }

    // Validate state transition
    stateMachine.validateApprove(task);

    // Update task status to approved
    const updated = await db.updateTaskStatus(taskId, TaskStatus.APPROVED);

    logger.info({ taskId, newStatus: TaskStatus.APPROVED }, 'Task approved');

    // Unblock dependent tasks
    const unblocked = await db.unblockDependentTasks(taskId);

    if (unblocked.length > 0) {
      logger.info({ taskId, unblockCount: unblocked.length }, 'Dependent tasks unblocked');

      // Publish event for each unblocked task
      for (const unblockedTask of unblocked) {
        await redisClient.publishEvent({
          event_type: EventType.DEPENDENT_TASK_APPROVED,
          task_id: unblockedTask.id,
          project_id: projectId,
          user_id: userId,
          timestamp: Date.now(),
        });
      }
    }

    // Notify assignee
    if (task.assignee_id) {
      await notifications.send({
        userId: task.assignee_id,
        type: 'task_approved',
        title: 'Task approved',
        message: `Your task ${taskId} has been approved and is now complete`,
        taskId,
        channels: [NotificationChannel.IN_APP],
        severity: 'info',
      });
    }

    // Create history record
    await db.createTaskHistory({
      task_id: taskId,
      event_type: 'task_approved',
      old_value: task.status,
      new_value: TaskStatus.APPROVED,
      user_id: userId,
    });
  } catch (error) {
    logger.error({ error, taskId }, 'Error handling task_approved event');
    throw error;
  }
}
