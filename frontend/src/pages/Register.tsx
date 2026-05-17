import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ArrowRight, Mail, Check, Eye, EyeOff } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import { useSEO } from '../hooks/useSEO';
import api from '../services/api';

/* â”€â”€ Design tokens (emerald-drenched dark) â”€â”€ */
const D = {
  bg:        'oklch(8% 0.009 265)',
  border:    'oklch(22% 0.012 265 / 0.55)',
  text:      'oklch(95% 0.004 265)',
  text2:     'oklch(65% 0.007 265)',
  text3:     'oklch(42% 0.006 265)',
  accent:    'oklch(56% 0.22 264)',
  accentHi:  'oklch(63% 0.21 264)',
  accentDim: 'oklch(56% 0.22 264 / 0.12)',
  accentBrd: 'oklch(56% 0.22 264 / 0.40)',
  ok:        'oklch(72% 0.18 145)',
  okDim:     'oklch(72% 0.18 145 / 0.12)',
  okBrd:     'oklch(72% 0.18 145 / 0.35)',
  bad:       'oklch(65% 0.22 25)',
  badDim:    'oklch(65% 0.22 25 / 0.10)',
  lBg:       'oklch(96% 0.010 55)',
  lBorder:   'oklch(84% 0.012 55)',
  lText:     'oklch(12% 0.006 0)',
  lText2:    'oklch(40% 0.006 0)',
} as const;

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'oklch(6% 0.007 265)',
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

type Step = 'form' | 'activation';

const QUOTES = [
  { text: `Nos commerciaux ne font plus que du closing. Qwillio gÃ¨re tout le reste.`, author: 'Alexandre B., Propulse Agency' },
  { text: `ROI positif dÃ¨s la premiÃ¨re semaine. La voix est indiscernable d'un vrai commercial.`, author: 'Thomas M., Axion Partners' },
  { text: `On a divisÃ© notre coÃ»t d'acquisition par trois en un mois.`, author: 'Sophie R., ImmoPro Lyon' },
];

