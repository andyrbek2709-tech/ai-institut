import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

// ── helpers ──────────────────────────────────────────────────────────────────

function getToken(req: Request): string | undefined {
  return req.headers.authorization?.replace('Bearer ', '');
}

async function verifyAdmin(token: string): Promise<{ appUserId: number; email: string }> {
  const supabase = getSupabaseAdmin();

  // Verify JWT
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new ApiError(401, 'Invalid token');

  // Check role
  const { data: appUser, error: appErr } = await supabase
    .from('app_users')
    .select('id, role, email')
    .eq('supabase_uid', user.id)
    .single();

  if (appErr || !appUser) throw new ApiError(401, 'User not found');
  if ((appUser as any).role !== 'admin') throw new ApiError(403, 'Admin role required');

  return { appUserId: (appUser as any).id, email: (appUser as any).email || user.email || '' };
}

async function writeAuditLog(
  actorId: number,
  actorEmail: string,
  action: string,
  entityType: string,
  entityId?: string | number | null,
  payload?: any,
) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('audit_logs').insert({
      action,
      entity_type: entityType,
      entity_id: entityId != null ? String(entityId) : null,
      actor_id: actorId,
      actor_email: actorEmail,
      payload: payload || null,
    });
  } catch (e) {
    logger.warn('audit_log write failed', e);
  }
}

