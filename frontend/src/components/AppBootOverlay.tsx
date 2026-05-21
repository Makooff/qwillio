import { useEffect, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import OrbsLoader from './OrbsLoader';

/**
 * Fullscreen boot overlay that plays the Qwillio logo animation in full
 * before revealing the app. The app renders underneath in parallel, so by
 * the time the intro animation finishes the dashboard (or landing page) is
 * already hydrated. The overlay fades out only once BOTH conditions hold:
 *
 *   - the initial auth check has completed (authStore.isLoading === false)
 *   - the minimum animation duration has elapsed (so the intro never cuts)
 */
export default function AppBootOverlay({
  minDurationMs = 900,
  fadeMs = 450,
  background,
}: {
  minDurationMs?: number;
  fadeMs?: number;
  background?: string;
}) {
  // Heuristic: if a token exists, the user is heading to the dashboard
  // (dark theme). Otherwise show the public/white intro.
  const resolvedBg =
    background ??
    (typeof window !== 'undefined' && window.localStorage.getItem('token')
      ? '#0A0A0F'
      : '#FFFFFF');
  const authLoading = useAuthStore((s) => s.isLoading);
  const [minElapsed, setMinElapsed] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setMinElapsed(true), minDurationMs);
    return () => window.clearTimeout(t);
  }, [minDurationMs]);

  useEffect(() => {
    if (!authLoading && minElapsed && !fadingOut) {
      setFadingOut(true);
      const t = window.setTimeout(() => setMounted(false), fadeMs);
      return () => window.clearTimeout(t);
    }
  }, [authLoading, minElapsed, fadingOut, fadeMs]);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: resolvedBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: fadingOut ? 0 : 1,
        transition: `opacity ${fadeMs}ms ease-out`,
        pointerEvents: fadingOut ? 'none' : 'auto',
      }}
    >
      <OrbsLoader size={48} />
    </div>
  );
}
