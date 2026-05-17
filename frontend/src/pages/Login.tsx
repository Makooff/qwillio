import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ArrowRight, Eye, EyeOff, BarChart2, Phone, Clock } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import { useSEO } from '../hooks/useSEO';

/* ── Design tokens (emerald-drenched dark) ── */
const D = {
  bg:        'oklch(9% 0.014 160)',
  bg2:       'oklch(12% 0.017 160)',
  border:    'oklch(26% 0.014 160 / 0.55)',
  text:      'oklch(95% 0.006 160)',
  text2:     'oklch(62% 0.009 160)',
  text3:     'oklch(40% 0.007 160)',
  accent:    'oklch(68% 0.22 160)',
  accentHi:  'oklch(73% 0.21 160)',
  accentDim: 'oklch(68% 0.22 160 / 0.12)',
  accentBrd: 'oklch(68% 0.22 160 / 0.35)',
  bad:       'oklch(65% 0.22 25)',
  badDim:    'oklch(65% 0.22 25 / 0.10)',
  lBg:       'oklch(96% 0.010 55)',
  lBorder:   'oklch(84% 0.012 55)',
  lText:     'oklch(12% 0.006 0)',
  lText2:    'oklch(40% 0.006 0)',
} as const;

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'oklch(6% 0.008 160)',
  border: `1px solid ${D.border}`,
  borderRadius: 10,
  padding: '13px 16px',
  color: D.text,
  fontSize: 15,
  fontFamily: `'Outfit', system-ui, sans-serif`,
  outline: 'none',
  transition: 'border-color 0.15s',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: D.text3,
  marginBottom: 8,
};

export default function Login() {
  useSEO({ title: 'Connexion — Qwillio', noindex: true });

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const { login } = useAuthStore();
  const navigate   = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      const { user } = useAuthStore.getState();
      navigate(user?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || (err as { message?: string })?.message || 'Identifiants incorrects.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      minHeight: '100dvh',
      fontFamily: `'Outfit', system-ui, sans-serif`,
    }}>
      {/* ── LEFT — cream brand panel ── */}
      <div style={{
        background: D.lBg,
        padding: '4rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        borderRight: `1px solid ${D.lBorder}`,
      }}>
        <Link to="/" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontSize: 18, fontWeight: 800, color: D.lText,
          letterSpacing: '-0.025em', textDecoration: 'none',
        }}>
          <QwillioLogo size={26} />
          Qwillio
        </Link>

        <div>
          <div style={{
            display: 'inline-block',
            background: 'oklch(68% 0.22 160 / 0.10)',
            color: 'oklch(42% 0.18 160)',
            fontSize: 10, fontWeight: 700,
            padding: '5px 12px', borderRadius: 999,
            textTransform: 'uppercase', letterSpacing: '0.09em',
            marginBottom: '1.5rem',
          }}>
            Plateforme IA vocale
          </div>
          <h2 style={{
            fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
            fontWeight: 800, color: D.lText,
            letterSpacing: '-0.035em', lineHeight: 1.1,
            marginBottom: '1rem',
          }}>
            Vos prospects{` `}
            <span style={{ color: 'oklch(52% 0.20 160)' }}>appelés</span>
            {`. Vos rendez-vous pris.`}
          </h2>
          <p style={{ fontSize: 15, color: D.lText2, lineHeight: 1.65, maxWidth: 360 }}>
            L'IA vocale B2B qui prospecte pendant que votre équipe dort.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {[
            { icon: <Phone size={14} />, text: `Appels IA indiscernables d'un humain` },
            { icon: <BarChart2 size={14} />, text: 'Qualification automatique des leads' },
            { icon: <Clock size={14} />, text: 'Premiers rendez-vous le jour même' },
          ].map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 30, height: 30,
                background: 'oklch(68% 0.22 160 / 0.10)',
                border: '1px solid oklch(68% 0.22 160 / 0.22)',
                borderRadius: 7,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'oklch(42% 0.18 160)', flexShrink: 0,
              }}>
                {f.icon}
              </div>
              <span style={{ fontSize: 13, color: D.lText2, fontWeight: 500 }}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT — dark form panel ── */}
      <div style={{
        background: D.bg,
        padding: '4rem',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          background: `radial-gradient(ellipse 400px 300px at 70% 15%, oklch(68% 0.22 160 / 0.06) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: 400, width: '100%', margin: '0 auto' }}>
          <div style={{ marginBottom: '2.5rem' }}>
            <h1 style={{
              fontSize: '1.8rem', fontWeight: 800,
              color: D.text, letterSpacing: '-0.035em',
              marginBottom: '0.4rem',
            }}>
              Bienvenue
            </h1>
            <p style={{ fontSize: 15, color: D.text2 }}>
              Connectez-vous à votre espace Qwillio.
            </p>
          </div>

          {error && (
            <div style={{
              background: D.badDim,
              border: `1px solid ${D.bad}`,
              borderRadius: 10, padding: '10px 14px',
              fontSize: 13, color: D.bad, marginBottom: '1.2rem',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div>
              <label style={labelStyle}>Adresse email</label>
              <input
                type="email" value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="vous@agence.fr"
                required autoComplete="email"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = D.accentBrd; }}
                onBlur={e => { e.target.style.borderColor = D.border; }}
              />
            </div>

            <div>
              <label style={labelStyle}>Mot de passe</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required autoComplete="current-password"
                  style={{ ...inputStyle, paddingRight: 44 }}
                  onFocus={e => { e.target.style.borderColor = D.accentBrd; }}
                  onBlur={e => { e.target.style.borderColor = D.border; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  style={{
                    position: 'absolute', right: 12, top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: D.text3, display: 'flex', alignItems: 'center', padding: 0,
                  }}
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <div style={{ marginTop: 8, textAlign: 'right' }}>
                <a href="#" style={{ fontSize: 12, color: D.text3, textDecoration: 'none',
                  transition: 'color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.color = D.accent)}
                  onMouseLeave={e => (e.currentTarget.style.color = D.text3)}
                >
                  Mot de passe oublié ?
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px 0',
                background: loading ? 'oklch(40% 0.10 160)' : D.accent,
                color: loading ? D.text2 : D.bg,
                border: 'none', borderRadius: 12,
                fontSize: 15, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontFamily: `'Outfit', system-ui, sans-serif`,
                transition: 'all 0.18s',
                letterSpacing: '0.01em', marginTop: '0.4rem',
                boxShadow: loading ? 'none' : `0 4px 16px oklch(68% 0.22 160 / 0.3)`,
              }}
              onMouseEnter={e => {
                if (!loading) {
                  e.currentTarget.style.background = D.accentHi;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = loading ? 'oklch(40% 0.10 160)' : D.accent;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              {loading ? 'Connexion...' : 'Se connecter'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p style={{ marginTop: '1.5rem', fontSize: 13, color: D.text3 }}>
            Pas encore de compte ?{' '}
            <Link to="/register" style={{ color: D.accent, fontWeight: 600, textDecoration: 'none' }}>
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
