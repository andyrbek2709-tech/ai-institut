import { describe, test, expect } from '@jest/globals';
import { validateCopilotApply, COPILOT_SUPPORTED_APPLY_TYPES } from './validateApplyAction';

describe('validateCopilotApply', () => {
  test('reject path skips payload checks', () => {
    expect(validateCopilotApply('create_tasks', {}, false)).toEqual({ ok: true });
  });

  test('create_tasks requires non-empty task titles', () => {
    const bad = validateCopilotApply('create_tasks', { tasks: [{ title: '' }] }, true);
    expect(bad.ok).toBe(false);
    const good = validateCopilotApply('create_tasks', { tasks: [{ title: '  Do X  ' }] }, true);
    expect(good).toEqual({ ok: true });
  });

  test('update_drawing requires id and updates object', () => {
    expect(validateCopilotApply('update_drawing', { drawing_id: 'x' }, true).ok).toBe(false);
    expect(validateCopilotApply('update_drawing', { drawing_id: 'x', updates: {} }, true)).toEqual({ ok: true });
  });

  test('unknown apply types are blocked on approve', () => {
    expect(COPILOT_SUPPORTED_APPLY_TYPES.has('workflow_transition')).toBe(false);
    const r = validateCopilotApply('workflow_transition', {}, true);
    expect(r.ok).toBe(false);
  });
});
