import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ArrowRight, ArrowLeft, Check, Mail, ChevronRight } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import { useLang } from '../stores/langStore';

type Step = 'form' | 'activation' | 'plan';

const plans = [
  { key: 'starter', name: 'Starter', price: 199, setup: 699, calls: 200 },
  { key: 'pro', name: 'Pro', price: 349, setup: 999, calls: 500, popular: true },
  { key: 'enterprise', name: 'Enterprise', price: 499, setup: 1499, calls: 1000 },
];

export default function Register() {
  const [step, setStep] = useState<Step>('form');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuthStore();
  const navigate = useNavigate();
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

  const handlePlanContinue = () => {
    navigate(`/admin`);
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

        {/* ═══ STEP 2: Activation Email ═══ */}
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

            <button
              onClick={() => setStep('plan')}
              className="inline-flex items-center justify-center gap-2 bg-[#6366f1] text-white text-base font-medium px-8 py-3.5 rounded-full hover:bg-[#4f46e5] transition-colors"
            >
              {t('register.continue')} <ArrowRight size={18} />
            </button>

            <p className="text-sm text-[#86868b] mt-4">
              <button onClick={() => {}} className="text-[#6366f1] font-medium hover:underline">
                {t('register.resend')}
              </button>
            </p>
          </div>
        )}

        {/* ═══ STEP 3: Plan Selection ═══ */}
        {step === 'plan' && (
          <>
            <h1 className="text-3xl font-semibold tracking-tight mb-2">
              {t('register.selectPlan')}
            </h1>
            <p className="text-[#86868b] mb-8">
              {t('register.selectPlanSub')}
            </p>

            <div className="space-y-3 mb-8">
              {plans.map(plan => (
                <button
                  key={plan.key}
                  onClick={() => setSelectedPlan(plan.key)}
                  className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                    selectedPlan === plan.key
                      ? 'border-[#6366f1] bg-[#6366f1]/5'
                      : 'border-[#d2d2d7] hover:border-[#86868b]'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    selectedPlan === plan.key ? 'border-[#6366f1] bg-[#6366f1]' : 'border-[#d2d2d7]'
                  }`}>
                    {selectedPlan === plan.key && <Check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold">{plan.name}</span>
                      {plan.popular && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#6366f1] text-white px-2 py-0.5 rounded-full">
                          {t('price.popular')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-[#86868b] mt-0.5">
                      {plan.calls.toLocaleString()} {t('register.callsIncluded')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-lg font-semibold">${plan.price}</span>
                    <span className="text-sm text-[#86868b]">{t('register.mo')}</span>
                    <p className="text-xs text-[#86868b]">+ ${plan.setup.toLocaleString()} {t('register.setupFee')}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={handlePlanContinue}
              className="w-full inline-flex items-center justify-center gap-2 bg-[#6366f1] text-white text-base font-medium px-6 py-3.5 rounded-full hover:bg-[#4f46e5] transition-colors"
            >
              {t('register.continue')} <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
