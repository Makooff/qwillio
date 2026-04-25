/**
 * Persistent log store backed by Postgres — survives restarts, queryable
 * for up to N days of history. Writes are fire-and-forget from the
 * winston MemoryTransport so logging never blocks user flows.
 *
 * Schema is created on boot via raw SQL so we don't need a Prisma
 * migration step in the deploy pipeline.
 */
import { Prisma } from '@prisma/client';
import { prisma } from './database';

export interface DbLogEntry {
  id: number;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  service?: string;
  stack?: string;
}

let tableReady = false;

/** Idempotent — safe to call on every boot. Creates the table + indexes. */
export async function ensureBotLogTable(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS bot_log (
        id        BIGSERIAL PRIMARY KEY,
        ts        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        level     VARCHAR(10) NOT NULL,
        message   TEXT NOT NULL,
        service   VARCHAR(64),
        stack     TEXT
      )
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS bot_log_ts_idx    ON bot_log (ts DESC)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS bot_log_level_idx ON bot_log (level)`);
    tableReady = true;
  } catch (err) {
    // Logging the failure here would loop. Just print to stderr.
    // eslint-disable-next-line no-console
    console.error('[db-log-store] ensureBotLogTable failed:', err);
  }
}

/** Fire-and-forget insert. Skipped silently if the table isn't ready. */
export async function addLogToDb(entry: Omit<DbLogEntry, 'id'>): Promise<void> {
  if (!tableReady) return;
  try {
    const ts = entry.timestamp ? new Date(entry.timestamp) : new Date();
    // Truncate runaway messages so a chatty stack trace can't bloat the table.
    const message = entry.message.slice(0, 4000);
    const stack = entry.stack ? entry.stack.slice(0, 8000) : null;
    await prisma.$executeRaw`
      INSERT INTO bot_log (ts, level, message, service, stack)
      VALUES (${ts}, ${entry.level}, ${message}, ${entry.service ?? null}, ${stack})
    `;
  } catch { /* swallow — logging must never crash the app */ }
}

/** Read the most recent N matching rows (newest last, like the memory store). */
export async function getLogsFromDb(opts: {
  since?: number;
  level?: string;
  search?: string;
  limit?: number;
}): Promise<DbLogEntry[]> {
  if (!tableReady) return [];
  const limit = Math.max(1, Math.min(opts.limit ?? 200, 1000));

  const conds: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (opts.since != null && Number.isFinite(opts.since)) {
    conds.push(Prisma.sql`id > ${opts.since}`);
  }
  if (opts.level && opts.level !== 'all') {
    conds.push(Prisma.sql`level = ${opts.level}`);
  }
  if (opts.search && opts.search.trim()) {
    const q = `%${opts.search.trim()}%`;
    conds.push(Prisma.sql`(message ILIKE ${q} OR COALESCE(stack, '') ILIKE ${q})`);
  }
  const where = Prisma.join(conds, ' AND ');

  // We sort DESC then reverse on the client so the latest N entries land
  // in chronological order at the bottom of the list, matching the
  // existing in-memory store API.
  const rows: any[] = await prisma.$queryRaw`
    SELECT id, ts, level, message, service, stack
    FROM bot_log
    WHERE ${where}
    ORDER BY id DESC
    LIMIT ${limit}
  `;

  return rows
    .map((r): DbLogEntry => ({
      id:        Number(r.id),
      timestamp: (r.ts instanceof Date ? r.ts : new Date(r.ts)).toISOString(),
      level:     r.level as DbLogEntry['level'],
      message:   r.message,
      service:   r.service ?? undefined,
      stack:     r.stack ?? undefined,
    }))
    .reverse();
}

/** Returns the highest id currently in the table — used for "live tail" polling. */
export async function getLastIdFromDb(): Promise<number> {
  if (!tableReady) return 0;
  try {
    const rows: { id: bigint | number }[] = await prisma.$queryRaw`SELECT COALESCE(MAX(id), 0) AS id FROM bot_log`;
    const v = rows?.[0]?.id ?? 0;
    return typeof v === 'bigint' ? Number(v) : Number(v);
  } catch { return 0; }
}

/** Drop everything older than `daysToKeep`. Run daily by the cron. */
export async function purgeOldLogs(daysToKeep = 7): Promise<number> {
  if (!tableReady) return 0;
  const days = Math.max(1, Math.min(daysToKeep, 90));
  try {
    const result = await prisma.$executeRawUnsafe(
      `DELETE FROM bot_log WHERE ts < NOW() - INTERVAL '${days} days'`
    );
    return Number(result || 0);
  } catch { return 0; }
}

/** Empty the table — used by the admin "clear logs" button. */
export async function clearLogsInDb(): Promise<void> {
  if (!tableReady) return;
  try { await prisma.$executeRawUnsafe(`TRUNCATE bot_log`); } catch { /* empty */ }
}

export function isDbLogStoreReady(): boolean {
  return tableReady;
}
