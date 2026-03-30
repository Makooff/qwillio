import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';

export interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string };
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

export function adminMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Accès refusé' });
  }
  next();
}

/**
 * requireAdmin — combined auth + admin-only guard for prospecting routes.
 * Grants access if ANY of the following is true:
 *   1. JWT role === 'admin'
 *   2. JWT user email === ADMIN_EMAIL (makho.off@gmail.com)
 *   3. X-Admin-Secret header matches ADMIN_SECRET env var (non-empty)
 * Returns 401 if no valid token, 403 if authenticated but not admin.
 */
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  // ── Option 3: secret header (no JWT needed) ───────────────
  const adminSecret = env.ADMIN_SECRET;
  if (adminSecret && req.headers['x-admin-secret'] === adminSecret) {
    return next();
  }

  // ── JWT verification ──────────────────────────────────────
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  const token = authHeader.split(' ')[1];
  let decoded: { id: string; role: string };
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as { id: string; role: string };
  } catch {
    return res.status(401).json({ error: 'Token invalide' });
  }

  req.userId   = decoded.id;
  req.userRole = decoded.role;

  // ── Option 1: role in JWT ─────────────────────────────────
  if (decoded.role === 'admin') return next();

  // ── Option 2: email match (DB lookup) ────────────────────
  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { email: true },
    });
    if (user?.email === env.ADMIN_EMAIL) return next();
  } catch {
    // DB unavailable — fall through to 403
  }

  return res.status(403).json({ error: 'Accès refusé — zone admin uniquement' });
}

export async function clientMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== 'client') {
    return res.status(403).json({ error: 'Client access only' });
  }

  try {
    const client = await prisma.client.findUnique({
      where: { userId: req.userId },
      select: { id: true },
    });

    if (!client) {
      return res.status(404).json({ error: 'No client profile found' });
    }

    (req as any).clientId = client.id;
    next();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
