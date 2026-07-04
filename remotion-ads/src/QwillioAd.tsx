import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  AbsoluteFill,
  Sequence,
} from 'remotion';

// ─── Brand tokens ─────────────────────────────────────────────────────────────
const C = {
  bg: '#0A0A0F',
  brand: '#7B5CF0',
  indigo: '#6366F1',
  indigoDark: '#4338CA',
  text: '#F8F8FF',
  textSec: '#8B8BA7',
  surface: '#0D0D15',
  border: 'rgba(255,255,255,0.07)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const ease = Easing.bezier(0.16, 1, 0.3, 1); // expo-out

function spr(frame: number, fps: number, delay = 0, config = { damping: 22, stiffness: 180, mass: 0.8 }) {
  return spring({ frame: frame - delay, fps, config });
}

function fade(frame: number, from: number, to: number, start = 0, end = 20) {
  return interpolate(frame - start, [0, end - start], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease });
}

// ─── Qwillio Logo (two overlapping circles) ───────────────────────────────────
const QwillioLogo: React.FC<{ size?: number; animProgress?: number }> = ({ size = 80, animProgress = 1 }) => {
  const r = size * 0.38;
  const cx = size / 2;
  const gap = r * 0.45;
  const leftCx = cx - gap * 0.5;
  const rightCx = cx + gap * 0.5;
  const scale = interpolate(animProgress, [0, 0.6, 1], [0, 1.12, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const opacity = interpolate(animProgress, [0, 0.3], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: `scale(${scale})`, opacity }}>
      <defs>
        <radialGradient id="gl" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#818CF8" />
          <stop offset="100%" stopColor={C.indigo} />
        </radialGradient>
        <radialGradient id="gr" cx="70%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor={C.brand} />
        </radialGradient>
        <clipPath id="cl"><circle cx={leftCx} cy={cx} r={r} /></clipPath>
        <clipPath id="cr"><circle cx={rightCx} cy={cx} r={r} /></clipPath>
      </defs>
      {/* Left circle */}
      <circle cx={leftCx} cy={cx} r={r} fill="url(#gl)" opacity={0.9} />
      {/* Right circle */}
      <circle cx={rightCx} cy={cx} r={r} fill="url(#gr)" opacity={0.9} />
      {/* Intersection overlay */}
      <circle cx={rightCx} cy={cx} r={r} fill={C.indigoDark} opacity={0.55} clipPath="url(#cl)" />
      {/* Q letter */}
      <text x={leftCx - r * 0.32} y={cx + r * 0.38} fontFamily="SF Pro Display, -apple-system, system-ui, sans-serif" fontWeight="800" fontSize={r * 0.85} fill="white" letterSpacing="-1">Q</text>
      {/* W letter */}
      <text x={rightCx - r * 0.25} y={cx + r * 0.38} fontFamily="SF Pro Display, -apple-system, system-ui, sans-serif" fontWeight="800" fontSize={r * 0.72} fill="white" opacity={0.9} letterSpacing="-1">W</text>
    </svg>
  );
};

// ─── Glow blob ────────────────────────────────────────────────────────────────
const GlowBlob: React.FC<{ x: number; y: number; r: number; color: string; opacity?: number }> = ({ x, y, r, color, opacity = 0.18 }) => (
  <div style={{
    position: 'absolute',
    left: x - r, top: y - r,
    width: r * 2, height: r * 2,
    borderRadius: '50%',
    background: color,
    filter: `blur(${r * 0.7}px)`,
    opacity,
    pointerEvents: 'none',
  }} />
);

