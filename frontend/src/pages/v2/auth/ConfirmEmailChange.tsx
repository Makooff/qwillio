import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from '../../../components/icons';
import LangToggle from '../../../components/LangToggle';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../services/api';
import { PillLink } from '../../../components/v2/Button';
import AuthShell, { AUTH_ICON_PLATE } from './AuthShell';

/**
 * Le second temps d'un changement d'adresse de connexion.
 *
 * Le lien arrive dans la NOUVELLE boîte, et c'est son ouverture qui prouve
 * qu'elle existe et qu'elle appartient bien à la même personne. Jusqu'à ce
 * clic, le compte garde son ancienne adresse: une faute de frappe ne ferme
 * donc jamais la porte.
 *
 * La page ressemble à `ConfirmEmail`, mais ne s'y greffe pas: celle-là ouvre
 * une session à partir d'un JWT et route selon l'état de l'abonnement, ce qui
 * n'a aucun sens ici, où l'on est déjà connecté et où l'on ne fait que
 * confirmer. Les mélanger aurait produit une page à deux comportements.
 */
export default function ConfirmEmailChange() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const { checkAuth } = useAuthStore();
  /* React 18 monte deux fois en développement: sans ce garde, le jeton, qui est
     à usage unique, serait consommé par le premier appel et le second
     afficherait « lien déjà utilisé » sur un changement pourtant réussi. */
  const done = useRef(false);

  useEffect(() => {
    if (done.current) return;
    done.current = true;

    if (!token) {
      setStatus('error');
      setMessage('Lien incomplet. Refaites la demande depuis votre compte.');
      return;
    }

    api.get(`/auth/confirm-email-change/${token}`)
      .then(async (res) => {
        setStatus('success');
        setMessage(`Vous vous connectez désormais avec ${res.data?.email}.`);
        /* La session porte l'ancienne adresse: on relit le compte pour que le
           portail affiche la nouvelle sans redemander une connexion. */
        await checkAuth();
      })
      .catch((err) => {
        setStatus('error');
        setMessage(err?.response?.data?.error || "La confirmation n'a pas abouti. Refaites la demande.");
      });
  }, [token, checkAuth]);

  const title =
    status === 'loading' ? 'Confirmation…'
      : status === 'success' ? 'Adresse confirmée'
      : 'Confirmation impossible';

  return (
    <AuthShell title={title} subtitle={message} headerRight={<LangToggle />}>
      {status === 'loading' && (
        <span className={AUTH_ICON_PLATE}>
          <Loader2 size={20} className="text-q2-indigo animate-spin" aria-hidden="true" />
        </span>
      )}

      {status === 'success' && (
        <div className="flex flex-col gap-6">
          <span className={AUTH_ICON_PLATE}>
            <CheckCircle2 size={20} className="text-q2-indigo" aria-hidden="true" />
          </span>
          <PillLink to="/dashboard/account" variant="primary" size="lg" className="w-full">
            Retour au compte
          </PillLink>
        </div>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-6">
          <span className={AUTH_ICON_PLATE}>
            <XCircle size={20} className="text-[color:var(--q2-bad-ink)]" aria-hidden="true" />
          </span>
          <PillLink to="/dashboard/account" variant="primary" size="lg" className="w-full">
            Retour au compte
          </PillLink>
        </div>
      )}
    </AuthShell>
  );
}
