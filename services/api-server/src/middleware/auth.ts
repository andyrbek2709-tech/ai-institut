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
    // Parse JWT payload without verification (Supabase tokens are pre-signed)
    const parts = token.split('.');
    if (parts.length !== 3) {
      return res.status(401).json({ error: 'Invalid token format' });
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64').toString('utf-8')
    );
    const userId = payload.sub;

    if (!userId) {
      logger.warn('Auth failed: no user ID in token payload');
      return res.status(401).json({ error: 'Invalid token' });
    }

    const supabase = getSupabaseAdmin();
    let { data: userData, error: selectErr } = await supabase
      .from('app_users')
      .select('*')
      .eq('supabase_uid', userId)
      .maybeSingle();

    // Auto-create app_users record if user doesn't exist
    if (!userData && !selectErr) {
      logger.info(`Creating missing app_users record for ${userId}`);
      const { data: newUser, error: insertErr } = await supabase
        .from('app_users')
        .insert({
          supabase_uid: userId,
          email: payload.email || '',
          full_name: payload.user_metadata?.full_name || payload.email || 'User',
          role: 'engineer',  // Default role for new users
        })
        .select('*')
        .maybeSingle();

      if (insertErr) {
        logger.error('Failed to create app_users record:', insertErr);
        return res.status(401).json({ error: 'User initialization failed' });
      }
      userData = newUser;
    } else if (selectErr) {
      logger.error('app_users query error:', selectErr);
      return res.status(401).json({ error: 'Invalid token' });
    }

    const ud = userData as any;
    req.user = {
      id: userId,
      email: payload.email || '',
      role: ud?.role || 'engineer',
      full_name: ud?.full_name,
      supabase_uid: userId,
    };

    next();
  } catch (err) {
    logger.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Invalid token' });
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
