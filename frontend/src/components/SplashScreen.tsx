import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import QwillioLogo from './QwillioLogo';
import { lottieJourney } from './blobPath';
import { BLOB_FRAMES, BLOB_CIRCLE, BLOB_CENTRE } from './lottieBlob';

/**
 * Launch animation for the installed app.
 *
 * Two shapes in the mark's own colours make their way in from opposite corners
 * — one from the top left, one from the bottom right — deforming as they come,
 * meet in the middle, merge, and resolve into the logo, which holds with the
 * wordmark for a beat.
 *
 * Nothing is translated. The travel is in the outline: every vertex is redrawn
 * a little further along, so each shape makes its own way across instead of
 * being slid across by a transform. That is the difference between a blob and a
 * sticker, and it is the whole reason this file generates paths rather than
 * animating a `style`.
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
 * The box the outlines are drawn in. Wide enough that a bubble can swell and
 * still have room, and it is the same coordinate space as the mark's own 512
 * box scaled to LOGO, so a resting bubble sits exactly on its lobe.
 */
const BOX = LOGO * 1.9;
const CENTRE = BOX / 2;

interface Drop {
  key: string;
  /** The whole journey as outlines: the travel is in the path, not in a transform. */
  shapes: string[];
  /** Flat brand colour. A gradient reads as a reflection, and a bubble in a
   *  logo animation is the logo's own colour, not a rendered sphere. */
  fill: string;
}

const R = px(ORB.r);

/**
 * How far outside the box each bubble starts. Well past a phone's diagonal, so
 * the shape is genuinely off-screen at the first frame rather than parked in a
 * corner waiting to be noticed.
 */
const REACH = BOX * 2.2;

const LOBE_LEFT = CENTRE - (LOGO / 2 - BLOB.leftX - R);
const LOBE_RIGHT = CENTRE + (BLOB.rightX + R - LOGO / 2);
const LOBE_Y = CENTRE + (BLOB.top + R - LOGO / 2);

/**
 * Painted in the mark's own order: violet first, indigo over it, so the left
 * lobe is in front for the whole journey as it is in the logo.
 *
 * The outlines are the reference file's own — wide shapes with deep concave
 * notches, sampled off its played timeline rather than off its six keyframes, so
 * the deformation is the one the reference actually shows. A perturbed circle
 * cannot be any of these: no amount of nudging a radius produces a silhouette
 * that folds back into itself.
 *
 * Flat fills. A gradient on these reads as a reflection on a rendered sphere,
 * and what arrives has to be the logo's own colour — it is about to *become*
 * the logo.
 */
const DROPS: Drop[] = [
  {
    key: 'right',
    // Enters from the bottom right, far outside the box — the SVG does not
    // clip, so "outside the box" is off the screen on any phone.
    shapes: lottieJourney({
      frames: BLOB_FRAMES,
      circle: BLOB_CIRCLE,
      source: BLOB_CENTRE,
      from: { x: BOX + REACH, y: BOX + REACH },
      to: { x: LOBE_RIGHT, y: LOBE_Y },
      r: R,
      // Two bubbles in the same pose at the same moment read as one object
      // duplicated, so this one starts a third of the way into the loop.
      offset: 8,
    }),
    fill: '#CD6BFB',
  },
  {
    key: 'left',
    // From the top left, and painted over the other, as in the mark.
    shapes: lottieJourney({
      frames: BLOB_FRAMES,
      circle: BLOB_CIRCLE,
      source: BLOB_CENTRE,
      from: { x: -REACH, y: -REACH },
      to: { x: LOBE_LEFT, y: LOBE_Y },
      r: R,
    }),
    fill: '#7A5FFF',
  },
];

export default function SplashScreen({
  onDone, waitFor,
}: {
  onDone: () => void;
  /** Background work to finish before handing over. */
  waitFor?: Promise<unknown>;
}) {
  const [visible, setVisible] = useState(true);
  /**
   * The metaball filter is only switched on for the approach. Two bubbles a
   * screen apart look the same with or without it, so running it for the whole
   * animation paid a full compositing pass per frame for nothing — which is
   * what made it stutter.
   */
  const [merging, setMerging] = useState(false);
  const reduced = useReducedMotion();

  // A reduced-motion launch still confirms the app opened, it just does not fly
  // anything across the screen.
  const t = useMemo(() => (reduced
    ? { travel: 0.01, settle: 0.01, resolve: 0.2, hold: 1.2, out: 0.25 }
    // travel + settle is one continuous motion: the lobes fall and rise, pass
    // their mark, and ease back onto it. Splitting it into two tweens is what
    // makes an arrival look mechanical.
    : { travel: 1.35, settle: 0.75, resolve: 0.45, hold: 2, out: 0.5 }),
  [reduced]);

  /** When the mark is fully formed and the wordmark is up. */
  const formed = t.travel + t.settle + t.resolve;

  useEffect(() => {
    if (reduced) return;
    const id = setTimeout(() => setMerging(true), t.travel * 620);
    return () => clearTimeout(id);
  }, [reduced, t.travel]);

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
          {/*
            The two drifting blooms that used to live here are gone. They were
            two blurred layers repainting on every frame for the whole splash,
            behind an animation that needed those frames — an ambience nobody
            can look at while the mark is forming.
          */}

          <div className="relative flex flex-col items-center">
            <div className="relative" style={{ width: LOGO, height: LOGO }}>
              {/*
                Stage 1: two drops crossing the whole screen and merging.

                Elements rather than an SVG, and vh rather than viewBox units,
                because the travel is a screen-height journey. They come to rest
                exactly where the mark's lobes are, so the crossfade that
                follows lands on itself.

                The bubbles are children of the filtered box, and travel far
                outside it: the filter region below is what decides how much of
                that is drawn, and it is deliberately tight.
              */}
              <motion.div
                aria-hidden="true"
                className="absolute"
                style={{
                  left: '50%',
                  top: '50%',
                  width: LOGO * 1.9,
                  height: LOGO * 1.9,
                  marginLeft: -(LOGO * 1.9) / 2,
                  marginTop: -(LOGO * 1.9) / 2,
                  // Switched on only for the merge. Two bubbles a screen apart
                  // look identical filtered or not, so paying for the filter
                  // during the travel bought nothing and cost every frame.
                  filter: merging && !reduced ? 'url(#qw-goo)' : undefined,
                  willChange: 'opacity',
                }}
                initial={{ opacity: 1 }}
                animate={{ opacity: 0 }}
                transition={{ duration: t.resolve, delay: t.travel + t.settle, ease: 'linear' }}
              >
                <svg
                  viewBox={`0 0 ${BOX} ${BOX}`}
                  className="absolute inset-0 h-full w-full overflow-visible"
                >
                  {DROPS.map(drop => (
                    <motion.path
                      key={drop.key}
                      fill={drop.fill}
                      style={{ willChange: 'd' }}
                      initial={{ d: drop.shapes[0] }}
                      animate={{
                        // The only thing animated in the whole layer. The
                        // journey lives in the outline: every vertex is redrawn
                        // a little further along, so the shape makes its own way
                        // across rather than being slid across by a transform.
                        d: reduced ? drop.shapes[drop.shapes.length - 1] : drop.shapes,
                      }}
                      transition={{
                        duration: reduced ? 0.2 : t.travel + t.settle,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </svg>
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
