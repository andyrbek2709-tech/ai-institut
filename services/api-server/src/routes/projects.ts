import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

function getToken(req: Request): string | undefined {
  return req.headers.authorization?.replace('Bearer ', '');
}

async function verifyGip(token: string): Promise<{ appUserId: number; role: string }> {
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new ApiError(401, 'Invalid token');
  const { data: appUser } = await supabase
    .from('app_users').select('id, role').eq('supabase_uid', user.id).single();
  if (!appUser) throw new ApiError(403, 'User not found');
  if (!['gip', 'admin'].includes(appUser.role)) throw new ApiError(403, 'GIP or admin role required');
  return { appUserId: appUser.id as number, role: appUser.role };
}

async function verifyAuth(token: string): Promise<{ appUserId: number; role: string }> {
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new ApiError(401, 'Invalid token');
  const { data: appUser } = await supabase
    .from('app_users').select('id, role').eq('supabase_uid', user.id).single();
  if (!appUser) throw new ApiError(403, 'User not found');
  return { appUserId: appUser.id as number, role: appUser.role };
}

// DELETE /api/project/:id — GIP/admin only, cascades everything
router.delete('/project/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyGip(token);

    const projectId = Number(req.params.id);
    if (!projectId) throw new ApiError(400, 'Invalid project id');

    const supabase = getSupabaseAdmin();

    // Delete tables without CASCADE first
    await supabase.from('raci').delete().eq('project_id', projectId);
    await supabase.from('meetings').delete().eq('project_id', projectId);

    // Delete project — CASCADE handles: tasks, task_attachments (via tasks),
    // project_documents, project_assignments, drawings, reviews, revisions,
    // transmittals, messages, activity_log, specifications
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw new ApiError(500, error.message);

    logger.info({ projectId }, 'Project deleted');
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/project/:id/raci — get project participants
router.get('/project/:id/raci', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyAuth(token);

    const projectId = Number(req.params.id);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('raci')
      .select('id, discipline, role, user_id, app_users(id, full_name, role, dept_id)')
      .eq('project_id', projectId)
      .order('discipline');
    if (error) throw new ApiError(500, error.message);
    return res.json(data || []);
  } catch (err) { next(err); }
});

// POST /api/project/:id/raci — add participant (GIP only)
router.post('/project/:id/raci', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyGip(token);

    const projectId = Number(req.params.id);
    const { user_id, discipline, role = 'R' } = req.body;
    if (!user_id || !discipline) throw new ApiError(400, 'user_id and discipline required');

    const supabase = getSupabaseAdmin();
    // Upsert: if same project+user+discipline exists — update role
    const { data, error } = await supabase
      .from('raci')
      .upsert({ project_id: projectId, user_id: Number(user_id), discipline, role },
               { onConflict: 'project_id,user_id,discipline' })
      .select()
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/raci/:raciId — remove participant entry (GIP only)
router.delete('/raci/:raciId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyGip(token);

    const raciId = Number(req.params.raciId);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('raci').delete().eq('id', raciId);
    if (error) throw new ApiError(500, error.message);
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// GET /api/my-projects — returns project IDs the current user belongs to (for non-GIP filter)
router.get('/my-projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId, role } = await verifyAuth(token);

    if (['gip', 'admin'].includes(role)) {
      // GIP/admin see all projects
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.from('projects').select('id').eq('archived', false);
      return res.json((data || []).map((p: any) => p.id));
    }

    const supabase = getSupabaseAdmin();
    const { data } = await supabase
      .from('raci').select('project_id').eq('user_id', appUserId);
    const ids = [...new Set((data || []).map((r: any) => r.project_id))];
    return res.json(ids);
  } catch (err) { next(err); }
});

export default router;
