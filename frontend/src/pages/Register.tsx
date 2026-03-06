import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ArrowRight, ArrowLeft, Mail } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import { useLang } from '../stores/langStore';
import api from '../services/api';

type Step = 'form' | 'activation';

export default function Register() {
  const [step, setStep] = useState<Step>('form');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const { register } = useAuthStore();
  const { t } = useLang();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t('register.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      await register(email, password, `${firstName} ${lastName}`);
      setStep('activation');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erreur lors de l\'inscription');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setResendSuccess(false);
    try {
      await api.post('/auth/resend-confirmation');
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch {
      // silently fail — user can try again
    } finally {
      setResending(false);
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

        {/* ═══ STEP 1: Registration Form ═══ */}
        {step === 'form' && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">
              {t('register.title')}
            </h1>
            <p className="text-[#86868b] mb-8">
              {t('register.trial')}
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('register.firstName')}</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
                    placeholder="Jean"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('register.lastName')}</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
                    placeholder="Dupont"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('register.email')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
                  placeholder="jean@entreprise.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('register.password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
                  placeholder="Minimum 6 caractères"
                  required
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">{t('register.confirmPassword')}</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
                  placeholder={t('register.confirmPlaceholder')}
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 bg-[#6366f1] text-white text-base font-medium px-6 py-3.5 rounded-full hover:bg-[#4f46e5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? t('register.loading') : (
                  <>{t('register.submit')} <ArrowRight size={18} /></>
                )}
              </button>
            </form>

            <p className="text-center text-sm text-[#86868b] mt-6">
              {t('register.hasAccount')}{' '}
              <Link to="/login" className="text-[#6366f1] font-medium hover:underline">
                {t('register.login')}
              </Link>
            </p>
          </>
        )}

        {/* ═══ STEP 2: Check Your Email ═══ */}
        {step === 'activation' && (
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-[#6366f1]/10 flex items-center justify-center mx-auto mb-6">
              <Mail size={36} className="text-[#6366f1]" />
            </div>
            <h1 className="text-3xl font-semibold tracking-tight mb-3">
              {t('register.activationTitle')}
            </h1>
            <p className="text-[#86868b] leading-relaxed mb-2">
              {t('register.activationText')} <strong className="text-[#1d1d1f]">{email}</strong>
            </p>
            <p className="text-[#86868b] leading-relaxed mb-8">
              {t('register.activationText2')}
            </p>

            {resendSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-xl text-sm mb-4">
                {t('register.resendSuccess')}
              </div>
            )}

            <p className="text-sm text-[#86868b]">
              <button
                onClick={handleResend}
                disabled={resending}
                className="text-[#6366f1] font-medium hover:underline disabled:opacity-50"
              >
                {resending ? t('register.resending') : t('register.resend')}
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
