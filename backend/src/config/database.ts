import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Neon serverless drops idle connections after ~5 min.
// connection_limit keeps pool small so stale connections are recycled faster.
const rawUrl = process.env.DATABASE_URL || '';
const neonParams = 'connect_timeout=10&connection_limit=5';
const dbUrl = rawUrl.includes('neon.tech') && !rawUrl.includes('connect_timeout')
  ? `${rawUrl}${rawUrl.includes('?') ? '&' : '?'}${neonParams}`
  : rawUrl;

const basePrisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' },
  ],
  datasources: { db: { url: dbUrl } },
});

basePrisma.$on('error', (e: any) => {
  const msg: string = typeof e?.message === 'string' ? e.message : JSON.stringify(e);
  // Neon idle disconnects — Prisma auto-reconnects on next query, suppress noise
  if (msg.includes('kind: Closed') || msg.includes('connection closed') || msg.includes('Error { kind: Closed') || msg.includes('Server has closed the connection')) return;
  logger.error('Prisma error:', e);
});

basePrisma.$on('warn', (e) => {
  logger.warn('Prisma warning:', e);
});

// ═══ Retry middleware for transient Neon disconnections ═══
// When Neon kills an idle connection, the first query fails with "Server has closed the connection".
// The retry catches this and re-runs the query on a fresh connection.
const RETRYABLE_ERRORS = ['Server has closed the connection', 'kind: Closed', 'connection closed', 'Connection refused', 'ECONNRESET'];
const MAX_RETRIES = 2;

const prisma = basePrisma.$extends({
  query: {
    async $allOperations({ args, query }: { args: any; query: (args: any) => Promise<any> }) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          return await query(args);
        } catch (error: any) {
          const msg = error?.message || '';
          const isRetryable = RETRYABLE_ERRORS.some(e => msg.includes(e));
          if (isRetryable && attempt < MAX_RETRIES) {
            logger.debug(`Neon connection lost, retrying query (attempt ${attempt + 1}/${MAX_RETRIES})...`);
            // Short delay before retry to let Prisma open a fresh connection
            await new Promise(r => setTimeout(r, 100 * (attempt + 1)));
            continue;
          }
          throw error;
        }
      }
    },
  },
}) as unknown as PrismaClient;

export { prisma };
