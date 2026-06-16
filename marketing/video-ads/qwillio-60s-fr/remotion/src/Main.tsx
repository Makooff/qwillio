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
  spring,
} from 'remotion';
import { COLORS, FONT, EASE, SPRING_SOFT } from './theme';
import {
  FontLoader,
  Grade,
  Grain,
  Scrim,
  RevealText,
  FadeUp,
  Kicker,
  CountUp,
  LowerThird,
  FeatureChip,
  StatCard,
  CTAButton,
  CalendarIcon,
  CheckIcon,
  PhoneIcon,
} from './components';

const A = (p: string) => staticFile(`assets/${p}`);

/* A full-frame background clip (footage), muted by default. */
const Clip: React.FC<{
  src: string;
  volume?: number;
  playbackRate?: number;
  style?: React.CSSProperties;
}> = ({ src, volume = 0, playbackRate = 1, style }) => (
  <AbsoluteFill style={style}>
    <Video
      src={src}
      volume={volume}
      playbackRate={playbackRate}
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  </AbsoluteFill>
);

/* ----------------------------- Scene 1: Hook ----------------------------- */
const Hook: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <Clip src={A('higgsfield/higgs-01-phone-ringing.mp4')} volume={0.35} />
    <Scrim to="rgba(5,6,12,0.8)" dir="to top" />
    <Grade />
    <Grain />
    <AbsoluteFill style={{ justifyContent: 'flex-end', padding: 110 }}>
      <Kicker label="Voix AI pour TPE et PME" delay={6} />
      <div style={{ height: 26 }} />
      <RevealText fontSize={86} fontWeight={700} maxWidth={1180} delay={14} lineHeight={1.06}>
        Combien d'appels avez-vous manqué cette semaine ?
      </RevealText>
    </AbsoluteFill>
  </AbsoluteFill>
);

/* --------------------------- Scene 2: Problème --------------------------- */
const Probleme: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <Clip src={A('higgsfield/higgs-02-stats-35.mp4')} playbackRate={0.5} />
    <Scrim to="rgba(5,6,12,0.82)" dir="to right" />
    <Grade />
    <Grain />
    <Audio src={A('audio/vo-segment1-probleme.wav')} startFrom={0} volume={1} />
    <AbsoluteFill style={{ justifyContent: 'center', padding: 110 }}>
      <Kicker label="Le problème" delay={8} />
      <div style={{ height: 18 }} />
      <div style={{ display: 'flex', alignItems: 'baseline' }}>
        <CountUp to={35} delay={14} dur={46} suffix=" %" fontSize={232} color={COLORS.indigoHi} />
      </div>
      <RevealText fontSize={46} fontWeight={500} color={COLORS.text2} maxWidth={1020} delay={30}>
        des appels en TPE et PME restent sans réponse.
      </RevealText>
      <div style={{ height: 26 }} />
      <Sequence from={200} layout="none">
        <RevealText fontSize={56} fontWeight={700} maxWidth={1020}>
          Vos concurrents répondent. Pas vous.
        </RevealText>
      </Sequence>
    </AbsoluteFill>
  </AbsoluteFill>
);

/* ------------------------- Scene 3: Solution intro ----------------------- */
const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pip = spring({ frame: frame - 168, fps, config: SPRING_SOFT });
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <Clip src={A('heygen/heygen-take1-intro.mp4')} volume={1} />
      <Grade vignette={0.5} />
      <Grain />
      {/* B-roll picture-in-picture insert (phone floating) */}
      <Sequence from={168}>
        <div
          style={{
            position: 'absolute',
            top: 90,
            right: 90,
            width: 600,
            height: 338,
            borderRadius: 22,
            overflow: 'hidden',
            opacity: interpolate(pip, [0, 1], [0, 1]),
            transform: `translateY(${interpolate(pip, [0, 1], [40, 0])}px) scale(${interpolate(
              pip,
              [0, 1],
              [0.92, 1]
            )})`,
            border: `1px solid rgba(129,140,248,0.3)`,
            boxShadow: `0 30px 80px -30px ${COLORS.indigo}aa`,
          }}
        >
          <Video
            src={A('higgsfield/higgs-05-phone-floating.mp4')}
            volume={0}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      </Sequence>
      <LowerThird line1="Marie" line2="Réceptionniste IA Qwillio" delay={16} />
    </AbsoluteFill>
  );
};

/* ------------------------- Scene 4: Features ----------------------------- */
const Features: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <Clip src={A('heygen/heygen-take2-features.mp4')} volume={1} />
    <Scrim to="rgba(5,6,12,0.7)" dir="to top" />
    <Grade vignette={0.5} />
    <Grain />
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 84,
        gap: 22,
      }}
    >
      <div style={{ display: 'flex', gap: 22 }}>
        <FeatureChip icon={<CalendarIcon />} label="Prend les rendez-vous" delay={34} />
        <FeatureChip icon={<CheckIcon />} label="Qualifie les prospects" delay={56} />
        <FeatureChip icon={<PhoneIcon />} label="Transfère les vraies urgences" delay={78} />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

