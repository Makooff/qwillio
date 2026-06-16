import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Sequence,
  Video,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from 'remotion';
import { COLORS, FONT, EASE } from './theme';
import { FontLoader } from './components';
import {
  HeroV2,
  LiveCallV2,
  BrandMark,
  DotGrid,
  FocalGlow,
  appear,
  INK,
  PANEL,
  PANEL_2,
  HAIRLINE,
} from './v2';

const A = (p: string) => staticFile(`assets/${p}`);

/* shared card shell for product scenes */
const ProductCard: React.FC<{
  title: string;
  right?: React.ReactNode;
  width?: number;
  children: React.ReactNode;
}> = ({ title, right, width = 1180, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = appear(frame, fps, 6);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <FontLoader />
      <FocalGlow o={0.16} />
      <DotGrid />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width,
            opacity: interpolate(p, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(p, [0, 1], [42, 0])}px) scale(${interpolate(
              p,
              [0, 1],
              [0.96, 1]
            )})`,
            borderRadius: 28,
            background: `linear-gradient(180deg, ${PANEL}, ${PANEL_2})`,
            border: `1px solid ${HAIRLINE}`,
            boxShadow: '0 60px 160px -60px rgba(0,0,0,0.9)',
            padding: 40,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <BrandMark size={24} />
              <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 18, color: COLORS.text3 }}>
                / {title}
              </span>
            </div>
            {right}
          </div>
          <div style={{ height: 1, background: HAIRLINE, margin: '24px 0' }} />
          {children}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* generic kinetic line (mask reveal) */
const KLine: React.FC<{
  children: React.ReactNode;
  delay: number;
  size: number;
  color?: string;
  weight?: number;
}> = ({ children, delay, size, color = COLORS.text, weight = 700 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = appear(frame, fps, delay);
  return (
    <div style={{ overflow: 'hidden', paddingBottom: '0.08em' }}>
      <div
        style={{
          transform: `translateY(${interpolate(p, [0, 1], [size * 1.1, 0])}px)`,
          fontFamily: FONT,
          fontWeight: weight,
          fontSize: size,
          lineHeight: 1.02,
          letterSpacing: '-0.045em',
          color,
        }}
      >
        {children}
      </div>
    </div>
  );
};

/* ----------------------------- Problem ---------------------------------- */
const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const sub = appear(frame, fps, 52);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <FontLoader />
      <FocalGlow x="38%" y="50%" o={0.13} />
      <DotGrid />
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 130 }}>
        <div
          style={{
            opacity: interpolate(appear(frame, fps, 4), [0, 1], [0, 1]),
            marginBottom: 26,
            fontFamily: FONT,
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: COLORS.text3,
          }}
        >
          Le coût du silence
        </div>
        <KLine delay={12} size={104}>
          <span style={{ color: COLORS.indigoHi }}>1 appel sur 3</span>
        </KLine>
        <KLine delay={22} size={104}>
          reste sans réponse.
        </KLine>
        <div
          style={{
            opacity: interpolate(sub, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(sub, [0, 1], [16, 0])}px)`,
            marginTop: 30,
            maxWidth: 880,
            fontFamily: FONT,
            fontWeight: 450,
            fontSize: 32,
            lineHeight: 1.4,
            color: COLORS.text2,
          }}
        >
          Et chaque appel manqué part, en silence, chez un concurrent.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ----------------------------- Calendar fill ----------------------------- */