// ─── Scene 1: Logo intro (frames 0–90) ───────────────────────────────────────
const SceneLogo: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoProgress = spr(frame, fps, 8, { damping: 18, stiffness: 120, mass: 1 });
  const wordmarkOpacity = fade(frame, 0, 1, 45, 70);
  const tagOpacity = fade(frame, 0, 1, 65, 85);

  const glowScale = interpolate(frame, [0, 60], [0, 1], { extrapolateRight: 'clamp', easing: ease });

  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
      <GlowBlob x={540} y={960} r={400} color={C.brand} opacity={glowScale * 0.22} />
      <GlowBlob x={400} y={880} r={280} color={C.indigo} opacity={glowScale * 0.18} />

      <QwillioLogo size={180} animProgress={logoProgress} />

      <div style={{
        marginTop: 36,
        fontFamily: 'SF Pro Display, -apple-system, system-ui, sans-serif',
        fontSize: 64,
        fontWeight: 800,
        letterSpacing: '-2px',
        color: C.text,
        opacity: wordmarkOpacity,
      }}>
        Qwillio
      </div>

      <div style={{
        marginTop: 14,
        fontFamily: 'SF Pro Text, -apple-system, system-ui, sans-serif',
        fontSize: 28,
        fontWeight: 500,
        letterSpacing: '0.5px',
        color: C.textSec,
        opacity: tagOpacity,
      }}>
        AI Phone Receptionist
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 2: Tagline (frames 80–175) ────────────────────────────────────────
const SceneTagline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const line1Scale = spr(frame, fps, 0, { damping: 20, stiffness: 200, mass: 0.6 });
  const line2Scale = spr(frame, fps, 18, { damping: 20, stiffness: 200, mass: 0.6 });
  const subOpacity = fade(frame, 0, 1, 40, 65);

  const bgOpacity = fade(frame, 0, 1, 0, 12);

  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: bgOpacity }}>
      <GlowBlob x={700} y={800} r={350} color={C.brand} opacity={0.20} />
      <GlowBlob x={300} y={1100} r={280} color={C.indigo} opacity={0.16} />

      <div style={{ padding: '0 80px', textAlign: 'center' }}>
        <div style={{
          fontFamily: 'SF Pro Display, -apple-system, system-ui, sans-serif',
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: '-3px',
          lineHeight: 1.0,
          color: C.text,
          transform: `scale(${interpolate(line1Scale, [0, 1], [0.85, 1])}) translateY(${interpolate(line1Scale, [0, 1], [40, 0])}px)`,
          opacity: line1Scale,
        }}>
          Your calls.
        </div>

        <div style={{
          fontFamily: 'SF Pro Display, -apple-system, system-ui, sans-serif',
          fontSize: 96,
          fontWeight: 800,
          letterSpacing: '-3px',
          lineHeight: 1.05,
          marginTop: 8,
          background: `linear-gradient(135deg, ${C.indigo} 0%, ${C.brand} 60%, #A78BFA 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          transform: `scale(${interpolate(line2Scale, [0, 1], [0.85, 1])}) translateY(${interpolate(line2Scale, [0, 1], [40, 0])}px)`,
          opacity: line2Scale,
        }}>
          Automated.
        </div>

        <div style={{
          marginTop: 40,
          fontFamily: 'SF Pro Text, -apple-system, system-ui, sans-serif',
          fontSize: 30,
          fontWeight: 400,
          color: C.textSec,
          lineHeight: 1.5,
          opacity: subOpacity,
        }}>
          Never miss a lead again.
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ─── iPhone 17 Pro Max mockup ─────────────────────────────────────────────────
const IPhoneMockup: React.FC<{ children: React.ReactNode; scale?: number }> = ({ children, scale = 1 }) => {
  const W = 390 * scale;
  const H = 844 * scale;
  const R = 54 * scale;
  const borderW = 3 * scale;
  const notchW = 126 * scale;
  const notchH = 34 * scale;
  const btnW = 3 * scale;
  const btnH = 70 * scale;

  return (
    <div style={{ position: 'relative', width: W, height: H }}>
      {/* Frame */}
      <div style={{
        position: 'absolute',
        inset: 0,
        borderRadius: R,
        border: `${borderW}px solid rgba(255,255,255,0.14)`,
        background: 'linear-gradient(160deg, #1C1C2E 0%, #0D0D15 40%, #0A0A0F 100%)',
        boxShadow: `0 0 0 ${borderW}px rgba(255,255,255,0.06), 0 40px 120px rgba(0,0,0,0.7), 0 0 60px rgba(123,92,240,0.15)`,
        overflow: 'hidden',
      }}>
        {/* Screen */}
        <div style={{
          position: 'absolute',
          inset: borderW,
          borderRadius: R - borderW,
          background: C.bg,
          overflow: 'hidden',
        }}>
          {/* Dynamic Island */}
          <div style={{
            position: 'absolute',
            top: 14 * scale,
            left: '50%',
            transform: 'translateX(-50%)',
            width: notchW,
            height: notchH,
            background: '#000',
            borderRadius: notchH / 2,
            zIndex: 10,
          }} />
          {children}
        </div>
      </div>

      {/* Side buttons */}
      <div style={{ position: 'absolute', left: -btnW - 2, top: H * 0.2, width: btnW, height: btnH * 0.55, background: '#222', borderRadius: '2px 0 0 2px' }} />
      <div style={{ position: 'absolute', left: -btnW - 2, top: H * 0.3, width: btnW, height: btnH, background: '#222', borderRadius: '2px 0 0 2px' }} />
      <div style={{ position: 'absolute', left: -btnW - 2, top: H * 0.42, width: btnW, height: btnH, background: '#222', borderRadius: '2px 0 0 2px' }} />
      <div style={{ position: 'absolute', right: -btnW - 2, top: H * 0.28, width: btnW, height: btnH * 1.5, background: '#222', borderRadius: '0 2px 2px 0' }} />
    </div>
  );
};

// ─── Qwillio app UI (inside phone) ───────────────────────────────────────────
const AppUI: React.FC<{ frame: number }> = ({ frame }) => {
  const callActive = frame > 30;
  const callOpacity = fade(frame, 0, 1, 30, 48);
  const statsOpacity = fade(frame, 0, 1, 55, 75);

  const callerName = 'Sophie Martin';
  const company = 'Boulangerie du Coin';

  return (
    <div style={{ width: '100%', height: '100%', background: C.bg, paddingTop: 60, display: 'flex', flexDirection: 'column', fontFamily: 'SF Pro Text, -apple-system, system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 28, height: 28 }}>
          <QwillioLogo size={28} animProgress={1} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 700, color: C.text, letterSpacing: '-0.3px' }}>Qwillio</span>
        <div style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px #22C55E' }} />
        <span style={{ fontSize: 11, color: '#22C55E' }}>Live</span>
      </div>

      {/* Active call card */}
      <div style={{
        margin: '16px 14px 0',
        background: `linear-gradient(135deg, ${C.brand}20, ${C.indigo}15)`,
        border: `1px solid ${C.brand}40`,
        borderRadius: 20,
        padding: '18px 18px',
        opacity: callOpacity,
      }}>
        <div style={{ fontSize: 11, color: C.brand, fontWeight: 600, letterSpacing: '0.8px', marginBottom: 10 }}>APPEL EN COURS</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: `${C.brand}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, color: C.brand }}>
            {callerName[0]}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{callerName}</div>
            <div style={{ fontSize: 12, color: C.textSec, marginTop: 2 }}>{company}</div>
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 13, color: '#22C55E', fontVariantNumeric: 'tabular-nums' }}>0:32</div>
        </div>

        {/* Waveform bars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 14, height: 28 }}>
          {[0.3, 0.7, 0.5, 1.0, 0.6, 0.85, 0.45, 0.9, 0.4, 0.75, 0.55, 0.8, 0.35, 0.65, 0.5].map((h, i) => (
            <div key={i} style={{
              flex: 1,
              height: `${h * 100}%`,
              background: `${C.brand}80`,
              borderRadius: 3,
            }} />
          ))}
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: C.textSec, lineHeight: 1.5 }}>
          "Bonjour, je suis Ashley l'assistante Qwillio…"
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 10, padding: '14px 14px 0', opacity: statsOpacity }}>
        {[
          { label: "Appels auj.", value: '12', unit: '/60' },
          { label: 'Leads', value: '3', unit: 'chauds' },
          { label: 'Taux conv.', value: '24', unit: '%' },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14,
            padding: '10px 10px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, letterSpacing: '-0.5px' }}>
              {s.value}<span style={{ fontSize: 12, color: C.textSec, fontWeight: 500 }}>{s.unit}</span>
            </div>
            <div style={{ fontSize: 10, color: C.textSec, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent leads */}
      <div style={{ padding: '14px 14px 0', opacity: statsOpacity }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: C.textSec, marginBottom: 8, letterSpacing: '0.4px' }}>LEADS RÉCENTS</div>
        {[
          { name: 'Pierre Durand', type: 'Restaurant', score: 8 },
          { name: 'Marie Leblanc', type: 'Coiffure', score: 7 },
        ].map(l => (
          <div key={l.name} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 16, background: 'rgba(123,92,240,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: C.brand }}>
              {l.name[0]}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{l.name}</div>
              <div style={{ fontSize: 11, color: C.textSec }}>{l.type}</div>
            </div>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: `${C.brand}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: C.brand }}>
              {l.score}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Scene 3: iPhone reveal (frames 165–295) ─────────────────────────────────
const ScenePhone: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneEnter = spr(frame, fps, 10, { damping: 24, stiffness: 160, mass: 1.1 });
  const bgOpacity = fade(frame, 0, 1, 0, 10);

  const phoneY = interpolate(phoneEnter, [0, 1], [200, 0]);
  const phoneScale = interpolate(phoneEnter, [0, 1], [0.88, 1]);

  const labelOpacity = fade(frame, 0, 1, 55, 75);

  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: bgOpacity }}>
      <GlowBlob x={540} y={980} r={480} color={C.brand} opacity={0.16} />
      <GlowBlob x={200} y={700} r={240} color={C.indigo} opacity={0.14} />

      {/* Label above phone */}
      <div style={{
        marginBottom: 36,
        fontFamily: 'SF Pro Display, -apple-system, system-ui, sans-serif',
        fontSize: 38,
        fontWeight: 700,
        letterSpacing: '-1px',
        color: C.text,
        textAlign: 'center',
        opacity: labelOpacity,
        padding: '0 60px',
      }}>
        Votre réceptionniste<br />
        <span style={{ background: `linear-gradient(135deg, ${C.indigo}, ${C.brand})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          toujours disponible
        </span>
      </div>

      <div style={{ transform: `translateY(${phoneY}px) scale(${phoneScale})` }}>
        <IPhoneMockup scale={1.2}>
          <AppUI frame={Math.max(0, frame - 25)} />
        </IPhoneMockup>
      </div>
    </AbsoluteFill>
  );
};

// ─── Animated counter ─────────────────────────────────────────────────────────
const Counter: React.FC<{ from: number; to: number; frame: number; duration?: number; suffix?: string }> = ({
  from, to, frame, duration = 45, suffix = '',
}) => {
  const val = Math.round(interpolate(frame, [0, duration], [from, to], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease }));
  return <>{val}{suffix}</>;
};

