import { Request, Response, NextFunction } from 'express';
import { getSupabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
  full_name?: string;
  supabase_uid?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const supabase = getSupabaseAdmin();

    const { data: { user }, error } = await supabase.auth.admin.getUserById(token);

    if (error || !user) {
      logger.warn('Auth failed:', error?.message);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { data: userData } = await supabase
      .from('app_users')
      .select('*')
      .eq('supabase_uid', user.id)
      .single();

    req.user = {
      id: user.id,
      email: user.email || '',
      role: userData?.role,
      full_name: userData?.full_name,
      supabase_uid: user.id,
    };

    next();
  } catch (err) {
    logger.error('Auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}

export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role || '')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  };
}
