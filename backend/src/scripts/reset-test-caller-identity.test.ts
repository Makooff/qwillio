import { expect, it, vi } from 'vitest';
import { parseResetArgs, resetTestCallerIdentity } from './reset-test-caller-identity';
const args = ['--client-id=59464bd0-ffb9-48bb-b0d8-93ffcf442f95', '--email=testqwillio@gmail.com', '--number=+32483620980'];
it('requires all scope arguments and rejects malformed or duplicate flags', () => {
  expect(parseResetArgs(args)).toMatchObject({ confirm: false, callerNumber: '32483620980' });
  for (const invalid of [[], args.slice(1), [...args, '--number=32475123456'], [...args.slice(0, 2), '--number=0483620980'], [args[0], '--email=bad', args[2]]]) expect(() => parseResetArgs(invalid)).toThrow();
});
function fake() {
  const rows: any[] = [];
  const tx = { $queryRaw: vi.fn(), client: { findUnique: vi.fn(async () => ({ contactEmail: 'testqwillio@gmail.com' })) },
    clientCall: { count: vi.fn(async () => 31) }, clientBooking: { count: vi.fn(async () => 1) },
    callerMemory: { findMany: vi.fn(async () => structuredClone(rows)), upsert: vi.fn(async ({ create, update }: any) => {
      const row = rows.find(r => r.callerNumber === create.callerNumber);
      if (row) Object.assign(row, update); else rows.push(create);
    }) } };
  return { rows, tx, db: { $transaction: (fn: any) => fn(tx) } as any };
}
it('dry run writes nothing, confirm rereads tombstones, preserves opposition and unrelated records', async () => {
  const f = fake();
  expect(await resetTestCallerIdentity(f.db, parseResetArgs(args))).toMatchObject({ dryRun: true, calls: 31, futureBookings: 1 });
  expect(f.tx.callerMemory.upsert).not.toHaveBeenCalled();
  f.rows.push({ clientId: parseResetArgs(args).clientId, callerNumber: '32483620980', isBlocked: true, knownName: 'Old', totalCalls: 31 });
  const result = await resetTestCallerIdentity(f.db, parseResetArgs([...args, '--confirm']));
  expect(result).toMatchObject({ dryRun: false, calls: 31, futureBookings: 1 });
  expect((result as any).after).toHaveLength(2);
  for (const row of (result as any).after) expect(row).toMatchObject({ knownName: null, email: null, profileSummary: null, preferences: [], isBlocked: true });
  for (const call of f.tx.callerMemory.upsert.mock.calls) expect(call[0].create.clientId).toBe(parseResetArgs(args).clientId);
  expect(Object.keys(f.tx.clientCall)).toEqual(['count']);
  expect(Object.keys(f.tx.clientBooking)).toEqual(['count']);
});
it('mismatching email refuses writes', async () => {
  const f = fake(); f.tx.client.findUnique.mockResolvedValue({ contactEmail: 'other@example.com' });
  await expect(resetTestCallerIdentity(f.db, parseResetArgs([...args, '--confirm']))).rejects.toThrow('mismatch');
  expect(f.tx.callerMemory.upsert).not.toHaveBeenCalled();
});
