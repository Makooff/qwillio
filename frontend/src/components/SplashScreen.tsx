import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import QwillioLogo from './QwillioLogo';

/**
 * Launch animation for the installed app.
 *
 * The two lobes of the mark fly in from either side and meet; at the moment
 * they overlap they resolve into the real logo, so the last frame is the brand
 * mark itself rather than an approximation of it. Then the whole thing lifts
 * away and hands over to whatever route is underneath.
 *
 * Shown only when running as an installed app: on the website it would sit
 * between a visitor and the page for no reason.
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
  // Down the left edge (arc of the right circle), then up the right edge
  // (arc of the left circle); both bulge outward, hence sweep-flag 0.
  return `M ${midX} ${top} A ${ORB.r} ${ORB.r} 0 0 0 ${midX} ${bottom} A ${ORB.r} ${ORB.r} 0 0 0 ${midX} ${top} Z`;
})();

export default function SplashScreen({ onDone }: { onDone: () => void }) {
  const [visible, setVisible] = useState(true);
  const reduced = useReducedMotion();

  // A reduced-motion launch still confirms the app opened, it just does not
  // fly anything across the screen.
  const t = useMemo(
    () => (reduced
      ? { converge: 0.01, resolve: 0.2, hold: 700, out: 0.25 }
      : { converge: 0.9, resolve: 0.55, hold: 1450, out: 0.45 }),
    [reduced],
  );

  useEffect(() => {
    const id = setTimeout(() => setVisible(false), t.hold);
    return () => clearTimeout(id);
  }, [t.hold]);

  return (
    <AnimatePresence onExitComplete={onDone}>
      {visible && (
        <motion.div
          key="splash"
          className="fixed inset-0 z-[100] grid place-items-center overflow-hidden"
          style={{ background: '#0A0A0C' }}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: reduced ? 1 : 1.04 }}
          transition={{ duration: t.out, ease: EASE_DRAWER }}
          role="status"
          aria-label="Qwillio"
        >
          {/* Brand glow behind the mark, breathing slowly. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(58% 42% at 50% 46%, rgba(122,95,255,0.30) 0%, rgba(205,107,251,0.14) 42%, transparent 72%)',
            }}
            initial={{ opacity: 0, scale: 0.86 }}
            animate={{ opacity: 1, scale: reduced ? 1 : [0.86, 1.06, 1] }}
            transition={{ duration: reduced ? 0.2 : 1.7, ease: EASE_OUT_EXPO }}
          />

          <div className="relative" style={{ width: 168, height: 168 }}>
            {/* Stage 1: the two lobes travel in and meet. */}
            <motion.svg
              viewBox="0 0 512 512"
              className="absolute inset-0 h-full w-full"
              aria-hidden="true"
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: t.resolve, delay: t.converge * 0.82, ease: 'linear' }}
            >
              <motion.circle
                cx={ORB.leftX}
                cy={ORB.y}
                r={ORB.r}
                fill="#7A5FFF"
                initial={{ cx: reduced ? ORB.leftX : -40, opacity: reduced ? 1 : 0 }}
                animate={{ cx: ORB.leftX, opacity: 1 }}
                transition={{ duration: t.converge, ease: EASE_OUT_EXPO }}
              />
              <motion.circle
                cx={ORB.rightX}
                cy={ORB.y}
                r={ORB.r}
                fill="#CD6BFB"
                initial={{ cx: reduced ? ORB.rightX : 552, opacity: reduced ? 1 : 0 }}
                animate={{ cx: ORB.rightX, opacity: 1 }}
                transition={{ duration: t.converge, ease: EASE_OUT_EXPO }}
              />
              {/* The overlap the brand actually uses, revealed as they close in. */}
              <motion.path
                d={LENS}
                fill="#7349FE"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: t.converge * 0.4, delay: t.converge * 0.55 }}
              />
            </motion.svg>

            {/* Stage 2: the real mark takes over, so the held frame is exact. */}
            <motion.div
              className="absolute inset-0 grid place-items-center"
              initial={{ opacity: 0, scale: reduced ? 1 : 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: t.resolve, delay: t.converge * 0.82, ease: EASE_OUT_EXPO }}
            >
              <QwillioLogo size={168} />
            </motion.div>
          </div>

          <motion.p
            className="absolute text-[15px] font-medium tracking-[0.16em] uppercase"
            style={{ color: 'rgba(245,245,247,0.62)', bottom: '22%' }}
            initial={{ opacity: 0, y: reduced ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: t.converge + t.resolve * 0.6, ease: EASE_OUT_EXPO }}
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
