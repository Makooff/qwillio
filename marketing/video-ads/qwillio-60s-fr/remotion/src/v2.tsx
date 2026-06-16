import React from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';
import { COLORS, FONT, EASE, SPRING_SOFT, SPRING_POP } from './theme';
import { FontLoader } from './components';

/* =============================================================================
 * Qwillio v2 look-dev: product-led, kinetic typography, clean compositing.
 * No AI b-roll, no radial-glow filter, no big-number-grid, no card grid.
 * ========================================================================== */

export const INK = '#07070b';
export const PANEL = '#0e0f17';
export const PANEL_2 = '#0b0c12';
export const HAIRLINE = 'rgba(255,255,255,0.08)';

export const appear = (frame: number, fps: number, delay = 0, cfg = SPRING_SOFT) =>
  spring({ frame: frame - delay, fps, config: cfg });

/* Subtle Stripe-like dotted grid with a soft radial fade. */
export const DotGrid: React.FC = () => (
  <AbsoluteFill
    style={{
      backgroundImage:
        'radial-gradient(circle at center, rgba(255,255,255,0.05) 1px, transparent 1.4px)',
      backgroundSize: '30px 30px',
      maskImage: 'radial-gradient(75% 70% at 50% 42%, black, transparent 78%)',
      WebkitMaskImage: 'radial-gradient(75% 70% at 50% 42%, black, transparent 78%)',
    }}
  />
);

/* One restrained focal glow behind the hero element (not a full-frame wash). */
export const FocalGlow: React.FC<{ x?: string; y?: string; c?: string; o?: number }> = ({
  x = '50%',
  y = '44%',
  c = COLORS.indigo,
  o = 0.16,
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(40% 40% at ${x} ${y}, ${c}${Math.round(o * 255)
        .toString(16)
        .padStart(2, '0')}, transparent 70%)`,
    }}
  />
);

export const BrandMark: React.FC<{ size?: number; muted?: boolean }> = ({
  size = 28,
  muted,
}) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
    <span
      style={{
        width: size * 0.62,
        height: size * 0.62,
        borderRadius: size * 0.18,
        background: `linear-gradient(135deg, ${COLORS.indigoHi}, ${COLORS.violet})`,
        boxShadow: `0 6px 18px -6px ${COLORS.indigo}`,
      }}
    />
    <span
      style={{
        fontFamily: FONT,
        fontWeight: 700,
        fontSize: size,
        letterSpacing: '-0.03em',
        color: muted ? COLORS.text2 : COLORS.text,
      }}
    >
      Qwillio
    </span>
  </span>
);

const StatusPill: React.FC<{ frame: number }> = ({ frame }) => {
  const pulse = 0.55 + 0.45 * Math.sin(frame / 9);
  const secs = 9 + Math.floor(frame / 30);
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 14px',
        borderRadius: 999,
        background: 'rgba(52,211,153,0.10)',
        border: '1px solid rgba(52,211,153,0.28)',
      }}
    >
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          background: COLORS.ok,
          boxShadow: `0 0 ${6 + pulse * 8}px ${COLORS.ok}`,
        }}
      />
      <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 17, color: COLORS.ok }}>
        En ligne
      </span>
      <span
        style={{
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: 17,
          color: COLORS.text2,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        00:{String(secs).padStart(2, '0')}
      </span>
    </div>
  );
};

const Waveform: React.FC<{ frame: number; bars?: number; width?: number }> = ({
  frame,
  bars = 42,
  width = 560,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5, height: 64, width }}>
    {Array.from({ length: bars }).map((_, i) => {
      const env = 0.35 + 0.65 * Math.abs(Math.sin(i / bars * Math.PI));
      const h = 6 + env * 52 * (0.5 + 0.5 * Math.sin(frame / 4 + i * 0.55));
      const t = i / (bars - 1);
      const col = i % 2 === 0 ? COLORS.indigoHi : COLORS.violet;
      return (
        <div
          key={i}
          style={{
            width: 5,
            height: Math.max(5, h),
            borderRadius: 3,
            background: col,
            opacity: 0.55 + 0.45 * env,
          }}
        />
      );
    })}
  </div>
);

const ChatLine: React.FC<{
  who: 'Marie' | 'Client';
  text: string;
  delay: number;
}> = ({ who, text, delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = appear(frame, fps, delay);
  const isAI = who === 'Marie';
  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        alignItems: 'flex-start',
        opacity: interpolate(p, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(p, [0, 1], [14, 0])}px)`,
      }}
    >
      <span
        style={{
          flex: 'none',
          marginTop: 4,
          padding: '4px 10px',
          borderRadius: 8,
          fontFamily: FONT,
          fontWeight: 600,
          fontSize: 15,
          color: isAI ? '#fff' : COLORS.text2,
          background: isAI ? COLORS.indigo : 'rgba(255,255,255,0.06)',
        }}
      >
        {who}
      </span>
      <span style={{ fontFamily: FONT, fontWeight: 450, fontSize: 23, lineHeight: 1.4, color: COLORS.text }}>
        {text}
      </span>
    </div>
  );
};

const CalIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="3" />
    <path d="M3 9h18M8 2v4M16 2v4" />
  </svg>
);
const Check: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12.5l5 5L20 6" />
  </svg>
);

const ActionPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const slot = appear(frame, fps, 120);
  const confirmed = frame > 168;
  const crm = appear(frame, fps, 196);
  return (
    <div
      style={{
        width: 380,
        alignSelf: 'stretch',
        borderRadius: 18,
        background: PANEL_2,
        border: `1px solid ${HAIRLINE}`,
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: COLORS.indigoHi }}>
        <CalIcon />
        <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 19, color: COLORS.text }}>
          Rendez-vous
        </span>
      </div>
      <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 17, color: COLORS.text2 }}>
        Jeudi 12 juin
      </div>
      <div
        style={{
          opacity: interpolate(slot, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(slot, [0, 1], [12, 0])}px)`,
          padding: '16px 18px',
          borderRadius: 12,
          background: confirmed ? 'rgba(52,211,153,0.10)' : 'rgba(99,102,241,0.12)',
          border: `1px solid ${confirmed ? 'rgba(52,211,153,0.4)' : 'rgba(99,102,241,0.4)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'none',
        }}
      >
        <span style={{ fontFamily: FONT, fontWeight: 700, fontSize: 26, color: COLORS.text }}>
          14:30
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 16,
            color: confirmed ? COLORS.ok : COLORS.indigoHi,
          }}
        >
          {confirmed ? (
            <>
              <Check /> Confirmé
            </>
          ) : (
            'Proposé'
          )}
        </span>
      </div>
      <div
        style={{
          opacity: interpolate(crm, [0, 1], [0, 1]),
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: COLORS.text2,
          fontFamily: FONT,
          fontWeight: 500,
          fontSize: 16,
        }}
      >
        <span style={{ color: COLORS.ok, display: 'inline-flex' }}>
          <Check />
        </span>
        Fiche client ajoutée au CRM
      </div>
    </div>
  );
};

/* ------------------------------- Scene: Live call ------------------------- */
export const LiveCallV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const card = appear(frame, fps, 6, SPRING_POP);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <FontLoader />
      <FocalGlow o={0.18} />
      <DotGrid />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 1240,
            transform: `translateY(${interpolate(card, [0, 1], [40, 0])}px) scale(${interpolate(
              card,
              [0, 1],
              [0.96, 1]
            )})`,
            opacity: interpolate(card, [0, 1], [0, 1]),
            borderRadius: 28,
            background: `linear-gradient(180deg, ${PANEL}, ${PANEL_2})`,
            border: `1px solid ${HAIRLINE}`,
            boxShadow: '0 60px 160px -60px rgba(0,0,0,0.9)',
            padding: 40,
          }}
        >
          {/* header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <BrandMark size={26} />
            <StatusPill frame={frame} />
          </div>
          <div style={{ height: 1, background: HAIRLINE, margin: '26px 0' }} />
          {/* body */}
          <div style={{ display: 'flex', gap: 34 }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 999,
                    background: `linear-gradient(135deg, ${COLORS.indigoHi}, ${COLORS.violet})`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                  }}
                >
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 4h4l2 5-3 2a14 14 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 16, color: COLORS.text2 }}>
                    Appel entrant
                  </span>
                  <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 24, color: COLORS.text, fontVariantNumeric: 'tabular-nums' }}>
                    +33 6 12 34 56 78
                  </span>
                </div>
              </div>
              <Waveform frame={frame} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
                <ChatLine who="Marie" text="Bonjour, Qwillio à votre écoute. Comment puis-je vous aider ?" delay={30} />
                <ChatLine who="Client" text="Je voudrais un rendez-vous jeudi après-midi." delay={70} />
                <ChatLine who="Marie" text="Parfait. J'ai jeudi à 14h30, je vous le réserve ?" delay={112} />
              </div>
            </div>
            <ActionPanel />
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------- Scene: Hero ----------------------------- */
const HeroLine: React.FC<{ children: React.ReactNode; delay: number; color?: string }> = ({
  children,
  delay,
  color = COLORS.text,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = appear(frame, fps, delay);
  return (
    <div style={{ overflow: 'hidden', paddingBottom: '0.06em' }}>
      <div
        style={{
          transform: `translateY(${interpolate(p, [0, 1], [130, 0])}px)`,
          fontFamily: FONT,
          fontWeight: 700,
          fontSize: 118,
          lineHeight: 1.0,
          letterSpacing: '-0.045em',
          color,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export const HeroV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const k = appear(frame, fps, 4);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <FontLoader />
      <FocalGlow x="50%" y="52%" o={0.14} />
      <DotGrid />
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 130 }}>
        <div
          style={{
            opacity: interpolate(k, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(k, [0, 1], [12, 0])}px)`,
            marginBottom: 30,
          }}
        >
          <BrandMark size={26} muted />
        </div>
        <HeroLine delay={14}>Vous ne manquerez plus</HeroLine>
        <HeroLine delay={26} color={COLORS.indigoHi}>jamais un appel.</HeroLine>
        <div
          style={{
            opacity: interpolate(appear(frame, fps, 48), [0, 1], [0, 1]),
            marginTop: 34,
            maxWidth: 880,
            fontFamily: FONT,
            fontWeight: 450,
            fontSize: 34,
            lineHeight: 1.4,
            color: COLORS.text2,
          }}
        >
          Une réceptionniste IA qui répond en une seconde, prend les rendez-vous et qualifie vos prospects. Jour et nuit.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
