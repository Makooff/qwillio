import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ArrowRight, Mail, Check, Eye, EyeOff } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { useSEO } from '../hooks/useSEO';
import api from '../services/api';

const D = {
  bg:        'oklch(8% 0.009 265)',
  border:    'oklch(22% 0.012 265 / 0.55)',
  text:      'oklch(95% 0.004 265)',
  text2:     'oklch(65% 0.007 265)',
  text3:     'oklch(42% 0.006 265)',
  accent:    'oklch(56% 0.22 264)',
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

const inputCls = `
  w-full bg-[oklch(6%_0.007_265)] border border-[oklch(22%_0.012_265/0.55)]
  rounded-[10px] px-4 py-[13px] text-[oklch(95%_0.004_265)] text-[15px]
  font-[Outfit,system-ui,sans-serif] outline-none
  transition-colors focus:border-[oklch(56%_0.22_264/0.40)]
  placeholder:text-[oklch(35%_0.006_265)]
`.replace(/\s+/g, ' ').trim();

const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.08em] text-[oklch(42%_0.006_265)] mb-2';

type Step = 'form' | 'activation';

const QUOTES = [
  { text: `Nos commerciaux ne font plus que du closing. Qwillio gère tout le reste.`, author: 'Alexandre B., Propulse Agency' },
  { text: `ROI positif dès la première semaine. La voix est indiscernable d'un vrai commercial.`, author: 'Thomas M., Axion Partners' },
  { text: `On a divisé notre coût d'acquisition par trois en un mois.`, author: 'Sophie R., ImmoPro Lyon' },
];

