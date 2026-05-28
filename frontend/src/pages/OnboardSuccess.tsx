import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2 } from 'lucide-react';
import api from '../services/api';
import { useAuthStore } from '../stores/authStore';
import QwillioLogo from '../components/QwillioLogo';

// Landing page after Stripe Checkout success.
// Polls /auth/me until subscriptionStatus === 'active', then redirects to /dashboard.
// Webhook can lag a few seconds — show a friendly waiting state instead of erroring.

export default function OnboardSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'waiting' | 'active' | 'timeout'>('waiting');
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const { data } = await api.get('/auth/me');
        const subStatus = data?.user?.client?.subscriptionStatus ?? data?.client?.subscriptionStatus;
        if (subStatus === 'active') {
          if (!cancelled) {
            useAuthStore.setState({ user: data.user ?? data, isLoading: false });
            setStatus('active');
            // Brief success flash, then redirect
            window.setTimeout(() => navigate('/dashboard?welcome=1'), 1200);
          }
          return;
        }
      } catch {
        // Network blip — just retry
      }
      setAttempts(n => n + 1);
      timer = window.setTimeout(poll, 2000);
    };

    poll();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [navigate]);

  // After 30 attempts (~60s), surface a softer "still processing" message but keep polling.
  useEffect(() => {
    if (attempts >= 30 && status === 'waiting') setStatus('timeout');
  }, [attempts, status]);

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2">
          <QwillioLogo size={32} />
          <span className="text-xl font-semibold tracking-tight">Qwillio</span>
        </div>

        {status === 'active' ? (
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-5">
            <Check size={28} className="text-emerald-600" />
          </div>
        ) : (
          <div className="w-16 h-16 rounded-2xl bg-[#6366f1]/10 flex items-center justify-center mx-auto mb-5">
            <Loader2 size={28} className="text-[#6366f1] animate-spin" />
          </div>
        )}

        {status === 'active' && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Paiement confirmé</h1>
            <p className="text-sm text-[#86868b]">Redirection vers votre dashboard…</p>
          </>
        )}

        {status === 'waiting' && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Activation en cours</h1>
            <p className="text-sm text-[#86868b]">
              Stripe a reçu votre paiement. On finalise la configuration. Ça prend quelques secondes.
            </p>
          </>
        )}

        {status === 'timeout' && (
          <>
            <h1 className="text-2xl font-semibold tracking-tight mb-2">Toujours en activation</h1>
            <p className="text-sm text-[#86868b] mb-4">
              Votre paiement est enregistré (session {sessionId?.slice(0, 12)}…). L'activation prend un peu plus longtemps que prévu, on continue à vérifier.
            </p>
            <p className="text-xs text-[#86868b]">
              Si la page reste bloquée plus d'une minute, contactez le support.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
