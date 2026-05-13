import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

function getToken(req: Request): string | undefined {
  return req.headers.authorization?.replace('Bearer ', '');
}

async function verifyGip(token: string): Promise<{ appUserId: number; role: string; deptId: number | null }> {
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new ApiError(401, 'Invalid token');
  const { data: appUser } = await supabase
    .from('app_users').select('id, role, dept_id').eq('supabase_uid', user.id).single();
  if (!appUser) throw new ApiError(403, 'User not found');
  if (!['gip', 'admin'].includes(appUser.role)) throw new ApiError(403, 'GIP or admin role required');
  return { appUserId: appUser.id as number, role: appUser.role, deptId: appUser.dept_id ?? null };
}

async function verifyAuth(token: string): Promise<{ appUserId: number; role: string; deptId: number | null }> {
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new ApiError(401, 'Invalid token');
  const { data: appUser } = await supabase
    .from('app_users').select('id, role, dept_id').eq('supabase_uid', user.id).single();
  if (!appUser) throw new ApiError(403, 'User not found');
  return { appUserId: appUser.id as number, role: appUser.role, deptId: appUser.dept_id ?? null };
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
    await supabase.from('project_depts').delete().eq('project_id', projectId);
    await supabase.from('project_members').delete().eq('project_id', projectId);

    // Delete project — CASCADE handles: tasks, task_attachments, project_documents,
    // project_assignments, drawings, reviews, revisions, transmittals, messages,
    // activity_log, specifications
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (error) throw new ApiError(500, error.message);

    logger.info({ projectId }, 'Project deleted');
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── DEPARTMENT ACCESS (GIP manages which departments see this project) ────────

// GET /api/project/:id/depts
router.get('/project/:id/depts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyAuth(token);

    const projectId = Number(req.params.id);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('project_depts')
      .select('id, dept_id, added_at, departments(id, name)')
      .eq('project_id', projectId)
      .order('added_at');
    if (error) throw new ApiError(500, error.message);
    return res.json(data || []);
  } catch (err) { next(err); }
});

// POST /api/project/:id/depts — add department (GIP only)
router.post('/project/:id/depts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId } = await verifyGip(token);

    const projectId = Number(req.params.id);
    const { dept_id } = req.body;
    if (!dept_id) throw new ApiError(400, 'dept_id required');

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('project_depts')
      .upsert({ project_id: projectId, dept_id: Number(dept_id), added_by: appUserId },
               { onConflict: 'project_id,dept_id' })
      .select('id, dept_id, added_at, departments(id, name)')
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/project-dept/:id — remove department entry (GIP only)
router.delete('/project-dept/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyGip(token);

    const id = Number(req.params.id);
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('project_depts').delete().eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── MEMBER ACCESS (Lead manages which engineers in their dept see this project) ─

// GET /api/project/:id/members
router.get('/project/:id/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { role, deptId } = await verifyAuth(token);

    const projectId = Number(req.params.id);
    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('project_members')
      .select('id, user_id, dept_id, added_at, app_users(id, full_name, role, dept_id)')
      .eq('project_id', projectId)
      .order('added_at');

    // Lead can only see their own dept's members
    if (!['gip', 'admin'].includes(role) && deptId) {
      query = query.eq('dept_id', deptId);
    }

    const { data, error } = await query;
    if (error) throw new ApiError(500, error.message);
    return res.json(data || []);
  } catch (err) { next(err); }
});

// POST /api/project/:id/members — add engineer (Lead: only from their dept; GIP: any dept)
router.post('/project/:id/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId, role, deptId } = await verifyAuth(token);

    // Lead or GIP/admin allowed
    if (!['gip', 'admin', 'lead'].includes(role)) throw new ApiError(403, 'Lead or GIP required');

    const projectId = Number(req.params.id);
    const { user_id } = req.body;
    if (!user_id) throw new ApiError(400, 'user_id required');

    const supabase = getSupabaseAdmin();

    // Fetch target user to get their dept_id
    const { data: targetUser } = await supabase
      .from('app_users').select('id, dept_id, role').eq('id', Number(user_id)).single();
    if (!targetUser) throw new ApiError(404, 'User not found');

    // Lead can only add engineers from their own dept
    if (role === 'lead' && deptId && targetUser.dept_id !== deptId) {
      throw new ApiError(403, 'Lead can only add engineers from their own department');
    }

    const { data, error } = await supabase
      .from('project_members')
      .upsert({
        project_id: projectId,
        user_id: Number(user_id),
        dept_id: targetUser.dept_id ?? deptId,
        added_by: appUserId,
      }, { onConflict: 'project_id,user_id' })
      .select('id, user_id, dept_id, added_at, app_users(id, full_name, role, dept_id)')
      .single();
    if (error) throw new ApiError(500, error.message);
    return res.json(data);
  } catch (err) { next(err); }
});

// DELETE /api/project-member/:id — remove member entry (Lead of same dept or GIP)
router.delete('/project-member/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { role, deptId } = await verifyAuth(token);

    if (!['gip', 'admin', 'lead'].includes(role)) throw new ApiError(403, 'Lead or GIP required');

    const id = Number(req.params.id);
    const supabase = getSupabaseAdmin();

    if (role === 'lead') {
      // Verify the entry belongs to their dept
      const { data: entry } = await supabase
        .from('project_members').select('dept_id').eq('id', id).single();
      if (!entry || entry.dept_id !== deptId) throw new ApiError(403, 'Not your department');
    }

    const { error } = await supabase.from('project_members').delete().eq('id', id);
    if (error) throw new ApiError(500, error.message);
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

// ─── RACI (legacy discipline mapping, kept for backward compat) ───────────────

// GET /api/project/:id/raci
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

// ─── MY-PROJECTS (access-controlled list of project IDs) ─────────────────────

// GET /api/my-projects
router.get('/my-projects', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId, role, deptId } = await verifyAuth(token);

    const supabase = getSupabaseAdmin();

    if (['gip', 'admin'].includes(role)) {
      // GIP/admin see all non-archived projects
      const { data } = await supabase.from('projects').select('id').eq('archived', false);
      return res.json((data || []).map((p: any) => p.id));
    }

    if (role === 'lead' && deptId) {
      // Lead sees projects where their department is assigned
      const { data } = await supabase
        .from('project_depts').select('project_id').eq('dept_id', deptId);
      const ids = [...new Set((data || []).map((r: any) => r.project_id))];
      return res.json(ids);
    }

    // Engineer/observer: sees projects where explicitly added as member
    const { data } = await supabase
      .from('project_members').select('project_id').eq('user_id', appUserId);
    const ids = [...new Set((data || []).map((r: any) => r.project_id))];
    return res.json(ids);
  } catch (err) { next(err); }
});

export default router;
