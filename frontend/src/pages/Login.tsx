import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ArrowRight, Eye, EyeOff, Phone, BarChart2, Clock } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { useSEO } from '../hooks/useSEO';

/**
 * Sign-in — two-column: glass form (left) + Qwillio brand panel (right).
 * Structure adapted from a user-provided template, re-tokened to the Qwillio
 * dark product register (indigo / Outfit) and wired to the real auth store.
 */

const D = {
  bg:        'oklch(8% 0.009 265)',
  panel:     'oklch(11% 0.013 265)',
  inset:     'oklch(6% 0.007 265)',
  border:    'oklch(22% 0.012 265 / 0.55)',
  text:      'oklch(95% 0.004 265)',
  text2:     'oklch(65% 0.007 265)',
  text3:     'oklch(42% 0.006 265)',
  accent:    'oklch(56% 0.22 264)',
  accentHi:  'oklch(63% 0.21 264)',
  accentDim: 'oklch(56% 0.22 264 / 0.10)',
  accentBrd: 'oklch(56% 0.22 264 / 0.22)',
  bad:       'oklch(65% 0.22 25)',
  badDim:    'oklch(65% 0.22 25 / 0.10)',
} as const;

/** Glass input shell — subtle fill, indigo on focus-within. */
function GlassInput({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border bg-[oklch(6%_0.007_265)] transition-colors focus-within:border-[oklch(56%_0.22_264/0.55)] focus-within:bg-[oklch(56%_0.22_264/0.06)]"
      style={{ borderColor: D.border }}
    >
      {children}
    </div>
  );
}

const fieldCls =
  'w-full bg-transparent text-[15px] px-4 py-[14px] rounded-2xl outline-none placeholder:text-[oklch(35%_0.006_265)] font-[Outfit,system-ui,sans-serif]';
const labelCls =
  'block text-[12px] font-medium mb-1.5 text-[oklch(65%_0.007_265)]';

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
                className="auth-in auth-d6 w-full rounded-2xl py-[15px] text-[15px] font-semibold border-none cursor-pointer flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: loading ? 'oklch(40% 0.10 264)' : D.accent,
                  color: loading ? D.text2 : 'oklch(98% 0.004 265)',
                }}
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
          className="auth-slide-right auth-d2 absolute inset-4 rounded-3xl overflow-hidden border flex flex-col justify-between p-12"
          style={{
            background: 'linear-gradient(160deg, oklch(13% 0.02 265) 0%, oklch(9% 0.012 265) 100%)',
            borderColor: D.border,
          }}
        >
          {/* restrained indigo wash — single, soft, top-right */}
          <div
            className="absolute pointer-events-none"
            style={{ inset: 0, background: 'radial-gradient(ellipse 460px 360px at 85% 8%, oklch(56% 0.22 264 / 0.10) 0%, transparent 70%)' }}
          />

          <span
            className="relative inline-block w-fit text-[11px] font-semibold uppercase tracking-[0.1em] px-3 py-1.5 rounded-full"
            style={{ background: D.accentDim, color: D.accentHi, border: `1px solid ${D.accentBrd}` }}
          >
            Plateforme IA vocale
          </span>

          <div className="relative">
            <h2 className="font-semibold tracking-[-0.035em] leading-[1.1]" style={{ fontSize: 'clamp(1.9rem, 2.6vw, 2.7rem)', color: D.text }}>
              Vos prospects <span style={{ color: D.accentHi }}>appelés</span>. Vos rendez-vous pris.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65] max-w-[380px]" style={{ color: D.text2 }}>
              L'IA vocale B2B qui prospecte et décroche pendant que votre équipe se concentre sur la fermeture.
            </p>
          </div>

          <div className="relative flex flex-col gap-3.5">
            {[
              { icon: <Phone size={15} />, text: "Appels IA indiscernables d'un humain" },
              { icon: <BarChart2 size={15} />, text: 'Qualification automatique des leads' },
              { icon: <Clock size={15} />, text: 'Premiers rendez-vous le jour même' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span
                  className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0"
                  style={{ background: D.accentDim, border: `1px solid ${D.accentBrd}`, color: D.accentHi }}
                >
                  {f.icon}
                </span>
                <span className="text-[14px] font-medium" style={{ color: D.text2 }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
