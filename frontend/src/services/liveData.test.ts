import { describe, it, expect, beforeEach, vi } from 'vitest';

const get = vi.fn();
vi.mock('./api', () => ({ default: { get: (...args: unknown[]) => get(...args) } }));

const {
  fetchLive, peekLive, subscribeLive, primeLive, invalidateLive, refreshAllLive, isFresh, __resetLive,
} = await import('./liveData');

beforeEach(() => {
  __resetLive();
  get.mockReset();
});

const ok = (data: unknown) => Promise.resolve({ data });

describe('what makes a tab switch instant', () => {
  it('hands back the cached answer with no request', async () => {
    get.mockReturnValue(ok({ calls: 3 }));
    await fetchLive('/overview');
    await fetchLive('/overview');
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('exposes the cached answer synchronously', async () => {
    // A page reads this during its first render. If it had to await, the tab
    // would flash a spinner over data that was already in memory.
    get.mockReturnValue(ok({ calls: 3 }));
    expect(peekLive('/overview')).toBeUndefined();
    await fetchLive('/overview');
    expect(peekLive('/overview')).toEqual({ calls: 3 });
  });

  it('collapses concurrent requests into one', async () => {
    // The page, the poller and a tab switch can all ask at the same instant.
    let resolve!: (v: unknown) => void;
    get.mockReturnValue(new Promise(r => { resolve = r; }));
    const all = Promise.all([fetchLive('/leads'), fetchLive('/leads'), fetchLive('/leads')]);
    resolve({ data: { data: [] } });
    await all;
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('refetches once the answer is stale', async () => {
    get.mockReturnValue(ok({ n: 1 }));
    await fetchLive('/overview');
    expect(isFresh('/overview')).toBe(true);

    vi.setSystemTime(Date.now() + 60_000);
    expect(isFresh('/overview')).toBe(false);
    await fetchLive('/overview');
    expect(get).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('forces a refetch when asked, however fresh', async () => {
    get.mockReturnValue(ok({ n: 1 }));
    await fetchLive('/overview');
    await fetchLive('/overview', { force: true });
    expect(get).toHaveBeenCalledTimes(2);
  });
});

describe('staying current without a refresh button', () => {
  it('pushes every update to subscribers', async () => {
    get.mockReturnValue(ok({ n: 1 }));
    const seen: unknown[] = [];
    subscribeLive('/overview', v => seen.push(v));
    await fetchLive('/overview', { force: true });

    get.mockReturnValue(ok({ n: 2 }));
    await fetchLive('/overview', { force: true });

    expect(seen).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('stops notifying a page that has gone away', async () => {
    get.mockReturnValue(ok({ n: 1 }));
    const seen: unknown[] = [];
    const stop = subscribeLive('/overview', v => seen.push(v));
    await fetchLive('/overview', { force: true });
    stop();
    await fetchLive('/overview', { force: true });
    expect(seen).toHaveLength(1);
  });

  it('keeps refreshing a key after its page unmounts', async () => {
    // This is what makes coming back to a tab instant rather than merely
    // cached: the key stays live, so the data is current when it is needed.
    get.mockReturnValue(ok({ n: 1 }));
    subscribeLive('/overview', () => undefined)();
    await fetchLive('/overview'); // let the subscription's own fetch settle
    get.mockClear();
    refreshAllLive();
    expect(get).toHaveBeenCalledWith('/overview');
  });

  it('does not poll a key nobody ever subscribed to', async () => {
    get.mockReturnValue(ok({ n: 1 }));
    await fetchLive('/one-off');
    get.mockClear();
    refreshAllLive();
    expect(get).not.toHaveBeenCalled();
  });

  it('refetches a key invalidated after a write', async () => {
    // The settings page saves; the copy the dashboard holds is wrong from that
    // instant, and nobody should have to reload to find out.
    get.mockReturnValue(ok({ n: 1 }));
    subscribeLive('/my-dashboard/settings', () => undefined);
    await fetchLive('/my-dashboard/settings', { force: true });
    get.mockClear();

    invalidateLive('/my-dashboard/');
    expect(get).toHaveBeenCalledWith('/my-dashboard/settings');
  });
});

describe('priming during the launch animation', () => {
  it('fills every key and marks them live', async () => {
    get.mockReturnValue(ok({ ready: true }));
    await primeLive(['/a', '/b']);
    expect(peekLive('/a')).toEqual({ ready: true });
    expect(peekLive('/b')).toEqual({ ready: true });

    get.mockClear();
    refreshAllLive();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('never lets one failing endpoint hold up the launch', async () => {
    get.mockImplementation((url: string) =>
      (url === '/a' ? Promise.reject(new Error('down')) : ok({ ok: 1 })));
    await expect(primeLive(['/a', '/b'])).resolves.toBeUndefined();
    expect(peekLive('/b')).toEqual({ ok: 1 });
  });
});
