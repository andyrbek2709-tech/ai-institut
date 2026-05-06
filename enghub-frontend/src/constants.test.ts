import { drawingStatusMap, taskWorkflowTransitions, copilotRolePrompts } from './constants';
import { describe, test, expect } from '@jest/globals';

describe('EngHub constants baseline', () => {
  test('workflow transitions include required production gates', () => {
    expect(taskWorkflowTransitions.todo).toContain('inprogress');
    expect(taskWorkflowTransitions.inprogress).toContain('review_lead');
    expect(taskWorkflowTransitions.review_lead).toEqual(
      expect.arrayContaining(['review_gip', 'revision'])
    );
    expect(taskWorkflowTransitions.review_gip).toEqual(
      expect.arrayContaining(['done', 'revision'])
    );
  });

  test('drawing statuses cover full lifecycle set', () => {
    const statuses = Object.keys(drawingStatusMap);
    expect(statuses).toEqual(
      expect.arrayContaining(['draft', 'in_work', 'review', 'approved', 'issued'])
    );
  });

  test('copilot role prompts exist for all runtime roles', () => {
    expect(copilotRolePrompts.gip).toBeTruthy();
    expect(copilotRolePrompts.lead).toBeTruthy();
    expect(copilotRolePrompts.engineer).toBeTruthy();
  });
});
