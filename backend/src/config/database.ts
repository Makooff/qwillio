import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

// Neon serverless drops idle connections after ~5 min and its pooler
// behaves like PgBouncer in transaction mode. We:
//   - append `pgbouncer=true` so Prisma disables prepared statements that
//     break under transaction pooling,
//   - keep `connection_limit` generous (15) since PgBouncer already manages
//     a large server-side pool — a small client pool just causes timeouts
//     under concurrent cron jobs ("connection limit: 3" was the bottleneck),
//   - extend `pool_timeout` so concurrent queries don't bail in 10s,
//   - set a short `connect_timeout` so a dead connection fails quickly.
const rawUrl = process.env.DATABASE_URL || '';
const neonParams = 'pgbouncer=true&connect_timeout=10&connection_limit=15&pool_timeout=30';
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
  // Neon idle disconnects and engine-transition noise — Prisma auto-reconnects, suppress.
  if (
    msg.includes('kind: Closed') ||
    msg.includes('connection closed') ||
    msg.includes('Error { kind: Closed') ||
    msg.includes('Server has closed the connection') ||
    msg.includes('Engine is not yet connected')
  ) return;
  logger.error('Prisma error:', e);
});

basePrisma.$on('warn', (e) => {
  logger.warn('Prisma warning:', e);
});

// ═══ Retry middleware for transient Neon disconnections ═══
// When Neon kills an idle connection, the first query fails with "Server has
// closed the connection". Prisma then marks the connection dead internally
// and the NEXT query on the pool uses a fresh one — so a simple retry with
// a small delay is enough. We do NOT call $disconnect() here because it
// affects every in-flight query globally and surfaces as
// "Engine is not yet connected" on concurrent requests.
const RETRYABLE_ERRORS = [
  'Server has closed the connection',
  'kind: Closed',
  'connection closed',
  'Connection refused',
  'ECONNRESET',
  'Engine is not yet connected',
  'Timed out fetching a new connection from the connection pool',
  "Can't reach database server",
];
const MAX_RETRIES = 3;

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
            const backoff = 250 * Math.pow(2, attempt); // 250, 500, 1000 ms
            // Only surface the retry if we're already at the 2nd attempt —
            // a first-try reconnect is so frequent on Neon that it pollutes
            // the log without being actionable.
            if (attempt >= 1) {
              logger.warn(`[prisma] transient DB error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff}ms…`);
            } else {
              logger.debug(`[prisma] transient DB error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff}ms…`);
            }
            await new Promise(r => setTimeout(r, backoff));
            continue;
          }
          throw error;
        }
      }
    },
  },
}) as unknown as PrismaClient;

export { prisma };
