import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MailCheck } from 'lucide-react';
import api from '../../../services/api';
import { useSEO } from '../../../hooks/useSEO';
import AuthShell, {
  AUTH_FIELD,
  AUTH_ICON_PLATE,
  AUTH_LABEL,
  AUTH_LINK,
  AUTH_SUBMIT,
} from './AuthShell';

/* Mot de passe oublié V2 — registre clair. Logique portée de
   pages/ForgotPassword.tsx: réponse volontairement générique, jamais
   d'indication sur l'existence du compte. */

export default function ForgotPassword() {
  useSEO({ title: 'Mot de passe oublié · Qwillio', noindex: true });

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

  if (sent) {
    return (
      <AuthShell
        title="Vérifiez vos courriels"
        subtitle={
          <>
            Si un compte existe pour <strong className="font-medium text-q2-ink">{email.trim()}</strong>, un lien de
            réinitialisation vient d'être envoyé. Le lien expire dans 1 heure.
          </>
        }
      >
        <div className="flex flex-col gap-6">
          <span className={AUTH_ICON_PLATE}>
            <MailCheck size={20} className="text-q2-indigo" aria-hidden="true" />
          </span>
          <Link to="/login" className={`${AUTH_LINK} inline-flex items-center gap-1.5 text-[14px] font-medium`}>
            Retour à la connexion <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Mot de passe oublié ?"
      subtitle="Entrez votre adresse courriel et nous vous enverrons un lien pour réinitialiser votre mot de passe."
      footer={
        <Link to="/login" className={AUTH_LINK}>
          Retour à la connexion
        </Link>
      }
    >
      <form onSubmit={handleSubmit} noValidate>
        <label htmlFor="email" className={AUTH_LABEL}>Adresse courriel</label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vous@entreprise.com"
          className={AUTH_FIELD}
        />
        <button type="submit" disabled={loading || !email.trim()} className={`${AUTH_SUBMIT} mt-5`}>
          {loading ? 'Envoi…' : 'Envoyer le lien'}
          {!loading && <ArrowRight size={16} aria-hidden="true" />}
        </button>
      </form>
    </AuthShell>
  );
}
