import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, LogOut, Mail, RefreshCw } from '../../../components/icons';
import LangToggle from '../../../components/LangToggle';
import { useLang } from '../../../stores/langStore';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../services/api';
import AuthShell, { AUTH_ALERT, AUTH_ICON_PLATE, AUTH_NOTICE, AUTH_OUTLINE, AUTH_SUBMIT } from './AuthShell';

/**
 * First gate of sign-up. Registration hands out a JWT immediately, so this is
 * the wall that keeps an unconfirmed account from wandering into the product:
 * every other route bounces back here until the address is proven.
 */
export default function VerifyEmail() {
  const navigate = useNavigate();
  const { user, logout, checkAuth } = useAuthStore();
  const { lang } = useLang();
  const isFr = lang === 'fr';

  const [resending, setResending] = useState(false);
  const [resendOk, setResendOk] = useState(false);
  const [resendError, setResendError] = useState(false);
  const [checking, setChecking] = useState(false);

  const resend = async () => {
    setResending(true);
    setResendOk(false);
    setResendError(false);
    try {
      await api.post('/auth/resend-confirmation');
      setResendOk(true);
      setTimeout(() => setResendOk(false), 5000);
    } catch {
      /* L'échec était silencieux: on cliquait, rien ne bougeait. C'est
         exactement l'écran où l'on est déjà en train d'attendre un email qui
         n'arrive pas, donc le seul où le silence est insupportable. */
      setResendError(true);
    } finally {
      setResending(false);
    }
  };

  // Confirming happens in another tab, so this window has no way of knowing on
  // its own. Re-reading the account is the cheapest way to move on.
  const refresh = async () => {
    setChecking(true);
    try { await checkAuth(); } finally { setChecking(false); }
  };

  return (
    <AuthShell
      title={isFr ? 'Vérifiez votre email' : 'Check your email'}
      subtitle={
        <>
          {isFr ? "Un lien d'activation a été envoyé à " : 'An activation link was sent to '}
          <strong className="font-medium text-q2-ink break-all">{user?.email}</strong>
          {isFr
            ? '. Ouvrez-le pour continuer votre inscription.'
            : '. Open it to continue signing up.'}
        </>
      }
      headerRight={
        <>
          <LangToggle />
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="inline-flex items-center gap-1.5 text-sm text-q2-body hover:text-[color:var(--q2-bad-ink)] transition-colors duration-150"
            title={isFr ? 'Se déconnecter' : 'Log out'}
          >
            <LogOut size={16} />
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <span className={AUTH_ICON_PLATE}>
          <Mail size={20} className="text-q2-indigo" aria-hidden="true" />
        </span>

        {resendOk && (
          <p role="status" className={AUTH_NOTICE}>
            {isFr ? 'Email renvoyé.' : 'Email sent again.'}
          </p>
        )}

        {resendError && (
          <p role="alert" className={AUTH_ALERT}>
            {isFr
              ? "L'envoi a échoué. Réessayez dans un instant, ou écrivez-nous à contact@qwillio.com."
              : 'Sending failed. Try again shortly, or email us at contact@qwillio.com.'}
          </p>
        )}

        <div className="flex flex-col gap-3">
          <button type="button" onClick={refresh} disabled={checking} className={AUTH_SUBMIT}>
            {checking ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {isFr ? "J'ai confirmé" : 'I confirmed'}
          </button>
          <button type="button" onClick={resend} disabled={resending} className={`${AUTH_OUTLINE} w-full`}>
            {resending ? (isFr ? 'Envoi…' : 'Sending…') : (isFr ? "Renvoyer l'email" : 'Resend email')}
          </button>
        </div>
      </div>
    </AuthShell>
  );
}
