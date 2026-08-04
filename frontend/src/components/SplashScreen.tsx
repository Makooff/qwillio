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

/** The mark's own size on screen, and the geometry inside its 512 box. */
const LOGO = 168;
const ORB = { r: 116, y: 256, leftX: 190, rightX: 322 };

/** The same circles, in the pixels they occupy inside a LOGO-sized box. */
const px = (n: number) => (n / 512) * LOGO;
const BLOB = {
  size: px(ORB.r * 2),
  top: px(ORB.y - ORB.r),
  leftX: px(ORB.leftX - ORB.r),
  rightX: px(ORB.rightX - ORB.r),
};

/**
 * How a blob of water behaves with nothing to fall onto.
 *
 * In free fall it is drawn out along its path; released, surface tension pulls
 * it back and overshoots, so it oscillates between prolate (stretched) and
 * oblate (flattened) with the amplitude dying away — never a bounce, never a
 * flat impact frame, which is what a cartoon squash gets wrong.
 *
 * The keyframes are that oscillation: strongly drawn out while travelling, then
 * three decaying swings, in antiphase between the two axes because volume is
 * conserved — wider means shorter, always.
 */
const WOBBLE = {
  times: [0, 0.46, 0.62, 0.74, 0.85, 0.93, 1],
  scaleX: [0.52, 0.62, 1.13, 0.93, 1.05, 0.98, 1],
  scaleY: [0.52, 0.92, 0.88, 1.07, 0.96, 1.02, 1],
  /**
   * The outline goes with it. A levitating drop is never a perfect ellipse: the
   * radii differ around the shape and drift, which is what the eye reads as
   * liquid rather than as a stretched circle.
   */
  radius: [
    '50% 50% 50% 50% / 50% 50% 50% 50%',
    '46% 54% 50% 50% / 62% 62% 38% 38%',
    '56% 44% 52% 48% / 40% 42% 58% 60%',
    '48% 52% 46% 54% / 56% 52% 48% 44%',
    '52% 48% 53% 47% / 47% 50% 50% 53%',
    '49% 51% 49% 51% / 51% 49% 51% 49%',
    '50% 50% 50% 50% / 50% 50% 50% 50%',
  ],
};

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
            <div className="relative" style={{ width: LOGO, height: LOGO }}>
              {/*
                Stage 1: two drops crossing the whole screen.

                Elements rather than an SVG, and vh rather than viewBox units,
                because the travel is a screen-height journey: inside the 512
                box the same numbers only ever moved them the width of the logo.
                They come to rest exactly where the mark's lobes are, so the
                crossfade that follows lands on itself.

                The left one is painted over the right, as in the mark — the
                whole way down, not only once it arrives.
              */}
              <motion.div
                aria-hidden="true"
                className="absolute inset-0"
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: t.resolve, delay: t.travel + t.settle, ease: 'linear' }}
              >
                <motion.div
                  className="absolute"
                  style={{
                    width: BLOB.size, height: BLOB.size,
                    top: BLOB.top, left: BLOB.rightX,
                    background: 'radial-gradient(circle at 36% 30%, #E39BFF 0%, #CD6BFB 42%, #B14FE6 100%)',
                    willChange: 'transform, border-radius',
                  }}
                  initial={{ y: reduced ? 0 : '58vh', scaleX: 0.52, scaleY: 0.52, opacity: reduced ? 1 : 0 }}
                  animate={{
                    // Rises from below the fold, overshoots the meeting point,
                    // and drifts back onto it.
                    y: reduced ? 0 : ['58vh', '-2.4vh', '0.8vh', '-0.3vh', '0.1vh', '0vh', '0vh'],
                    scaleX: reduced ? 1 : WOBBLE.scaleX,
                    scaleY: reduced ? 1 : WOBBLE.scaleY,
                    borderRadius: reduced ? '50%' : WOBBLE.radius,
                    opacity: 1,
                  }}
                  // Slightly behind the left one: two objects arriving on the
                  // exact same frame read as one object, not as a meeting.
                  transition={{
                    duration: t.travel + t.settle,
                    delay: reduced ? 0 : 0.07,
                    times: reduced ? undefined : WOBBLE.times,
                    ease: EASE_OUT_EXPO,
                  }}
                />
                <motion.div
                  className="absolute"
                  style={{
                    width: BLOB.size, height: BLOB.size,
                    top: BLOB.top, left: BLOB.leftX,
                    background: 'radial-gradient(circle at 36% 30%, #A08CFF 0%, #7A5FFF 44%, #5B41DB 100%)',
                    willChange: 'transform, border-radius',
                  }}
                  initial={{ y: reduced ? 0 : '-58vh', scaleX: 0.52, scaleY: 0.52, opacity: reduced ? 1 : 0 }}
                  animate={{
                    y: reduced ? 0 : ['-58vh', '2.4vh', '-0.8vh', '0.3vh', '-0.1vh', '0vh', '0vh'],
                    scaleX: reduced ? 1 : WOBBLE.scaleX,
                    scaleY: reduced ? 1 : WOBBLE.scaleY,
                    borderRadius: reduced ? '50%' : WOBBLE.radius,
                    opacity: 1,
                  }}
                  transition={{
                    duration: t.travel + t.settle,
                    times: reduced ? undefined : WOBBLE.times,
                    ease: EASE_OUT_EXPO,
                  }}
                />
              </motion.div>

              {/* Stage 2: the real mark takes over, so the held frame is exact. */}
              <motion.div
                className="absolute inset-0 grid place-items-center"
                style={{ willChange: 'transform, opacity' }}
                initial={{ opacity: 0, scale: reduced ? 1 : 0.965 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: t.resolve, delay: t.travel + t.settle, ease: EASE_OUT_EXPO }}
              >
                <QwillioLogo size={LOGO} />
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
