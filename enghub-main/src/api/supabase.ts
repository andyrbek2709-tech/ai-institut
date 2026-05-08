// Supabase API helpers — прямые fetch запросы без SDK
//
// SECURITY: SERVICE_KEY БОЛЬШЕ НЕ ДОСТУПЕН В КЛИЕНТЕ.
// Все admin-операции (создание юзера, смена пароля, подпись Storage URL,
// удаление файла, чтение activity_log, прямые INSERT в notifications)
// идут через серверные /api/* endpoints с user JWT.

import { apiPost } from './http';

const SURL = process.env.REACT_APP_SUPABASE_URL || '';
const KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || '';

// Always fetch a fresh token from the Supabase JS session when none is provided.
// This is the single source of truth — no localStorage fallback.
const freshToken = async (provided?: string): Promise<string> => {
  if (provided) return provided;
  try {
    const { getSupabaseAnonClient } = await import('./supabaseClient');
    const { data } = await getSupabaseAnonClient().auth.getSession();
    if (data.session?.access_token) return data.session.access_token;
  } catch { /* ignore */ }
  return KEY; // anon key as last resort for public endpoints
};

const H = (token: string) => ({
  'apikey': KEY,
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export class AuthError extends Error {
  status = 401;
  constructor() { super('Unauthorized'); this.name = 'AuthError'; }
}

const RLS_TABLE_LABELS: Record<string, string> = {
  projects: 'проектов',
  tasks: 'задач',
  drawings: 'чертежей',
  reviews: 'замечаний',
  transmittals: 'трансмитталов',
  messages: 'сообщений',
  meetings: 'протоколов',
  project_documents: 'документов проекта',
  task_attachments: 'вложений задачи',
  notifications: 'уведомлений',
  departments: 'отделов',
  app_users: 'пользователей',
};

const humanizeRlsError = (msg: string): string => {
  const match = msg.match(/row-level security policy for table "?(\w+)"?/);
  if (!match) return msg;
  const table = match[1];
  const label = RLS_TABLE_LABELS[table] || table;
  return `У вас недостаточно прав для этой операции с ${label}. Проверьте вашу роль в системе.`;
};

const guardError = async (r: Response): Promise<Response> => {
  if (r.status === 401) throw new AuthError();
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    const raw = body.message || body.error || body.details || `HTTP ${r.status}: ${r.statusText}`;
    const msg = typeof raw === 'string' && raw.includes('row-level security')
      ? humanizeRlsError(raw)
      : raw;
    throw new Error(msg);
  }
  return r;
};

export const get = async (path: string, token?: string) => {
  const t = await freshToken(token);
  return fetch(`${SURL}/rest/v1/${path}`, { headers: H(t), signal: AbortSignal.timeout(30000) }).then(guardError).then(r => r.json());
};

export const post = async (path: string, data: any, token?: string) => {
  const t = await freshToken(token);
  return fetch(`${SURL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...H(t), 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(30000),
  }).then(guardError).then(r => r.json());
};

export const patch = async (path: string, data: any, token?: string) => {
  const t = await freshToken(token);
  return fetch(`${SURL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...H(t), 'Prefer': 'return=representation' },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(30000),
  }).then(guardError).then(r => r.json());
};

export const del = async (path: string, token?: string) => {
  const t = await freshToken(token);
  return fetch(`${SURL}/rest/v1/${path}`, { method: 'DELETE', headers: H(t), signal: AbortSignal.timeout(30000) }).then(guardError);
};

export const signIn = async (email: string, password: string) => {
  // Use Supabase JS client so autoRefreshToken keeps the session alive
  const { getSupabaseAnonClient } = await import('./supabaseClient');
  const sb = getSupabaseAnonClient();
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
  if (!data.session) throw new Error('Сессия не получена. Проверьте данные.');
  return { access_token: data.session.access_token, user: data.user };
};

// Admin-операции через серверные /api endpoints (требуют admin role).
// createAuthUser теперь принимает (email, password, full_name, role, dept_id?).
// Старая 2-arg сигнатура поддержана через дефолты для обратной совместимости.
export const createAuthUser = async (
  email: string,
  password: string,
  full_name: string = email,
  role: string = 'engineer',
  dept_id?: number | null,
) =>
  apiPost('/api/admin-users', { action: 'create', email, password, full_name, role, dept_id });

export const updateUserPassword = (supabase_uid: string, new_password: string) =>
  apiPost('/api/admin-users', { action: 'reset_password', supabase_uid, new_password });

export const updateUserRole = (user_id: number, role: string, dept_id?: number | null) =>
  apiPost('/api/admin-users', { action: 'update_role', user_id, role, dept_id });

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

// Task history (versioning)
export const listTaskHistory = (taskId: number, token?: string) =>
  get(`task_history?task_id=eq.${taskId}&order=changed_at.desc&limit=30`, token);

// Review comments (threads)
export const listReviewComments = (reviewId: number, token?: string) =>
  get(`review_comments?review_id=eq.${reviewId}&order=created_at.asc`, token);

