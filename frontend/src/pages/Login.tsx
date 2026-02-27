import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import { useLang } from '../stores/langStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useLang();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/admin');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] flex items-center justify-center px-6 relative">
      <div className="absolute top-4 right-6"><LangToggle /></div>
      <div className="w-full max-w-md">

        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-[#6366f1] font-medium hover:text-[#4f46e5] transition-colors mb-8">
          <ArrowLeft size={16} /> {t('back.site')}
        </Link>

        <Link to="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[#1d1d1f] mb-10">
          <QwillioLogo size={30} /> Qwillio
        </Link>

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
