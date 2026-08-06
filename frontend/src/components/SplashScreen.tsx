import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import QwillioLogo from './QwillioLogo';
import { liquidJourney } from './blobPath';

/**
 * Launch animation for the installed app.
 *
 * Two big shapes in the mark's own colours sit against the left and right edges,
 * a quarter of each already past the edge and cut off. They deform where they
 * are — swells and hollows drifting round their outlines — and then, still
 * deforming, make their way in to the middle, shrinking as they go. The
 * deformation dies away with the journey, so what arrives is two circles exactly
 * where the mark's lobes are, and the real logo takes over from there and holds
 * with the wordmark for a beat.
 *
 * Nothing is translated. The travel is in the outline: every vertex is redrawn a
 * little further along, so each shape makes its own way across instead of being
 * slid across by a transform. That is the difference between a blob and a
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
const LOBE_R = px(ORB.r);
/** How far the lobes sit either side of the mark's centre. */
const LOBE_DX = px(ORB.rightX) - LOGO / 2;

/**
 * The mark does not sit at the middle of the screen: it is the top of a column
 * that also carries the wordmark, and the column is what is centred. This is
 * that offset — the wordmark's line box plus its margin, halved — and it is what
 * the shapes have to aim at instead of the centre.
 */
const WORDMARK_LIFT = (24 + 34) / 2;

/**
 * How big the shapes are before they set off, against the shorter side of the
 * screen. Big enough that a quarter of one genuinely runs off the edge on a
 * phone, rather than looking like a ball parked in a corner.
 */
const START_R = 0.34;

interface Shape {
  key: string;
  seed: number;
  /** -1 for the shape on the left edge, 1 for the one on the right. */
  side: -1 | 1;
  /** Flat brand colour. A gradient reads as a reflection, and a shape in a logo
   *  animation is the logo's own colour, not a rendered sphere. */
  fill: string;
}

/**
 * Painted in the mark's own order: violet first, indigo over it, so the left
 * lobe is in front for the whole journey as it is in the logo.
 */
const SHAPES: Shape[] = [
  { key: 'right', seed: 21, side: 1, fill: '#CD6BFB' },
  { key: 'left', seed: 7, side: -1, fill: '#7A5FFF' },
];

/** The viewport, read once: a launch animation that reflows mid-flight would
 *  restart every path it is playing. */
function useViewport() {
  return useState(() => ({
    w: typeof window === 'undefined' ? 390 : window.innerWidth,
    h: typeof window === 'undefined' ? 844 : window.innerHeight,
  }))[0];
}

export default function SplashScreen({
  onDone, waitFor,
}: {
  onDone: () => void;
  /** Background work to finish before handing over. */
  waitFor?: Promise<unknown>;
}) {
  const [visible, setVisible] = useState(true);
  const reduced = useReducedMotion();
  const view = useViewport();

  const journeys = useMemo(() => {
    // A quarter of the width past the edge: the shape is 2r across, so half a
    // radius of it is outside and three quarters of it can be seen.
    const r0 = Math.min(view.w, view.h) * START_R;
    const mark = { x: view.w / 2, y: view.h / 2 - WORDMARK_LIFT };
    return SHAPES.map(shape => ({
      ...shape,
      frames: liquidJourney({
        from: {
          x: shape.side < 0 ? r0 / 2 : view.w - r0 / 2,
          y: view.h / 2,
        },
        to: { x: mark.x + shape.side * LOBE_DX, y: mark.y },
        r0,
        r1: LOBE_R,
        seed: shape.seed,
      }),
    }));
  }, [view.w, view.h]);

  // A reduced-motion launch still confirms the app opened, it just does not fly
  // anything across the screen.
  const t = useMemo(() => (reduced
    ? { travel: 0.01, settle: 0.01, resolve: 0.2, hold: 1.2, out: 0.25 }
    // travel + settle is one continuous motion: the shapes deform where they
    // are, come in, and ease onto their marks. Splitting it into two tweens is
    // what makes an arrival look mechanical.
    : { travel: 1.6, settle: 0.9, resolve: 0.45, hold: 2, out: 0.5 }),
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

          {/*
            Stage 1: the two shapes, in screen coordinates.

            The SVG is the viewport itself rather than a box around the logo,
            because the shapes start at the edges and have to be cut off by them.
            The viewport is the clip.
          */}
          <motion.svg
            aria-hidden="true"
            className="absolute inset-0 h-full w-full"
            viewBox={`0 0 ${view.w} ${view.h}`}
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: t.resolve, delay: t.travel + t.settle, ease: 'linear' }}
          >
            {journeys.map(shape => (
              <motion.path
                key={shape.key}
                fill={shape.fill}
                style={{ willChange: 'd' }}
                initial={{ d: shape.frames[0] }}
                animate={{
                  // The only thing animated in the whole layer. The journey
                  // lives in the outline: every vertex is redrawn a little
                  // further along, so the shape makes its own way in rather than
                  // being slid across by a transform.
                  d: reduced ? shape.frames[shape.frames.length - 1] : shape.frames,
                }}
                transition={{
                  duration: reduced ? 0.2 : t.travel + t.settle,
                  // The hold and the easing are already in the frames; another
                  // ease on top of them would fight it.
                  ease: 'linear',
                }}
              />
            ))}
          </motion.svg>

          <div className="relative flex flex-col items-center">
            <div className="relative" style={{ width: LOGO, height: LOGO }}>
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
