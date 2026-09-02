import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MailCheck } from '../components/icons';
import api from '../services/api';
import QwillioLogo from '../components/QwillioLogo';
import { useSEO } from '../hooks/useSEO';

const D = {
  bg:     'oklch(8% 0 0)',
  bg2:    'oklch(11% 0 0)',
  border: 'oklch(22% 0 0 / 0.55)',
  text:   'oklch(95% 0 0)',
  text2:  'oklch(65% 0 0)',
  text3:  'oklch(42% 0 0)',
  accent: 'oklch(60.4% 0.213 285.5)',
  accentHi: 'oklch(66% 0.19 286)',
} as const;

const inputCls = `
  w-full bg-[oklch(6%_0_0)] border border-[oklch(22%_0_0/0.55)]
  rounded-[10px] px-4 py-[13px] text-[oklch(95%_0_0)] text-[15px]
  font-[Outfit,system-ui,sans-serif] outline-none
  transition-colors focus:border-[oklch(56%_0.22_158/0.40)]
  placeholder:text-[oklch(35%_0_0)]
`.replace(/\s+/g, ' ').trim();

const labelCls = 'block text-[11px] font-bold uppercase tracking-[0.08em] text-[oklch(42%_0_0)] mb-2';

export default function ForgotPassword() {
  useSEO({ title: 'Mot de passe oublié — Qwillio', noindex: true });

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const language = navigator.language?.startsWith('en') ? 'en' : 'fr';
      await api.post('/auth/forgot-password', { email: email.trim(), language });
    } catch {
      // Intentionally ignore — the endpoint always responds generically so we
      // never reveal whether the address exists.
    } finally {
      setLoading(false);
      setSent(true);
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

        {sent ? (
          <div>
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'oklch(60.4% 0.213 285.5 / 0.12)' }}
            >
              <MailCheck size={22} style={{ color: D.accentHi }} aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold mb-2" style={{ color: D.text }}>Vérifiez vos courriels</h1>
            <p className="text-[14px] leading-relaxed mb-6" style={{ color: D.text2 }}>
              Si un compte existe pour <strong style={{ color: D.text }}>{email.trim()}</strong>, un lien de
              réinitialisation vient d'être envoyé. Le lien expire dans 1 heure.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold no-underline hover:underline"
              style={{ color: D.accentHi }}
            >
              Retour à la connexion <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold mb-2" style={{ color: D.text }}>Mot de passe oublié ?</h1>
            <p className="text-[14px] leading-relaxed mb-6" style={{ color: D.text2 }}>
              Entrez votre adresse courriel et nous vous enverrons un lien pour réinitialiser votre mot de passe.
            </p>
            <form onSubmit={handleSubmit} noValidate>
              <label htmlFor="email" className={labelCls}>Adresse courriel</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@entreprise.com"
                className={inputCls}
              />
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 rounded-[10px] py-[13px] text-[15px] font-semibold text-white transition-opacity disabled:opacity-50"
                style={{ background: D.accent }}
              >
                {loading ? 'Envoi…' : 'Envoyer le lien'}
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