export default function Register() {
  useSEO({ title: 'CrÃ©er un compte â€” Qwillio', noindex: true });

  const [step, setStep]              = useState<Step>('form');
  const [email, setEmail]            = useState('');
  const [password, setPassword]      = useState('');
  const [confirmPw, setConfirmPw]    = useState('');
  const [showPw, setShowPw]          = useState(false);
  const [error, setError]            = useState('');
  const [loading, setLoading]        = useState(false);
  const [resending, setResending]    = useState(false);
  const [resendOk, setResendOk]      = useState(false);
  const [quoteIdx]                   = useState(() => Math.floor(Math.random() * QUOTES.length));

  const { register } = useAuthStore();
  const navigate      = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPw) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractÃ¨res.'); return; }
    setLoading(true);
    try {
      await register(email.trim(), password, '');
      const { user } = useAuthStore.getState();
      if (user?.emailConfirmed) { navigate('/onboard'); } else { setStep('activation'); }
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { error?: unknown } } })?.response?.data?.error;
      setError(
        typeof errData === 'string' ? errData
          : ((errData as { message?: string })?.message ||
             (err as { message?: string })?.message ||
             'Une erreur est survenue. RÃ©essayez.')
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setResendOk(false);
    try {
      await api.post('/auth/resend-confirmation');
      setResendOk(true);
      setTimeout(() => setResendOk(false), 5000);
    } catch { /* silent */ } finally { setResending(false); }
  }

  const quote = QUOTES[quoteIdx];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      minHeight: '100dvh',
      fontFamily: `'Outfit', system-ui, sans-serif`,
    }}>
      {/* â”€â”€ LEFT â€” cream brand panel â”€â”€ */}
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

        {/* Testimonial */}
        <div>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.09em', color: 'oklch(42% 0.18 264)',
            marginBottom: '1rem',
          }}>
            TÃ©moignage client
          </div>
          <blockquote style={{
            fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
            fontWeight: 700, color: D.lText,
            letterSpacing: '-0.02em', lineHeight: 1.35,
            marginBottom: '1.2rem',
          }}>
            "{quote.text}"
          </blockquote>
          <cite style={{ fontSize: 14, color: D.lText2, fontStyle: 'normal', fontWeight: 500 }}>
            {quote.author}
          </cite>
        </div>

        {/* Trust signals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
          {[
            'Premiers appels en 10 minutes',
            'Sans engagement annuel',
            'Support FR 7j/7',
          ].map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: 'oklch(56% 0.22 264 / 0.12)',
                border: '1px solid oklch(56% 0.22 264 / 0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Check size={10} style={{ color: 'oklch(52% 0.20 264)' }} />
              </div>
              <span style={{ fontSize: 13, color: D.lText2, fontWeight: 500 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* â”€â”€ RIGHT â€” dark form panel â”€â”€ */}
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
          background: `radial-gradient(ellipse 400px 300px at 80% 15%, oklch(56% 0.22 264 / 0.06) 0%, transparent 70%)`,
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', maxWidth: 400, width: '100%', margin: '0 auto' }}>
          {step === 'form' ? (
            <>
              <div style={{ marginBottom: '2.5rem' }}>
                <h1 style={{
                  fontSize: '1.8rem', fontWeight: 800,
                  color: D.text, letterSpacing: '-0.035em', marginBottom: '0.4rem',
                }}>
                  CrÃ©er votre compte
                </h1>
                <p style={{ fontSize: 15, color: D.text2 }}>
                  Premiers appels en 10 minutes.
                </p>
              </div>

              {error && (
                <div style={{
                  background: D.badDim, border: `1px solid ${D.bad}`,
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
                      placeholder="8 caractÃ¨res minimum"
                      required autoComplete="new-password"
                      style={{ ...inputStyle, paddingRight: 44 }}
                      onFocus={e => { e.target.style.borderColor = D.accentBrd; }}
                      onBlur={e => { e.target.style.borderColor = D.border; }}
                    />
                    <button
                      type="button" onClick={() => setShowPw(!showPw)}
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
                </div>

                <div>
                  <label style={labelStyle}>Confirmer le mot de passe</label>
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                    required autoComplete="new-password"
                    style={inputStyle}
                    onFocus={e => { e.target.style.borderColor = D.accentBrd; }}
                    onBlur={e => { e.target.style.borderColor = D.border; }}
                  />
                </div>

                <button
                  type="submit" disabled={loading}
                  style={{
                    width: '100%', padding: '13px 0',
                    background: loading ? 'oklch(40% 0.10 264)' : D.accent,
                    color: loading ? D.text2 : D.bg,
                    border: 'none', borderRadius: 12,
                    fontSize: 15, fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: `'Outfit', system-ui, sans-serif`,
                    transition: 'all 0.18s', letterSpacing: '0.01em', marginTop: '0.4rem',
                    boxShadow: loading ? 'none' : `0 4px 16px oklch(56% 0.22 264 / 0.3)`,
                  }}
                  onMouseEnter={e => {
                    if (!loading) {
                      e.currentTarget.style.background = D.accentHi;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = loading ? 'oklch(40% 0.10 264)' : D.accent;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  {loading ? 'CrÃ©ation...' : 'CrÃ©er mon compte'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              <p style={{ marginTop: '1.5rem', fontSize: 13, color: D.text3 }}>
                DÃ©jÃ  un compte ?{' '}
                <Link to="/login" style={{ color: D.accent, fontWeight: 600, textDecoration: 'none' }}>
                  Se connecter
                </Link>
              </p>

              <p style={{ marginTop: '1rem', fontSize: 12, color: 'oklch(35% 0.006 265)', lineHeight: 1.5 }}>
                En crÃ©ant un compte, vous acceptez nos{' '}
                <a href="#" style={{ color: D.text3 }}>CGU</a>
                {' '}et notre{' '}
                <a href="#" style={{ color: D.text3 }}>politique de confidentialitÃ©</a>.
              </p>
            </>
          ) : (
            /* â”€â”€ Activation screen â”€â”€ */
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64,
                background: D.okDim, border: `1px solid ${D.okBrd}`,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1.5rem',
              }}>
                <Mail size={28} style={{ color: D.ok }} />
              </div>
              <h2 style={{
                fontSize: '1.5rem', fontWeight: 800,
                color: D.text, letterSpacing: '-0.03em', marginBottom: '0.75rem',
              }}>
                VÃ©rifiez votre email
              </h2>
              <p style={{ fontSize: 14, color: D.text2, lineHeight: 1.6, marginBottom: '0.5rem' }}>
                Un lien d'activation a Ã©tÃ© envoyÃ© Ã 
              </p>
              <p style={{ fontSize: 15, fontWeight: 600, color: D.text, marginBottom: '2rem' }}>
                {email}
              </p>

              {resendOk && (
                <div style={{
                  background: D.okDim, border: `1px solid ${D.okBrd}`,
                  borderRadius: 10, padding: '10px 14px',
                  fontSize: 13, color: D.ok, marginBottom: '1.2rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                  <Check size={14} /> Email renvoyÃ© avec succÃ¨s
                </div>
              )}

              <button
                onClick={handleResend} disabled={resending}
                style={{
                  background: 'none',
                  border: `1px solid ${D.border}`,
                  borderRadius: 10, padding: '10px 20px',
                  color: D.text2, fontSize: 13, fontWeight: 500,
                  cursor: resending ? 'not-allowed' : 'pointer',
                  fontFamily: `'Outfit', system-ui, sans-serif`,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  if (!resending) {
                    e.currentTarget.style.borderColor = D.accentBrd;
                    e.currentTarget.style.color = D.accent;
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = D.border;
                  e.currentTarget.style.color = D.text2;
                }}
              >
                {resending ? 'Renvoi...' : `Renvoyer l'email`}
              </button>

              <div style={{ marginTop: '2rem' }}>
                <Link to="/login" style={{ fontSize: 13, color: D.text3, textDecoration: 'none' }}>
                  Retour Ã  la connexion
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
