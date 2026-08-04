import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import QwillioLogo from './QwillioLogo';

/**
 * Launch animation for the installed app.
 *
 * The two lobes of the mark arrive from opposite ends of the screen — the left
 * one falling, the right one rising — drift for a moment as if settling, and
 * come to rest as the logo, which then holds with the wordmark for a beat.
 *
 * Everything that moves here moves by transform, never by geometry or by size.
 * Animating an SVG `cy` re-lays-out the shape on every frame, and animating the
 * scale of a blurred layer re-rasterises the blur on every frame; both look
 * fine on a laptop and stutter on a phone, which is what "it must be much
 * smoother" was about. Transforms are composited, so the whole sequence is one
 * GPU job.
 *
 * The hold is also the point: the dashboard loads underneath, so the fade ends
 * on a screen that is already populated instead of one that starts fetching.
 */

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
const EASE_DRAWER = [0.32, 0.72, 0, 1] as const;

/** Lobe geometry, matched to where the circles sit inside the 512 logo box. */
const ORB = { r: 116, y: 256, leftX: 190, rightX: 322 };

/** How far off-screen each lobe starts, in the 512 viewBox's own units. */
const ENTRY = 470;

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
  const t = useMemo(() => (reduced
    ? { travel: 0.01, settle: 0.01, resolve: 0.2, hold: 1.2, out: 0.25 }
    // travel + settle is one continuous motion: the lobes fall and rise, pass
    // their mark, and ease back onto it. Splitting it into two tweens is what
    // makes an arrival look mechanical.
    : { travel: 0.95, settle: 0.45, resolve: 0.4, hold: 2, out: 0.5 }),
  [reduced]);

  /** When the mark is fully formed and the wordmark is up. */
  const formed = t.travel + t.settle + t.resolve;

  useEffect(() => {
    let alive = true;
    // Two seconds ON the finished logo, as asked — the loading happens inside
    // that window rather than after it.
    const floor = new Promise<void>(resolve => setTimeout(resolve, (formed + t.hold) * 1000));
    // The ceiling matters more than the floor: a phone on a bad connection
    // should reach the dashboard and fill in, not stare at a logo.
    const ceiling = new Promise<void>(resolve => setTimeout(resolve, (formed + t.hold) * 1000 + 3_500));

    void Promise.all([floor, Promise.race([waitFor ?? Promise.resolve(), ceiling])])
      .then(() => { if (alive) setVisible(false); });

    return () => { alive = false; };
  }, [formed, t.hold, waitFor]);

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
            near-black at the bottom right. Painted once and never animated —
            a moving gradient of this size is a full-screen repaint per frame.
          */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(120% 90% at 8% 4%, rgba(148,116,255,0.32) 0%, rgba(96,72,190,0.13) 38%, transparent 70%),'
                + 'radial-gradient(95% 80% at 92% 96%, rgba(0,0,0,0.92) 0%, rgba(4,4,7,0.6) 45%, transparent 78%),'
                + 'linear-gradient(148deg, rgba(36,26,64,0.75) 0%, rgba(12,10,20,0.9) 52%, #050507 100%)',
            }}
          />
          {!reduced && (
            <>
              {/*
                Two blooms drifting on different periods, so the light never
                settles into a symmetrical gradient. Transform only: scaling a
                blurred layer re-renders the blur every frame, which is exactly
                the kind of thing a phone cannot keep up with.
              */}
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{
                  top: '-18%', left: '-14%', width: '78%', height: '62%',
                  background: 'radial-gradient(circle at 40% 40%, rgba(174,132,255,0.30), transparent 68%)',
                  filter: 'blur(30px)',
                  willChange: 'transform',
                }}
                animate={{ x: [0, 46, -20, 0], y: [0, 28, 60, 0] }}
                transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute"
                style={{
                  top: '4%', left: '16%', width: '66%', height: '56%',
                  background: 'radial-gradient(circle at 60% 50%, rgba(205,107,251,0.17), transparent 70%)',
                  filter: 'blur(38px)',
                  willChange: 'transform',
                }}
                animate={{ x: [0, -40, 24, 0], y: [0, 36, -14, 0] }}
                transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
              />
            </>
          )}

          <div className="relative flex flex-col items-center">
            <div className="relative" style={{ width: 168, height: 168 }}>
              {/* Stage 1: the lobes fall and rise into place, then settle. */}
              <motion.svg
                viewBox="0 0 512 512"
                className="absolute inset-0 h-full w-full"
                aria-hidden="true"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: t.resolve, delay: t.travel + t.settle, ease: 'linear' }}
              >
                {/* The lobes are grouped so their travel is a transform on the
                    group rather than a change to the circle's own geometry. */}
                <motion.g
                  style={{ willChange: 'transform' }}
                  initial={{ y: reduced ? 0 : -ENTRY, opacity: reduced ? 1 : 0 }}
                  animate={{ y: reduced ? 0 : [-ENTRY, 16, -5, 0], opacity: 1 }}
                  transition={{
                    duration: t.travel + t.settle,
                    times: reduced ? undefined : [0, 0.6, 0.82, 1],
                    ease: EASE_OUT_EXPO,
                  }}
                >
                  <circle cx={ORB.leftX} cy={ORB.y} r={ORB.r} fill="#7A5FFF" />
                </motion.g>
                <motion.g
                  style={{ willChange: 'transform' }}
                  initial={{ y: reduced ? 0 : ENTRY, opacity: reduced ? 1 : 0 }}
                  animate={{ y: reduced ? 0 : [ENTRY, -16, 5, 0], opacity: 1 }}
                  // Slightly behind the left one: two objects arriving on the
                  // exact same frame read as one object, not as a meeting.
                  transition={{
                    duration: t.travel + t.settle,
                    delay: reduced ? 0 : 0.07,
                    times: reduced ? undefined : [0, 0.6, 0.82, 1],
                    ease: EASE_OUT_EXPO,
                  }}
                >
                  <circle cx={ORB.rightX} cy={ORB.y} r={ORB.r} fill="#CD6BFB" />
                </motion.g>
                {/* The overlap the brand actually uses, revealed as they meet. */}
                <motion.path
                  d={LENS}
                  fill="#7349FE"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: t.settle * 0.8, delay: t.travel * 0.78 }}
                />
              </motion.svg>

              {/* Stage 2: the real mark takes over, so the held frame is exact. */}
              <motion.div
                className="absolute inset-0 grid place-items-center"
                style={{ willChange: 'transform, opacity' }}
                initial={{ opacity: 0, scale: reduced ? 1 : 0.965 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: t.resolve, delay: t.travel + t.settle, ease: EASE_OUT_EXPO }}
              >
                <QwillioLogo size={168} />
              </motion.div>
            </div>

            {/* The wordmark as it is set everywhere else on the site: Outfit,
                semibold, tight tracking. A splash that spells the name
                differently from the header is a splash for another product. */}
            <motion.p
              className="mt-6 text-[26px] font-semibold tracking-tight"
              style={{ color: '#F5F5F7', willChange: 'transform, opacity' }}
              initial={{ opacity: 0, y: reduced ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: t.travel + t.settle + t.resolve * 0.4, ease: EASE_OUT_EXPO }}
            >
              Qwillio
            </motion.p>
          </div>
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
