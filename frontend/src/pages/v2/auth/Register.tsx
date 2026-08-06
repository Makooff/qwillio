import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Check, Eye, EyeOff, Mail } from '../../../components/icons';
import { useAuthStore } from '../../../stores/authStore';
import { useSEO } from '../../../hooks/useSEO';
import api from '../../../services/api';
import { captureBillingPeriod } from '../../../lib/billingPeriod';
import AuthShell, {
  AuthDivider,
  GoogleAuthV2,
  AUTH_ALERT,
  AUTH_FIELD,
  AUTH_ICON_PLATE,
  AUTH_LABEL,
  AUTH_LINK,
  AUTH_NOTICE,
  AUTH_OUTLINE,
  AUTH_SUBMIT,
} from './AuthShell';

/* Création de compte V2, registre clair (DA/v2-direction.md).
   Logique portée de pages/Register.tsx: authStore.register, écran d'activation,
   renvoi d'email, Google. La capture du parrainage reste globale. */

type Step = 'form' | 'activation';

export default function Register() {
  useSEO({ title: 'Créer un compte · Qwillio', noindex: true });

  /* La page tarifs arrive ici avec ?billing=annual. On la range tout de suite:
     la confirmation d'adresse passe entre cet écran et le paiement, et l'URL
     ne survit pas au trajet. */
  useEffect(() => captureBillingPeriod(window.location.search), []);

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
      // Registration already handed out a JWT, so an unconfirmed account is
      // "logged in". Sending it to /subscribe would only get it bounced; the
      // guards own the routing from here.
      if (user?.emailConfirmed) { navigate('/subscribe'); } else { setStep('activation'); }
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

  if (step === 'activation') {
    return (
      <AuthShell
        title="Vérifiez votre email"
        subtitle="Un lien d'activation a été envoyé à votre adresse."
        footer={
          <Link to="/login" className={AUTH_LINK}>
            Retour à la connexion
          </Link>
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3">
            <span className={AUTH_ICON_PLATE}>
              <Mail size={20} className="text-q2-indigo" aria-hidden="true" />
            </span>
            <p className="text-[15px] font-medium text-q2-ink break-all">{email}</p>
          </div>

          {resendOk && (
            <p className={`${AUTH_NOTICE} flex items-center gap-1.5`} role="status">
              <Check size={14} aria-hidden="true" /> Email renvoyé avec succès
            </p>
          )}

          <button onClick={handleResend} disabled={resending} className={`${AUTH_OUTLINE} w-full`}>
            {resending ? 'Renvoi…' : `Renvoyer l'email`}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Créer votre compte"
      subtitle="Premiers appels en 10 minutes."
      footer={
        <>
          <p>
            Déjà un compte ?{' '}
            <Link to="/login" className={AUTH_LINK}>
              Se connecter
            </Link>
          </p>
          <p className="mt-4 text-[12px] text-q2-body">
            En créant un compte, vous acceptez nos{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className={AUTH_LINK}>CGU</a>
            {' '}et notre{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className={AUTH_LINK}>politique de confidentialité</a>.
          </p>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {error && (
          <div className={AUTH_ALERT} role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="reg-email" className={AUTH_LABEL}>Adresse email</label>
            <input
              id="reg-email" name="email" type="email" value={email}
              onChange={(e) => setEmail(e.target.value)} placeholder="vous@agence.fr"
              required autoComplete="email" className={AUTH_FIELD}
            />
          </div>

          <div>
            <label htmlFor="reg-password" className={AUTH_LABEL}>Mot de passe</label>
            <div className="relative">
              <input
                id="reg-password" name="password" type={showPw ? 'text' : 'password'} value={password}
                onChange={(e) => setPassword(e.target.value)} placeholder="8 caractères minimum"
                required autoComplete="new-password" className={`${AUTH_FIELD} pr-12`}
              />
              <button
                type="button" onClick={() => setShowPw(!showPw)}
                aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                className="absolute inset-y-0 right-3 flex items-center text-q2-body hover:text-q2-graphite transition-colors duration-150 focus:outline-none focus-visible:text-q2-ink"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="reg-confirm-password" className={AUTH_LABEL}>Confirmer le mot de passe</label>
            <input
              id="reg-confirm-password" type={showPw ? 'text' : 'password'} value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)} placeholder="••••••••"
              required autoComplete="new-password" className={AUTH_FIELD}
            />
          </div>

          <button type="submit" disabled={loading} className={AUTH_SUBMIT}>
            {loading ? 'Création…' : 'Créer mon compte'}
            {!loading && <ArrowRight size={16} aria-hidden="true" />}
          </button>
        </form>

        <AuthDivider label="ou" />

        <GoogleAuthV2 mode="register" onError={setError} disabled={loading} />
      </div>
    </AuthShell>
  );
}
