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
  // Also suppress boot-time `bot_log does not exist` (42P01) — the log table is
  // created lazily and any writes that race past the tableReady guard fall through
  // to here. These are non-fatal: the addLogToDb caller already swallows them.
  if (
    msg.includes('kind: Closed') ||
    msg.includes('connection closed') ||
    msg.includes('Error { kind: Closed') ||
    msg.includes('Server has closed the connection') ||
    msg.includes('Engine is not yet connected') ||
    msg.includes('relation "bot_log" does not exist') ||
    msg.includes('42P01')
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
const MAX_RETRIES = 8;
// "Can't reach database server" usually means Neon compute is cold-starting
// (up to 30s on the free plan). Give those much longer backoffs than transient
// pool/connection hiccups, which recover in <500ms.
const COLDSTART_PATTERNS = ["Can't reach database server", 'Connection refused', 'ECONNRESET'];

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
            const isColdStart = COLDSTART_PATTERNS.some(e => msg.includes(e));
            // Cold-start: 1s, 2s, 4s, 8s, 8s (up to ~23s total — Neon usually
            // wakes within 5-10s). Transient: 250, 500, 1000, 2000, 4000 ms.
            const backoff = isColdStart
              ? Math.min(8000, 1000 * Math.pow(2, attempt))
              : 250 * Math.pow(2, attempt);
            if (attempt >= 1) {
              logger.warn(`[prisma] ${isColdStart ? 'cold-start' : 'transient'} DB error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff}ms…`);
            } else {
              logger.debug(`[prisma] ${isColdStart ? 'cold-start' : 'transient'} DB error (attempt ${attempt + 1}/${MAX_RETRIES}), retrying in ${backoff}ms…`);
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