export const createReviewComment = (payload: any, token?: string) =>
  post('review_comments', payload, token);

// Notifications
export const listNotifications = (userId: number, token?: string) =>
  get(`notifications?user_id=eq.${userId}&order=created_at.desc&limit=50`, token);

export const markNotificationRead = (id: number, token?: string) =>
  patch(`notifications?id=eq.${id}`, { is_read: true }, token);

export const markAllNotificationsRead = (userId: number, token?: string) =>
  patch(`notifications?user_id=eq.${userId}&is_read=eq.false`, { is_read: true }, token);

export const createNotification = (payload: any) =>
  apiPost('/api/notifications-create', payload);

export { SURL };

// =========================================================================
// T30 / T31 — Документы проекта, прикрепления к задачам, storage stats
// =========================================================================

export const STORAGE_BUCKET = 'project-files';
export const FILE_SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB

const sanitizeName = (n: string) => n.replace(/[^a-zA-Z0-9._-]/g, '_');

const uploadToBucket = async (path: string, file: File, token?: string) => {
  const t = await freshToken(token);
  const r = await fetch(`${SURL}/storage/v1/object/${STORAGE_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${t}`,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: file,
  });
  if (!r.ok) {
    const body = await r.text().catch(() => '');
    throw new Error(`Storage upload failed (${r.status}): ${body}`);
  }
  return path;
};

export const signProjectFileUrl = async (path: string, expiresInSec: number = 60 * 60): Promise<string | null> => {
  try {
    const j = await apiPost<{ signed_url: string }>('/api/storage-sign-url', {
      storage_path: path,
      expiresIn: expiresInSec,
    });
    return j?.signed_url || null;
  } catch {
    return null;
  }
};

const removeFromBucket = async (path: string) => {
  try {
    await apiPost('/api/storage-delete', { storage_path: path });
  } catch {
    /* best-effort */
  }
};

// ----- Project documents -------------------------------------------------

export type DocType = 'tz' | 'addendum' | 'other';

export const listProjectDocuments = (projectId: number, token?: string) =>
  get(`project_documents?project_id=eq.${projectId}&order=uploaded_at.desc`, token);

export const uploadProjectDocument = async (
  projectId: number,
  docType: DocType,
  file: File,
  uploadedBy: number,
  token: string,
): Promise<any> => {
  if (file.size > FILE_SIZE_LIMIT) {
    throw new Error(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Лимит — 50 МБ.`);
  }
  const stamp = Date.now();
  const safe = sanitizeName(file.name);
  const path = `${projectId}/${docType}/${stamp}_${safe}`;
  await uploadToBucket(path, file, token);
  try {
    const rows = await post('project_documents', {
      project_id: projectId,
      doc_type: docType,
      name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
    }, token);
    return Array.isArray(rows) ? rows[0] : rows;
  } catch (e) {
    // откатываем загруженный файл если запись в БД не удалась
    await removeFromBucket(path);
    throw e;
  }
};

export const deleteProjectDocument = async (id: string, storagePath: string, token: string) => {
  await del(`project_documents?id=eq.${id}`, token);
  await removeFromBucket(storagePath);
};

// ----- Task attachments --------------------------------------------------

export const listTaskAttachments = (taskId: number, token?: string) =>
  get(`task_attachments?task_id=eq.${taskId}&order=uploaded_at.desc`, token);

export const listTaskAttachmentsByTaskIds = async (taskIds: number[], token?: string) => {
  if (!taskIds.length) return [] as any[];
  const inList = taskIds.map(t => String(t)).join(',');
  const rows = await get(`task_attachments?task_id=in.(${inList})&select=id,task_id,name,size_bytes`, token);
  return Array.isArray(rows) ? rows : [];
};

export const uploadTaskAttachment = async (
  projectId: number,
  taskId: number,
  file: File,
  uploadedBy: number,
  token: string,
): Promise<any> => {
  if (file.size > FILE_SIZE_LIMIT) {
    throw new Error(`Файл слишком большой (${(file.size / 1024 / 1024).toFixed(1)} МБ). Лимит — 50 МБ.`);
  }
  const stamp = Date.now();
  const safe = sanitizeName(file.name);
  const path = `${projectId}/tasks/${taskId}/${stamp}_${safe}`;
  await uploadToBucket(path, file, token);
  try {
    const rows = await post('task_attachments', {
      task_id: taskId,
      name: file.name,
      storage_path: path,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: uploadedBy,
    }, token);
    return Array.isArray(rows) ? rows[0] : rows;
  } catch (e) {
    await removeFromBucket(path);
    throw e;
  }
};

export const deleteTaskAttachment = async (id: string, storagePath: string, token: string) => {
  await del(`task_attachments?id=eq.${id}`, token);
  await removeFromBucket(storagePath);
};

// ----- Storage stats -----------------------------------------------------

export const getStorageStats = (token?: string) =>
  get(`project_storage_stats?order=total_bytes.desc`, token);
