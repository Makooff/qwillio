import { useEffect, useState } from 'react';
import { fetchLive, peekLive, subscribeLive } from '../services/liveData';

/**
 * Read a dashboard endpoint that stays current on its own.
 *
 * The first render already has the cached answer when there is one, which is
 * what makes moving between tabs feel like moving rather than loading. Updates
 * arrive from the background refresh without the page asking.
 */
export function useLive<T = unknown>(key: string | null): {
  data: T | undefined;
  loading: boolean;
  error: unknown;
  refresh: () => void;
} {
  const [data, setData] = useState<T | undefined>(() => (key ? peekLive<T>(key) : undefined));
  const [error, setError] = useState<unknown>(null);
  // Loading only when there is nothing to show. A refresh behind a rendered
  // page is not a loading state — showing a spinner over good data is a step
  // backwards from showing the data.
  const [loading, setLoading] = useState(() => (key ? peekLive(key) === undefined : false));

  useEffect(() => {
    if (!key) return;
    const held = peekLive<T>(key);
    setData(held);
    setLoading(held === undefined);

    const unsubscribe = subscribeLive<T>(key, next => {
      setData(next);
      setLoading(false);
      setError(null);
    });

    fetchLive<T>(key).catch(err => {
      // A failed refresh over data already on screen is not worth an error
      // state: the numbers are a few seconds old, not wrong.
      if (peekLive(key) === undefined) setError(err);
      setLoading(false);
    });

    return unsubscribe;
  }, [key]);

  return {
    data,
    loading,
    error,
    refresh: () => { if (key) void fetchLive(key, { force: true }).catch(() => undefined); },
  };
}
