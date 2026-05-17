import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Phone, BarChart2, Clock, Shield } from 'lucide-react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { useSEO } from '../hooks/useSEO';
import QwillioLogo from '../components/QwillioLogo';

/* ─────────────────────────────────────────────────────
   Design tokens — Indigo-drenched dark
   Scene: directeur commercial B2B, Lyon, 15h, MacBook
   ───────────────────────────────────────────────────── */
const D = {
  bg:        'oklch(8% 0.009 265)',
  bg2:       'oklch(11% 0.013 265)',
  bg3:       'oklch(15% 0.017 265)',
  bgLight:   'oklch(96% 0.010 55)',
  border:    'oklch(22% 0.012 265 / 0.55)',
  borderHi:  'oklch(30% 0.014 265 / 0.70)',
  text:      'oklch(95% 0.004 265)',
  text2:     'oklch(65% 0.007 265)',
  text3:     'oklch(42% 0.006 265)',
  accent:    'oklch(56% 0.22 264)',
  accentHi:  'oklch(63% 0.21 264)',
  accentDim: 'oklch(56% 0.22 264 / 0.12)',
  accentBrd: 'oklch(56% 0.22 264 / 0.40)',
  violet:    'oklch(67% 0.26 299)',
  violetDim: 'oklch(67% 0.26 299 / 0.12)',
  ok:        'oklch(72% 0.18 145)',
  okDim:     'oklch(72% 0.18 145 / 0.12)',
  lText:     'oklch(12% 0.006 0)',
  lText2:    'oklch(40% 0.006 0)',
  lBorder:   'oklch(84% 0.012 55)',
  lPanel:    'oklch(91% 0.012 55)',
} as const;

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

/* ─────────────────────────────────────────────────────
   FadeIn — scroll reveal. scale(0.98) → scale(1).
   ───────────────────────────────────────────────────── */
function FadeIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.06 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.98)',
        transition: `opacity 0.65s ${EASE} ${delay}ms, transform 0.65s ${EASE} ${delay}ms`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   MagneticBtn — spring physics on hover.
   stiffness 280 damping 18 mass 0.8
   ───────────────────────────────────────────────────── */
function MagneticBtn({
  to,
  children,
  variant = 'primary',
}: {
  to: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 280, damping: 18, mass: 0.8 });
  const sy = useSpring(y, { stiffness: 280, damping: 18, mass: 0.8 });

  function onMove(e: React.MouseEvent<HTMLAnchorElement>) {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.22);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.22);
  }

  const primaryStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: D.accent,
    color: D.bg,
    fontFamily: 'Outfit, system-ui, sans-serif',
    fontSize: 15,
    fontWeight: 700,
    padding: '14px 28px',
    borderRadius: 14,
    textDecoration: 'none',
    letterSpacing: '0.01em',
    boxShadow: `0 4px 20px ${D.accentDim}, 0 0 0 1px ${D.accentBrd}`,
    cursor: 'pointer',
    userSelect: 'none',
  };

  const ghostStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: 'transparent',
    color: D.text2,
    fontFamily: 'Outfit, system-ui, sans-serif',
    fontSize: 15,
    fontWeight: 500,
    padding: '13px 24px',
    borderRadius: 14,
    border: `1.5px solid ${D.border}`,
    textDecoration: 'none',
    cursor: 'pointer',
    userSelect: 'none',
  };

  return (
    <motion.a
      ref={ref}
      href={to}
      style={{
        ...(variant === 'primary' ? primaryStyle : ghostStyle),
        x: sx,
        y: sy,
      }}
      onMouseMove={onMove}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      whileHover={variant === 'primary' ? { background: D.accentHi } : { borderColor: D.accent, color: D.accent }}
      whileTap={{ scale: 0.97, transition: { duration: 0.1 } }}
    >
      {children}
    </motion.a>
  );
}

/* ─────────────────────────────────────────────────────
   Live Call Demo — animated transcript cycling 3 sets
   ───────────────────────────────────────────────────── */
const SETS = [
  [
    { r: 'ai', t: `Bonjour, je suis l'assistante IA de Veritas Solutions. Vous êtes bien M. Mercier ?` },
    { r: 'h',  t: `Oui c'est moi.` },
    { r: 'ai', t: `Parfait. Je vous appelle pour votre besoin CRM. Vous avez 5 minutes ?` },
  ],
  [
    { r: 'ai', t: `Bonjour, j'appelle pour Apex Agency. Votre demande date de 3 jours, j'avais une question.` },
    { r: 'h',  t: `Oui, allez-y.` },
    { r: 'ai', t: `Votre équipe fait combien d'appels par semaine actuellement ?` },
  ],
  [
    { r: 'ai', t: `Bonjour Mme Fontaine, c'est Aria pour Kairos Conseil. Votre demande signale que vous prospectez manuellement.` },
    { r: 'h',  t: `C'est ça, c'est chronophage.` },
    { r: 'ai', t: `Je comprends. Nos clients récupèrent 2h par jour en moyenne. Je vous envoie un exemple ?` },
  ],
];

