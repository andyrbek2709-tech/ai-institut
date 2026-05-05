export enum EventType {
  // User-triggered events
  TASK_CREATED = 'task.created',
  FILE_ATTACHED = 'file.attached',
  SUBMITTED_FOR_REVIEW = 'task.submitted_for_review',
  REVIEW_COMMENT_ADDED = 'review.comment_added',
  TASK_ACCEPTED_BY_LEAD = 'task.accepted_by_lead',
  TASK_RETURNED_BY_LEAD = 'task.returned_by_lead',
  TASK_APPROVED_BY_GIP = 'task.approved_by_gip',
  TASK_RETURNED_BY_GIP = 'task.returned_by_gip',
  DEPENDENCY_CREATED = 'dependency.created',
  DEPENDENT_TASK_APPROVED = 'dependent_task.approved',

  // System-generated events
  DEADLINE_APPROACHING_2D = 'deadline.approaching_2d',
  DEADLINE_APPROACHING_1D = 'deadline.approaching_1d',
  DEADLINE_EXCEEDED = 'deadline.exceeded',
  BLOCKING_24H = 'blocking.24h',
  BLOCKING_48H = 'blocking.48h',
  BLOCKING_72H = 'blocking.72h',
  REVIEW_TIMEOUT_LEAD_24H = 'review.timeout_lead_24h',
  REVIEW_TIMEOUT_LEAD_48H = 'review.timeout_lead_48h',
  REVIEW_TIMEOUT_GIP_24H = 'review.timeout_gip_24h',
  HEARTBEAT_CHECK = 'heartbeat.check',
}

export interface StreamEvent {
  event_type: EventType;
  task_id: string;
  project_id: string;
  user_id?: string;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface RedisStreamMessage {
  id: string;
  data: Record<string, string>;
}

export const STREAM_NAME = 'task-events';
export const CONSUMER_GROUP = 'orchestrator-group';
