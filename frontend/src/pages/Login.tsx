import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ArrowRight, Eye, EyeOff } from '../components/icons';
import QwillioLogo from '../components/QwillioLogo';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { useSEO } from '../hooks/useSEO';

/**
 * Sign-in — two-column: glass form (left) + Qwillio brand panel (right).
 * Structure adapted from a user-provided template, re-tokened to the Qwillio
 * dark product register (indigo / Outfit) and wired to the real auth store.
 */

const D = {
  bg:        'oklch(8% 0 0)',
  panel:     'oklch(11% 0 0)',
  inset:     'oklch(6% 0 0)',
  border:    'oklch(22% 0 0 / 0.55)',
  text:      'oklch(95% 0 0)',
  text2:     'oklch(65% 0 0)',
  text3:     'oklch(42% 0 0)',
  accent:    'oklch(60.4% 0.213 285.5)',
  accentHi:  'oklch(66% 0.19 286)',
  accentDim: 'oklch(60.4% 0.213 285.5 / 0.10)',
  accentBrd: 'oklch(60.4% 0.213 285.5 / 0.22)',
  bad:       'oklch(65% 0.22 25)',
  badDim:    'oklch(65% 0.22 25 / 0.10)',
} as const;

/** Glass input shell — subtle fill, indigo on focus-within. */
function GlassInput({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border bg-[oklch(6%_0_0)] transition-colors focus-within:border-[oklch(56%_0.22_158/0.55)] focus-within:bg-[oklch(56%_0.22_158/0.06)]"
      style={{ borderColor: D.border }}
    >
      {children}
    </div>
  );
}

const fieldCls =
  'w-full bg-transparent text-[15px] px-4 py-[14px] rounded-2xl outline-none placeholder:text-[oklch(35%_0_0)] font-[Outfit,system-ui,sans-serif]';
const labelCls =
  'block text-[12px] font-medium mb-1.5 text-[oklch(65%_0_0)]';

export default function Login() {
  useSEO({ title: 'Connexion — Qwillio', noindex: true });

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      const { user } = useAuthStore.getState();
      navigate(user?.role === 'admin' ? '/admin' : (user?.onboardingCompleted ? '/dashboard' : '/onboard'));
    } catch (err: any) {
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError('Le serveur met du temps à répondre. Veuillez réessayer dans quelques secondes.');
      } else {
        const errData = err?.response?.data?.error;
        setError(typeof errData === 'string' ? errData : (errData?.message || err?.message || 'Identifiants incorrects.'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-dvh flex flex-col lg:flex-row"
      style={{ background: D.bg, fontFamily: "'Outfit', system-ui, sans-serif" }}
    >
      {/* ── LEFT — sign-in form ── */}
      <section className="flex-1 flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <Link
            to="/"
            className="auth-in auth-d1 inline-flex items-center gap-2 text-[17px] font-extrabold no-underline tracking-[-0.025em] mb-10"
            style={{ color: D.text }}
          >
            <QwillioLogo size={24} />
            Qwillio
          </Link>

          <div className="flex flex-col gap-6">
            <div>
              <h1 className="auth-in auth-d1 text-[2rem] md:text-[2.4rem] font-semibold tracking-[-0.035em] leading-[1.1]" style={{ color: D.text }}>
                Bienvenue
              </h1>
              <p className="auth-in auth-d2 mt-1.5 text-[15px]" style={{ color: D.text2 }}>
                Connectez-vous à votre espace Qwillio.
              </p>
            </div>

            {error && (
              <div
                className="auth-in rounded-2xl px-4 py-3 text-[13px]"
                style={{ background: D.badDim, border: `1px solid ${D.bad}`, color: D.bad }}
                role="alert"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="auth-in auth-d3">
                <label htmlFor="login-email" className={labelCls}>Adresse email</label>
                <GlassInput>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@agence.fr"
                    required
                    autoComplete="email"
                    className={fieldCls}
                  />
                </GlassInput>
              </div>

              <div className="auth-in auth-d4">
                <label htmlFor="login-password" className={labelCls}>Mot de passe</label>
                <GlassInput>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className={`${fieldCls} pr-12`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                      className="absolute inset-y-0 right-3 flex items-center bg-transparent border-none cursor-pointer"
                      style={{ color: D.text3 }}
                    >
                      {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </GlassInput>
              </div>

              <div className="auth-in auth-d5 flex items-center justify-between text-[13px]">
                <label className="flex items-center gap-2.5 cursor-pointer" style={{ color: D.text2 }}>
                  <input type="checkbox" name="rememberMe" defaultChecked className="auth-checkbox" />
                  Rester connecté
                </label>
                <Link to="/forgot-password" className="no-underline hover:underline transition-colors" style={{ color: D.accentHi }}>
                  Mot de passe oublié ?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="auth-in auth-d6 w-full rounded-full px-4 py-4 text-base font-medium border-none cursor-pointer flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed bg-white text-[#1d1d1f] hover:bg-[#7a5fff] hover:text-white"
                style={loading ? { background: 'oklch(40% 0 0)', color: D.text2 } : undefined}
              >
                {loading ? 'Connexion…' : 'Se connecter'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            <div className="auth-in auth-d7 relative flex items-center justify-center">
              <span className="w-full border-t" style={{ borderColor: D.border }} />
              <span className="px-4 text-[12px] absolute font-medium uppercase tracking-[0.1em]" style={{ color: D.text3, background: D.bg }}>
                ou
              </span>
            </div>

            <div className="auth-in auth-d7">
              <GoogleAuthButton mode="login" onError={setError} disabled={loading} />
            </div>

            <p className="auth-in auth-d7 text-center text-[13px]" style={{ color: D.text3 }}>
              Pas encore de compte ?{' '}
              <Link to="/register" className="font-semibold no-underline hover:underline" style={{ color: D.accentHi }}>
                Créer un compte
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ── RIGHT — Qwillio brand panel (desktop) ── */}
      <section className="hidden lg:block flex-1 relative p-4">
        <div
          className="auth-slide-right auth-d2 absolute inset-4 rounded-3xl overflow-hidden border flex flex-col justify-center p-12"
          style={{
            background: 'linear-gradient(150deg, #7349fe 0%, #7a5fff 45%, #cd6afb 100%)',
            borderColor: 'rgba(255,255,255,0.14)',
          }}
        >
          {/* Soft light source, top-right, to keep the flat gradient from reading as a swatch */}
          <div
            className="absolute pointer-events-none"
            style={{ inset: 0, background: 'radial-gradient(ellipse 520px 400px at 82% 6%, rgba(255,255,255,0.22) 0%, transparent 70%)' }}
          />

          <div className="relative">
            <h2
              className="font-semibold tracking-[-0.035em] leading-[1.1]"
              style={{ fontSize: 'clamp(1.9rem, 2.6vw, 2.7rem)', color: 'rgba(255,255,255,0.72)' }}
            >
              Vos prospects <span className="text-white">appelés</span>.
              <span className="block">Vos <span className="font-bold text-white">rendez-vous</span> pris.</span>
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65] max-w-[380px]" style={{ color: 'rgba(255,255,255,0.76)' }}>
              Votre réceptionniste IA décroche en moins d'une seconde, qualifie chaque appel et remplit votre agenda, 24h/24.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
