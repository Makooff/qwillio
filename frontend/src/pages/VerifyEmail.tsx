import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Loader2, LogOut, RefreshCw } from '../components/icons';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import { useLang } from '../stores/langStore';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';

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
  const [checking, setChecking] = useState(false);

  const resend = async () => {
    setResending(true);
    setResendOk(false);
    try {
      await api.post('/auth/resend-confirmation');
      setResendOk(true);
      setTimeout(() => setResendOk(false), 5000);
    } catch { /* silent — the user can just try again */ } finally {
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
    <div className="min-h-dvh bg-white text-[#1d1d1f]">
      <header className="border-b border-[#d2d2d7]/60">
        <div className="max-w-[560px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QwillioLogo size={28} />
            <span className="text-xl font-semibold tracking-tight">Qwillio</span>
          </div>
          <div className="flex items-center gap-3">
            <LangToggle />
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="inline-flex items-center gap-1.5 text-sm text-[#86868b] hover:text-red-500 transition-colors"
              title={isFr ? 'Se déconnecter' : 'Log out'}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[560px] mx-auto px-6 py-20 text-center">
        <div className="mx-auto mb-6 w-14 h-14 rounded-2xl bg-[#7a5fff]/10 flex items-center justify-center">
          <Mail size={24} className="text-[#7a5fff]" />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight">
          {isFr ? 'Vérifiez votre email' : 'Check your email'}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#525257]">
          {isFr ? "Un lien d'activation a été envoyé à " : 'An activation link was sent to '}
          <strong className="text-[#1d1d1f]">{user?.email}</strong>
          {isFr
            ? '. Ouvrez-le pour continuer votre inscription.'
            : '. Open it to continue signing up.'}
        </p>

        {resendOk && (
          <p role="status" className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-700">
            {isFr ? 'Email renvoyé.' : 'Email sent again.'}
          </p>
        )}

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={refresh}
            disabled={checking}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-6 py-3.5 text-[15px] font-medium text-white transition-colors duration-300 hover:bg-[#7a5fff] disabled:opacity-50"
          >
            {checking ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
            {isFr ? "J'ai confirmé" : 'I confirmed'}
          </button>
          <button
            type="button"
            onClick={resend}
            disabled={resending}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-[#d2d2d7] px-6 py-3.5 text-[15px] font-medium transition-colors hover:border-[#86868b] disabled:opacity-50"
          >
            {resending ? (isFr ? 'Envoi…' : 'Sending…') : (isFr ? "Renvoyer l'email" : 'Resend email')}
          </button>
        </div>
      </div>
    </div>
  );
}
