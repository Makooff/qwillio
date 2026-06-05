import React, { useState, useEffect } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  delayRender,
  continueRender,
  staticFile,
} from 'remotion';
import { COLORS, FONT, EASE, SPRING_SOFT, SPRING_POP } from './theme';

/* Loads the self-hosted Outfit font inside the React tree and holds the render
 * until the glyphs are ready. Reliable under concurrency (unlike a top-level
 * module delayRender). */
export const FontLoader: React.FC = () => {
  const [handle] = useState(() => delayRender('Loading Outfit font'));
  useEffect(() => {
    let cancelled = false;
    const font = new FontFace(
      'Outfit',
      `url(${staticFile('fonts/Outfit.ttf')}) format('truetype')`,
      { weight: '100 900' }
    );
    font
      .load()
      .then((loaded) => {
        document.fonts.add(loaded);
        if (!cancelled) continueRender(handle);
      })
      .catch(() => {
        if (!cancelled) continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  }, [handle]);
  return null;
};

/* ----------------------------------------------------------------------------
 * Ambient grade + grain: a unifying indigo/violet wash, vignette and film grain
 * laid over every scene so the HeyGen and Higgsfield clips read as one piece.
 * -------------------------------------------------------------------------- */
export const Grade: React.FC<{ vignette?: number }> = ({ vignette = 0.6 }) => (
  <AbsoluteFill style={{ pointerEvents: 'none' }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(62% 62% at 20% 16%, ${COLORS.indigo}26, transparent 62%)`,
        mixBlendMode: 'screen',
      }}
    />
    <AbsoluteFill
      style={{
        background: `radial-gradient(55% 55% at 84% 88%, ${COLORS.violet}22, transparent 60%)`,
        mixBlendMode: 'screen',
      }}
    />
    <AbsoluteFill
      style={{ boxShadow: `inset 0 0 340px 90px rgba(0,0,0,${vignette})` }}
    />
  </AbsoluteFill>
);

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.06 }) => {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>`;
  return (
    <AbsoluteFill
      style={{
        backgroundImage: `url("data:image/svg+xml,${svg}")`,
        opacity,
        mixBlendMode: 'soft-light',
        pointerEvents: 'none',
      }}
    />
  );
};

/* Scrim to guarantee text legibility over busy footage. */
export const Scrim: React.FC<{
  from?: string;
  to?: string;
  dir?: string;
}> = ({ from = 'rgba(5,6,12,0.0)', to = 'rgba(5,6,12,0.85)', dir = 'to top' }) => (
  <AbsoluteFill style={{ background: `linear-gradient(${dir}, ${to}, ${from})` }} />
);

/* ----------------------------------------------------------------------------
 * RevealText: a single line that rises into a clipping mask (Apple/Stripe feel).
 * -------------------------------------------------------------------------- */
export const RevealText: React.FC<{
  children: React.ReactNode;
  delay?: number;
  fontSize: number;
  fontWeight?: number;
  color?: string;
  letterSpacing?: string;
  lineHeight?: number;
  align?: React.CSSProperties['textAlign'];
  maxWidth?: number | string;
}> = ({
  children,
  delay = 0,
  fontSize,
  fontWeight = 700,
  color = COLORS.text,
  letterSpacing = '-0.02em',
  lineHeight = 1.04,
  align = 'left',
  maxWidth,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: SPRING_SOFT });
  const y = interpolate(p, [0, 1], [fontSize * 1.05, 0]);
  const op = interpolate(p, [0, 1], [0, 1]);
  return (
    <div style={{ overflow: 'hidden', paddingBottom: '0.14em', maxWidth }}>
      <div
        style={{
          transform: `translateY(${y}px)`,
          opacity: op,
          fontFamily: FONT,
          fontWeight,
          fontSize,
          color,
          lineHeight,
          letterSpacing,
          textAlign: align,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/* Fade + lift wrapper for arbitrary content. */
export const FadeUp: React.FC<{
  children: React.ReactNode;
  delay?: number;
  y?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, y = 28, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: SPRING_SOFT });
  return (
    <div
      style={{
        transform: `translateY(${interpolate(p, [0, 1], [y, 0])}px)`,
        opacity: interpolate(p, [0, 1], [0, 1]),
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/* Small uppercase kicker label with a glowing dot. */
export const Kicker: React.FC<{ label: string; delay?: number }> = ({
  label,
  delay = 0,
}) => (
  <FadeUp delay={delay} y={16} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: 999,
        background: COLORS.indigo,
        boxShadow: `0 0 16px 2px ${COLORS.indigo}`,
      }}
    />
    <span
      style={{
        fontFamily: FONT,
        fontWeight: 600,
        fontSize: 24,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: COLORS.text2,
      }}
    >
      {label}
    </span>
  </FadeUp>
);

/* Animated tabular number. */
export const CountUp: React.FC<{
  to: number;
  from?: number;
  delay?: number;
  dur?: number;
  prefix?: string;
  suffix?: string;
  fontSize: number;
  fontWeight?: number;
  color?: string;
}> = ({
  to,
  from = 0,
  delay = 0,
  dur = 42,
  prefix = '',
  suffix = '',
  fontSize,
  fontWeight = 800,
  color = COLORS.text,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [delay, delay + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: EASE.outExpo,
  });
  const v = Math.round(from + (to - from) * p);
  return (
    <span
      style={{
        fontFamily: FONT,
        fontWeight,
        fontSize,
        color,
        letterSpacing: '-0.04em',
        fontVariantNumeric: 'tabular-nums',
        lineHeight: 1,
      }}
    >
      {prefix}
      {v}
      {suffix}
    </span>
  );
};

/* Lower-third pill (no side-stripe; uses a glowing status dot per brand rules). */
export const LowerThird: React.FC<{
  line1: string;
  line2: string;
  delay?: number;
}> = ({ line1, line2, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: SPRING_SOFT });
  const x = interpolate(p, [0, 1], [-70, 0]);
  const op = interpolate(p, [0, 1], [0, 1]);
  return (
    <div
      style={{
        position: 'absolute',
        left: 96,
        bottom: 96,
        transform: `translateX(${x}px)`,
        opacity: op,
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '18px 28px 18px 22px',
        borderRadius: 16,
        background: 'rgba(12,13,20,0.82)',
        border: `1px solid rgba(129,140,248,0.22)`,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          width: 12,
          height: 12,
          borderRadius: 999,
          background: COLORS.ok,
          boxShadow: `0 0 14px 2px ${COLORS.ok}`,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 30, color: COLORS.text }}>
          {line1}
        </span>
        <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 21, color: COLORS.text2 }}>
          {line2}
        </span>
      </div>
    </div>
  );
};

/* Feature chip with icon, pops in. */
export const FeatureChip: React.FC<{
  icon: React.ReactNode;
  label: string;
  delay?: number;
}> = ({ icon, label, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: SPRING_POP });
  const s = interpolate(p, [0, 1], [0.8, 1]);
  const op = interpolate(p, [0, 1], [0, 1]);
  return (
    <div
      style={{
        transform: `scale(${s})`,
        opacity: op,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 24px',
        borderRadius: 999,
        background: 'rgba(18,19,31,0.86)',
        border: `1px solid rgba(129,140,248,0.28)`,
        boxShadow: `0 12px 40px -16px ${COLORS.indigo}66`,
      }}
    >
      <div style={{ display: 'flex', color: COLORS.indigoHi }}>{icon}</div>
      <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 28, color: COLORS.text }}>
        {label}
      </span>
    </div>
  );
};

