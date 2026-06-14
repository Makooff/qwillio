import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import QwillioLogo from '../components/QwillioLogo';
import { useSEO } from '../hooks/useSEO';

const D = {
  bg:     'oklch(8% 0.009 265)',
  bg2:    'oklch(11% 0.013 265)',
  border: 'oklch(22% 0.012 265 / 0.55)',
  text:   'oklch(95% 0.004 265)',
  text2:  'oklch(65% 0.007 265)',
  text3:  'oklch(42% 0.006 265)',
  accent: 'oklch(56% 0.22 158)',
  accentHi: 'oklch(63% 0.21 158)',
  bad:    'oklch(65% 0.22 25)',
  ok:     'oklch(72% 0.18 145)',
} as const;

const inputCls = `
  w-full bg-[oklch(6%_0.007_265)] border border-[oklch(22%_0.012_265/0.55)]
  rounded-[10px] px-4 py-[13px] pr-11 text-[oklch(95%_0.004_265)] text-[15px]
  font-[Outfit,system-ui,sans-serif] outline-none
  transition-colors focus:border-[oklch(56%_0.22_158/0.40)]
  placeholder:text-[oklch(35%_0.006_265)]
`.replace(/\s+/g, ' ').trim();

const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.08em] text-[oklch(42%_0.006_265)] mb-2';

export default function ResetPassword() {
  useSEO({ title: 'Réinitialiser le mot de passe — Qwillio', noindex: true });

  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2200);
    } catch (err: any) {
      const errData = err?.response?.data?.error;
      setError(typeof errData === 'string' ? errData : 'Lien invalide ou expiré. Veuillez en demander un nouveau.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-dvh flex items-center justify-center px-6"
      style={{ background: D.bg, fontFamily: "'Outfit', system-ui, sans-serif" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8"
        style={{ background: D.bg2, border: `1px solid ${D.border}` }}
      >
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-[17px] font-extrabold no-underline tracking-[-0.025em] mb-8"
          style={{ color: D.text }}
        >
          <QwillioLogo size={24} />
          Qwillio
        </Link>

        {done ? (
          <div>
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'oklch(72% 0.18 145 / 0.12)' }}
            >
              <CheckCircle2 size={22} style={{ color: D.ok }} aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold mb-2" style={{ color: D.text }}>Mot de passe mis à jour</h1>
            <p className="text-[14px] leading-relaxed" style={{ color: D.text2 }}>
              Vous allez être redirigé vers la connexion…
            </p>
          </div>
        ) : !token ? (
          <div>
            <h1 className="text-xl font-bold mb-2" style={{ color: D.text }}>Lien invalide</h1>
            <p className="text-[14px] leading-relaxed mb-6" style={{ color: D.text2 }}>
              Ce lien de réinitialisation est incomplet ou expiré.
            </p>
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold no-underline hover:underline"
              style={{ color: D.accentHi }}
            >
              Demander un nouveau lien <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-2" style={{ color: D.text }}>Nouveau mot de passe</h1>
            <p className="text-[14px] leading-relaxed mb-6" style={{ color: D.text2 }}>
              Choisissez un nouveau mot de passe (8 caractères minimum).
            </p>
            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="password" className={labelCls}>Nouveau mot de passe</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={inputCls}
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

              <label htmlFor="confirm" className={`${labelCls} mt-4`}>Confirmer le mot de passe</label>
              <input
                id="confirm"
                type={showPw ? 'text' : 'password'}
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
              />

              {error && (
                <p className="mt-3 text-[13px]" style={{ color: D.bad }} role="alert">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !password || !confirm}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-[10px] py-[13px] text-[15px] font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: D.accent }}
              >
                {loading ? 'Mise à jour…' : 'Réinitialiser le mot de passe'}
                {!loading && <ArrowRight size={16} aria-hidden="true" />}
              </button>
            </form>
            <Link
              to="/login"
              className="inline-block mt-5 text-[13px] no-underline hover:underline"
              style={{ color: D.text3 }}
            >
              Retour à la connexion
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