const PROSPECTS = [
  { initials: 'RM', name: 'René Mercier',   company: 'Axiom Group' },
  { initials: 'CB', name: 'Clara Bertrand', company: 'Nexum Partners' },
  { initials: 'MF', name: 'M. Fontaine',    company: 'ImmoPro Lyon' },
];

function LiveCallDemo() {
  const [setIdx, setSetIdx] = useState(0);
  const [lineIdx, setLineIdx] = useState(0);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const lines = SETS[setIdx];
    if (lineIdx >= lines.length) {
      const t = setTimeout(() => {
        setSetIdx(i => (i + 1) % SETS.length);
        setLineIdx(0);
      }, 3200);
      return () => clearTimeout(t);
    }
    setTyping(true);
    const dur = SETS[setIdx][lineIdx].r === 'ai' ? 900 : 600;
    const t1 = setTimeout(() => setTyping(false), dur);
    const t2 = setTimeout(() => setLineIdx(i => i + 1), dur + 350);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [setIdx, lineIdx]);

  const prospect = PROSPECTS[setIdx];
  const visible = SETS[setIdx].slice(0, lineIdx);

  return (
    <div
      aria-label="Démonstration d'un appel IA en cours"
      style={{
        background: D.bg2,
        border: `1px solid ${D.border}`,
        borderRadius: 24,
        padding: '1.8rem',
        boxShadow: `0 32px 80px oklch(0% 0 0 / 0.5), 0 0 0 1px oklch(100% 0 0 / 0.04)`,
        maxWidth: 400,
        width: '100%',
      }}
    >
      {/* Live badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '1.2rem' }}>
        <span
          aria-live="polite"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: D.okDim, color: D.ok,
            fontSize: 11, fontWeight: 700,
            padding: '4px 10px', borderRadius: 999,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}
        >
          <span style={{
            width: 5, height: 5, background: D.ok, borderRadius: '50%',
            animation: 'livePulse 1.6s ease-in-out infinite',
          }} aria-hidden="true" />
          En direct
        </span>
        <span style={{ fontSize: 12, color: D.text3 }}>Appel en cours</span>
      </div>

      {/* Caller info */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '1.2rem' }}>
        <div
          aria-hidden="true"
          style={{
            width: 42, height: 42,
            background: D.accentDim, border: `1px solid ${D.accentBrd}`,
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: D.accent, fontSize: 13, fontWeight: 700, flexShrink: 0,
          }}
        >
          {prospect.initials}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: D.text }}>{prospect.name}</div>
          <div style={{ fontSize: 12, color: D.text3 }}>{prospect.company}</div>
        </div>
        <Phone size={16} style={{ color: D.accent, marginLeft: 'auto' }} aria-hidden="true" />
      </div>

      {/* Transcript */}
      <div
        role="log"
        aria-label="Transcription de l'appel"
        style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 160, marginBottom: '1rem' }}
      >
        {visible.map((line, i) => (
          <div key={i}>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: line.r === 'ai' ? D.accent : D.text3,
              marginBottom: 3,
            }}>
              {line.r === 'ai' ? 'Qwillio IA' : 'Prospect'}
            </div>
            <div style={{
              padding: '8px 12px', borderRadius: 10,
              fontSize: 13, lineHeight: 1.5,
              color: 'oklch(85% 0.005 265)',
              background: line.r === 'ai' ? D.accentDim : D.bg3,
              border: line.r === 'ai' ? `1px solid ${D.accentBrd}` : `1px solid ${D.border}`,
            }}>
              {line.t}
            </div>
          </div>
        ))}
        {typing && (
          <div aria-label="L'IA est en train de répondre">
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
              textTransform: 'uppercase', color: D.accent, marginBottom: 3,
            }}>
              Qwillio IA
            </div>
            <div style={{
              padding: '10px 14px', borderRadius: 10,
              background: D.accentDim, border: `1px solid ${D.accentBrd}`,
              display: 'inline-flex', gap: 4, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <span key={i} aria-hidden="true" style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: D.accent, opacity: 0.7,
                  animation: `typingDot 1s ${EASE} ${i * 120}ms infinite`,
                }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Waveform */}
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28 }}>
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} style={{
            flex: 1, background: D.accent, borderRadius: 999, opacity: 0.5,
            animation: `waveBar 1.1s ${EASE} ${i * 55}ms infinite alternate`,
          }} />
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Step visual panel — stylized mock-UI for features
   ───────────────────────────────────────────────────── */