/* Stat card with big value + label. */
export const StatCard: React.FC<{
  value: string;
  label: string;
  delay?: number;
  accent?: string;
}> = ({ value, label, delay = 0, accent = COLORS.indigoHi }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: SPRING_POP });
  const y = interpolate(p, [0, 1], [40, 0]);
  const s = interpolate(p, [0, 1], [0.92, 1]);
  const op = interpolate(p, [0, 1], [0, 1]);
  return (
    <div
      style={{
        transform: `translateY(${y}px) scale(${s})`,
        opacity: op,
        width: 360,
        padding: '40px 36px',
        borderRadius: 24,
        background: 'linear-gradient(180deg, rgba(26,27,46,0.92), rgba(12,13,20,0.92))',
        border: `1px solid rgba(129,140,248,0.22)`,
        boxShadow: `0 30px 80px -40px ${COLORS.indigo}88`,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 800,
          fontSize: 86,
          color: accent,
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 26, color: COLORS.text2 }}>
        {label}
      </span>
    </div>
  );
};

/* Pulsing CTA button. */
export const CTAButton: React.FC<{ label: string; delay?: number }> = ({
  label,
  delay = 0,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: SPRING_POP });
  const appear = interpolate(p, [0, 1], [0.85, 1]);
  const op = interpolate(p, [0, 1], [0, 1]);
  const pulse = 1 + 0.03 * Math.sin((frame - delay) / 14);
  const glow = 0.5 + 0.5 * Math.sin((frame - delay) / 14);
  return (
    <div
      style={{
        transform: `scale(${appear * pulse})`,
        opacity: op,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 16,
        padding: '26px 44px',
        borderRadius: 18,
        background: `linear-gradient(180deg, ${COLORS.indigoHi}, ${COLORS.indigo})`,
        boxShadow: `0 20px 60px -18px rgba(99,102,241,${0.45 + glow * 0.4})`,
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: 34,
        color: 'white',
      }}
    >
      {label}
      <ArrowIcon />
    </div>
  );
};

/* ----------------------------------- icons --------------------------------- */
export const CalendarIcon: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <path d="M3 9h18M8 2v4M16 2v4" />
  </svg>
);
export const CheckIcon: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M8.5 12.5l2.5 2.5 4.5-5" />
  </svg>
);
export const PhoneIcon: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 4h4l2 5-3 2a14 14 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </svg>
);
export const ArrowIcon: React.FC = () => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