// ─── Scene 4: Stats (frames 280–385) ─────────────────────────────────────────
const SceneStats: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = fade(frame, 0, 1, 0, 10);

  const stats = [
    { label: 'Appels / jour', from: 0, to: 60, suffix: '', color: C.brand },
    { label: 'Disponibilité', from: 0, to: 24, suffix: 'h/7j', color: C.indigo },
    { label: 'Taux de réponse', from: 0, to: 97, suffix: '%', color: '#22C55E' },
    { label: 'Setup en', from: 0, to: 5, suffix: 'min', color: '#F59E0B' },
  ];

  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: bgOpacity }}>
      <GlowBlob x={800} y={600} r={380} color={C.brand} opacity={0.18} />
      <GlowBlob x={200} y={1300} r={300} color={C.indigo} opacity={0.14} />

      <div style={{
        fontFamily: 'SF Pro Display, -apple-system, system-ui, sans-serif',
        fontSize: 52,
        fontWeight: 800,
        color: C.text,
        letterSpacing: '-2px',
        marginBottom: 64,
        textAlign: 'center',
        opacity: fade(frame, 0, 1, 0, 18),
      }}>
        Des résultats<br />
        <span style={{ background: `linear-gradient(135deg, ${C.brand}, ${C.indigo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>concrets</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 60px', width: '100%' }}>
        {stats.map((s, i) => {
          const delay = 20 + i * 18;
          const itemProgress = spr(frame, fps, delay, { damping: 20, stiffness: 220, mass: 0.7 });
          const itemY = interpolate(itemProgress, [0, 1], [50, 0]);
          const itemOpacity = interpolate(itemProgress, [0, 0.3], [0, 1], { extrapolateRight: 'clamp' });

          return (
            <div key={s.label} style={{
              transform: `translateY(${itemY}px)`,
              opacity: itemOpacity,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 22,
              padding: '24px 30px',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
            }}>
              <div style={{ flex: 1, fontSize: 20, fontWeight: 500, color: C.textSec }}>
                {s.label}
              </div>
              <div style={{ fontSize: 52, fontWeight: 800, color: s.color, letterSpacing: '-2px', fontVariantNumeric: 'tabular-nums' }}>
                <Counter from={s.from} to={s.to} frame={Math.max(0, frame - delay)} duration={40} suffix={s.suffix} />
              </div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ─── Scene 5: CTA outro (frames 375–450) ─────────────────────────────────────
const SceneCTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const bgOpacity = fade(frame, 0, 1, 0, 12);
  const logoProgress = spr(frame, fps, 8, { damping: 18, stiffness: 140, mass: 0.9 });
  const titleOpacity = fade(frame, 0, 1, 22, 40);
  const ctaProgress = spr(frame, fps, 40, { damping: 22, stiffness: 200, mass: 0.8 });
  const subtitleOpacity = fade(frame, 0, 1, 55, 72);

  const ctaScale = interpolate(ctaProgress, [0, 1], [0.85, 1]);
  const ctaY = interpolate(ctaProgress, [0, 1], [30, 0]);

  return (
    <AbsoluteFill style={{ background: C.bg, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: bgOpacity }}>
      {/* Dramatic glow */}
      <div style={{
        position: 'absolute',
        top: '35%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 700, height: 700,
        background: `radial-gradient(circle, ${C.brand}30 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <QwillioLogo size={120} animProgress={logoProgress} />

      <div style={{
        marginTop: 30,
        fontFamily: 'SF Pro Display, -apple-system, system-ui, sans-serif',
        fontSize: 72,
        fontWeight: 800,
        letterSpacing: '-3px',
        color: C.text,
        opacity: titleOpacity,
        textAlign: 'center',
      }}>
        Qwillio
      </div>

      <div style={{
        marginTop: 14,
        fontFamily: 'SF Pro Text, -apple-system, system-ui, sans-serif',
        fontSize: 26,
        color: C.textSec,
        opacity: titleOpacity,
        textAlign: 'center',
      }}>
        AI Phone Receptionist
      </div>

      {/* CTA button */}
      <div style={{
        marginTop: 64,
        transform: `scale(${ctaScale}) translateY(${ctaY}px)`,
        opacity: ctaProgress,
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${C.brand} 0%, ${C.indigo} 100%)`,
          borderRadius: 100,
          padding: '26px 72px',
          fontFamily: 'SF Pro Display, -apple-system, system-ui, sans-serif',
          fontSize: 30,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '-0.5px',
          boxShadow: `0 0 60px ${C.brand}50, 0 20px 60px rgba(0,0,0,0.4)`,
        }}>
          Essayer gratuitement
        </div>
      </div>

      <div style={{
        marginTop: 28,
        fontFamily: 'SF Pro Text, -apple-system, system-ui, sans-serif',
        fontSize: 22,
        color: C.textSec,
        opacity: subtitleOpacity,
        letterSpacing: '0.3px',
      }}>
        qwillio.com
      </div>

      {/* Bottom tagline */}
      <div style={{
        position: 'absolute',
        bottom: 80,
        fontFamily: 'SF Pro Text, -apple-system, system-ui, sans-serif',
        fontSize: 18,
        color: 'rgba(255,255,255,0.25)',
        letterSpacing: '2px',
        opacity: subtitleOpacity,
      }}>
        NEVER MISS A LEAD
      </div>
    </AbsoluteFill>
  );
};

// ─── Cross-fade transition wrapper ───────────────────────────────────────────
const CrossFade: React.FC<{ children: React.ReactNode; from: number; fadeLen?: number }> = ({ children, from, fadeLen = 12 }) => {
  const frame = useCurrentFrame() + from;
  // This is used inside a <Sequence from={...}> so frame is local
  return <>{children}</>;
};

// ─── Master composition ───────────────────────────────────────────────────────
export const QwillioAd: React.FC = () => {
  const frame = useCurrentFrame();

  // Cross-scene background fade continuity
  const scene2Opacity = fade(frame, 0, 1, 78, 92);
  const scene3Opacity = fade(frame, 0, 1, 163, 177);
  const scene4Opacity = fade(frame, 0, 1, 278, 290);
  const scene5Opacity = fade(frame, 0, 1, 373, 385);

  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {/* Scene 1: Logo (0-90) */}
      <Sequence from={0} durationInFrames={100}>
        <div style={{ opacity: frame < 78 ? 1 : interpolate(frame, [78, 95], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) }}>
          <SceneLogo />
        </div>
      </Sequence>

      {/* Scene 2: Tagline (80-175) */}
      <Sequence from={80} durationInFrames={100}>
        <div style={{ opacity: frame > 163 ? interpolate(frame, [163, 178], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : scene2Opacity }}>
          <SceneTagline />
        </div>
      </Sequence>

      {/* Scene 3: iPhone (165-295) */}
      <Sequence from={165} durationInFrames={120}>
        <div style={{ opacity: frame > 278 ? interpolate(frame, [278, 292], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : scene3Opacity }}>
          <ScenePhone />
        </div>
      </Sequence>

      {/* Scene 4: Stats (280-385) */}
      <Sequence from={280} durationInFrames={110}>
        <div style={{ opacity: frame > 373 ? interpolate(frame, [373, 387], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }) : scene4Opacity }}>
          <SceneStats />
        </div>
      </Sequence>

      {/* Scene 5: CTA (375-450) */}
      <Sequence from={375} durationInFrames={75}>
        <div style={{ opacity: scene5Opacity }}>
          <SceneCTA />
        </div>
      </Sequence>
    </AbsoluteFill>
  );
};
