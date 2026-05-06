/**
 * validateApplyAction.ts
 * ЕДИНАЯ точка защиты перед записью в БД
 */

export type Role = 'admin' | 'gip' | 'lead' | 'engineer';

export type Action =
  | 'create_tasks'
  | 'create_review'
  | 'update_task'
  | 'delete_entity'
  | 'assign_user';

export interface ValidateContext {
  userId: string;
  role: Role;
  projectId?: string;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Главная функция
 */
export function validateApplyAction(
  action: Action,
  payload: any,
  ctx: ValidateContext
): ValidationResult {
  // --- 1. Базовая защита ---
  if (!ctx.userId) {
    return fail('UNAUTHORIZED', 'Пользователь не авторизован');
  }

  if (!ctx.projectId) {
    return fail('NO_PROJECT', 'Не выбран проект');
  }

  // --- 2. Запрещенные AI действия ---
  const forbiddenActions: Action[] = [
    'update_task',
    'delete_entity',
    'assign_user'
  ];

  if (forbiddenActions.includes(action)) {
    return fail('FORBIDDEN_ACTION', 'AI не имеет права выполнять это действие');
  }

  // --- 3. Ролевая модель ---
  if (ctx.role === 'engineer') {
    if (action === 'create_tasks') {
      return fail('ROLE_RESTRICTED', 'Инженер не может создавать задачи');
    }
  }

  // --- 4. Валидация по типу ---
  switch (action) {
    case 'create_tasks':
      return validateCreateTasks(payload);

    case 'create_review':
      return validateCreateReview(payload);

    default:
      return fail('UNKNOWN_ACTION', 'Неизвестное действие');
  }
}

/**
 * --- VALIDATORS ---
 */
function validateCreateTasks(payload: any): ValidationResult {
  if (!Array.isArray(payload.items)) {
    return fail('INVALID_FORMAT', 'items должен быть массивом');
  }

  if (payload.items.length === 0) {
    return fail('EMPTY', 'Нет задач для создания');
  }

  if (payload.items.length > 50) {
    return fail('LIMIT_EXCEEDED', 'Слишком много задач (макс 50)');
  }

  for (const task of payload.items) {
    if (!task.name || typeof task.name !== 'string') {
      return fail('INVALID_NAME', 'Каждая задача должна иметь название');
    }

    if (task.name.length > 200) {
      return fail('NAME_TOO_LONG', 'Название слишком длинное');
    }

    if (task.deadline && !isValidDate(task.deadline)) {
      return fail('INVALID_DATE', 'Некорректный формат даты');
    }

    // AI не может назначать исполнителя
    if (task.assigned_to) {  // B2 fix: column is assigned_to in tasks (not assignee_id)
      return fail('ASSIGN_FORBIDDEN', 'Назначение исполнителя запрещено для AI');
    }
  }

  return success();
}

function validateCreateReview(payload: any): ValidationResult {
  if (!Array.isArray(payload.items)) {
    return fail('INVALID_FORMAT', 'items должен быть массивом');
  }

  if (payload.items.length === 0) {
    return fail('EMPTY', 'Нет замечаний');
  }

  for (const r of payload.items) {
    if (!r.text || r.text.length < 5) {
      return fail('INVALID_TEXT', 'Замечание слишком короткое');
    }

    if (!['critical', 'major', 'minor'].includes(r.severity)) {
      return fail('INVALID_SEVERITY', 'Некорректный severity');
    }

    if (!r.drawing_id) {
      return fail('NO_DRAWING', 'Замечание должно быть привязано к чертежу');
    }
  }

  return success();
}

/**
 * --- HELPERS ---
 */
function isValidDate(date: string): boolean {
  return !isNaN(Date.parse(date));
}

function fail(code: string, message: string): ValidationResult {
  return {
    ok: false,
    error: `${code}: ${message}`
  };
}

function success(): ValidationResult {
  return { ok: true };
}
