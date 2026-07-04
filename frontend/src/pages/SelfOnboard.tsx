import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  ArrowRight, ArrowLeft, Check, ChevronRight,
  Building2, Phone, CreditCard, Loader2, Sparkles, LogOut
} from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import { useLang } from '../stores/langStore';
import api from '../services/api';

type Step = 1 | 2 | 3;

const plans = [
  { key: 'starter', name: 'Starter', price: 197, setup: 697, calls: 200, trial: '1er mois gratuit' },
  { key: 'pro', name: 'Pro', price: 347, setup: 997, calls: 500, popular: true, trial: '1er mois gratuit' },
  { key: 'enterprise', name: 'Enterprise', price: 497, setup: 1497, calls: 1000, trial: '1er mois gratuit' },
];

export default function SelfOnboard() {
  const navigate = useNavigate();
  const { user, checkAuth, logout } = useAuthStore();
  const { t } = useLang();
  const [step, setStep] = useState<Step>(1);
  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('payment') === 'cancelled') {
      setError('Paiement annulé. Vous pouvez réessayer quand vous êtes prêt.');
      setStep(3); // Go back to plan selection step
    }
  }, [searchParams]);

  const handleFinish = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/onboard', {
        businessName,
        businessPhone: phone || null,
        industry: industry || null,
        website: website || null,
        planType: selectedPlan,
      });
      // Save the fresh JWT and update store directly (no extra /auth/me round-trip)
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      if (data.user) {
        useAuthStore.setState({ user: data.user, token: data.token, isLoading: false });
      }

      // Redirect to Stripe Checkout if available (1st month free, then monthly)
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      navigate(data.user?.role === 'admin' ? '/admin' : '/dashboard');
    } catch (err: any) {
      const errData = err.response?.data?.error;
      setError(typeof errData === 'string' ? errData : (errData?.message || err.message || 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  };

  const progress = (step / 3) * 100;

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]/60">
        <div className="max-w-[640px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QwillioLogo size={28} />
            <span className="text-xl font-semibold tracking-tight">Qwillio</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#86868b]">{t('onboard.step')} {step} / 3</span>
            <LangToggle />
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="inline-flex items-center gap-1.5 text-sm text-[#86868b] hover:text-red-500 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
        <div className="h-1 bg-[#d2d2d7]/30">
          <div
            className="h-full bg-[#6366f1] transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Step dots */}
      <div className="flex items-center justify-center gap-2 py-6">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
              s < step
                ? 'bg-[#6366f1] text-white'
                : s === step
                ? 'bg-[#6366f1]/10 text-[#6366f1] border-2 border-[#6366f1]'
                : 'bg-[#f5f5f7] text-[#86868b]'
            }`}
          >
            {s < step ? <Check size={14} /> : s}
          </div>
        ))}
      </div>

      {/* Main content */}
      <main className="max-w-[640px] mx-auto px-6 pb-12">
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7] p-8">

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6">
              {error}
            </div>
          )}

          {/* ═══ STEP 1: Business Info ═══ */}
          {step === 1 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center">
                  <Building2 size={20} className="text-[#6366f1]" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">{t('selfOnboard.step1.title')}</h2>
                  <p className="text-sm text-[#86868b]">{t('selfOnboard.step1.subtitle')}</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {t('selfOnboard.businessName')} <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
                    placeholder="Acme Inc."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('selfOnboard.industry')}</label>
                  <select
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
                  >
                    <option value="">{t('selfOnboard.selectIndustry')}</option>
                    <option value="restaurant">Restaurant / Food</option>
                    <option value="medical">Medical / Healthcare</option>
                    <option value="legal">Legal</option>
                    <option value="real-estate">Real Estate</option>
                    <option value="salon">Salon / Spa</option>
                    <option value="automotive">Automotive</option>
                    <option value="dental">Dental</option>
                    <option value="hvac">HVAC / Plumbing</option>
                    <option value="retail">Retail / E-commerce</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('selfOnboard.website')}</label>
                  <input
                    type="url"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
                    placeholder="https://mywebsite.com"
                  />
                </div>
              </div>
            </>
          )}

          {/* ═══ STEP 2: Phone Number ═══ */}
          {step === 2 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center">
                  <Phone size={20} className="text-[#6366f1]" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">{t('selfOnboard.step2.title')}</h2>
                  <p className="text-sm text-[#86868b]">{t('selfOnboard.step2.subtitle')}</p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-2">{t('selfOnboard.phone')}</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-all"
                    placeholder="+1 (555) 123-4567"
                  />
                  <p className="text-xs text-[#86868b] mt-2">{t('selfOnboard.phoneHint')}</p>
                </div>
              </div>
            </>
          )}

          {/* ═══ STEP 3: Plan Selection ═══ */}
          {step === 3 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center">
                  <CreditCard size={20} className="text-[#6366f1]" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">{t('register.selectPlan')}</h2>
                  <p className="text-sm text-[#86868b]">{t('register.selectPlanSub')}</p>
                </div>
              </div>

              <div className="space-y-3">
                {plans.map(plan => (
                  <button
                    key={plan.key}
                    onClick={() => setSelectedPlan(plan.key)}
                    className={`w-full flex items-center gap-4 p-5 rounded-2xl border-2 transition-all text-left ${
                      selectedPlan === plan.key
                        ? 'border-[#6366f1] bg-white'
                        : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'
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
                      {plan.trial && <p className="text-[10px] font-semibold text-emerald-600 mt-0.5">{plan.trial}</p>}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── Navigation ── */}
          <div className="flex items-center justify-between mt-10 pt-6 border-t border-[#d2d2d7]/40">
            {step > 1 ? (
              <button
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                onClick={() => setStep((step - 1) as Step)}
              >
                <ArrowLeft size={18} /> {t('onboard.prev')}
              </button>
            ) : <div />}

            {step < 3 ? (
              <button
                className="inline-flex items-center gap-1.5 bg-[#6366f1] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-[#4f46e5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={step === 1 && !businessName.trim()}
                onClick={() => setStep((step + 1) as Step)}
              >
                {t('onboard.next')} <ChevronRight size={18} />
              </button>
            ) : (
              <button
                className="inline-flex items-center gap-1.5 bg-[#1d1d1f] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-[#424245] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={loading}
                onClick={handleFinish}
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin" /> Redirection vers le paiement...</>
                ) : (
                  <><CreditCard size={18} /> Continuer vers le paiement</>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
