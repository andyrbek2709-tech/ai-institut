import { describe, test, expect } from '@jest/globals';
import { validateApplyAction } from './validateApplyAction';

describe('validateApplyAction', () => {
  const baseCtx = { userId: 'u1', role: 'gip' as const, projectId: 'p1' };

  test('create_tasks validates items payload', () => {
    const bad = validateApplyAction('create_tasks', { items: [{ name: '' }] }, baseCtx);
    expect(bad.ok).toBe(false);
    const good = validateApplyAction('create_tasks', { items: [{ name: 'Собрать исходные данные' }] }, baseCtx);
    expect(good).toEqual({ ok: true });
  });

  test('engineer cannot create tasks', () => {
    const res = validateApplyAction('create_tasks', { items: [{ name: 'Task' }] }, { userId: 'u1', role: 'engineer', projectId: 'p1' });
    expect(res.ok).toBe(false);
    expect(res.error).toContain('ROLE_RESTRICTED');
  });

  test('forbidden action is blocked', () => {
    const res = validateApplyAction('assign_user', {}, baseCtx);
    expect(res.ok).toBe(false);
    expect(res.error).toContain('FORBIDDEN_ACTION');
  });
});
