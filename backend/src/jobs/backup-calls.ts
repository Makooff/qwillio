import fs from 'fs/promises';
import path from 'path';
import zlib from 'zlib';
import { promisify } from 'util';
import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { discordService } from '../services/discord.service';

const gzip = promisify(zlib.gzip);

// Nightly snapshot of call data. Complements — does NOT replace — Neon's
// point-in-time recovery. This backup exists specifically to guard against:
//  1. A rogue DELETE or migration that erases historical calls.
//  2. A Neon-plan downgrade that drops PITR retention.
//  3. Ad-hoc regulatory export requests (GDPR).
//
// Output: one gzipped JSONL file per table, per day, under BACKUP_DIR
// (defaults to /tmp/qwillio-backups). To ship to S3/R2, extend
// `uploadSnapshot` — the file at `filePath` is ready to upload as-is.

interface SnapshotResult {
  table: string;
  rowCount: number;
  filePath: string;
  bytes: number;
}

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

async function writeJsonlGz(filePath: string, rows: unknown[]): Promise<number> {
  const jsonl = rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '');
  const gzipped = await gzip(Buffer.from(jsonl, 'utf8'));
  await fs.writeFile(filePath, gzipped);
  return gzipped.length;
}

async function snapshotTable<T extends Record<string, unknown>>(params: {
  table: string;
  outDir: string;
  isoDay: string;
  fetcher: () => Promise<T[]>;
}): Promise<SnapshotResult> {
  const { table, outDir, isoDay, fetcher } = params;
  const filePath = path.join(outDir, `${isoDay}-${table}.jsonl.gz`);
  const rows = await fetcher();
  const bytes = await writeJsonlGz(filePath, rows);
  return { table, rowCount: rows.length, filePath, bytes };
}

// Optional S3/R2 upload hook — no external SDK dependency. Set
// BACKUP_UPLOAD_URL to a pre-signed PUT URL template that contains
// `{filename}` and this uploads via a plain PUT. Leave unset to keep
// backups on local disk only.
async function uploadSnapshot(filePath: string): Promise<void> {
  const tpl = process.env.BACKUP_UPLOAD_URL_TEMPLATE;
  if (!tpl) return;
  const filename = path.basename(filePath);
  const url = tpl.replace('{filename}', encodeURIComponent(filename));
  const body = await fs.readFile(filePath);
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/gzip', 'Content-Length': String(body.length) },
    body,
  });
  if (!res.ok) {
    throw new Error(`backup upload failed for ${filename}: ${res.status} ${res.statusText}`);
  }
}

export async function runCallBackup(now: Date = new Date()): Promise<SnapshotResult[]> {
  const isoDay = now.toISOString().slice(0, 10);
  const outDir = process.env.BACKUP_DIR || '/tmp/qwillio-backups';
  await ensureDir(outDir);

  // Backup window: last 48 hours, generous overlap so a missed run does
  // not create a gap. Restore consumers de-duplicate on primary key.
  const since = new Date(now.getTime() - 48 * 60 * 60 * 1000);

  const results: SnapshotResult[] = [];

  results.push(await snapshotTable({
    table: 'client_calls',
    outDir,
    isoDay,
    fetcher: () => prisma.clientCall.findMany({ where: { startedAt: { gte: since } } }) as any,
  }));

  results.push(await snapshotTable({
    table: 'calls',
    outDir,
    isoDay,
    fetcher: () => prisma.call.findMany({ where: { startedAt: { gte: since } } }) as any,
  }));

  results.push(await snapshotTable({
    table: 'prospects_touched',
    outDir,
    isoDay,
    fetcher: () => prisma.prospect.findMany({ where: { updatedAt: { gte: since } } }) as any,
  }));

  for (const r of results) {
    try {
      await uploadSnapshot(r.filePath);
    } catch (err) {
      logger.error(`backup: upload failed for ${r.table}`, err);
    }
  }

  const totalRows = results.reduce((acc, r) => acc + r.rowCount, 0);
  const totalBytes = results.reduce((acc, r) => acc + r.bytes, 0);
  logger.info(`backup: ${isoDay} — ${totalRows} rows, ${(totalBytes / 1024).toFixed(1)} KB across ${results.length} tables`);

  try {
    await discordService.notify(
      `💾 Backup ${isoDay} — ${totalRows} rows, ${(totalBytes / 1024).toFixed(1)} KB (${results.length} tables)`,
    );
  } catch {
    // Discord failures should never break the backup itself
  }

  return results;
}