// ── POST /api/admin-users ─────────────────────────────────────────────────────
// actions: create | reset_password | update_role | disable | delete
router.post('/admin-users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId, email: actorEmail } = await verifyAdmin(token);

    const { action, ...body } = req.body;
    const supabase = getSupabaseAdmin();

    if (action === 'create') {
      const { email, password, full_name, role, dept_id } = body;
      if (!email || !password || !full_name || !role) throw new ApiError(400, 'email, password, full_name, role required');

      const validRoles = ['admin', 'gip', 'lead', 'lead_engineer', 'engineer', 'reviewer', 'observer'];
      if (!validRoles.includes(role)) throw new ApiError(400, `Invalid role: ${role}`);

      // Create Supabase Auth user
      const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (authErr) throw new ApiError(400, authErr.message);

      const supabase_uid = authData.user.id;

      // Insert app_users record
      const { data: appUser, error: insertErr } = await supabase
        .from('app_users')
        .insert({ email, full_name, role, dept_id: dept_id || null, supabase_uid, is_active: true })
        .select()
        .single();

      if (insertErr) {
        // Rollback auth user on app_users failure
        await supabase.auth.admin.deleteUser(supabase_uid);
        throw new ApiError(500, insertErr.message);
      }

      await writeAuditLog(appUserId, actorEmail, 'user.create', 'app_users', (appUser as any).id, { email, role });
      return res.status(201).json(appUser);
    }

    if (action === 'reset_password') {
      const { supabase_uid, new_password } = body;
      if (!supabase_uid || !new_password) throw new ApiError(400, 'supabase_uid and new_password required');
      if (new_password.length < 6) throw new ApiError(400, 'Password must be at least 6 chars');

      const { error } = await supabase.auth.admin.updateUserById(supabase_uid, { password: new_password });
      if (error) throw new ApiError(400, error.message);

      await writeAuditLog(appUserId, actorEmail, 'user.reset_password', 'auth_users', supabase_uid, {});
      return res.json({ success: true });
    }

    if (action === 'update_role') {
      const { user_id, role, dept_id } = body;
      if (!user_id || !role) throw new ApiError(400, 'user_id and role required');

      const validRoles = ['admin', 'gip', 'lead', 'lead_engineer', 'engineer', 'reviewer', 'observer'];
      if (!validRoles.includes(role)) throw new ApiError(400, `Invalid role: ${role}`);

      const { data, error } = await supabase
        .from('app_users')
        .update({ role, dept_id: dept_id ?? null })
        .eq('id', user_id)
        .select()
        .single();
      if (error) throw new ApiError(400, error.message);

      await writeAuditLog(appUserId, actorEmail, 'user.update_role', 'app_users', user_id, { role, dept_id });
      return res.json(data);
    }

    if (action === 'update') {
      const { user_id, full_name, position, role, dept_id, is_active } = body;
      if (!user_id) throw new ApiError(400, 'user_id required');

      const updates: any = {};
      if (full_name !== undefined) updates.full_name = full_name;
      if (position !== undefined) updates.position = position;
      if (role !== undefined) {
        const validRoles = ['admin', 'gip', 'lead', 'lead_engineer', 'engineer', 'reviewer', 'observer'];
        if (!validRoles.includes(role)) throw new ApiError(400, `Invalid role: ${role}`);
        updates.role = role;
      }
      if (dept_id !== undefined) updates.dept_id = dept_id || null;
      if (is_active !== undefined) updates.is_active = Boolean(is_active);

      const { data, error } = await supabase
        .from('app_users')
        .update(updates)
        .eq('id', user_id)
        .select()
        .single();
      if (error) throw new ApiError(400, error.message);

      await writeAuditLog(appUserId, actorEmail, 'user.update', 'app_users', user_id, updates);
      return res.json(data);
    }

    if (action === 'disable') {
      const { user_id, is_active } = body;
      if (!user_id) throw new ApiError(400, 'user_id required');

      const { data, error } = await supabase
        .from('app_users')
        .update({ is_active: Boolean(is_active) })
        .eq('id', user_id)
        .select()
        .single();
      if (error) throw new ApiError(400, error.message);

      const actionName = is_active ? 'user.enable' : 'user.disable';
      await writeAuditLog(appUserId, actorEmail, actionName, 'app_users', user_id, {});
      return res.json(data);
    }

    if (action === 'delete') {
      const { user_id, supabase_uid } = body;
      if (!user_id) throw new ApiError(400, 'user_id required');

      // Prevent deleting yourself
      if (Number(user_id) === appUserId) throw new ApiError(400, 'Cannot delete yourself');

      const { error: delErr } = await supabase.from('app_users').delete().eq('id', user_id);
      if (delErr) throw new ApiError(400, delErr.message);

      if (supabase_uid) {
        const { error: authDelErr } = await supabase.auth.admin.deleteUser(supabase_uid);
        if (authDelErr) logger.warn('Auth user delete failed (app_users already deleted)', authDelErr.message);
      }

      await writeAuditLog(appUserId, actorEmail, 'user.delete', 'app_users', user_id, { supabase_uid });
      return res.status(204).send();
    }

    throw new ApiError(400, `Unknown action: ${action}`);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/organization ───────────────────────────────────────────────
router.get('/admin/organization', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyAdmin(token);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('organization_settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error) throw new ApiError(500, error.message);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/admin/organization ─────────────────────────────────────────────
router.patch('/admin/organization', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId, email: actorEmail } = await verifyAdmin(token);

    const { company_name, logo_url, primary_color } = req.body;
    const updates: any = { updated_at: new Date().toISOString() };
    if (company_name !== undefined) updates.company_name = String(company_name).trim() || 'EngHub';
    if (logo_url !== undefined) updates.logo_url = logo_url || null;
    if (primary_color !== undefined) updates.primary_color = primary_color;

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('organization_settings')
      .update(updates)
      .eq('id', 1)
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);
    await writeAuditLog(appUserId, actorEmail, 'org.update', 'organization_settings', 1, updates);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/admin/branding/logo ─────────────────────────────────────────────
// Uploads logo via multipart/form-data to Supabase Storage, returns public URL
router.post('/admin/branding/logo', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId, email: actorEmail } = await verifyAdmin(token);

    // We receive a base64-encoded file from the client
    const { fileBase64, mimeType, fileName } = req.body;
    if (!fileBase64 || !mimeType || !fileName) throw new ApiError(400, 'fileBase64, mimeType, fileName required');

    const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
    if (!allowedMimes.includes(mimeType)) throw new ApiError(400, 'Only PNG/JPEG/SVG/WebP images allowed');

    const buffer = Buffer.from(fileBase64, 'base64');
    if (buffer.length > 2 * 1024 * 1024) throw new ApiError(400, 'Logo must be under 2MB');

    const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
    const storagePath = `branding/logo_${Date.now()}.${ext}`;

    const supabase = getSupabaseAdmin();
    const { error: uploadErr } = await supabase.storage
      .from('project-files')
      .upload(storagePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadErr) throw new ApiError(500, `Storage upload failed: ${uploadErr.message}`);

    // Get public URL (logos should be publicly accessible for login page)
    const { data: urlData } = supabase.storage
      .from('project-files')
      .getPublicUrl(storagePath);

    const publicUrl = urlData.publicUrl;

    // Update organization_settings with new logo URL
    await supabase
      .from('organization_settings')
      .update({ logo_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', 1);

    await writeAuditLog(appUserId, actorEmail, 'org.upload_logo', 'organization_settings', 1, { storagePath });
    return res.json({ logo_url: publicUrl });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/departments ────────────────────────────────────────────────
router.get('/admin/departments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyAdmin(token);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('departments')
      .select('*, head:head_id(id, full_name, email, position)')
      .order('name');

    if (error) throw new ApiError(500, error.message);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/admin/departments ───────────────────────────────────────────────
router.post('/admin/departments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId, email: actorEmail } = await verifyAdmin(token);

    const { name, description, head_id } = req.body;
    if (!name?.trim()) throw new ApiError(400, 'name required');

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('departments')
      .insert({ name: name.trim(), description: description || null, head_id: head_id || null })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new ApiError(409, 'Department name already exists');
      throw new ApiError(500, error.message);
    }

    await writeAuditLog(appUserId, actorEmail, 'dept.create', 'departments', (data as any).id, { name });
    return res.status(201).json(data);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/admin/departments/:id ─────────────────────────────────────────
router.patch('/admin/departments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId, email: actorEmail } = await verifyAdmin(token);

    const { id } = req.params;
    const { name, description, head_id, is_archived } = req.body;

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description || null;
    if (head_id !== undefined) updates.head_id = head_id || null;
    if (is_archived !== undefined) updates.is_archived = Boolean(is_archived);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('departments')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') throw new ApiError(409, 'Department name already exists');
      throw new ApiError(500, error.message);
    }

    const actionName = is_archived === true ? 'dept.archive' : is_archived === false ? 'dept.restore' : 'dept.update';
    await writeAuditLog(appUserId, actorEmail, actionName, 'departments', id, updates);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/admin/departments/:id ─────────────────────────────────────────
router.delete('/admin/departments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId, email: actorEmail } = await verifyAdmin(token);

    const { id } = req.params;
    const supabase = getSupabaseAdmin();

    // Check if dept has users
    const { data: users } = await supabase
      .from('app_users')
      .select('id')
      .eq('dept_id', id)
      .limit(1);

    if (users && users.length > 0) {
      throw new ApiError(409, 'Отдел содержит пользователей. Переназначьте их перед удалением.');
    }

    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) throw new ApiError(500, error.message);

    await writeAuditLog(appUserId, actorEmail, 'dept.delete', 'departments', id, {});
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── POST /api/admin/projects/:id/restore ─────────────────────────────────────
router.post('/admin/projects/:id/restore', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId, email: actorEmail } = await verifyAdmin(token);

    const { id } = req.params;
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('projects')
      .update({ archived: false, archived_at: null })
      .eq('id', id)
      .select()
      .single();

    if (error) throw new ApiError(500, error.message);
    await writeAuditLog(appUserId, actorEmail, 'project.restore', 'projects', id, {});
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /api/admin/projects/:id ───────────────────────────────────────────
// Permanently delete an archived project
router.delete('/admin/projects/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    const { appUserId, email: actorEmail } = await verifyAdmin(token);

    const { id } = req.params;
    const supabase = getSupabaseAdmin();

    // Verify it's actually archived first
    const { data: proj } = await supabase
      .from('projects')
      .select('id, name, archived')
      .eq('id', id)
      .single();

    if (!proj) throw new ApiError(404, 'Project not found');
    if (!(proj as any).archived) throw new ApiError(400, 'Project is not archived. Archive it first.');

    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw new ApiError(500, error.message);

    await writeAuditLog(appUserId, actorEmail, 'project.permanent_delete', 'projects', id, { name: (proj as any).name });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/audit-logs ─────────────────────────────────────────────────
router.get('/admin/audit-logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyAdmin(token);

    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new ApiError(500, error.message);
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/admin/org-public ─────────────────────────────────────────────────
// Public endpoint: org name + logo (for login page, no auth required)
router.get('/admin/org-public', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('organization_settings')
      .select('company_name, logo_url, primary_color')
      .eq('id', 1)
      .single();

    if (error) return res.json({ company_name: 'EngHub', logo_url: null, primary_color: '#2b5bb5' });
    return res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
