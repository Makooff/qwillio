import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import {
  ArrowRight, ArrowLeft, Check, ChevronRight,
  Building2, Phone, CreditCard, Loader2, Sparkles, LogOut,
  Users, Megaphone, Star, FileText, CalendarClock, MapPin,
  Mail, Crosshair, LifeBuoy, LineChart, Calculator, Package,
  type LucideIcon,
} from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import { useLang } from '../stores/langStore';
import api from '../services/api';

type Step = 1 | 2 | 3 | 4;

const plans = [
  { key: 'starter', name: 'Starter', price: 497, calls: 800, trial: '1er mois gratuit' },
  { key: 'pro', name: 'Pro', price: 1297, calls: 2000, popular: true, trial: '1er mois gratuit' },
  { key: 'enterprise', name: 'Enterprise', price: 2497, calls: 4000, trial: '1er mois gratuit' },
];

// 13 modules ordered by demand (most-requested first). Synced with /agent and /pricing.
const MODULES: Array<{ id: string; icon: LucideIcon; name: string; tagline: string }> = [
  { id: 'crm',        icon: Users,        name: 'CRM AI',        tagline: 'Pipeline, forecast, relances' },
  { id: 'marketing',  icon: Megaphone,    name: 'Marketing AI',  tagline: 'Posts, emails, ad copy' },
  { id: 'reputation', icon: Star,         name: 'Reputation AI', tagline: 'Avis et réponses' },
  { id: 'document',   icon: FileText,     name: 'Document AI',   tagline: 'Devis, contrats, signature' },
  { id: 'scheduling', icon: CalendarClock,name: 'Scheduling AI', tagline: 'Créneaux et rappels' },
  { id: 'local_seo',  icon: MapPin,       name: 'Local SEO AI',  tagline: 'GMB, keywords, audit' },
  { id: 'email',      icon: Mail,         name: 'Email AI',      tagline: 'Triage et auto-reply' },
  { id: 'lead_gen',   icon: Crosshair,    name: 'Lead Gen AI',   tagline: 'Prospection sortante' },
  { id: 'support',    icon: LifeBuoy,     name: 'Support AI',    tagline: 'Tickets et escalade' },
  { id: 'payments',   icon: CreditCard,   name: 'Payments AI',   tagline: 'Encaissements et acomptes' },
  { id: 'analytics',  icon: LineChart,    name: 'Analytics AI',  tagline: 'Digest, anomalies, forecast' },
  { id: 'accounting', icon: Calculator,   name: 'Accounting AI', tagline: 'Factures et P&L' },
  { id: 'inventory',  icon: Package,      name: 'Inventory AI',  tagline: 'Stock et réassort' },
];
const MODULE_PRICE = 197;
const BUNDLE_PRICE = 1497;

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
  const [selectedModules, setSelectedModules] = useState<Set<string>>(new Set());
  const [bundle, setBundle] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get('payment') === 'cancelled' || searchParams.get('canceled') === '1') {
      setError('Paiement annulé. Vous pouvez réessayer quand vous êtes prêt.');
      setStep(4);
    }
    const requestedStep = parseInt(searchParams.get('step') || '0');
    if ([1, 2, 3, 4].includes(requestedStep)) setStep(requestedStep as Step);
  }, [searchParams]);

  const toggleModule = (id: string) => {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const modulesTotal = bundle ? BUNDLE_PRICE : selectedModules.size * MODULE_PRICE;
  const planPrice = plans.find(p => p.key === selectedPlan)?.price ?? 0;
  const grandTotal = planPrice + modulesTotal;

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
        selectedModules: bundle ? [] : Array.from(selectedModules),
        bundle,
      });
      // Save the fresh JWT and update store directly (no extra /auth/me round-trip)
      if (data.token) {
        localStorage.setItem('token', data.token);
      }
      if (data.user) {
        useAuthStore.setState({ user: data.user, token: data.token, isLoading: false });
      }

      // Test account bypass — backend already activated everything for free.
      if (data.bypass) {
        navigate('/dashboard?welcome=test');
        return;
      }

      // Normal flow → redirect to Stripe Checkout (card + 30-day free trial).
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }

      // Defensive fallback: should never hit. Surface a clear error instead of
      // letting the UI crash on an unexpected response shape.
      setError('Activation impossible. Veuillez réessayer ou contacter le support.');
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { error?: string | { message?: string } } } })?.response;
      const errData = response?.data?.error;
      setError(typeof errData === 'string' ? errData : ((errData as { message?: string })?.message || (err instanceof Error ? err.message : 'Something went wrong.')));
    } finally {
      setLoading(false);
    }
  };

  const progress = (step / 4) * 100;

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
            <span className="text-sm text-[#86868b]">{t('onboard.step')} {step} / 4</span>
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
            className="h-full bg-[#6366f1] transition-colors duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Step dots */}
      <div className="flex items-center justify-center gap-2 py-6">
        {[1, 2, 3].map(s => (
          <div
            key={s}
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
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
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-colors"
                    placeholder="Acme Inc."
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">{t('selfOnboard.industry')}</label>
                  <select
                    value={industry}
                    onChange={e => setIndustry(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-colors"
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
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-colors"
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
                    className="w-full px-4 py-3 rounded-xl border border-[#d2d2d7] bg-white text-[#1d1d1f] placeholder-[#86868b]/50 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 focus:border-[#6366f1] transition-colors"
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
                    className={`w-full flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border-2 transition-colors text-left ${
                      selectedPlan === plan.key
                        ? 'border-[#6366f1] bg-white'
                        : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'
                    }`}
                  >
                    <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selectedPlan === plan.key ? 'border-[#6366f1] bg-[#6366f1]' : 'border-[#d2d2d7]'
                    }`}>
                      {selectedPlan === plan.key && <Check size={12} className="text-white" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
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
                      {plan.trial && (
                        <p className="text-[11px] font-semibold text-emerald-600 mt-1.5">{plan.trial}</p>
                      )}
                    </div>

                    <div className="flex-shrink-0 text-right leading-tight whitespace-nowrap">
                      <div>
                        <span className="text-lg font-semibold">${plan.price}</span>
                        <span className="text-sm text-[#86868b]">{t('register.mo')}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ═══ STEP 4: Modules selection + récap ═══ */}
          {step === 4 && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-[#a855f7]/10 flex items-center justify-center">
                  <Sparkles size={20} className="text-[#a855f7]" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight">Modules IA (optionnel)</h2>
                  <p className="text-sm text-[#86868b]">Premier mois offert. Annulable à tout moment.</p>
                </div>
              </div>

              {/* Bundle toggle */}
              <button
                onClick={() => { setBundle(b => !b); if (!bundle) setSelectedModules(new Set()); }}
                className={`w-full mb-4 p-4 sm:p-5 rounded-2xl border-2 transition-colors text-left ${
                  bundle ? 'border-[#a855f7] bg-[#a855f7]/[0.04]' : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 ${
                    bundle ? 'border-[#a855f7] bg-[#a855f7]' : 'border-[#d2d2d7]'
                  }`}>
                    {bundle && <Check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold">All Agents Bundle</span>
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-[#a855f7] text-white px-2 py-0.5 rounded-full">
                        Économie $1064
                      </span>
                    </div>
                    <p className="text-sm text-[#86868b] mt-0.5">Les 13 modules en un seul abonnement.</p>
                  </div>
                  <div className="flex-shrink-0 text-right whitespace-nowrap">
                    <span className="text-lg font-semibold">${BUNDLE_PRICE}</span>
                    <span className="text-sm text-[#86868b]">/mo</span>
                  </div>
                </div>
              </button>

              {/* 13 modules grid */}
              <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2 ${bundle ? 'opacity-40 pointer-events-none' : ''}`}>
                {MODULES.map(m => {
                  const Icon = m.icon;
                  const checked = selectedModules.has(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleModule(m.id)}
                      className={`flex items-start gap-3 p-3 rounded-xl border-2 transition-colors text-left ${
                        checked ? 'border-[#6366f1] bg-[#6366f1]/[0.04]' : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                        checked ? 'border-[#6366f1] bg-[#6366f1]' : 'border-[#d2d2d7]'
                      }`}>
                        {checked && <Check size={10} className="text-white" />}
                      </div>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.10)' }}>
                        <Icon size={14} className="text-[#6366f1]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{m.name}</p>
                        <p className="text-[11px] text-[#86868b] truncate">{m.tagline}</p>
                      </div>
                      <span className="text-[11px] font-semibold text-[#86868b] whitespace-nowrap flex-shrink-0">$197/mo</span>
                    </button>
                  );
                })}
              </div>

              {/* Total */}
              <div className="mt-6 p-4 rounded-2xl bg-[#fafaf8] border border-[#d2d2d7]/60">
                <div className="flex items-center justify-between text-sm text-[#86868b] mb-1">
                  <span>{plans.find(p => p.key === selectedPlan)?.name} (plan de base)</span>
                  <span className="tabular-nums">${planPrice}/mo</span>
                </div>
                <div className="flex items-center justify-between text-sm text-[#86868b] mb-2">
                  <span>{bundle ? 'Bundle 13 modules' : `${selectedModules.size} module(s) sélectionné(s)`}</span>
                  <span className="tabular-nums">${modulesTotal}/mo</span>
                </div>
                <div className="border-t border-[#d2d2d7]/60 pt-2 flex items-center justify-between">
                  <span className="text-base font-semibold">Total mensuel</span>
                  <div className="text-right">
                    <div className="text-lg font-semibold tabular-nums">${grandTotal}/mo</div>
                    <div className="text-[11px] text-emerald-600 font-semibold">1ᵉʳ mois gratuit</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ── Navigation ── */}
          <div className="flex items-center justify-between gap-4 mt-10 pt-6 px-2 sm:px-4 border-t border-[#d2d2d7]/40">
            {step > 1 ? (
              <button
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#86868b] hover:text-[#1d1d1f] transition-colors flex-shrink-0"
                onClick={() => setStep((step - 1) as Step)}
              >
                <ArrowLeft size={18} /> {t('onboard.prev')}
              </button>
            ) : <div className="flex-shrink-0" />}

            {step < 4 ? (
              <button
                className="inline-flex items-center gap-1.5 bg-[#6366f1] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-[#4f46e5] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
                disabled={step === 1 && !businessName.trim()}
                onClick={() => setStep((step + 1) as Step)}
              >
                {t('onboard.next')} <ChevronRight size={18} />
              </button>
            ) : (
              <button
                className="inline-flex items-center justify-center gap-1.5 bg-[#1d1d1f] text-white text-sm font-medium px-5 sm:px-6 py-3 rounded-full hover:bg-[#424245] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink min-w-0"
                disabled={loading}
                onClick={handleFinish}
              >
                {loading ? (
                  <><Loader2 size={18} className="animate-spin flex-shrink-0" /> <span className="truncate">Redirection…</span></>
                ) : (
                  <><CreditCard size={18} className="flex-shrink-0" /> <span className="truncate">Activer mon compte</span></>
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
