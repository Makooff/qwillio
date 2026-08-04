import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import QwillioLogo from './QwillioLogo';

/**
 * Launch animation for the installed app.
 *
 * The two lobes of the mark arrive from opposite ends of the screen — the left
 * one falling, the right one rising — drift for a moment as if settling, and
 * come to rest as the logo. The last frame is the real mark rather than an
 * approximation of it.
 *
 * It also buys time on purpose: the dashboard loads underneath, so the fade
 * ends on a screen that is already populated instead of one that starts
 * fetching. The animation holds until that work is done, within reason — a slow
 * network must not turn a launch into a wait.
 */

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

/** Lobe geometry, matched to where the circles sit inside the 512 logo box. */
const ORB = { r: 116, y: 256, leftX: 190, rightX: 322 };

/**
 * The vesica where the two lobes overlap, which the brand paints in the deep
 * mauve. Its outline is an arc of each circle meeting at the two intersection
 * points, not a circle of its own.
 */
const LENS = (() => {
  const midX = (ORB.leftX + ORB.rightX) / 2;
  const half = Math.sqrt(ORB.r ** 2 - ((ORB.rightX - ORB.leftX) / 2) ** 2);
  const top = ORB.y - half;
  const bottom = ORB.y + half;
  // Down the left edge (arc of the right circle), then up the right edge (arc
  // of the left circle); both bulge outward, hence sweep-flag 0.
  return `M ${midX} ${top} A ${ORB.r} ${ORB.r} 0 0 0 ${midX} ${bottom} A ${ORB.r} ${ORB.r} 0 0 0 ${midX} ${top} Z`;
})();

export default function SplashScreen({
  onDone, waitFor,
}: {
  onDone: () => void;
  /** Background work to finish before handing over. */
  waitFor?: Promise<unknown>;
}) {
  const [visible, setVisible] = useState(true);
  const reduced = useReducedMotion();

  // A reduced-motion launch still confirms the app opened, it just does not fly
  // anything across the screen.
  const t = useMemo(
    () => (reduced
      ? { travel: 0.01, settle: 0.01, resolve: 0.2, hold: 700, out: 0.25 }
      : { travel: 0.85, settle: 0.5, resolve: 0.45, hold: 1900, out: 0.5 }),
    [reduced],
  );

  useEffect(() => {
    let alive = true;
    const floor = new Promise<void>(resolve => setTimeout(resolve, t.hold));
    // The ceiling matters more than the floor: a phone on a bad connection
    // should reach the dashboard and fill in, not stare at a logo.
    const ceiling = new Promise<void>(resolve => setTimeout(resolve, t.hold + 4_000));

    void Promise.all([floor, Promise.race([waitFor ?? Promise.resolve(), ceiling])])
      .then(() => { if (alive) setVisible(false); });

    return () => { alive = false; };
  }, [t.hold, waitFor]);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[100] grid place-items-center overflow-hidden"
          style={{ background: '#08070B' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: reduced ? 1 : 1.04 }}
          transition={{ duration: t.out, ease: EASE_DRAWER }}
          role="status"
          aria-label="Qwillio"
        >
          {/*
            The field the mark sits in: mauve gathered towards the top left,
            near-black at the bottom right, and drifting — three offset blooms
            on different periods, so the light never settles into a symmetrical
            gradient. A single linear one reads as a template.
          */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 8% 4%, rgba(148,116,255,0.34) 0%, rgba(96,72,190,0.14) 38%, transparent 70%),'
                + 'radial-gradient(95% 80% at 92% 96%, rgba(0,0,0,0.92) 0%, rgba(4,4,7,0.6) 45%, transparent 78%),'
                + 'linear-gradient(148deg, rgba(36,26,64,0.75) 0%, rgba(12,10,20,0.9) 52%, #050507 100%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE_OUT_EXPO }}
          />
          {!reduced && (
            <>
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{
                  top: '-18%', left: '-14%', width: '78%', height: '62%',
                  background: 'radial-gradient(circle at 40% 40%, rgba(174,132,255,0.30), transparent 68%)',
                  filter: 'blur(28px)',
                }}
                animate={{ x: [0, 44, -18, 0], y: [0, 26, 58, 0], scale: [1, 1.12, 0.96, 1] }}
                transition={{ duration: 13, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{
                  top: '6%', left: '18%', width: '64%', height: '54%',
                  background: 'radial-gradient(circle at 60% 50%, rgba(205,107,251,0.18), transparent 70%)',
                  filter: 'blur(36px)',
                }}
                // A different period from the first, so the two never line up
                // and the light keeps moving without ever repeating a pose.
                animate={{ x: [0, -38, 22, 0], y: [0, 34, -12, 0], scale: [1, 0.94, 1.1, 1] }}
                transition={{ duration: 9.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </>
          )}

          <div className="relative" style={{ width: 168, height: 168 }}>
            {/* Stage 1: the lobes fall and rise into place, then float. */}
            <motion.svg
              viewBox="0 0 512 512"
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: t.resolve, delay: t.travel + t.settle, ease: 'linear' }}
            >
              <motion.circle
                cx={ORB.leftX}
                r={ORB.r}
                fill="#7A5FFF"
                initial={{ cy: reduced ? ORB.y : -180, opacity: reduced ? 1 : 0 }}
                animate={{
                  cy: reduced ? ORB.y : [-180, ORB.y + 14, ORB.y - 6, ORB.y],
                  opacity: 1,
                }}
                transition={{
                  duration: t.travel + t.settle,
                  times: reduced ? undefined : [0, 0.62, 0.82, 1],
                  ease: EASE_OUT_EXPO,
                }}
              />
              <motion.circle
                cx={ORB.rightX}
                r={ORB.r}
                fill="#CD6BFB"
                initial={{ cy: reduced ? ORB.y : 692, opacity: reduced ? 1 : 0 }}
                animate={{
                  cy: reduced ? ORB.y : [692, ORB.y - 14, ORB.y + 6, ORB.y],
                  opacity: 1,
                }}
                // Slightly behind the left one: two objects arriving on the
                // exact same frame read as one object, not as a meeting.
                transition={{
                  duration: t.travel + t.settle,
                  delay: reduced ? 0 : 0.08,
                  times: reduced ? undefined : [0, 0.62, 0.82, 1],
                  ease: EASE_OUT_EXPO,
                }}
              />
              {/* The overlap the brand actually uses, revealed as they meet. */}
              <motion.path
                d={LENS}
                fill="#7349FE"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: t.settle * 0.7, delay: t.travel * 0.72 }}
              />
            </motion.svg>

            {/* Stage 2: the real mark takes over, so the held frame is exact. */}
            <motion.div
              className="absolute inset-0 grid place-items-center"
              initial={{ opacity: 0, scale: reduced ? 1 : 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: t.resolve, delay: t.travel + t.settle, ease: EASE_OUT_EXPO }}
            >
              <QwillioLogo size={168} />
            </motion.div>
          </div>

          <motion.p
            className="absolute text-[15px] font-medium tracking-[0.16em] uppercase"
            style={{ color: 'rgba(245,245,247,0.62)', bottom: '22%' }}
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: t.travel + t.settle + t.resolve * 0.5, ease: EASE_OUT_EXPO }}
          >
            Qwillio
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** True when launched from the home screen rather than a browser tab. */
export function isStandaloneApp(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari predates the display-mode media query for installed apps.
    (window.navigator as any).standalone === true
  );
}
