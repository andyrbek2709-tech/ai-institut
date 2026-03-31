/**
 * Server-side orchestrator inserts rows into `ai_actions`; this module validates
 * payloads before the client applies them to Supabase (single source of truth for apply-contracts).
 */

export type ApplyValidationResult =
  | { ok: true }
  | { ok: false; error: string };

const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/** Action types the Copilot panel knows how to execute on approve. */
export const COPILOT_SUPPORTED_APPLY_TYPES = new Set([
  'create_tasks',
  'create_drawing',
  'update_drawing',
  'create_drawing_revision',
  'create_revision',
  'create_review',
  'update_review_status',
  'create_transmittal',
  'update_transmittal_status',
]);

function validateTransmittalItems(items: unknown): ApplyValidationResult {
  if (!Array.isArray(items)) return { ok: true };
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it == null || typeof it !== 'object') {
      return { ok: false, error: `create_transmittal: items[${i}] должен быть объектом.` };
    }
    const row = it as Record<string, unknown>;
    const hasDrawing = row.drawing_id != null && String(row.drawing_id).trim() !== '';
    const hasRevision = row.revision_id != null && String(row.revision_id).trim() !== '';
    if (!hasDrawing && !hasRevision) {
      return { ok: false, error: `create_transmittal: в позиции ${i + 1} нужен drawing_id и/или revision_id.` };
    }
  }
  return { ok: true };
}

export function validateCopilotApply(
  actionType: string,
  payload: Record<string, unknown> | null | undefined,
  approved: boolean,
): ApplyValidationResult {
  if (!approved) return { ok: true };

  if (!COPILOT_SUPPORTED_APPLY_TYPES.has(actionType)) {
    return {
      ok: false,
      error: `Тип действия «${actionType}» не поддерживается при подтверждении в Copilot. Отклоните карточку или обновите клиент.`,
    };
  }

  const p = payload && typeof payload === 'object' ? payload : {};

  switch (actionType) {
    case 'create_tasks': {
      if (!Array.isArray(p.tasks)) {
        return { ok: false, error: 'Невозможно применить create_tasks: payload.tasks должен быть массивом.' };
      }
      if (p.tasks.length === 0) {
        return { ok: false, error: 'Невозможно применить create_tasks: список задач пуст.' };
      }
      for (let i = 0; i < p.tasks.length; i++) {
        const t = p.tasks[i];
        if (t == null || typeof t !== 'object') {
          return { ok: false, error: `create_tasks: элемент ${i} не является объектом задачи.` };
        }
        const title = (t as Record<string, unknown>).title;
        if (!nonEmpty(title)) {
          return { ok: false, error: `create_tasks: у задачи ${i + 1} отсутствует title.` };
        }
      }
      return { ok: true };
    }
    case 'create_drawing': {
      if (!nonEmpty(p.code) || !nonEmpty(p.title)) {
        return { ok: false, error: 'Невозможно применить create_drawing: нужны непустые code и title.' };
      }
      return { ok: true };
    }
    case 'update_drawing': {
      if (!nonEmpty(p.drawing_id)) {
        return { ok: false, error: 'Невозможно применить update_drawing: отсутствует drawing_id.' };
      }
      if (p.updates == null || typeof p.updates !== 'object' || Array.isArray(p.updates)) {
        return { ok: false, error: 'Невозможно применить update_drawing: updates должен быть объектом полей.' };
      }
      return { ok: true };
    }
    case 'create_drawing_revision':
    case 'create_revision': {
      if (!nonEmpty(p.drawing_id)) {
        return { ok: false, error: 'Невозможно применить ревизию: отсутствует drawing_id.' };
      }
      return { ok: true };
    }
    case 'create_review': {
      if (!nonEmpty(p.title)) {
        return { ok: false, error: 'Невозможно применить create_review: отсутствует title.' };
      }
      return { ok: true };
    }
    case 'update_review_status': {
      if (!nonEmpty(p.review_id) || !nonEmpty(p.status)) {
        return { ok: false, error: 'Невозможно применить update_review_status: нужны review_id и status.' };
      }
      return { ok: true };
    }
    case 'create_transmittal': {
      return validateTransmittalItems(p.items);
    }
    case 'update_transmittal_status': {
      if (!nonEmpty(p.transmittal_id) || !nonEmpty(p.status)) {
        return { ok: false, error: 'Невозможно применить update_transmittal_status: нужны transmittal_id и status.' };
      }
      return { ok: true };
    }
    default:
      return { ok: false, error: `Внутренняя ошибка: неизвестный тип «${actionType}».` };
  }
}
