import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { loginSchema, registerSchema } from '../utils/validators';

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { email, password } = loginSchema.parse(req.body);

      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) {
        return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }

      const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
      });

      const refreshToken = jwt.sign({ id: user.id }, env.JWT_SECRET, {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN,
      });

      res.json({
        token,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async register(req: Request, res: Response) {
    try {
      const { email, password, name } = registerSchema.parse(req.body);

      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });
      }

      const passwordHash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

      const user = await prisma.user.create({
        data: { email, passwordHash, name, role: 'admin' },
      });

      const token = jwt.sign({ id: user.id, role: user.role }, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
      });

      res.status(201).json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  }

  async me(req: any, res: Response) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: { id: true, email: true, name: true, role: true, createdAt: true },
      });

      if (!user) return res.status(404).json({ error: 'Utilisateur non trouvé' });
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}

export const authController = new AuthController();
