import { Router, Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../config/supabase.js';
import { ApiError } from '../middleware/errorHandler.js';

const router = Router();

function getToken(req: Request): string | undefined {
  return req.headers.authorization?.replace('Bearer ', '');
}

async function verifyAuth(token: string): Promise<{ userId: string }> {
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) throw new ApiError(401, 'Invalid token');
  return { userId: user.id };
}

// POST /api/storage-sign-url
// Body: { bucket?: string, storage_path: string, expiresIn?: number }
router.post('/storage-sign-url', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyAuth(token);
    const { bucket = 'project-files', storage_path, expiresIn = 3600 } = req.body;
    if (!storage_path) throw new ApiError(400, 'storage_path required');
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(storage_path, Number(expiresIn));
    if (error) throw new ApiError(500, `Storage sign error: ${error.message}`);
    return res.json({ signed_url: data?.signedUrl || null });
  } catch (err) { next(err); }
});

// POST /api/storage-delete
// Body: { bucket?: string, storage_path: string }
router.post('/storage-delete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = getToken(req);
    if (!token) throw new ApiError(401, 'Missing token');
    await verifyAuth(token);
    const { bucket = 'project-files', storage_path } = req.body;
    if (!storage_path) throw new ApiError(400, 'storage_path required');
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from(bucket).remove([storage_path]);
    if (error) throw new ApiError(500, `Storage delete error: ${error.message}`);
    return res.json({ ok: true });
  } catch (err) { next(err); }
});

export default router;
