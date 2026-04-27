import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('globalSearch helper', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.REACT_APP_SUPABASE_URL = 'https://example.supabase.co';
    process.env.REACT_APP_SUPABASE_ANON_KEY = 'anon';
  });

  test('returns grouped results for projects/tasks/drawings/reviews', async () => {
    const fetchMock: any = jest.fn();
    fetchMock
      .mockResolvedValueOnce({ json: async () => [{ id: 1, name: 'PRJ-001' }] })
      .mockResolvedValueOnce({ json: async () => [{ id: 2, name: 'Task A' }] })
      .mockResolvedValueOnce({ json: async () => [{ id: 'd1', title: 'DWG-001' }] })
      .mockResolvedValueOnce({ json: async () => [{ id: 'r1', title: 'Review A' }] });
    (global as any).fetch = fetchMock;

    const mod = await import('./supabase');
    const result = await mod.globalSearch('PRJ', 'token-1');

    expect(Array.isArray(result.projects)).toBe(true);
    expect(Array.isArray(result.tasks)).toBe(true);
    expect(Array.isArray(result.drawings)).toBe(true);
    expect(Array.isArray(result.reviews)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.some((u) => u.includes('/rest/v1/projects?select='))).toBe(true);
    expect(urls.some((u) => u.includes('/rest/v1/tasks?select=id,project_id,name'))).toBe(true);
    expect(urls.some((u) => u.includes('/rest/v1/drawings?select=id,project_id,code,title'))).toBe(true);
    expect(urls.some((u) => u.includes('/rest/v1/reviews?select=id,project_id,drawing_id,title'))).toBe(true);
  });

  test('returns empty groups for blank query', async () => {
    const fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    const mod = await import('./supabase');
    const result = await mod.globalSearch('   ', 'token-1');
    expect(result).toEqual({ projects: [], tasks: [], drawings: [], reviews: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
