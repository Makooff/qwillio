import api from './api';

/**
 * A always-warm cache in front of the dashboard's GET endpoints.
 *
 * Two problems, one cause. Switching tabs re-mounted a page, which re-fetched
 * everything, which meant a spinner every time — even though the same answer
 * had arrived seconds earlier. And the only way to see fresh numbers was the
 * refresh button, which reloaded the whole application.
 *
 * So: every response is kept, a remount reads it back synchronously (no
 * spinner, the page is simply there), and the entries that matter are
 * revalidated on a timer, when the window regains focus, and when the app comes
 * back from the background. The refresh button has nothing left to do.
 *
 * Deliberately not a library: this is one map, one timer and one subscriber
 * list, and swapping the data layer of a working dashboard for react-query
 * would be a much larger change than the problem deserves.
 */

interface Entry {
  data: unknown;
  at: number;
  inFlight: Promise<unknown> | null;
  listeners: Set<(data: unknown) => void>;
  /** Kept fresh by the background loop while true. */
  live: boolean;
}

const store = new Map<string, Entry>();

/** How stale a cached answer may be before a read triggers a refetch. */
const STALE_MS = 15_000;
/** How often live keys are refreshed while the app is open and visible. */
const POLL_MS = 25_000;

function entry(key: string): Entry {
  let e = store.get(key);
  if (!e) {
    e = { data: undefined, at: 0, inFlight: null, listeners: new Set(), live: false };
    store.set(key, e);
  }
  return e;
}

/** The cached answer, or undefined. Synchronous — that is the whole point. */
export function peekLive<T = unknown>(key: string): T | undefined {
  return store.get(key)?.data as T | undefined;
}

export function isFresh(key: string): boolean {
  const e = store.get(key);
  return !!e && e.data !== undefined && Date.now() - e.at < STALE_MS;
}

/**
 * Fetch, or return what is already there.
 *
 * Concurrent callers share one request: the overview page, the poller and a tab
 * switch all asking at once should cost one round-trip, not three.
 */
export async function fetchLive<T = unknown>(key: string, opts: { force?: boolean } = {}): Promise<T> {
  const e = entry(key);
  if (!opts.force && e.data !== undefined && Date.now() - e.at < STALE_MS) return e.data as T;
  if (e.inFlight) return e.inFlight as Promise<T>;

  const task = api.get(key)
    .then(({ data }) => {
      e.data = data;
      e.at = Date.now();
      e.listeners.forEach(fn => fn(data));
      return data as T;
    })
    .finally(() => { e.inFlight = null; });

  e.inFlight = task;
  return task;
}

/**
 * Keep a key fresh for as long as the app is open, and hand every update to
 * `onUpdate`. Returns the unsubscribe.
 *
 * A key stays live after the last subscriber leaves: that is what makes coming
 * back to a tab instant instead of merely cached. It stops costing anything the
 * moment the app is hidden.
 */
export function subscribeLive<T = unknown>(key: string, onUpdate: (data: T) => void): () => void {
  const e = entry(key);
  e.live = true;
  const listener = (data: unknown) => onUpdate(data as T);
  e.listeners.add(listener);
  // Stale or missing: refresh now, so a tab opened after a long pause shows
  // current numbers rather than yesterday's.
  if (!isFresh(key)) void fetchLive(key).catch(() => undefined);
  return () => { e.listeners.delete(listener); };
}

/** Warm a set of keys without subscribing — used while the splash is up. */
export async function primeLive(keys: string[]): Promise<void> {
  await Promise.all(keys.map(key => {
    entry(key).live = true;
    return fetchLive(key).catch(() => undefined);
  }));
}

/** Refresh everything that is live, now. */
export function refreshAllLive(): void {
  for (const [key, e] of store) {
    if (e.live) void fetchLive(key, { force: true }).catch(() => undefined);
  }
}

/**
 * Forget a key. Needed after a write: the settings page saves, and the copy the
 * dashboard is holding is wrong from that instant.
 */
export function invalidateLive(prefix: string): void {
  for (const [key, e] of store) {
    if (!key.startsWith(prefix)) continue;
    e.at = 0;
    if (e.live) void fetchLive(key, { force: true }).catch(() => undefined);
  }
}

let loop: ReturnType<typeof setInterval> | null = null;

/**
 * Start the background refresh. Idempotent, so mounting two dashboards does not
 * double the polling.
 */
export function startLiveLoop(): void {
  if (loop || typeof document === 'undefined') return;

  loop = setInterval(() => {
    // A hidden app is a phone in a pocket: polling there spends battery and
    // quota on numbers nobody is looking at.
    if (document.visibilityState !== 'visible') return;
    refreshAllLive();
  }, POLL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshAllLive();
  });
  window.addEventListener('focus', () => refreshAllLive());
  // Coming back online is exactly when the held data is most likely wrong.
  window.addEventListener('online', () => refreshAllLive());
}

/** Test seam. */
export function __resetLive(): void {
  store.clear();
  if (loop) { clearInterval(loop); loop = null; }
}
