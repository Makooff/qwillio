import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Neon serverless drops idle connections after ~5 min and its pooler
// behaves like PgBouncer in transaction mode. We:
//   - append `pgbouncer=true` so Prisma disables prepared statements that
//     break under transaction pooling,
//   - cap `connection_limit` to 3 so stale connections get recycled fast,
//   - set a short `connect_timeout` so a dead connection fails quickly.
const rawUrl = process.env.DATABASE_URL || '';
const neonParams = 'pgbouncer=true&connect_timeout=10&connection_limit=3';
const dbUrl = rawUrl.includes('neon.tech') && !rawUrl.includes('pgbouncer=true')
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
// When Neon kills an idle connection, the first query fails with "Server has
// closed the connection". Prisma will NOT retry automatically. The extension
// below catches the error, on the second attempt forces the client to drop
// its pool and reconnect, then re-runs the query on a fresh connection.
const RETRYABLE_ERRORS = ['Server has closed the connection', 'kind: Closed', 'connection closed', 'Connection refused', 'ECONNRESET'];
const MAX_RETRIES = 2;

// Avoid thrashing $disconnect() when many concurrent queries all hit the same
// dead pool at once — coalesce reconnect attempts.
let reconnectInFlight: Promise<void> | null = null;
async function forceReconnect(): Promise<void> {
  if (!reconnectInFlight) {
    reconnectInFlight = (async () => {
      try {
        await basePrisma.$disconnect();
      } catch { /* swallow */ }
      try {
        await basePrisma.$connect();
      } catch { /* swallow — next query will re-establish */ }
    })();
    // Release the lock after the cycle completes so future cold errors can
    // trigger a new reconnect.
    reconnectInFlight.finally(() => { reconnectInFlight = null; });
  }
  return reconnectInFlight;
}

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
            logger.warn(`[prisma] Neon connection lost (attempt ${attempt + 1}/${MAX_RETRIES}) — reconnecting…`);
            await forceReconnect();
            await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
            continue;
          }
          throw error;
        }
      }
    },
  },
}) as unknown as PrismaClient;

export { prisma };
