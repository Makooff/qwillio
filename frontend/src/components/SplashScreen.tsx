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
 * The bubbles arrive at roughly the size they will end at — the mark's own
 * lobes, give or take the breathing. Blowing them up to the width of a phone
 * and shrinking them down again made every frame a full-screen composite, and
 * that is what the stutter was.
 */
const TRAVEL_SCALE = 1.12;

/**
 * How a body of liquid behaves with nothing to fall onto: drawn out along its
 * path, then pulled back by surface tension, overshooting and settling. The two
 * axes are in antiphase because volume is conserved — wider always means
 * shorter — and the swings decay rather than bouncing, because there is no
 * surface to bounce off.
 *
 * The scale carries the shrink as well as the wobble: one keyframe list, so the
 * two can never disagree about where the shape is.
 */
const WOBBLE = {
  times: [0, 0.34, 0.52, 0.66, 0.78, 0.9, 1],
  scaleX: [TRAVEL_SCALE * 0.82, TRAVEL_SCALE * 0.9, TRAVEL_SCALE * 1.1, 0.94, 1.05, 0.98, 1],
  scaleY: [TRAVEL_SCALE * 1.24, TRAVEL_SCALE * 1.12, TRAVEL_SCALE * 0.9, 1.07, 0.96, 1.02, 1],
  /**
   * The outline drifts with it. A free-floating bubble is never a perfect
   * ellipse: its radii differ around the shape and keep changing, which is what
   * the eye reads as a membrane rather than as a stretched circle.
   */
  radius: [
    '54% 46% 58% 42% / 48% 56% 44% 52%',
    '42% 58% 46% 54% / 62% 44% 56% 38%',
    '58% 42% 52% 48% / 40% 58% 42% 60%',
    '48% 52% 44% 56% / 56% 46% 54% 44%',
    '52% 48% 53% 47% / 47% 52% 48% 53%',
    '49% 51% 50% 50% / 51% 49% 51% 49%',
    '50% 50% 50% 50% / 50% 50% 50% 50%',
  ],
};

/**
 * The droplets that get swallowed.
 *
 * A satellite caught by the surface it is falling towards is the clearest
 * single sign that the thing is liquid. They vanish into the mass rather than
 * fading: under the filter, shrinking next to a larger body looks like being
 * drunk by it.
 */
const SATELLITE = {
  times: [0, 0.5, 0.72, 1],
  scale: [1, 0.85, 0.4, 0],
};

interface Drop {
  key: string;
  size: number;
  /** Resting offset from the centre of the band, in pixels. */
  x: number;
  y: number;
  fill: string;
  from: string;
  travel: string[];
  delay: number;
  satellite?: boolean;
}

/**
 * Painted in the mark's own order: violet first, indigo over it. The left lobe
 * is on top in the logo, so it is on top here for the whole journey.
 *
 * The fills are three-stop gradients rather than flat colour — light gathered
 * off-centre, saturated body, a darker far side. The filter blurs them, which
 * is exactly right: the shading softens into the surface instead of sitting on
 * it like the white smear the previous version painted on top.
 */
const DROPS: Drop[] = [
  {
    key: 'satellite-right',
    size: BLOB.size * 0.26,
    x: BLOB.rightX - LOGO / 2 + BLOB.size * 0.78,
    y: BLOB.top - LOGO / 2 + BLOB.size * 0.42,
    fill: 'radial-gradient(circle at 34% 28%, #EFB2FF 0%, #CD6BFB 55%, #9B37D0 100%)',
    from: '86vh',
    travel: ['86vh', '16vh', '3vh', '0vh'],
    delay: 0.04,
    satellite: true,
  },
  {
    key: 'right',
    size: BLOB.size,
    x: BLOB.rightX - LOGO / 2,
    y: BLOB.top - LOGO / 2,
    fill: 'radial-gradient(circle at 32% 26%, #F6C8FF 0%, #E08BFF 26%, #CD6BFB 55%, #8E2FC6 100%)',
    from: '76vh',
    // Rises from below the fold, overshoots the meeting point, and drifts back.
    travel: ['76vh', '16vh', '1.5vh', '-0.6vh', '0.2vh', '0vh', '0vh'],
    // Slightly behind the left one: two objects arriving on the exact same
    // frame read as one object, not as a meeting.
    delay: 0.09,
  },
  {
    key: 'satellite-left',
    size: BLOB.size * 0.22,
    x: BLOB.leftX - LOGO / 2 - BLOB.size * 0.62,
    y: BLOB.top - LOGO / 2 - BLOB.size * 0.3,
    fill: 'radial-gradient(circle at 34% 28%, #C3B6FF 0%, #7A5FFF 55%, #4A32C4 100%)',
    from: '-84vh',
    travel: ['-84vh', '-15vh', '-2.5vh', '0vh'],
    delay: 0,
    satellite: true,
  },
  {
    key: 'left',
    size: BLOB.size,
    x: BLOB.leftX - LOGO / 2,
    y: BLOB.top - LOGO / 2,
    fill: 'radial-gradient(circle at 32% 26%, #D8D0FF 0%, #9E8CFF 26%, #7A5FFF 55%, #452BC0 100%)',
    from: '-76vh',
    travel: ['-76vh', '-16vh', '-1.5vh', '0.6vh', '-0.2vh', '0vh', '0vh'],
    delay: 0,
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
                {DROPS.map(drop => (
                  <motion.div
                    key={drop.key}
                    className="absolute"
                    style={{
                      width: drop.size,
                      height: drop.size,
                      // Positioned against the band's centre so the resting
                      // place is the lobe's own spot inside the mark.
                      left: `calc(50% + ${drop.x}px)`,
                      top: `calc(50% + ${drop.y}px)`,
                      background: drop.fill,
                      borderRadius: '50%',
                      willChange: 'transform, border-radius',
                    }}
                    initial={{
                      y: reduced ? 0 : drop.from,
                      scaleX: reduced ? 1 : drop.satellite ? SATELLITE.scale[0] : WOBBLE.scaleX[0],
                      scaleY: reduced ? 1 : drop.satellite ? SATELLITE.scale[0] : WOBBLE.scaleY[0],
                      opacity: reduced && drop.satellite ? 0 : 1,
                    }}
                    animate={{
                      y: reduced ? 0 : drop.travel,
                      scaleX: reduced ? 1 : drop.satellite ? SATELLITE.scale : WOBBLE.scaleX,
                      scaleY: reduced ? 1 : drop.satellite ? SATELLITE.scale : WOBBLE.scaleY,
                      borderRadius: reduced || drop.satellite ? '50%' : WOBBLE.radius,
                      opacity: drop.satellite && reduced ? 0 : 1,
                    }}
                    transition={{
                      duration: t.travel + t.settle,
                      delay: reduced ? 0 : drop.delay,
                      times: reduced ? undefined : drop.satellite ? SATELLITE.times : WOBBLE.times,
                      ease: EASE_OUT_EXPO,
                    }}
                  />
                ))}
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
