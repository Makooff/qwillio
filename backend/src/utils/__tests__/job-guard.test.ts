import { describe, it, expect, vi } from 'vitest';
import { JobGuard } from '../job-guard';

describe('JobGuard', () => {
  it('runs the job and records run metadata', async () => {
    const g = new JobGuard();
    await g.run('a', async () => {});
    const snap = g.snapshot();
    expect(snap.a.runs).toBe(1);
    expect(snap.a.skips).toBe(0);
    expect(snap.a.running).toBe(false);
    expect(snap.a.lastError).toBeNull();
    expect(snap.a.lastDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('runs sequential invocations back to back', async () => {
    const g = new JobGuard();
    const fn = vi.fn(async () => {});
    await g.run('a', fn);
    await g.run('a', fn);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(g.snapshot().a.runs).toBe(2);
  });

  it('skips a tick that overlaps an in-flight run', async () => {
    const g = new JobGuard();
    let release!: () => void;
    const inFlight = new Promise<void>((r) => { release = r; });
    const fn = vi.fn(() => inFlight);

    const first = g.run('a', fn);   // starts, marks running, awaits inFlight
    await g.run('a', fn);           // overlaps -> skipped immediately

    expect(fn).toHaveBeenCalledTimes(1);
    expect(g.snapshot().a.skips).toBe(1);

    release();
    await first;
    expect(g.snapshot().a.runs).toBe(1);
    expect(g.snapshot().a.running).toBe(false);
  });

  it('captures errors without throwing and resets the running flag', async () => {
    const g = new JobGuard();
    await expect(
      g.run('a', async () => { throw new Error('boom'); }),
    ).resolves.toBeUndefined();
    const snap = g.snapshot();
    expect(snap.a.lastError).toBe('boom');
    expect(snap.a.running).toBe(false);
    // A later run can still proceed after a failure.
    await g.run('a', async () => {});
    expect(g.snapshot().a.lastError).toBeNull();
  });

  it('snapshot is a copy, not a live reference', async () => {
    const g = new JobGuard();
    await g.run('a', async () => {});
    const snap = g.snapshot();
    snap.a.runs = 999;
    expect(g.snapshot().a.runs).toBe(1);
  });
});