const CalendarFill: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'];
  const times = ['9h', '10h', '11h', '12h', '14h', '15h'];
  // filled appointments: [col, row, label, accent, delay]
  const appts: [number, number, string, string, number][] = [
    [0, 1, 'RDV', COLORS.indigo, 30],
    [1, 0, 'Rappel', COLORS.violet, 42],
    [1, 3, 'RDV', COLORS.indigo, 54],
    [2, 1, 'RDV', COLORS.indigo, 60],
    [2, 4, 'Devis', COLORS.violet, 72],
    [3, 2, 'RDV', COLORS.indigo, 84],
    [3, 5, 'Rappel', COLORS.violet, 96],
    [4, 0, 'RDV', COLORS.indigo, 102],
    [4, 3, 'RDV', COLORS.indigo, 112],
    [4, 4, 'RDV', COLORS.indigo, 120],
  ];
  const count = appts.filter((a) => frame > a[4] + 6).length;
  return (
    <ProductCard
      title="Agenda · cette semaine"
      right={
        <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 18, color: COLORS.ok }}>
          +{count} rendez-vous
        </span>
      }
    >
      <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(5, 1fr)', gap: 10 }}>
        <div />
        {days.map((d) => (
          <div
            key={d}
            style={{ fontFamily: FONT, fontWeight: 600, fontSize: 18, color: COLORS.text2, textAlign: 'center' }}
          >
            {d}
          </div>
        ))}
        {times.map((t, row) => (
          <React.Fragment key={t}>
            <div
              style={{
                fontFamily: FONT,
                fontWeight: 500,
                fontSize: 15,
                color: COLORS.text3,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 8,
              }}
            >
              {t}
            </div>
            {days.map((_, col) => {
              const ap = appts.find((a) => a[0] === col && a[1] === row);
              const p = ap ? appear(frame, fps, ap[4]) : 0;
              return (
                <div
                  key={col}
                  style={{
                    height: 46,
                    borderRadius: 9,
                    border: `1px solid ${HAIRLINE}`,
                    background: ap ? `${ap[3]}26` : 'rgba(255,255,255,0.015)',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  {ap ? (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: 12,
                        opacity: interpolate(p as number, [0, 1], [0, 1]),
                        transform: `scale(${interpolate(p as number, [0, 1], [0.8, 1])})`,
                        background: `${ap[3]}22`,
                        borderLeft: `3px solid ${ap[3]}`,
                      }}
                    >
                      <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 15, color: COLORS.text }}>
                        {ap[2]}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </ProductCard>
  );
};

/* ----------------------------- Leads / CRM ------------------------------- */
const StatusChip: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <span
    style={{
      padding: '5px 12px',
      borderRadius: 999,
      fontFamily: FONT,
      fontWeight: 600,
      fontSize: 15,
      color,
      background: `${color}1f`,
      border: `1px solid ${color}55`,
    }}
  >
    {label}
  </span>
);

const LeadsCRM: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rows: [string, string, string, string, number][] = [
    ['Camille R.', '06 12 ··· 78', 'Qualifié', COLORS.ok, 28],
    ['Atelier Vélo', '06 44 ··· 09', 'RDV pris', COLORS.indigoHi, 46],
    ['M. Bernard', '07 81 ··· 23', 'Rappel', COLORS.violet, 64],
    ['Studio Pilae', '06 70 ··· 51', 'Qualifié', COLORS.ok, 82],
    ['Léa Fontaine', '07 12 ··· 88', 'RDV pris', COLORS.indigoHi, 100],
  ];
  const count = rows.filter((r) => frame > r[4] + 6).length;
  return (
    <ProductCard
      title="Leads · aujourd'hui"
      width={1080}
      right={
        <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 18, color: COLORS.indigoHi }}>
          {count} captés
        </span>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map((r) => {
          const p = appear(frame, fps, r[4]);
          return (
            <div
              key={r[0]}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 22px',
                borderRadius: 14,
                background: 'rgba(255,255,255,0.02)',
                border: `1px solid ${HAIRLINE}`,
                opacity: interpolate(p, [0, 1], [0, 1]),
                transform: `translateX(${interpolate(p, [0, 1], [-24, 0])}px)`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 999,
                    background: 'rgba(129,140,248,0.16)',
                    border: '1px solid rgba(129,140,248,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: FONT,
                    fontWeight: 700,
                    fontSize: 16,
                    color: COLORS.indigoHi,
                  }}
                >
                  {r[0].slice(0, 1)}
                </div>
                <span style={{ fontFamily: FONT, fontWeight: 600, fontSize: 22, color: COLORS.text }}>
                  {r[0]}
                </span>
                <span
                  style={{
                    fontFamily: FONT,
                    fontWeight: 500,
                    fontSize: 18,
                    color: COLORS.text3,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {r[1]}
                </span>
              </div>
              <StatusChip label={r[2]} color={r[3]} />
            </div>
          );
        })}
      </div>
    </ProductCard>
  );
};

/* ----------------------------- Availability ------------------------------ */
const Availability: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dots = 60;
  const lit = Math.floor(interpolate(frame, [20, 110], [0, dots], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <FontLoader />
      <FocalGlow x="50%" y="40%" o={0.14} />
      <DotGrid />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 44 }}>
        <div style={{ textAlign: 'center' }}>
          <KLine delay={6} size={100}>
            Marie ne dort jamais.
          </KLine>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', width: 900, gap: 12, justifyContent: 'center' }}>
          {Array.from({ length: dots }).map((_, i) => (
            <div
              key={i}
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background: i < lit ? COLORS.indigoHi : 'rgba(255,255,255,0.06)',
                boxShadow: i < lit ? `0 0 10px ${COLORS.indigo}` : 'none',
              }}
            />
          ))}
        </div>
        <div
          style={{
            opacity: interpolate(appear(frame, fps, 36), [0, 1], [0, 1]),
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: 30,
            color: COLORS.text2,
          }}
        >
          100 appels en simultané. Jour et nuit. Week-end compris.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ----------------------------- Avatar insert ----------------------------- */