function StepPanel({ step }: { step: number }) {
  if (step === 0) {
    return (
      <div style={{
        background: D.lPanel, border: `1px solid ${D.lBorder}`,
        borderRadius: 20, padding: '2.5rem',
        display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: D.lText2, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          Import CSV
        </div>
        {['Dupont SAS — 06 12 34 56 78', 'Martine Leclerc — 06 98 76 54 32', 'Kairos Tech — 01 23 45 67 89'].map((r, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 10,
            background: 'oklch(96% 0.010 55)',
            border: `1px solid ${D.lBorder}`,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: i < 2 ? D.ok : 'oklch(72% 0.15 45)',
            }} aria-hidden="true" />
            <span style={{ fontSize: 13, color: D.lText }}>{r}</span>
            <span style={{
              marginLeft: 'auto', fontSize: 10, fontWeight: 700,
              color: i < 2 ? D.ok : 'oklch(60% 0.15 45)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {i < 2 ? 'Valide' : 'Doublon'}
            </span>
          </div>
        ))}
        <div style={{ marginTop: 4, fontSize: 12, color: D.lText2 }}>
          847 contacts importés — 12 doublons supprimés
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div style={{
        background: D.bg2, border: `1px solid ${D.border}`,
        borderRadius: 20, padding: '2.5rem',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: D.okDim, color: D.ok,
            fontSize: 10, fontWeight: 700,
            padding: '3px 10px', borderRadius: 999,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            <span style={{ width: 4, height: 4, background: D.ok, borderRadius: '50%', animation: 'livePulse 1.6s ease-in-out infinite' }} aria-hidden="true" />
            14 appels en cours
          </span>
        </div>
        {[
          { name: 'Dupont SAS',   score: 87, label: 'Chaud' },
          { name: 'Tech Innov.',  score: 62, label: 'Tiède' },
          { name: 'Kairos Group', score: 41, label: 'Froid' },
        ].map((item, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 14px', borderRadius: 10,
            background: D.bg3, border: `1px solid ${D.border}`,
          }}>
            <span style={{ fontSize: 13, color: D.text, flex: 1 }}>{item.name}</span>
            <div style={{ flex: 2, height: 5, background: D.border, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{
                width: `${item.score}%`, height: '100%', borderRadius: 999,
                background: item.score > 75 ? D.ok : item.score > 50 ? 'oklch(72% 0.15 45)' : D.text3,
              }} />
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, color: item.score > 75 ? D.ok : item.score > 50 ? 'oklch(72% 0.15 45)' : D.text3,
              minWidth: 36, textAlign: 'right',
            }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div style={{
      background: D.lPanel, border: `1px solid ${D.lBorder}`,
      borderRadius: 20, padding: '2.5rem',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: D.lText2, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        Leads chauds du jour
      </div>
      {[
        { name: 'Dupont SAS', action: 'Rappeler avant 17h', tag: 'RDV suggéré' },
        { name: 'Nova Partners', action: 'Envoyer démo vidéo', tag: 'Intéressé' },
      ].map((lead, i) => (
        <div key={i} style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'oklch(96% 0.010 55)', border: `1px solid ${D.lBorder}`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: D.lText }}>{lead.name}</span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: 'oklch(56% 0.22 264 / 0.10)', color: 'oklch(42% 0.18 264)',
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {lead.tag}
            </span>
          </div>
          <p style={{ fontSize: 12, color: D.lText2, margin: 0 }}>{lead.action}</p>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Stars component
   ───────────────────────────────────────────────────── */
function Stars({ size = 14 }: { size?: number }) {
  return (
    <div style={{ display: 'flex', gap: 3 }} aria-label="5 étoiles sur 5">
      {[0, 1, 2, 3, 4].map(i => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={D.accent} aria-hidden="true">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Main page
   ───────────────────────────────────────────────────── */
export default function Landing() {
  useSEO({ title: `Qwillio — L'IA vocale qui prospecte pour vous` });

  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <div style={{
      background: D.bg,
      color: D.text,
      fontFamily: `'Outfit', system-ui, -apple-system, sans-serif`,
      overflowX: 'hidden',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <style>{`
        @keyframes livePulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.3; transform: scale(0.7); }
        }
        @keyframes waveBar {
          0%   { height: 15%; }
          100% { height: 100%; }
        }
        @keyframes typingDot {
          0%, 100% { transform: translateY(0); opacity: 0.7; }
          50%       { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes marquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>

      {/* Skip link */}
      <a
        href="#main-content"
        style={{
          position: 'absolute', top: -40, left: 8,
          background: D.accent, color: D.bg,
          padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 14,
          zIndex: 200, textDecoration: 'none',
          transition: `top 0.2s ${EASE}`,
        }}
        onFocus={e => { e.currentTarget.style.top = '8px'; }}
        onBlur={e => { e.currentTarget.style.top = '-40px'; }}
      >
        Aller au contenu principal
      </a>

      {/* ── NAV ── */}
      <header
        role="banner"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          padding: scrolled ? '0.7rem 0' : '1.3rem 0',
          background: scrolled ? `oklch(8% 0.009 265 / 0.92)` : 'transparent',
          backdropFilter: scrolled ? 'blur(20px) saturate(160%)' : 'none',
          borderBottom: scrolled ? `1px solid ${D.border}` : '1px solid transparent',
          transition: `all 0.35s ${EASE}`,
        }}
      >
        <div style={{
          maxWidth: 1200, margin: '0 auto',
          padding: '0 2.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <Link
            to="/"
            aria-label="Qwillio — retour à l'accueil"
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 18, fontWeight: 800, color: D.text,
              letterSpacing: '-0.025em', textDecoration: 'none',
            }}
          >
            <QwillioLogo size={26} />
            Qwillio
          </Link>

          <nav aria-label="Navigation principale" style={{ display: 'flex', gap: '2.5rem' }}>
            {[
              ['Fonctionnalités', '#features'],
              ['Tarifs', '#pricing'],
              ['Blog', '/blog'],
            ].map(([label, href]) => (
              <a
                key={label}
                href={href}
                style={{ fontSize: 14, color: D.text2, textDecoration: 'none', fontWeight: 500, transition: `color 0.2s` }}
                onMouseEnter={e => (e.currentTarget.style.color = D.text)}
                onMouseLeave={e => (e.currentTarget.style.color = D.text2)}
              >
                {label}
              </a>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link
              to="/login"
              style={{ fontSize: 14, color: D.text2, textDecoration: 'none', fontWeight: 500, transition: `color 0.2s` }}
              onMouseEnter={e => (e.currentTarget.style.color = D.text)}
              onMouseLeave={e => (e.currentTarget.style.color = D.text2)}
            >
              Connexion
            </Link>
            <Link
              to="/register"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: D.accent, color: D.bg,
                fontSize: 13, fontWeight: 700,
                padding: '8px 20px', borderRadius: 10,
                textDecoration: 'none', letterSpacing: '0.01em',
                transition: `background 0.2s, transform 0.15s ${EASE}`,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = D.accentHi; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = D.accent; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              Essai gratuit
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content">
        {/* ── HERO ── */}
        <section
          aria-labelledby="hero-heading"
          style={{
            minHeight: '100dvh',
            display: 'grid',
            gridTemplateColumns: '1fr 420px',
            gap: '4rem',
            alignItems: 'center',
            maxWidth: 1200, margin: '0 auto',
            padding: '8rem 2.5rem 5rem',
            position: 'relative',
          }}
        >
          {/* Ambient glow */}
          <div aria-hidden="true" style={{
            position: 'absolute', top: '25%', left: '-10%',
            width: 600, height: 600,
            background: `radial-gradient(ellipse at center, oklch(56% 0.22 264 / 0.06) 0%, transparent 70%)`,
            pointerEvents: 'none', zIndex: 0,
          }} />

          <div style={{ position: 'relative', zIndex: 1 }}>
            {/* Badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: D.accentDim, border: `1px solid ${D.accentBrd}`,
              color: D.accent,
              fontSize: 11, fontWeight: 700,
              padding: '6px 14px', borderRadius: 999,
              marginBottom: '2rem',
              textTransform: 'uppercase', letterSpacing: '0.09em',
            }}>
              <span aria-hidden="true" style={{
                width: 5, height: 5, background: D.accent, borderRadius: '50%',
                animation: 'livePulse 2s ease-in-out infinite',
              }} />
              IA Vocale B2B — France
            </div>

            {/* H1 — weight contrast, no gradient text */}
            <h1
              id="hero-heading"
              style={{
                fontSize: 'clamp(3rem, 5.5vw, 5rem)',
                fontWeight: 800,
                lineHeight: 1.0,
                letterSpacing: '-0.045em',
                color: D.text,
                marginBottom: '1.5rem',
              }}
            >
              Vos prospects<br />
              appelés la nuit.<br />
              <span style={{ color: D.accent }}>Rendez-vous pris.</span>
            </h1>

            <p style={{
              fontSize: 17, color: D.text2,
              lineHeight: 1.65, maxWidth: 420,
              marginBottom: '2.5rem', fontWeight: 400,
            }}>
              Qwillio automatise les appels froids pour les agences B2B françaises.
              Premiers appels en 10 minutes, premiers rendez-vous le jour même.
            </p>

            {/* Dual CTA */}
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '3rem' }}>
              <MagneticBtn to="/register">
                Commencer gratuitement
                <ArrowRight size={16} aria-hidden="true" />
              </MagneticBtn>
              <MagneticBtn to="#features" variant="ghost">
                Voir comment ça marche
              </MagneticBtn>
            </div>

            {/* 3 inline proof numbers — NOT hero-metric card grid */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2rem', flexWrap: 'wrap' }}>
              {[
                { val: '47',      lbl: 'agences actives' },
                { val: '12 800+', lbl: 'appels cette semaine' },
                { val: '4.8/5',   lbl: 'satisfaction client' },
              ].reduce((acc, s, i) => {
                if (i > 0) acc.push(
                  <div key={`div-${i}`} aria-hidden="true" style={{ width: 1, height: 32, background: D.border }} />
                );
                acc.push(
                  <div key={s.val} style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: 22, fontWeight: 800, color: D.text, letterSpacing: '-0.03em', lineHeight: 1 }}>
                      {s.val}
                    </span>
                    <span style={{ fontSize: 12, color: D.text3, fontWeight: 500, marginTop: 2 }}>
                      {s.lbl}
                    </span>
                  </div>
                );
                return acc;
              }, [] as React.ReactNode[])}
            </div>
          </div>

          {/* Live call demo (right column) */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <motion.div
              initial={{ opacity: 0, y: 24, rotate: -1 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            >
              <LiveCallDemo />
            </motion.div>
          </div>
        </section>

        {/* ── TRUST MARQUEE ── */}
        <div
          aria-label="Agences qui utilisent Qwillio"
          style={{
            borderTop: `1px solid ${D.border}`,
            borderBottom: `1px solid ${D.border}`,
            padding: '1.5rem 0',
            overflow: 'hidden',
            background: D.bg2,
          }}
        >
          <div style={{ display: 'flex', animation: 'marquee 22s linear infinite', width: 'max-content' }}>
            {[0, 1].map(outer => (
              <div key={outer} aria-hidden={outer === 1} style={{ display: 'flex', alignItems: 'center', gap: '4rem', padding: '0 2rem' }}>
                {[
                  'Propulse Agency', 'Axion Partners', 'ImmoPro Lyon',
                  'Kairos Conseil', 'Veritas Group', 'Nova Recrutement',
                  'Ares Consulting', 'Lumia Solutions', 'Crest Agency',
                ].map(name => (
                  <span key={name} style={{
                    fontSize: 13, fontWeight: 600, color: D.text3,
                    letterSpacing: '0.02em', whiteSpace: 'nowrap',
                  }}>
                    {name}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* ── HOW IT WORKS — zigzag, NOT identical 3-col cards ── */}
        <section
          id="features"
          aria-labelledby="features-heading"
          style={{ padding: '8rem 2.5rem', background: D.bgLight }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <FadeIn>
              <div style={{ marginBottom: '5rem' }}>
                <div style={{
                  display: 'inline-block',
                  background: 'oklch(56% 0.22 264 / 0.10)',
                  color: 'oklch(42% 0.18 264)',
                  fontSize: 11, fontWeight: 700,
                  padding: '5px 14px', borderRadius: 999,
                  textTransform: 'uppercase', letterSpacing: '0.09em',
                  marginBottom: '1rem',
                }}>
                  Comment ça marche
                </div>
                <h2
                  id="features-heading"
                  style={{
                    fontSize: 'clamp(2rem, 4vw, 3.2rem)',
                    fontWeight: 800, letterSpacing: '-0.035em',
                    color: D.lText, lineHeight: 1.1, marginBottom: '1rem',
                  }}
                >
                  Trois étapes.<br />Premier rendez-vous aujourd'hui.
                </h2>
                <p style={{ fontSize: 17, color: D.lText2, lineHeight: 1.65, maxWidth: 480 }}>
                  Pas de paramétrage complexe. Pas de formation. Vous importez vos prospects, on s'occupe du reste.
                </p>
              </div>
            </FadeIn>

            {/* Zigzag steps */}
            {[
              {
                num: '01',
                title: 'Importez vos prospects',
                desc: `Collez un fichier CSV ou connectez votre CRM. Qwillio importe, valide et déduplique vos contacts en quelques secondes. Aucun champ obligatoire au-delà de l'email ou du téléphone.`,
              },
              {
                num: '02',
                title: `L'IA appelle, qualifie, note`,
                desc: `Aria appelle chaque prospect sur votre plage horaire, détecte les signaux d'intention, et retranscrit l'échange mot pour mot. Vous recevez un score de qualification et la transcription complète.`,
              },
              {
                num: '03',
                title: `Votre équipe ferme les deals`,
                desc: `Vos commerciaux ne voient que les leads chauds. Plus de cold calling inutile. Ils reçoivent un briefing complet avec contexte et prochaine action recommandée.`,
              },
            ].map((step, i) => (
              <FadeIn key={step.num} delay={i * 80}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  direction: i % 2 === 1 ? 'rtl' : 'ltr',
                  gap: '6rem',
                  alignItems: 'center',
                  marginBottom: i < 2 ? '6rem' : 0,
                }}>
                  <div style={{ direction: 'ltr' }}>
                    <div style={{
                      fontSize: '6rem', fontWeight: 800,
                      color: D.lBorder,
                      letterSpacing: '-0.05em', lineHeight: 1,
                      marginBottom: '0.5rem',
                      fontFeatureSettings: `'tnum'`,
                    }}>
                      {step.num}
                    </div>
                    <h3 style={{
                      fontSize: '1.7rem', fontWeight: 700,
                      color: D.lText, letterSpacing: '-0.02em',
                      marginBottom: '0.8rem',
                    }}>
                      {step.title}
                    </h3>
                    <p style={{ fontSize: 16, color: D.lText2, lineHeight: 1.7, maxWidth: 400 }}>
                      {step.desc}
                    </p>
                  </div>
                  <div style={{ direction: 'ltr' }}>
                    <StepPanel step={i} />
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </section>

        {/* ── TESTIMONIALS — asymmetric, NOT identical 3-col ── */}
        <section
          aria-labelledby="testimonials-heading"
          style={{ padding: '8rem 2.5rem', background: D.bg }}
        >
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <FadeIn style={{ marginBottom: '4rem' }}>
              <div style={{
                display: 'inline-block',
                background: D.accentDim, border: `1px solid ${D.accentBrd}`,
                color: D.accent,
                fontSize: 11, fontWeight: 700,
                padding: '5px 14px', borderRadius: 999,
                textTransform: 'uppercase', letterSpacing: '0.09em',
                marginBottom: '1rem',
              }}>
                Ils nous font confiance
              </div>
              <h2
                id="testimonials-heading"
                style={{
                  fontSize: 'clamp(2rem, 3.5vw, 3rem)',
                  fontWeight: 800, color: D.text,
                  letterSpacing: '-0.035em', lineHeight: 1.1,
                }}
              >
                Des résultats, pas des promesses.
              </h2>
            </FadeIn>

            {/* 2fr featured left spanning 2 rows, 1fr two stacked right */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gridTemplateRows: 'auto auto',
              gap: '1.5rem',
            }}>
              <FadeIn delay={0} style={{ gridRow: '1 / 3' }}>
                <article style={{
                  height: '100%',
                  background: D.bg2, border: `1px solid ${D.border}`,
                  borderRadius: 24, padding: '3rem',
                  display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                }}>
                  <div>
                    <Stars size={14} />
                    <blockquote style={{
                      fontSize: 'clamp(1.1rem, 2vw, 1.4rem)',
                      fontWeight: 600, color: D.text,
                      lineHeight: 1.55, letterSpacing: '-0.015em',
                      margin: '1.5rem 0 2rem',
                    }}>
                      "Nos commerciaux ne font plus que du closing. Qwillio gère tout le cold call.
                      En un mois, on a triplé notre pipeline sans embaucher personne."
                    </blockquote>
                  </div>
                  <footer style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div aria-hidden="true" style={{
                      width: 48, height: 48,
                      background: D.accentDim, border: `1px solid ${D.accentBrd}`,
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: D.accent, fontWeight: 700, fontSize: 15,
                    }}>
                      AB
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: D.text }}>Alexandre Blanchard</div>
                      <div style={{ fontSize: 13, color: D.text3 }}>Directeur, Propulse Agency</div>
                    </div>
                    <div style={{
                      marginLeft: 'auto',
                      background: D.accentDim, border: `1px solid ${D.accentBrd}`,
                      borderRadius: 10, padding: '6px 14px',
                      fontSize: 13, fontWeight: 700, color: D.accent,
                    }}>
                      +340% pipeline
                    </div>
                  </footer>
                </article>
              </FadeIn>

              {[
                {
                  initials: 'TM', name: 'Thomas Moreau', role: 'CEO, Axion Partners',
                  quote: `ROI positif la première semaine. La voix est indiscernable d'un vrai commercial.`,
                  stat: 'ROI semaine 1',
                },
                {
                  initials: 'SR', name: 'Sophie Renard', role: 'Fondatrice, ImmoPro',
                  quote: `On a divisé notre coût d'acquisition par trois. Mes équipes adorent.`,
                  stat: '-3x CAC',
                },
              ].map((t, i) => (
                <FadeIn key={t.initials} delay={(i + 1) * 80}>
                  <article style={{
                    background: D.bg2, border: `1px solid ${D.border}`,
                    borderRadius: 20, padding: '2rem',
                  }}>
                    <Stars size={12} />
                    <blockquote style={{ fontSize: 14, color: D.text2, lineHeight: 1.6, margin: '0.8rem 0 1.2rem' }}>
                      "{t.quote}"
                    </blockquote>
                    <footer style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div aria-hidden="true" style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: D.accentDim, border: `1px solid ${D.accentBrd}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: D.accent, fontSize: 12, fontWeight: 700,
                      }}>
                        {t.initials}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: D.text }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: D.text3 }}>{t.role}</div>
                      </div>
                      <span style={{
                        marginLeft: 'auto',
                        fontSize: 11, fontWeight: 800, color: D.accent, letterSpacing: '0.02em',
                      }}>
                        {t.stat}
                      </span>
                    </footer>
                  </article>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>

        {/* ── PRICING — 1fr 1.35fr 1fr, center visually dominant ── */}
        <section
          id="pricing"
          aria-labelledby="pricing-heading"
          style={{ padding: '8rem 2.5rem', background: D.bg2 }}
        >
          <div style={{ maxWidth: 1000, margin: '0 auto' }}>
            <FadeIn style={{ marginBottom: '4rem' }}>
              <h2
                id="pricing-heading"
                style={{
                  fontSize: 'clamp(2rem, 4vw, 3rem)',
                  fontWeight: 800, color: D.text,
                  letterSpacing: '-0.035em', marginBottom: '0.8rem',
                }}
              >
                Simple. Transparent.
              </h2>
              <p style={{ fontSize: 16, color: D.text2, lineHeight: 1.6 }}>
                Sans engagement annuel. Arrêtez quand vous voulez.
              </p>
            </FadeIn>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1.35fr 1fr',
              gap: '1.25rem',
              alignItems: 'start',
            }}>
              {[
                {
                  name: 'Starter', price: '29', period: '/mois',
                  calls: '200 appels / mois',
                  popular: false,
                  features: [
                    'Appels IA illimités en durée',
                    'Transcription automatique',
                    'Score de qualification',
                  ],
                  cta: 'Commencer',
                  ctaTo: '/register',
                },
                {
                  name: 'Pro', price: '79', period: '/mois',
                  calls: '600 appels / mois',
                  popular: true,
                  features: [
                    'Tout Starter inclus',
                    `Priorité file d'appels`,
                    'Intégrations CRM (HubSpot, Pipedrive)',
                    'Rapport hebdomadaire',
                    'Support prioritaire 7j/7',
                  ],
                  cta: 'Démarrer en Pro',
                  ctaTo: '/register',
                },
                {
                  name: 'Agence', price: '199', period: '/mois',
                  calls: 'Appels illimités',
                  popular: false,
                  features: [
                    'Tout Pro inclus',
                    'Multi-clients et white-label',
                    'API complète',
                  ],
                  cta: 'Nous contacter',
                  ctaTo: '/register',
                },
              ].map((tier, i) => (
                <FadeIn key={tier.name} delay={i * 60}>
                  <div
                    aria-current={tier.popular ? 'true' : undefined}
                    style={{
                      background: tier.popular ? D.bg3 : D.bg,
                      border: `1px solid ${tier.popular ? D.accentBrd : D.border}`,
                      borderRadius: 20,
                      padding: tier.popular ? '2.5rem' : '2rem',
                      position: 'relative',
                      boxShadow: tier.popular
                        ? `0 0 0 1px ${D.accentDim}, 0 8px 32px oklch(56% 0.22 264 / 0.08)`
                        : 'none',
                    }}
                  >
                    {tier.popular && (
                      <div style={{
                        position: 'absolute', top: -12, left: '50%',
                        transform: 'translateX(-50%)',
                        background: D.accent, color: D.bg,
                        fontSize: 10, fontWeight: 800,
                        padding: '4px 16px', borderRadius: 999,
                        whiteSpace: 'nowrap',
                        textTransform: 'uppercase', letterSpacing: '0.09em',
                      }}>
                        Le plus choisi
                      </div>
                    )}

                    <div style={{
                      fontSize: 11, fontWeight: 700,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                      color: D.text3, marginBottom: '1.2rem',
                    }}>
                      {tier.name}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, marginBottom: '0.4rem' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: D.text3 }}>€</span>
                      <span style={{
                        fontSize: tier.popular ? '3.5rem' : '3rem',
                        fontWeight: 800, color: D.text,
                        letterSpacing: '-0.04em', lineHeight: 1,
                      }}>
                        {tier.price}
                      </span>
                      <span style={{ fontSize: 14, color: D.text3, fontWeight: 400 }}>{tier.period}</span>
                    </div>

                    <div style={{ fontSize: 13, color: D.accent, fontWeight: 600, marginBottom: '2rem' }}>
                      {tier.calls}
                    </div>

                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 2rem', display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {tier.features.map(f => (
                        <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: D.text2, lineHeight: 1.5 }}>
                          <Check size={14} style={{ color: D.ok, flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <Link
                      to={tier.ctaTo}
                      aria-label={`${tier.cta} — forfait ${tier.name} à ${tier.price}€ par mois`}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        width: '100%', padding: '0.85rem',
                        borderRadius: 12, fontSize: 14, fontWeight: 600,
                        textDecoration: 'none',
                        background: tier.popular ? D.accent : 'transparent',
                        color: tier.popular ? D.bg : D.text2,
                        border: tier.popular ? 'none' : `1.5px solid ${D.border}`,
                        boxShadow: tier.popular ? `0 4px 20px oklch(56% 0.22 264 / 0.3)` : 'none',
                        transition: `all 0.2s ${EASE}`,
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = tier.popular ? D.accentHi : D.accentDim;
                        e.currentTarget.style.color = tier.popular ? D.bg : D.accent;
                        e.currentTarget.style.borderColor = tier.popular ? 'transparent' : D.accent;
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = tier.popular ? D.accent : 'transparent';
                        e.currentTarget.style.color = tier.popular ? D.bg : D.text2;
                        e.currentTarget.style.borderColor = tier.popular ? 'transparent' : D.border;
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      {tier.cta}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </FadeIn>
              ))}
            </div>

            <FadeIn delay={240}>
              <div style={{
                marginTop: '2.5rem',
                display: 'flex', alignItems: 'center', gap: 8,
                color: D.text3, fontSize: 13,
              }}>
                <Shield size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
                Conforme RGPD. Sans engagement annuel. Annulation en 1 clic.
              </div>
            </FadeIn>
          </div>
        </section>

        {/* ── CTA BANNER ── */}
        <section
          aria-labelledby="cta-heading"
          style={{
            padding: '9rem 2.5rem',
            background: D.bg,
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div aria-hidden="true" style={{
            position: 'absolute', top: '30%', right: '10%',
            width: 500, height: 500,
            background: `radial-gradient(ellipse at center, oklch(56% 0.22 264 / 0.05) 0%, transparent 70%)`,
            pointerEvents: 'none',
          }} />
          <div style={{ maxWidth: 680, margin: '0 auto', position: 'relative' }}>
            <FadeIn>
              <div style={{
                display: 'inline-block',
                background: D.accentDim, border: `1px solid ${D.accentBrd}`,
                color: D.accent,
                fontSize: 11, fontWeight: 700,
                padding: '5px 14px', borderRadius: 999,
                textTransform: 'uppercase', letterSpacing: '0.09em',
                marginBottom: '1.5rem',
              }}>
                Prêt à commencer ?
              </div>
              <h2
                id="cta-heading"
                style={{
                  fontSize: 'clamp(2.2rem, 4.5vw, 3.8rem)',
                  fontWeight: 800, color: D.text,
                  letterSpacing: '-0.04em', lineHeight: 1.05,
                  marginBottom: '1.2rem',
                }}
              >
                Vos concurrents prospectent déjà la nuit.
              </h2>
              <p style={{
                fontSize: 17, color: D.text2, lineHeight: 1.65,
                marginBottom: '2.5rem', maxWidth: 500,
              }}>
                10 minutes de configuration. Premiers appels aujourd'hui. Aucune carte bancaire pour l'essai.
              </p>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <MagneticBtn to="/register">
                  Essayer gratuitement
                  <ArrowRight size={16} aria-hidden="true" />
                </MagneticBtn>
                <MagneticBtn to="/login" variant="ghost">
                  J'ai déjà un compte
                </MagneticBtn>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer
        role="contentinfo"
        style={{
          borderTop: `1px solid ${D.border}`,
          padding: '2.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <QwillioLogo size={20} />
          <span style={{ fontSize: 15, fontWeight: 800, color: D.text, letterSpacing: '-0.02em' }}>
            Qwillio
          </span>
        </div>

        <nav aria-label="Liens légaux" style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
          {[
            ['Conditions générales', '/legal/terms'],
            ['Confidentialité', '/legal/privacy'],
            ['RGPD', '/legal/gdpr'],
            ['Contact', '/legal/contact'],
          ].map(([label, href]) => (
            <Link
              key={label}
              to={href}
              style={{ fontSize: 13, color: D.text3, textDecoration: 'none', transition: `color 0.2s` }}
              onMouseEnter={e => (e.currentTarget.style.color = D.text2)}
              onMouseLeave={e => (e.currentTarget.style.color = D.text3)}
            >
              {label}
            </Link>
          ))}
        </nav>

        <div style={{ fontSize: 13, color: D.text3 }}>
          &copy; {new Date().getFullYear()} Qwillio SAS
        </div>
      </footer>
    </div>
  );
}
