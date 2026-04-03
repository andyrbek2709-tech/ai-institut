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

export class AuthError extends Error {
  status = 401;
  constructor() { super('Unauthorized'); this.name = 'AuthError'; }
}

const guardError = async (r: Response): Promise<Response> => {
  if (r.status === 401) throw new AuthError();
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.message || body.error || `HTTP ${r.status}: ${r.statusText}`);
  }
  return r;
};

export const get = (path: string, token?: string) =>
  fetch(`${SURL}/rest/v1/${path}`, { headers: H(token) }).then(guardError).then(r => r.json());

export const post = (path: string, data: any, token?: string) =>
  fetch(`${SURL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...H(token), 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  }).then(guardError).then(r => r.json());

export const patch = (path: string, data: any, token?: string) =>
  fetch(`${SURL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...H(token), 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
  }).then(guardError).then(r => r.json());

export const del = (path: string, token?: string) =>
  fetch(`${SURL}/rest/v1/${path}`, { method: 'DELETE', headers: H(token) }).then(guardError);

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

export const updateReviewStatus = (reviewId: string, status: string, token?: string) =>
  patch(`reviews?id=eq.${reviewId}`, { status, updated_at: new Date().toISOString() }, token);

export const createTransmittal = (payload: any, token?: string) =>
  post('transmittals', payload, token);

export const updateTransmittalStatus = (transmittalId: string, status: string, token?: string) =>
  patch(`transmittals?id=eq.${transmittalId}`, { status, updated_at: new Date().toISOString() }, token);

export const listTransmittalItems = (transmittalId: string, token?: string) =>
  get(`transmittal_items?transmittal_id=eq.${transmittalId}&order=created_at.desc`, token);

export const createTransmittalItem = (payload: any, token?: string) =>
  post('transmittal_items', payload, token);

export const listProjectTasks = (projectId: number, token?: string) =>
  get(`tasks?project_id=eq.${projectId}&order=id`, token);

export const createProjectTask = (payload: any, token?: string) =>
  post('tasks', payload, token);

export const updateTaskDrawingLink = (taskId: number, drawingId: string | null, token?: string) =>
  patch(`tasks?id=eq.${taskId}`, { drawing_id: drawingId }, token);

export const listMeetings = (projectId: number, token?: string) =>
  get(`meetings?project_id=eq.${projectId}&order=meeting_date.desc`, token);

export const createMeeting = (payload: any, token?: string) =>
  post('meetings', payload, token);

export const listTimeEntries = async (projectId: number, token?: string) => {
  const primary = await get(`time_entries?project_id=eq.${projectId}&order=date.desc`, token);
  if (Array.isArray(primary)) return primary;
  const fallback = await get(`time_log?project_id=eq.${projectId}&order=date.desc`, token);
  return Array.isArray(fallback) ? fallback : [];
};

export const createTimeEntry = async (payload: any, token?: string) => {
  const primary = await post('time_entries', payload, token);
  if (Array.isArray(primary)) return primary;
  if ((primary as any)?.id) return primary;
  return post('time_log', payload, token);
};

export const globalSearch = async (query: string, token?: string) => {
  const normalized = String(query || '').trim();
  if (!normalized) {
    return { projects: [], tasks: [], drawings: [], reviews: [] };
  }

  const v = encodeURIComponent(`*${normalized}*`);

  const [projects, tasks, drawings, reviews] = await Promise.all([
    get(`projects?select=id,name,code,status&or=(name.ilike.${v},code.ilike.${v})&order=id.desc&limit=10`, token),
    get(`tasks?select=id,project_id,name,dept,status,priority&name=ilike.${v}&order=id.desc&limit=10`, token),
    get(`drawings?select=id,project_id,code,title,discipline,status,revision&or=(title.ilike.${v},code.ilike.${v})&order=updated_at.desc.nullslast&limit=10`, token),
    get(`reviews?select=id,project_id,drawing_id,title,status,severity&title=ilike.${v}&order=updated_at.desc.nullslast&limit=10`, token),
  ]);

  return {
    projects: Array.isArray(projects) ? projects : [],
    tasks: Array.isArray(tasks) ? tasks : [],
    drawings: Array.isArray(drawings) ? drawings : [],
    reviews: Array.isArray(reviews) ? reviews : [],
  };
};

export { SURL, SERVICE_KEY };
