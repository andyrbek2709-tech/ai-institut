import { Logger } from 'pino';
import { Database } from '../services/database';
import { NotificationService } from '../services/notifications';
import { StateMachine } from '../services/state-machine';
import { RedisStreamClient } from '../redis/client';
import { EventType, StreamEvent } from '../redis/stream';
import { handleTaskCreated } from './task-created';
import { handleTaskSubmitted } from './task-submitted';
import { handleTaskReviewReturned } from './task-review-returned';
import { handleTaskApproved } from './task-approved';
import { handleDeadlineApproaching } from './deadline-approaching';
import { handleAgskStandardUploaded } from './agsk-standard-uploaded';
import { handleAgskStandardReady } from './agsk-standard-ready';
import { handleDrawingSubmittedForReview } from './drawing-submitted';
import { handleDrawingApproved } from './drawing-approved';
import { handleMeetingRecorded } from './meeting-recorded';
import { handleCalculationCompleted } from './calculation-completed';

export async function processEvent(
  event: Partial<StreamEvent>,
  logger: Logger,
  db: Database,
  notifications: NotificationService,
  stateMachine: StateMachine,
  redisClient: RedisStreamClient,
): Promise<void> {
  const { event_type, task_id, project_id, user_id, metadata } = event;

  if (!task_id || !project_id || !event_type) {
    logger.warn({ event }, 'Invalid event data');
    return;
  }

  try {
    switch (event_type) {
      case EventType.TASK_CREATED:
        await handleTaskCreated(task_id, project_id, user_id || '', logger, db, notifications);
        break;

      case EventType.SUBMITTED_FOR_REVIEW:
        await handleTaskSubmitted(
          task_id,
          project_id,
          user_id || '',
          logger,
          db,
          notifications,
          stateMachine,
        );
        break;

      case EventType.TASK_RETURNED_BY_LEAD:
      case EventType.TASK_RETURNED_BY_GIP:
        await handleTaskReviewReturned(
          task_id,
          project_id,
          user_id || '',
          metadata,
          logger,
          db,
          notifications,
          stateMachine,
        );
        break;

      case EventType.TASK_APPROVED_BY_GIP:
        await handleTaskApproved(
          task_id,
          project_id,
          user_id || '',
          metadata,
          logger,
          db,
          notifications,
          stateMachine,
          redisClient,
        );
        break;

      case EventType.DEADLINE_APPROACHING_2D:
        await handleDeadlineApproaching(task_id, project_id, 2, logger, db, notifications);
        break;

      case EventType.DEADLINE_APPROACHING_1D:
        await handleDeadlineApproaching(task_id, project_id, 1, logger, db, notifications);
        break;

      case EventType.DEADLINE_EXCEEDED:
        await handleDeadlineApproaching(task_id, project_id, 0, logger, db, notifications);
        break;

      // ── New: AGSK / Drawings / Meetings / Calculations ──
      case EventType.AGSK_STANDARD_UPLOADED:
        await handleAgskStandardUploaded(task_id, project_id, user_id || '', metadata, logger, db, notifications);
        break;
      case EventType.AGSK_STANDARD_READY:
        await handleAgskStandardReady(task_id, project_id, user_id || '', metadata, logger, db, notifications);
        break;
      case EventType.DRAWING_SUBMITTED_FOR_REVIEW:
        await handleDrawingSubmittedForReview(task_id, project_id, user_id || '', metadata, logger, db, notifications);
        break;
      case EventType.DRAWING_APPROVED:
        await handleDrawingApproved(task_id, project_id, user_id || '', metadata, logger, db, notifications);
        break;
      case EventType.MEETING_RECORDED:
        await handleMeetingRecorded(task_id, project_id, user_id || '', metadata, logger, db, notifications);
        break;
      case EventType.CALCULATION_COMPLETED:
        await handleCalculationCompleted(task_id, project_id, user_id || '', metadata, logger, db, notifications);
        break;

      default:
        logger.info({ event_type }, 'Unhandled event type');
    }
  } catch (error) {
    logger.error({ error, event_type, task_id }, 'Error processing event');
    throw error;
  }
}
