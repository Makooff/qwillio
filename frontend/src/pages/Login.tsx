import { useState } from 'react';
import { useSEO } from '../hooks/useSEO';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import GoogleAuthButton from '../components/GoogleAuthButton';
import { useLang } from '../stores/langStore';

export default function Login() {
  useSEO({ title: 'Login', noindex: true });
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useLang();

  const hasGoogle = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const { user } = useAuthStore.getState();
      navigate(user?.role === 'admin' ? '/admin' : (user?.onboardingCompleted ? '/dashboard' : '/onboard'));
    } catch (err: any) {
      const errData = err.response?.data?.error;
      setError(typeof errData === 'string' ? errData : (errData?.message || err.message || 'Erreur de connexion'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] flex flex-col px-6" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between py-4 flex-shrink-0">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[#6366f1] font-medium hover:text-[#4f46e5] transition-colors">
          <ArrowLeft size={16} /> {t('back.site')}
        </Link>
        <LangToggle />
      </div>

      {/* Logo — centered between top bar and form */}
      <div className="flex justify-center py-8 flex-shrink-0">
        <Link to="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[#1d1d1f]">
          <QwillioLogo size={30} /> Qwillio
        </Link>
      </div>

      {/* Form area */}
      <div className="w-full max-w-md mx-auto flex-1">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          {t('login.title')}
        </h1>
        <p className="text-[#86868b] mb-8">
          {t('login.subtitle')}
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">{t('login.email')}</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
              placeholder="admin@qwillio.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">{t('login.password')}</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#1d1d1f] text-white text-base font-medium px-6 py-3.5 rounded-full hover:bg-[#424245] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? t('login.loading') : (
              <>{t('login.submit')} <ArrowRight size={18} /></>
            )}
          </button>
        </form>

        {hasGoogle && (
          <>
            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-[#d2d2d7]" />
              <span className="text-sm text-[#86868b]">{t('login.or') || 'ou'}</span>
              <div className="flex-1 h-px bg-[#d2d2d7]" />
            </div>
            <GoogleAuthButton mode="login" disabled={loading} onError={setError} />
          </>
        )}

        <p className="text-center text-sm text-[#86868b] mt-6">
          {t('login.noAccount')}{' '}
          <Link to="/register" className="text-[#6366f1] font-medium hover:underline">
            {t('login.register')}
          </Link>
        </p>
      </div>
    </div>
  );
}
