import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Neon serverless drops idle connections after ~5 min.
// Force short connect_timeout + connection_limit to avoid stale pool connections.
const rawUrl = process.env.DATABASE_URL || '';
const neonParams = 'connect_timeout=10&pool_timeout=20&connection_limit=5&pgbouncer=true';
const dbUrl = rawUrl.includes('neon.tech') && !rawUrl.includes('connect_timeout')
  ? `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}${neonParams}`
  : rawUrl;

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
  datasources: { db: { url: dbUrl } },
});

prisma.$on('error', (e: any) => {
  // Neon closes idle connections (kind: Closed) — Prisma auto-reconnects, this is not an app error
  const msg: string = typeof e?.message === 'string' ? e.message : JSON.stringify(e);
  if (msg.includes('kind: Closed') || msg.includes('connection closed') || msg.includes('Error { kind: Closed') || msg.includes('Server has closed the connection')) return;
  logger.error('Prisma error:', e);
});

prisma.$on('warn', (e) => {
  logger.warn('Prisma warning:', e);
});

export { prisma };
