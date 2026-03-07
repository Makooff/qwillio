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
