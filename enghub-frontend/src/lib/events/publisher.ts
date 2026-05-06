export interface EventPayload {
  event_type: string;
  task_id?: string;
  project_id?: string;
  user_id?: string;
  review_id?: string;
  dependency_id?: string;
  metadata?: Record<string, any>;
}

export async function publishEvent(payload: EventPayload): Promise<void> {
  try {
    const response = await fetch('/api/publish-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: payload.event_type,
        task_id: payload.task_id,
        project_id: payload.project_id,
        user_id: payload.user_id,
        review_id: payload.review_id,
        metadata: payload.metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    console.log(`[Events] Published: ${payload.event_type}`, {
      taskId: payload.task_id,
      projectId: payload.project_id,
    });
  } catch (error) {
    console.error('[Events] Failed to publish event:', error);
    // Не бросаем ошибку — API должна работать даже если Redis недоступна
  }
}

// Специализированные обёртки для разных типов событий

export async function publishTaskCreated(
  taskId: string,
  projectId: string,
  userId: string,
  metadata?: Record<string, any>
): Promise<void> {
  return publishEvent({
    event_type: 'task.created',
    task_id: taskId,
    project_id: projectId,
    user_id: userId,
    metadata,
  });
}

export async function publishTaskSubmittedForReview(
  taskId: string,
  projectId: string,
  userId: string,
  metadata?: Record<string, any>
): Promise<void> {
  return publishEvent({
    event_type: 'task.submitted_for_review',
    task_id: taskId,
    project_id: projectId,
    user_id: userId,
    metadata,
  });
}

export async function publishTaskApproved(
  taskId: string,
  projectId: string,
  userId: string,
  metadata?: Record<string, any>
): Promise<void> {
  return publishEvent({
    event_type: 'task.approved_by_gip',
    task_id: taskId,
    project_id: projectId,
    user_id: userId,
    metadata,
  });
}

export async function publishTaskReturned(
  taskId: string,
  projectId: string,
  userId: string,
  returnedBy: 'lead' | 'gip',
  metadata?: Record<string, any>
): Promise<void> {
  return publishEvent({
    event_type: returnedBy === 'lead' ? 'task.returned_by_lead' : 'task.returned_by_gip',
    task_id: taskId,
    project_id: projectId,
    user_id: userId,
    metadata,
  });
}

export async function publishReviewCommentAdded(
  taskId: string,
  projectId: string,
  userId: string,
  reviewId: string,
  metadata?: Record<string, any>
): Promise<void> {
  return publishEvent({
    event_type: 'review.comment_added',
    task_id: taskId,
    project_id: projectId,
    user_id: userId,
    review_id: reviewId,
    metadata,
  });
}

export async function publishDependencyCreated(
  parentTaskId: string,
  dependentTaskId: string,
  projectId: string,
  userId: string,
  metadata?: Record<string, any>
): Promise<void> {
  return publishEvent({
    event_type: 'dependency.created',
    task_id: parentTaskId, // parent task
    project_id: projectId,
    user_id: userId,
    metadata: {
      ...metadata,
      dependent_task_id: dependentTaskId,
    },
  });
}

export async function publishFileAttached(
  taskId: string,
  projectId: string,
  userId: string,
  metadata?: Record<string, any>
): Promise<void> {
  return publishEvent({
    event_type: 'file.attached',
    task_id: taskId,
    project_id: projectId,
    user_id: userId,
    metadata,
  });
}
