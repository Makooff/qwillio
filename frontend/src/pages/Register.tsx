import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
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
  const { register, googleLogin } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useLang();

  const handleGoogleSuccess = async (tokenResponse: any) => {
    setError('');
    setLoading(true);
    try {
      await googleLogin(tokenResponse.access_token, 'token');
      const { user } = useAuthStore.getState();
      navigate(user?.role === 'admin' ? '/admin' : (user?.onboardingCompleted ? '/dashboard' : '/onboard'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  const googleSignIn = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => setError('Google Sign-In failed'),
  });

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
      // If email was auto-confirmed (Resend test domain), go straight to onboarding
      const { user } = useAuthStore.getState();
      if (user?.emailConfirmed) {
        navigate('/onboard');
      } else {
        setStep('activation');
      }
    } catch (err: any) {
      const errData = err.response?.data?.error;
      setError(typeof errData === 'string' ? errData : (errData?.message || err.message || t('register.errorFallback')));
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

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-[#d2d2d7]" />
              <span className="text-sm text-[#86868b]">{t('login.or') || 'ou'}</span>
              <div className="flex-1 h-px bg-[#d2d2d7]" />
            </div>

            <button
              type="button"
              onClick={() => googleSignIn()}
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-white text-[#1d1d1f] text-base font-medium px-6 py-3.5 rounded-full border border-[#d2d2d7] hover:bg-[#f5f5f7] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
              </svg>
              {t('register.google') || "S'inscrire avec Google"}
            </button>

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