export default function Register() {
  useSEO({ title: 'Créer un compte — Qwillio', noindex: true });

  const [step, setStep]           = useState<Step>('form');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [resending, setResending] = useState(false);
  const [resendOk, setResendOk]   = useState(false);
  const [quoteIdx]                = useState(() => Math.floor(Math.random() * QUOTES.length));

  const { register } = useAuthStore();
  const navigate      = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPw) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (password.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    setLoading(true);
    try {
      await register(email.trim(), password, '');
      const { user } = useAuthStore.getState();
      if (user?.emailConfirmed) { navigate('/onboard'); } else { setStep('activation'); }
    } catch (err: any) {
      const errData = err?.response?.data?.error;
      setError(
        typeof errData === 'string' ? errData
          : (errData?.message || err?.message || 'Une erreur est survenue. Réessayez.')
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
    <div
      className="min-h-dvh grid lg:grid-cols-2"
      style={{ fontFamily: "'Outfit', system-ui, sans-serif" }}
    >
      {/* ── LEFT — cream brand panel (desktop only) ── */}
      <div
        className="hidden lg:flex flex-col justify-between p-16 border-r"
        style={{ background: D.lBg, borderColor: D.lBorder }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[18px] font-extrabold no-underline tracking-[-0.025em]"
          style={{ color: D.lText }}
        >
          <QwillioLogo size={26} />
          Qwillio
        </Link>

        {/* Testimonial */}
        <div>
          <div
            className="text-[10px] font-bold uppercase tracking-[0.09em] mb-4"
            style={{ color: 'oklch(42% 0.18 264)' }}
          >
            Témoignage client
          </div>
          <blockquote
            className="font-bold tracking-[-0.02em] leading-[1.35] mb-5 not-italic"
            style={{
              fontSize: 'clamp(1.1rem, 2.5vw, 1.5rem)',
              color: D.lText,
            }}
          >
            "{quote.text}"
          </blockquote>
          <cite className="text-[14px] font-medium not-italic" style={{ color: D.lText2 }}>
            {quote.author}
          </cite>
        </div>

        {/* Trust signals */}
        <div className="flex flex-col gap-3">
          {[
            'Premiers appels en 10 minutes',
            'Sans engagement annuel',
            'Support FR 7j/7',
          ].map(item => (
            <div key={item} className="flex items-center gap-2">
              <div
                className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0"
                style={{
                  background: 'oklch(56% 0.22 264 / 0.12)',
                  border: '1px solid oklch(56% 0.22 264 / 0.25)',
                }}
              >
                <Check size={10} style={{ color: 'oklch(52% 0.20 264)' }} />
              </div>
              <span className="text-[13px] font-medium" style={{ color: D.lText2 }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT — dark form panel ── */}
      <div
        className="flex flex-col justify-center min-h-dvh px-5 py-10 sm:px-10 lg:px-16 relative"
        style={{ background: D.bg }}
      >
        {/* Glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 400px 300px at 80% 15%, oklch(56% 0.22 264 / 0.06) 0%, transparent 70%)',
          }}
        />

        {/* Mobile logo */}
        <div className="lg:hidden mb-8 relative">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[17px] font-extrabold no-underline tracking-[-0.025em]"
            style={{ color: D.text }}
          >
            <QwillioLogo size={24} />
            Qwillio
          </Link>
        </div>

        <div className="relative w-full max-w-sm mx-auto">
          {step === 'form' ? (
            <>
              <div className="mb-8">
                <h1
                  className="text-[1.8rem] font-extrabold tracking-[-0.035em] mb-1"
                  style={{ color: D.text }}
                >
                  Créer votre compte
                </h1>
                <p className="text-[15px]" style={{ color: D.text2 }}>
                  Premiers appels en 10 minutes.
                </p>
              </div>

              {error && (
                <div
                  className="rounded-[10px] px-3.5 py-2.5 text-[13px] mb-5"
                  style={{ background: D.badDim, border: `1px solid ${D.bad}`, color: D.bad }}
                >
                  {error}
                </div>
              )}

              {/* Google button */}
              <GoogleAuthButton mode="register" onError={setError} disabled={loading} />

              {/* Divider */}
              <div className="relative my-5 flex items-center gap-3">
                <div className="flex-1 h-px" style={{ background: D.border }} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: D.text3 }}>
                  ou
                </span>
                <div className="flex-1 h-px" style={{ background: D.border }} />
              </div>

              {/* Email / password form */}
              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label htmlFor="reg-email" className={labelCls}>Adresse email</label>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="vous@agence.fr"
                    required
                    autoComplete="email"
                    className={inputCls}
                  />
                </div>

                <div>
                  <label htmlFor="reg-password" className={labelCls}>Mot de passe</label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="6 caractères minimum"
                      required
                      autoComplete="new-password"
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0 bg-transparent border-none cursor-pointer flex items-center"
                      style={{ color: D.text3 }}
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="reg-confirm-password" className={labelCls}>Confirmer le mot de passe</label>
                  <input
                    id="reg-confirm-password"
                    type={showPw ? 'text' : 'password'}
                    value={confirmPw}
                    onChange={e => setConfirmPw(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="new-password"
                    className={inputCls}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-[13px] rounded-xl text-[15px] font-bold border-none cursor-pointer flex items-center justify-center gap-2 transition-all mt-1 active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: loading ? 'oklch(40% 0.10 264)' : D.accent,
                    color: loading ? D.text2 : D.bg,
                    boxShadow: loading ? 'none' : '0 4px 16px oklch(56% 0.22 264 / 0.3)',
                    fontFamily: "'Outfit', system-ui, sans-serif",
                  }}
                >
                  {loading ? 'Création...' : 'Créer mon compte'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              <p className="mt-5 text-[13px]" style={{ color: D.text3 }}>
                Déjà un compte ?{' '}
                <Link to="/login" className="font-semibold no-underline" style={{ color: D.accent }}>
                  Se connecter
                </Link>
              </p>

              <p className="mt-3 text-[12px] leading-relaxed" style={{ color: 'oklch(35% 0.006 265)' }}>
                En créant un compte, vous acceptez nos{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: D.text3 }}>CGU</a>
                {' '}et notre{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: D.text3 }}>politique de confidentialité</a>.
              </p>
            </>
          ) : (
            /* ── Activation screen ── */
            <div className="text-center">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: D.okDim, border: `1px solid ${D.okBrd}` }}
              >
                <Mail size={28} style={{ color: D.ok }} />
              </div>
              <h2
                className="text-[1.5rem] font-extrabold tracking-[-0.03em] mb-3"
                style={{ color: D.text }}
              >
                Vérifiez votre email
              </h2>
              <p className="text-[14px] leading-[1.6] mb-1" style={{ color: D.text2 }}>
                Un lien d'activation a été envoyé à
              </p>
              <p className="text-[15px] font-semibold mb-8" style={{ color: D.text }}>
                {email}
              </p>

              {resendOk && (
                <div
                  className="rounded-[10px] px-3.5 py-2.5 text-[13px] mb-5 flex items-center justify-center gap-1.5"
                  style={{ background: D.okDim, border: `1px solid ${D.okBrd}`, color: D.ok }}
                >
                  <Check size={14} /> Email renvoyé avec succès
                </div>
              )}

              <button
                onClick={handleResend}
                disabled={resending}
                className="border rounded-[10px] px-5 py-2.5 text-[13px] font-medium cursor-pointer transition-all bg-transparent hover:border-[oklch(56%_0.22_264/0.40)] hover:text-[oklch(56%_0.22_264)] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  borderColor: D.border,
                  color: D.text2,
                  fontFamily: "'Outfit', system-ui, sans-serif",
                }}
              >
                {resending ? 'Renvoi...' : `Renvoyer l'email`}
              </button>

              <div className="mt-8">
                <Link
                  to="/login"
                  className="text-[13px] no-underline"
                  style={{ color: D.text3 }}
                >
                  Retour à la connexion
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
