import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ArrowRight, Mail, Check, Eye, EyeOff, Phone, BarChart2, Clock } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { useSEO } from '../hooks/useSEO';
import api from '../services/api';

/**
 * Register — same two-column glass language as the sign-in. Brand panel on the
 * right (honest trust signals, no fabricated testimonials — pre-revenue).
 */

const D = {
  bg:        'oklch(8% 0.009 265)',
  inset:     'oklch(6% 0.007 265)',
  border:    'oklch(22% 0.012 265 / 0.55)',
  text:      'oklch(95% 0.004 265)',
  text2:     'oklch(65% 0.007 265)',
  text3:     'oklch(42% 0.006 265)',
  accent:    'oklch(56% 0.02 265)',
  accentHi:  'oklch(63% 0.02 265)',
  accentDim: 'oklch(56% 0.02 265 / 0.10)',
  accentBrd: 'oklch(56% 0.02 265 / 0.22)',
  ok:        'oklch(72% 0.18 145)',
  okDim:     'oklch(72% 0.18 145 / 0.12)',
  okBrd:     'oklch(72% 0.18 145 / 0.35)',
  bad:       'oklch(65% 0.22 25)',
  badDim:    'oklch(65% 0.22 25 / 0.10)',
} as const;

function GlassInput({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border bg-[oklch(6%_0.007_265)] transition-colors focus-within:border-[oklch(56%_0.22_158/0.55)] focus-within:bg-[oklch(56%_0.22_158/0.06)]"
      style={{ borderColor: D.border }}
    >
      {children}
    </div>
  );
}

const fieldCls =
  'w-full bg-transparent text-[15px] px-4 py-[14px] rounded-2xl outline-none placeholder:text-[oklch(35%_0.006_265)] font-[Outfit,system-ui,sans-serif]';
const labelCls = 'block text-[12px] font-medium mb-1.5 text-[oklch(65%_0.007_265)]';

type Step = 'form' | 'activation';

