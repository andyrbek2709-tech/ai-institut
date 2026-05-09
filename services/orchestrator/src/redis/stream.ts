export enum EventType {
  // ── User-triggered TASK events ──
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

  // ── System-generated TASK events ──
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

  // ── AGSK (нормативная база) events ──
  AGSK_STANDARD_UPLOADED = 'agsk.standard.uploaded',  // PDF загружен, ingestion стартовал
  AGSK_STANDARD_READY = 'agsk.standard.ready',        // Обработан, готов к поиску
  AGSK_STANDARD_FAILED = 'agsk.standard.failed',      // Ingestion job упал

  // ── Drawings (чертежи) events ──
  DRAWING_CREATED = 'drawing.created',
  DRAWING_SUBMITTED_FOR_REVIEW = 'drawing.submitted_for_review',
  DRAWING_APPROVED = 'drawing.approved',
  DRAWING_RETURNED = 'drawing.returned',
  DRAWING_ISSUED = 'drawing.issued',

  // ── Meetings (совещания) events ──
  MEETING_RECORDED = 'meeting.recorded',              // Создан протокол
  MEETING_TRANSCRIBED = 'meeting.transcribed',        // Whisper завершил транскрипцию

  // ── Calculations (расчёты) events ──
  CALCULATION_COMPLETED = 'calculation.completed',    // Расчёт сохранён с результатом

  // ── ChatGPT 4.0 actions events ──
  CHATGPT4_ACTION_PROPOSED = 'chatgpt4.action.proposed', // AI предложил действие, ждёт approve
}

export interface StreamEvent {
  event_type: EventType;
  // Универсальный ID связанной сущности — task_id для task.* событий,
  // standard_id для agsk.*, drawing_id для drawing.*, meeting_id для meeting.*.
  // Оставлен как task_id для обратной совместимости со старыми handlers.
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
