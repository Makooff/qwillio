import { useGoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { useState, useRef } from 'react';

const GoogleSVG = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
    <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
    <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
  </svg>
);

interface Props {
  mode: 'login' | 'register';
  disabled?: boolean;
  onError: (msg: string) => void;
}

const MAX_ATTEMPTS = 6;
const RETRY_DELAY  = 8000; // ms between retries

function GoogleButton({ mode, disabled, onError }: Props) {
  const { googleLogin } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading]   = useState(false);
  const [attempt, setAttempt]   = useState(0);
  const cancelledRef = useRef(false);

  async function doLogin(token: string, attemptNum: number): Promise<void> {
    if (cancelledRef.current) return;
    setAttempt(attemptNum);
    try {
      await googleLogin(token, 'token');
      if (cancelledRef.current) return;
      const { user } = useAuthStore.getState();
      navigate(user?.role === 'admin' ? '/admin' : (user?.onboardingCompleted ? '/dashboard' : '/onboard'));
    } catch (err: any) {
      if (cancelledRef.current) return;
      const isServerError = !err?.response || err?.response?.status === 500 || err?.response?.status === 503;
      if (isServerError && attemptNum < MAX_ATTEMPTS) {
        // Server/DB still cold — retry after delay
        await new Promise(r => setTimeout(r, RETRY_DELAY));
        return doLogin(token, attemptNum + 1);
      }
      // Final failure or non-retryable error
      const msg = err?.response?.data?.error;
      onError(msg || 'Serveur indisponible. Réessaie dans quelques secondes.');
      setLoading(false);
      setAttempt(0);
    }
  }

  const googleSignIn = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      onError('');
      cancelledRef.current = false;
      setLoading(true);
      setAttempt(1);
      await doLogin(tokenResponse.access_token, 1);
    },
    onError: (err?: any) => {
      const code = err?.error || '';
      if (code === 'popup_closed_by_user' || code === 'access_denied') return;
      if (code === 'popup_blocked_by_browser') {
        onError('Popup bloqué. Autorise les popups pour ce site.');
      } else {
        onError('Google Sign-In non configuré pour ce domaine. Utilise email/mot de passe.');
      }
    },
    flow: 'implicit',
  });

  const baseLabel = mode === 'login' ? 'Se connecter avec Google' : "S'inscrire avec Google";

  function getLabel() {
    if (!loading) return baseLabel;
    if (attempt <= 1) return 'Connexion en cours...';
    if (attempt <= 2) return 'Démarrage du serveur...';
    return `Connexion... (${attempt}/${MAX_ATTEMPTS})`;
  }

  return (
    <button
      type="button"
      onClick={() => !loading && googleSignIn()}
      disabled={disabled || loading}
      className="w-full inline-flex items-center justify-center gap-2 bg-white text-[#1d1d1f] text-base font-medium px-6 py-3.5 rounded-full border border-[#d2d2d7] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <GoogleSVG />
      {getLabel()}
    </button>
  );
}

export default function GoogleAuthButton(props: Props) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return null;
  return <GoogleButton {...props} />;
}
