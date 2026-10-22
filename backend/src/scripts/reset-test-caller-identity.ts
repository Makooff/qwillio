import { Prisma, PrismaClient } from '@prisma/client';
import { canonicalCallerNumber, callerMemoryView, memoryEnvelope } from '../services/voice/caller-memory-policy';

export function parseResetArgs(args: string[]) {
  const values = new Map<string, string>();
  let confirm = false;
  for (let i = 0; i < args.length; i++) {
    const token = args[i];
    if (token === '--confirm' && !confirm) { confirm = true; continue; }
    const match = /^(--client-id|--email|--number)(?:=(.*))?$/.exec(token);
    if (!match || values.has(match[1])) throw new Error('Unknown or duplicate argument');
    const value = match[2] ?? args[++i];
    if (!value || value.startsWith('--')) throw new Error('Missing argument value');
    values.set(match[1], value);
  }
  const clientId = values.get('--client-id') ?? '';
  const email = values.get('--email') ?? '';
  const callerNumber = canonicalCallerNumber(values.get('--number'));
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientId)
      || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 255 || !callerNumber) {
    throw new Error('Require exact --client-id UUID, --email and valid international --number');
  }
  return { clientId, email, callerNumber, confirm };
}

/** Dependency injected for offline verification; writes only CallerMemory. */
export async function resetTestCallerIdentity(db: PrismaClient, options: ReturnType<typeof parseResetArgs>) {
  const { clientId, email, callerNumber, confirm } = options;
  return db.$transaction(async tx => {
    const lock = `caller-memory:${clientId}:${callerNumber}`;
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))::text AS locked`;
    const client = await tx.client.findUnique({ where: { id: clientId }, select: { id: true, contactEmail: true } });
    if (!client || client.contactEmail !== email) throw new Error('Client ID / contact email mismatch; no writes');
    const forms = [callerNumber, `+${callerNumber}`];
    const rows = await tx.callerMemory.findMany({ where: { clientId, callerNumber: { in: forms } } });
    const calls = await tx.clientCall.count({ where: { clientId, callerNumber: { in: forms } } });
    const futureBookings = await tx.clientBooking.count({ where: { clientId, customerPhone: { in: forms }, status: 'confirmed', bookingDate: { gte: new Date() } } });
    const before = rows.map(row => ({ callerNumber: row.callerNumber, ...callerMemoryView(row) }));
    if (!confirm) return { dryRun: true, clientId, callerNumber, calls, futureBookings, before };
    const resetAt = new Date();
    const blocked = rows.some(row => row.isBlocked);
    const totalCalls = Math.max(calls, ...rows.map(row => row.totalCalls));
    const lastCallAt = rows.reduce<Date | null>((last, row) => row.lastCallAt && (!last || row.lastCallAt > last) ? row.lastCallAt : last, null);
    // Both accepted transport forms get tombstones; never delete a row.
    for (const form of forms) {
      const facts = memoryEnvelope(rows.find(row => row.callerNumber === form)?.facts, resetAt);
      facts.identity = { name: null, email: null };
      facts.contact.callbackNumber = null;
      facts.engagements.openRequests = [];
      facts.meta.identityResetAt = resetAt.toISOString();
      facts.meta.preferencesAt = null; facts.meta.summaryAt = null; facts.meta.summaryCallId = null;
      const data = { knownName: null, email: null, profileSummary: null, lastSummary: null, lastOutcome: null,
        preferences: [], facts: facts as unknown as Prisma.InputJsonObject, isBlocked: blocked };
      await tx.callerMemory.upsert({ where: { clientId_callerNumber: { clientId, callerNumber: form } },
        create: { clientId, callerNumber: form, ...data, totalCalls, lastCallAt }, update: data });
    }
    const reread = await tx.callerMemory.findMany({ where: { clientId, callerNumber: { in: forms } } });
    const after = reread.map(row => ({ callerNumber: row.callerNumber, ...callerMemoryView(row, resetAt) }));
    if (after.length !== 2 || after.some(row => row.knownName || row.email || row.profileSummary || row.preferences.length || row.identityResetAt !== resetAt.toISOString())) throw new Error('Reset readback failed');
    return { dryRun: false, clientId, callerNumber, calls, futureBookings, identityResetAt: resetAt.toISOString(), after,
      cacheWarning: 'Restart backend/voice workers or allow 60s history cache TTL before next test call.' };
  }, { timeout: 10000, maxWait: 5000 });
}

// No dotenv/config import: credentials must be provided by the parent process.
if (typeof require !== 'undefined' && require.main === module) {
  let db: PrismaClient | undefined;
  Promise.resolve().then(async () => {
    const options = parseResetArgs(process.argv.slice(2));
    db = new PrismaClient();
    console.log(JSON.stringify(await resetTestCallerIdentity(db, options), null, 2));
  }).catch(error => { console.error(error instanceof Error ? error.message : 'Reset failed'); process.exitCode = 1; })
    .finally(async () => { await db?.$disconnect(); });
}