/* ------------------------- Scene 5: Scale -------------------------------- */
const Scale: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    {/* avatar take3 for the first ~6.6s, then dataflow b-roll */}
    <Clip src={A('heygen/heygen-take3-scale.mp4')} volume={1} />
    <Sequence from={198}>
      <Clip src={A('higgsfield/higgs-04-dataflow.mp4')} volume={0} />
      <Scrim to="rgba(5,6,12,0.6)" dir="to top" />
    </Sequence>
    <Grade vignette={0.5} />
    <Grain />
    {/* compact stat top-right so it never covers the face */}
    <div style={{ position: 'absolute', top: 90, right: 96, textAlign: 'right' }}>
      <FadeUp delay={12}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end' }}>
          <CountUp to={100} delay={16} dur={40} fontSize={150} color={COLORS.indigoHi} />
        </div>
        <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 30, color: COLORS.text2 }}>
          appels en simultané
        </span>
      </FadeUp>
    </div>
    <Sequence from={150}>
      <div style={{ position: 'absolute', left: 96, bottom: 96 }}>
        <RevealText fontSize={58} fontWeight={700}>
          Sans une seule erreur.
        </RevealText>
      </div>
    </Sequence>
  </AbsoluteFill>
);

/* ------------------------- Scene 6: Preuve ------------------------------- */
const Preuve: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(120% 120% at 50% 0%, ${COLORS.bg3}, ${COLORS.bg})`,
    }}
  >
    <Grade vignette={0.5} />
    <Grain />
    <Audio src={A('audio/vo-segment2-preuve.wav')} startFrom={0} volume={1} />
    <AbsoluteFill style={{ padding: 110, justifyContent: 'center' }}>
      <Kicker label="La preuve" delay={8} />
      <div style={{ height: 22 }} />
      <RevealText fontSize={52} fontWeight={600} maxWidth={1500} delay={16} lineHeight={1.18}>
        « Marie décroche en moins d'une seconde. Nos patients pensent qu'elle fait partie de l'équipe. »
      </RevealText>
      <div style={{ height: 14 }} />
      <FadeUp delay={42}>
        <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 28, color: COLORS.text3 }}>
          Dr. Sarah Chen, Bright Dental
        </span>
      </FadeUp>
      <div style={{ height: 60 }} />
      <div style={{ display: 'flex', gap: 30 }}>
        <StatCard value="98 %" label="d'appels décrochés" delay={120} />
        <StatCard value="< 1 s" label="de temps de réponse" delay={132} />
        <StatCard value="24 / 7" label="toujours disponible" delay={144} />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

/* ------------------------- Scene 7: CTA --------------------------------- */
const CTA: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <Clip src={A('heygen/heygen-take4-cta.mp4')} volume={1} />
    <Scrim to="rgba(5,6,12,0.72)" dir="to top" />
    <Grade vignette={0.5} />
    <Grain />
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 96, gap: 26 }}>
      <Sequence from={108} layout="none">
        <FadeUp delay={0} style={{ textAlign: 'center' }}>
          <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: 30, color: COLORS.text2 }}>
            Premier mois offert. Sans carte.
          </span>
        </FadeUp>
      </Sequence>
      <Sequence from={120} layout="none">
        <CTAButton label="Créer mon compte  ·  qwillio.com/register" />
      </Sequence>
    </AbsoluteFill>
  </AbsoluteFill>
);

/* ------------------------- Scene 8: End card ---------------------------- */
const EndCard: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
    <Clip src={A('higgsfield/higgs-06-logo-reveal.mp4')} volume={0} />
    <Scrim to="rgba(5,6,12,0.78)" dir="to top" />
    <Grade vignette={0.5} />
    <Grain />
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 130 }}>
      <FadeUp delay={18} style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: FONT, fontWeight: 600, fontSize: 44, color: COLORS.text }}>
          Chaque appel répondu. Chaque lead capturé.
        </div>
        <div style={{ height: 14 }} />
        <div style={{ fontFamily: FONT, fontWeight: 500, fontSize: 28, color: COLORS.indigoHi }}>
          qwillio.com/register
        </div>
      </FadeUp>
    </AbsoluteFill>
  </AbsoluteFill>
);

/* ------------------------------- Assembly ------------------------------- */
export const Main: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const fadeEdges = interpolate(
    frame,
    [0, 12, durationInFrames - 16, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <FontLoader />
      {/* global music bed (royalty-free, generated) */}
      <Audio
        src={A('audio/music-bed.wav')}
        volume={(f) =>
          interpolate(
            f,
            [0, 45, durationInFrames - 60, durationInFrames],
            [0, 0.16, 0.16, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: EASE.out }
          )
        }
      />

      <Sequence durationInFrames={150}><Hook /></Sequence>
      <Sequence from={150} durationInFrames={300}><Probleme /></Sequence>
      <Sequence from={450} durationInFrames={240}><Intro /></Sequence>
      <Sequence from={690} durationInFrames={240}><Features /></Sequence>
      <Sequence from={930} durationInFrames={270}><Scale /></Sequence>
      <Sequence from={1200} durationInFrames={300}><Preuve /></Sequence>
      <Sequence from={1500} durationInFrames={318}><CTA /></Sequence>
      <Sequence from={1818} durationInFrames={92}><EndCard /></Sequence>

      {/* global fade from / to black */}
      <AbsoluteFill
        style={{ backgroundColor: 'black', opacity: 1 - fadeEdges, pointerEvents: 'none' }}
      />
    </AbsoluteFill>
  );
};
