import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import LangToggle from '../../../components/LangToggle';
import { useLang } from '../../../stores/langStore';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../services/api';
import { PillLink } from '../../../components/v2/Button';
import AuthShell, { AUTH_ICON_PLATE } from './AuthShell';

/* Confirmation d'email V2, registre clair. Logique portée de
   pages/ConfirmEmail.tsx: jeton URL, JWT stocké, redirection sur le compte
   rafraîchi (jamais sur la réponse de confirmation). */

export default function ConfirmEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState('');
  const { checkAuth } = useAuthStore();
  const { t } = useLang();

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError(t('confirm.missingToken'));
      return;
    }

    api.get(`/auth/confirm/${token}`)
      .then(async (res) => {
        const { token: jwtToken } = res.data;
        if (jwtToken) {
          localStorage.setItem('token', jwtToken);
        }
        await checkAuth();
        setStatus('success');

        // Route on the refreshed account, not on the confirm response: only the
        // former knows whether a card is already on file.
        setTimeout(() => {
          const fresh = useAuthStore.getState().user;
          if (fresh?.onboardingCompleted) {
            navigate(fresh.role === 'admin' ? '/admin' : '/dashboard');
          } else if (!fresh?.hasSubscription) {
            navigate('/subscribe');
          } else {
            navigate('/onboard');
          }
        }, 2000);
      })
      .catch((err) => {
        setStatus('error');
        const errData = err.response?.data?.error;
        setError(typeof errData === 'string' ? errData : (errData?.message || err.message || t('confirm.errorFallback')));
      });
  }, [token]);

  const title =
    status === 'loading' ? t('confirm.loading') : status === 'success' ? t('confirm.success') : t('confirm.failed');
  const subtitle = status === 'loading' ? t('confirm.wait') : status === 'success' ? t('confirm.redirect') : error;

  return (
    <AuthShell title={title} subtitle={subtitle} headerRight={<LangToggle />}>
      {status === 'loading' && (
        <span className={AUTH_ICON_PLATE}>
          <Loader2 size={20} className="text-q2-indigo animate-spin" aria-hidden="true" />
        </span>
      )}

      {status === 'success' && (
        <span className={AUTH_ICON_PLATE}>
          <CheckCircle2 size={20} className="text-q2-indigo" aria-hidden="true" />
        </span>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-6">
          <span className={AUTH_ICON_PLATE}>
            <XCircle size={20} className="text-[#b42318]" aria-hidden="true" />
          </span>
          <PillLink to="/login" variant="primary" size="lg" className="w-full">
            {t('confirm.goLogin')}
          </PillLink>
        </div>
      )}
    </AuthShell>
  );
}