export default function Register() {
  useSEO({ title: 'Créer un compte — Qwillio', noindex: true });

  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendOk, setResendOk] = useState(false);

  const { register } = useAuthStore();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password !== confirmPw) { setError('Les mots de passe ne correspondent pas.'); return; }
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    setLoading(true);
    try {
      await register(email.trim(), password, '');
      const { user } = useAuthStore.getState();
      if (user?.emailConfirmed) { navigate('/onboard'); } else { setStep('activation'); }
    } catch (err: any) {
      const errData = err?.response?.data?.error;
      setError(typeof errData === 'string' ? errData : (errData?.message || err?.message || 'Une erreur est survenue. Réessayez.'));
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

  return (
    <div
      className="min-h-dvh flex flex-col lg:flex-row"
      style={{ background: D.bg, fontFamily: "'Outfit', system-ui, sans-serif" }}
    >
      {/* ── LEFT — form ── */}
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

          {step === 'form' ? (
            <div className="flex flex-col gap-6">
              <div>
                <h1 className="auth-in auth-d1 text-[2rem] md:text-[2.4rem] font-semibold tracking-[-0.035em] leading-[1.1]" style={{ color: D.text }}>
                  Créer votre compte
                </h1>
                <p className="auth-in auth-d2 mt-1.5 text-[15px]" style={{ color: D.text2 }}>
                  Premiers appels en 10 minutes.
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
                  <label htmlFor="reg-email" className={labelCls}>Adresse email</label>
                  <GlassInput>
                    <input
                      id="reg-email" name="email" type="email" value={email}
                      onChange={(e) => setEmail(e.target.value)} placeholder="vous@agence.fr"
                      required autoComplete="email" className={fieldCls}
                    />
                  </GlassInput>
                </div>

                <div className="auth-in auth-d4">
                  <label htmlFor="reg-password" className={labelCls}>Mot de passe</label>
                  <GlassInput>
                    <div className="relative">
                      <input
                        id="reg-password" name="password" type={showPw ? 'text' : 'password'} value={password}
                        onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum"
                        required autoComplete="new-password" className={`${fieldCls} pr-12`}
                      />
                      <button
                        type="button" onClick={() => setShowPw(!showPw)}
                        aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                        className="absolute inset-y-0 right-3 flex items-center bg-transparent border-none cursor-pointer"
                        style={{ color: D.text3 }}
                      >
                        {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </GlassInput>
                </div>

                <div className="auth-in auth-d5">
                  <label htmlFor="reg-confirm-password" className={labelCls}>Confirmer le mot de passe</label>
                  <GlassInput>
                    <input
                      id="reg-confirm-password" type={showPw ? 'text' : 'password'} value={confirmPw}
                      onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••••"
                      required autoComplete="new-password" className={fieldCls}
                    />
                  </GlassInput>
                </div>

                <button
                  type="submit" disabled={loading}
                  className="auth-in auth-d6 w-full rounded-2xl py-[15px] text-[15px] font-semibold border-none cursor-pointer flex items-center justify-center gap-2 transition-colors active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: loading ? 'oklch(40% 0.02 265)' : D.accent, color: loading ? D.text2 : 'oklch(98% 0.004 265)' }}
                >
                  {loading ? 'Création…' : 'Créer mon compte'}
                  {!loading && <ArrowRight size={16} />}
                </button>
              </form>

              <div className="auth-in auth-d7 relative flex items-center justify-center">
                <span className="w-full border-t" style={{ borderColor: D.border }} />
                <span className="px-4 text-[12px] absolute font-medium uppercase tracking-[0.1em]" style={{ color: D.text3, background: D.bg }}>ou</span>
              </div>

              <div className="auth-in auth-d7">
                <GoogleAuthButton mode="register" onError={setError} disabled={loading} />
              </div>

              <p className="auth-in auth-d7 text-center text-[13px]" style={{ color: D.text3 }}>
                Déjà un compte ?{' '}
                <Link to="/login" className="font-semibold no-underline hover:underline" style={{ color: D.accentHi }}>
                  Se connecter
                </Link>
              </p>

              <p className="auth-in text-[12px] leading-relaxed text-center" style={{ color: 'oklch(35% 0.006 265)' }}>
                En créant un compte, vous acceptez nos{' '}
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: D.text3 }}>CGU</a>
                {' '}et notre{' '}
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: D.text3 }}>politique de confidentialité</a>.
              </p>
            </div>
          ) : (
            /* ── Activation screen ── */
            <div className="auth-in text-center max-w-sm mx-auto">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6" style={{ background: D.okDim, border: `1px solid ${D.okBrd}` }}>
                <Mail size={28} style={{ color: D.ok }} />
              </div>
              <h2 className="text-[1.6rem] font-semibold tracking-[-0.03em] mb-3" style={{ color: D.text }}>Vérifiez votre email</h2>
              <p className="text-[14px] leading-[1.6] mb-1" style={{ color: D.text2 }}>Un lien d'activation a été envoyé à</p>
              <p className="text-[15px] font-semibold mb-8" style={{ color: D.text }}>{email}</p>

              {resendOk && (
                <div className="rounded-2xl px-4 py-3 text-[13px] mb-5 flex items-center justify-center gap-1.5" style={{ background: D.okDim, border: `1px solid ${D.okBrd}`, color: D.ok }}>
                  <Check size={14} /> Email renvoyé avec succès
                </div>
              )}

              <button
                onClick={handleResend} disabled={resending}
                className="border rounded-2xl px-5 py-3 text-[13px] font-medium cursor-pointer transition-colors bg-transparent hover:border-[oklch(56%_0.22_158/0.45)] hover:text-[oklch(63%_0.21_158)] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ borderColor: D.border, color: D.text2 }}
              >
                {resending ? 'Renvoi…' : `Renvoyer l'email`}
              </button>

              <div className="mt-8">
                <Link to="/login" className="text-[13px] no-underline hover:underline" style={{ color: D.text3 }}>Retour à la connexion</Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── RIGHT — Qwillio brand panel (desktop) ── */}
      <section className="hidden lg:block flex-1 relative p-4">
        <div
          className="auth-slide-right auth-d2 absolute inset-4 rounded-3xl overflow-hidden border flex flex-col justify-between p-12"
          style={{ background: 'linear-gradient(160deg, oklch(13% 0.02 265) 0%, oklch(9% 0.012 265) 100%)', borderColor: D.border }}
        >
          <div className="absolute pointer-events-none" style={{ inset: 0, background: 'radial-gradient(ellipse 460px 360px at 85% 8%, oklch(56% 0.02 265 / 0.10) 0%, transparent 70%)' }} />

          <span className="relative inline-block w-fit text-[11px] font-semibold uppercase tracking-[0.1em] px-3 py-1.5 rounded-full" style={{ background: D.accentDim, color: D.accentHi, border: `1px solid ${D.accentBrd}` }}>
            Essai sans engagement
          </span>

          <div className="relative">
            <h2 className="font-semibold tracking-[-0.035em] leading-[1.1]" style={{ fontSize: 'clamp(1.9rem, 2.6vw, 2.7rem)', color: D.text }}>
              Lancez votre <span style={{ color: D.accentHi }}>réceptionniste IA</span> en quelques minutes.
            </h2>
            <p className="mt-4 text-[15px] leading-[1.65] max-w-[380px]" style={{ color: D.text2 }}>
              Configurez, testez, mettez en ligne. Vos appels répondus 24h/24 dès aujourd'hui.
            </p>
          </div>

          <div className="relative flex flex-col gap-3.5">
            {[
              { icon: <Clock size={15} />, text: 'Premiers appels en 10 minutes' },
              { icon: <Phone size={15} />, text: 'Sans engagement annuel' },
              { icon: <BarChart2 size={15} />, text: 'Support FR 7j/7' },
            ].map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-[9px] flex items-center justify-center shrink-0" style={{ background: D.accentDim, border: `1px solid ${D.accentBrd}`, color: D.accentHi }}>
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