const AvatarInsert: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = appear(frame, fps, 4);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <FontLoader />
      <FocalGlow o={0.14} />
      <DotGrid />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 26 }}>
        <div
          style={{
            width: 920,
            height: 518,
            borderRadius: 22,
            overflow: 'hidden',
            border: `1px solid ${HAIRLINE}`,
            boxShadow: '0 50px 140px -60px rgba(0,0,0,0.9)',
            opacity: interpolate(p, [0, 1], [0, 1]),
            transform: `scale(${interpolate(p, [0, 1], [0.95, 1])})`,
          }}
        >
          <Video
            src={A('heygen/heygen-take1-intro.mp4')}
            volume={0}
            startFrom={20}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, opacity: interpolate(appear(frame, fps, 16), [0, 1], [0, 1]) }}>
          <BrandMark size={22} muted />
          <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 22, color: COLORS.text2 }}>
            Une vraie voix. Pas un répondeur.
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ----------------------------- Benefits / proof -------------------------- */
const Benefits: React.FC = () => {
  const lines = ['Zéro appel manqué.', 'Plus de rendez-vous.', 'Aucune charge en plus.'];
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <FontLoader />
      <FocalGlow x="50%" y="46%" o={0.14} />
      <DotGrid />
      <AbsoluteFill style={{ justifyContent: 'center', paddingLeft: 130 }}>
        {lines.map((l, i) => (
          <KLine key={l} delay={10 + i * 16} size={92} color={i === 0 ? COLORS.indigoHi : COLORS.text}>
            {l}
          </KLine>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ----------------------------- CTA --------------------------------------- */
const CTAV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const btn = appear(frame, fps, 40);
  const pulse = 1 + 0.02 * Math.sin(frame / 16);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <FontLoader />
      <FocalGlow x="50%" y="46%" o={0.18} />
      <DotGrid />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 30 }}>
        <div style={{ textAlign: 'center' }}>
          <KLine delay={8} size={96}>
            Activez Marie aujourd'hui.
          </KLine>
        </div>
        <div
          style={{
            opacity: interpolate(appear(frame, fps, 24), [0, 1], [0, 1]),
            fontFamily: FONT,
            fontWeight: 450,
            fontSize: 30,
            color: COLORS.text2,
          }}
        >
          Premier mois offert. Sans carte. Prêt en deux minutes.
        </div>
        <div
          style={{
            marginTop: 14,
            opacity: interpolate(btn, [0, 1], [0, 1]),
            transform: `scale(${interpolate(btn, [0, 1], [0.9, 1]) * pulse})`,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 14,
            padding: '24px 44px',
            borderRadius: 16,
            background: `linear-gradient(180deg, ${COLORS.indigoHi}, ${COLORS.indigo})`,
            boxShadow: `0 24px 70px -22px ${COLORS.indigo}`,
            fontFamily: FONT,
            fontWeight: 700,
            fontSize: 32,
            color: '#fff',
          }}
        >
          qwillio.com/register
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ----------------------------- End card ---------------------------------- */
const EndCardV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = appear(frame, fps, 6);
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <FontLoader />
      <FocalGlow x="50%" y="44%" o={0.16} />
      <DotGrid />
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center', gap: 26 }}>
        <div style={{ transform: `scale(${interpolate(p, [0, 1], [0.9, 1])})`, opacity: interpolate(p, [0, 1], [0, 1]) }}>
          <BrandMark size={64} />
        </div>
        <div
          style={{
            opacity: interpolate(appear(frame, fps, 22), [0, 1], [0, 1]),
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: 34,
            color: COLORS.text2,
          }}
        >
          Chaque appel répondu. Chaque lead capturé.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ------------------------------- Assembly -------------------------------- */
export const MainV2: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const edges = interpolate(
    frame,
    [0, 12, durationInFrames - 18, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  return (
    <AbsoluteFill style={{ backgroundColor: INK }}>
      <FontLoader />
      <Audio
        src={A('audio/music-bed.wav')}
        volume={(f) =>
          interpolate(f, [0, 45, durationInFrames - 60, durationInFrames], [0, 0.2, 0.2, 0], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: EASE.out,
          })
        }
      />
      {/* VO track placeholder: drop assets/audio/voiceover.wav and uncomment.
      <Audio src={A('audio/voiceover.wav')} /> */}

      <Sequence durationInFrames={120}><HeroV2 /></Sequence>
      <Sequence from={120} durationInFrames={150}><Problem /></Sequence>
      <Sequence from={270} durationInFrames={270}><LiveCallV2 /></Sequence>
      <Sequence from={540} durationInFrames={180}><CalendarFill /></Sequence>
      <Sequence from={720} durationInFrames={180}><LeadsCRM /></Sequence>
      <Sequence from={900} durationInFrames={150}><Availability /></Sequence>
      <Sequence from={1050} durationInFrames={90}><AvatarInsert /></Sequence>
      <Sequence from={1140} durationInFrames={150}><Benefits /></Sequence>
      <Sequence from={1290} durationInFrames={165}><CTAV2 /></Sequence>
      <Sequence from={1455} durationInFrames={105}><EndCardV2 /></Sequence>

      <AbsoluteFill style={{ backgroundColor: 'black', opacity: 1 - edges, pointerEvents: 'none' }} />
    </AbsoluteFill>
  );
};
