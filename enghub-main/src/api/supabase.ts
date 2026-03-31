// Supabase API helpers — прямые fetch запросы без SDK

const SURL = process.env.REACT_APP_SUPABASE_URL || '';
const KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.REACT_APP_SUPABASE_SERVICE_KEY || '';

const H = (token?: string) => ({
  'apikey': KEY,
  'Authorization': `Bearer ${token || KEY}`,
  'Content-Type': 'application/json',
});

const AdminH = () => ({
  'apikey': KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
});

export const get = (path: string, token?: string) =>
  fetch(`${SURL}/rest/v1/${path}`, { headers: H(token) }).then(r => r.json());

export const post = (path: string, data: any, token?: string) =>
  fetch(`${SURL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...H(token), 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const patch = (path: string, data: any, token?: string) =>
  fetch(`${SURL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...H(token), 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  }).then(r => r.json());

export const del = (path: string, token?: string) =>
  fetch(`${SURL}/rest/v1/${path}`, { method: 'DELETE', headers: H(token) });

export const signIn = (email: string, password: string) =>
  fetch(`${SURL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: H(),
    body: JSON.stringify({ email, password }),
  }).then(r => r.json());

export const createAuthUser = (email: string, password: string) =>
  fetch(`${SURL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: AdminH(),
    body: JSON.stringify({ email, password, email_confirm: true }),
  }).then(r => r.json());

export const updateUserPassword = (uid: string, newPassword: string) =>
  fetch(`${SURL}/auth/v1/admin/users/${uid}`, {
    method: 'PUT',
    headers: AdminH(),
    body: JSON.stringify({ password: newPassword }),
  }).then(r => r.json());

// Domain helpers for engineering workflow
export const listDrawings = (projectId: number, token?: string) =>
  get(`drawings?project_id=eq.${projectId}&order=created_at.desc`, token);

export const createDrawing = (payload: any, token?: string) =>
  post('drawings', payload, token);

export const updateDrawing = (id: string, payload: any, token?: string) =>
  patch(`drawings?id=eq.${id}`, payload, token);

export const createRevisionRecord = (payload: any, token?: string) =>
  post('revisions', payload, token);

export const listRevisions = (projectId: number, token?: string) =>
  get(`revisions?project_id=eq.${projectId}&order=created_at.desc`, token);

export const listReviews = (projectId: number, token?: string) =>
  get(`reviews?project_id=eq.${projectId}&order=created_at.desc`, token);

export const createReview = (payload: any, token?: string) =>
  post('reviews', payload, token);

export const createTransmittal = (payload: any, token?: string) =>
  post('transmittals', payload, token);

export const listProjectTasks = (projectId: number, token?: string) =>
  get(`tasks?project_id=eq.${projectId}&order=id`, token);

export const createProjectTask = (payload: any, token?: string) =>
  post('tasks', payload, token);

export const updateTaskDrawingLink = (taskId: number, drawingId: string | null, token?: string) =>
  patch(`tasks?id=eq.${taskId}`, { drawing_id: drawingId }, token);

export { SURL, SERVICE_KEY };
