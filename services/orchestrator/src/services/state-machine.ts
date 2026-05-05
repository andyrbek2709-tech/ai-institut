import { Logger } from 'pino';
import { ValidationError } from '../utils/errors';

export enum TaskStatus {
  CREATED = 'created',
  IN_PROGRESS = 'in_progress',
  REVIEW_LEAD = 'review_lead',
  REVIEW_GIP = 'review_gip',
  REWORK = 'rework',
  AWAITING_DATA = 'awaiting_data',
  APPROVED = 'approved',
}

export interface TaskState {
  id: string;
  status: TaskStatus;
  assignee_id: string;
  lead_id?: string;
  project_id: string;
  rework_count: number;
  created_at: string;
  deadline_at?: string;
  has_blocking_dependencies: boolean;
  is_unblocked: boolean;
}

export interface StateTransition {
  from: TaskStatus;
  to: TaskStatus;
  trigger: string;
  condition?: (state: TaskState) => boolean;
}

export class StateMachine {
  private logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  private transitions: StateTransition[] = [
    // From CREATED
    { from: TaskStatus.CREATED, to: TaskStatus.IN_PROGRESS, trigger: 'start_work' },
    { from: TaskStatus.CREATED, to: TaskStatus.AWAITING_DATA, trigger: 'await_dependency' },

    // From IN_PROGRESS
    { from: TaskStatus.IN_PROGRESS, to: TaskStatus.REVIEW_LEAD, trigger: 'submit_for_review' },
    { from: TaskStatus.IN_PROGRESS, to: TaskStatus.AWAITING_DATA, trigger: 'block_by_dependency' },

    // From REVIEW_LEAD
    { from: TaskStatus.REVIEW_LEAD, to: TaskStatus.REVIEW_GIP, trigger: 'lead_approves' },
    { from: TaskStatus.REVIEW_LEAD, to: TaskStatus.REWORK, trigger: 'lead_returns' },

    // From REWORK
    { from: TaskStatus.REWORK, to: TaskStatus.REVIEW_LEAD, trigger: 'resubmit_for_review' },

    // From REVIEW_GIP
    { from: TaskStatus.REVIEW_GIP, to: TaskStatus.APPROVED, trigger: 'gip_approves' },
    { from: TaskStatus.REVIEW_GIP, to: TaskStatus.REWORK, trigger: 'gip_returns' },

    // From AWAITING_DATA
    { from: TaskStatus.AWAITING_DATA, to: TaskStatus.IN_PROGRESS, trigger: 'dependency_resolved' },
  ];

  canTransition(
    currentStatus: TaskStatus,
    trigger: string,
    state: TaskState,
  ): boolean {
    const transition = this.transitions.find(
      t => t.from === currentStatus && t.trigger === trigger,
    );

    if (!transition) {
      return false;
    }

    if (transition.condition) {
      return transition.condition(state);
    }

    return true;
  }

  getNextStatus(currentStatus: TaskStatus, trigger: string): TaskStatus {
    const transition = this.transitions.find(
      t => t.from === currentStatus && t.trigger === trigger,
    );

    if (!transition) {
      throw new ValidationError(
        `Invalid transition: ${currentStatus} -> ${trigger}`,
      );
    }

    return transition.to;
  }

  validateSubmit(state: TaskState): void {
    if (state.status !== TaskStatus.IN_PROGRESS && state.status !== TaskStatus.REWORK) {
      throw new ValidationError(
        `Cannot submit task in status '${state.status}'`,
      );
    }
  }

  validateReturn(state: TaskState): void {
    if (
      state.status !== TaskStatus.REVIEW_LEAD &&
      state.status !== TaskStatus.REVIEW_GIP
    ) {
      throw new ValidationError(
        `Cannot return task in status '${state.status}'`,
      );
    }
  }

  validateApprove(state: TaskState): void {
    if (state.status !== TaskStatus.REVIEW_LEAD && state.status !== TaskStatus.REVIEW_GIP) {
      throw new ValidationError(
        `Cannot approve task in status '${state.status}'`,
      );
    }
  }

  isTerminalStatus(status: TaskStatus): boolean {
    return status === TaskStatus.APPROVED;
  }

  isBlockingStatus(status: TaskStatus): boolean {
    return [TaskStatus.REVIEW_LEAD, TaskStatus.REVIEW_GIP, TaskStatus.REWORK].includes(
      status,
    );
  }
}
