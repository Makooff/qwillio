import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ArrowRight, Eye, EyeOff, BarChart2, Phone, Clock } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { useSEO } from '../hooks/useSEO';

const D = {
  bg:        'oklch(8% 0.009 265)',
  bg2:       'oklch(11% 0.013 265)',
  border:    'oklch(22% 0.012 265 / 0.55)',
  text:      'oklch(95% 0.004 265)',
  text2:     'oklch(65% 0.007 265)',
  text3:     'oklch(42% 0.006 265)',
  accent:    'oklch(56% 0.22 264)',
  accentHi:  'oklch(63% 0.21 264)',
  accentBrd: 'oklch(56% 0.22 264 / 0.40)',
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

export default function Login() {
  useSEO({ title: 'Connexion — Qwillio', noindex: true });

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [warming, setWarming] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Silent pre-warm: kick the backend on page load so Neon is awake before Google popup completes
  useEffect(() => {
    const url = (import.meta.env.VITE_API_URL || 'https://qwillio.onrender.com').replace(/\/api$/, '');
    fetch(`${url}/api/health`, { signal: AbortSignal.timeout(30000) }).catch(() => {});
  }, []);

  const { login } = useAuthStore();
  const navigate  = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    setWarming(false);
    setElapsed(0);
    const start = Date.now();
    let ticker: ReturnType<typeof setInterval> | null = null;
    for (let i = 0; i < 10; i++) {
      try {
        await login(email.trim(), password);
        if (ticker) clearInterval(ticker);
        const { user } = useAuthStore.getState();
        navigate(user?.role === 'admin' ? '/admin' : '/dashboard');
        return;
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        if (status === 503 && i < 9) {
          if (i === 0) {
            setWarming(true);
            ticker = setInterval(() => setElapsed(Math.round((Date.now() - start) / 1000)), 1000);
          }
          await new Promise(r => setTimeout(r, 10000));
          continue;
        }
        if (ticker) clearInterval(ticker);
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
        setError(msg || (err as { message?: string })?.message || 'Identifiants incorrects.');
        break;
      }
    }
    setWarming(false);
    setLoading(false);
  }

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

        <div>
          <div
            className="inline-block text-[10px] font-bold uppercase tracking-[0.09em] px-3 py-1.5 rounded-full mb-6"
            style={{
              background: 'oklch(56% 0.22 264 / 0.10)',
              color: 'oklch(42% 0.18 264)',
            }}
          >
            Plateforme IA vocale
          </div>
          <h2
            className="font-extrabold tracking-[-0.035em] leading-[1.1] mb-4"
            style={{
              fontSize: 'clamp(1.8rem, 3vw, 2.6rem)',
              color: D.lText,
            }}
          >
            Vos prospects{' '}
            <span style={{ color: 'oklch(52% 0.20 264)' }}>appelés</span>
            {'. Vos rendez-vous pris.'}
          </h2>
          <p className="text-[15px] leading-[1.65] max-w-[360px]" style={{ color: D.lText2 }}>
            L'IA vocale B2B qui prospecte pendant que votre équipe dort.
          </p>
        </div>

        <div className="flex flex-col gap-3.5">
          {[
            { icon: <Phone size={14} />, text: `Appels IA indiscernables d'un humain` },
            { icon: <BarChart2 size={14} />, text: 'Qualification automatique des leads' },
            { icon: <Clock size={14} />, text: 'Premiers rendez-vous le jour même' },
          ].map((f, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div
                className="w-[30px] h-[30px] rounded-[7px] flex items-center justify-center shrink-0"
                style={{
                  background: 'oklch(56% 0.22 264 / 0.10)',
                  border: '1px solid oklch(56% 0.22 264 / 0.22)',
                  color: 'oklch(42% 0.18 264)',
                }}
              >
                {f.icon}
              </div>
              <span className="text-[13px] font-medium" style={{ color: D.lText2 }}>{f.text}</span>
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
            background: 'radial-gradient(ellipse 400px 300px at 70% 15%, oklch(56% 0.22 264 / 0.06) 0%, transparent 70%)',
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
          <div className="mb-8">
            <h1
              className="text-[1.8rem] font-extrabold tracking-[-0.035em] mb-1"
              style={{ color: D.text }}
            >
              Bienvenue
            </h1>
            <p className="text-[15px]" style={{ color: D.text2 }}>
              Connectez-vous à votre espace Qwillio.
            </p>
          </div>

          {error && (
            <div
              className="rounded-[10px] px-3.5 py-2.5 text-[13px] mb-5"
              style={{
                background: D.badDim,
                border: `1px solid ${D.bad}`,
                color: D.bad,
              }}
            >
              {error}
            </div>
          )}

          {/* Google button */}
          <GoogleAuthButton mode="login" onError={setError} disabled={loading} />

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
              <label htmlFor="login-email" className={labelCls}>Adresse email</label>
              <input
                id="login-email"
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
              <label htmlFor="login-password" className={labelCls}>Mot de passe</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
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
              <div className="mt-2 text-right">
                <a
                  href="#"
                  className="text-[12px] no-underline transition-colors hover:text-[oklch(56%_0.22_264)]"
                  style={{ color: D.text3 }}
                >
                  Mot de passe oublié ?
                </a>
              </div>
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
              {warming ? `Démarrage... ${elapsed}s` : loading ? 'Connexion...' : 'Se connecter'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>

          <p className="mt-5 text-[13px]" style={{ color: D.text3 }}>
            Pas encore de compte ?{' '}
            <Link to="/register" className="font-semibold no-underline" style={{ color: D.accent }}>
              Créer un compte
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
