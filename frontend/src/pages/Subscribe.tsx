import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, CreditCard, Loader2, LogOut, ShieldCheck } from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import { useLang } from '../stores/langStore';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';

/**
 * Second gate of sign-up: pick a plan and register a card.
 *
 * Nothing is charged here. The card opens the free trial and is what the
 * subscription bills against once the trial ends. The Client record is created
 * by the Stripe webhook, not by this page, so an abandoned checkout leaves no
 * half-made customer behind.
 */

const PLANS = [
  { key: 'solo', name: 'Solo', price: 99, minutes: 250 },
  { key: 'starter', name: 'Starter', price: 249, minutes: 750 },
  { key: 'pro', name: 'Pro', price: 599, minutes: 2000, popular: true },
  { key: 'enterprise', name: 'Enterprise', price: 1290, minutes: 5000 },
];

const INDUSTRIES = [
  'restaurant', 'medical', 'legal', 'real-estate', 'salon',
  'automotive', 'dental', 'hvac', 'retail', 'other',
];

const TRIAL_DAYS = 7;

export default function Subscribe() {
  const navigate = useNavigate();
  const { logout } = useAuthStore();
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [searchParams] = useSearchParams();

  const [businessName, setBusinessName] = useState('');
  const [industry, setIndustry] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('pro');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (searchParams.get('payment') === 'cancelled') {
      setError(isFr
        ? 'Paiement annulé. Vous pouvez réessayer quand vous êtes prêt.'
        : 'Payment cancelled. You can try again whenever you are ready.');
    }
  }, [searchParams, isFr]);

  const submit = async () => {
    if (!businessName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/checkout', {
        businessName: businessName.trim(),
        industry: industry || null,
        planType: selectedPlan,
      });
      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setError(isFr ? 'Le paiement est indisponible pour le moment.' : 'Checkout is unavailable right now.');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        // Already subscribed — the guard will route on the refreshed user.
        navigate('/onboard');
        return;
      }
      setError(isFr
        ? "Impossible d'ouvrir le paiement. Réessayez."
        : 'Could not open checkout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]/60">
        <div className="max-w-[640px] mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QwillioLogo size={28} />
            <span className="text-xl font-semibold tracking-tight">Qwillio</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#86868b]">{isFr ? 'Étape 1 / 2' : 'Step 1 / 2'}</span>
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

      <div className="max-w-[640px] mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#7a5fff]/10 flex items-center justify-center">
            <CreditCard size={20} className="text-[#7a5fff]" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isFr ? 'Votre forfait' : 'Your plan'}
            </h1>
            <p className="text-sm text-[#86868b]">
              {isFr
                ? `${TRIAL_DAYS} jours d'essai. Carte requise, rien n'est débité avant la fin de l'essai.`
                : `${TRIAL_DAYS}-day trial. Card required, nothing is charged until the trial ends.`}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mb-6 rounded-xl border border-[#cd6afb]/30 bg-[#cd6afb]/10 px-4 py-3 text-sm">
            {error}
          </p>
        )}

        <label className="block mb-4">
          <span className="text-sm font-medium">{isFr ? 'Nom de votre entreprise' : 'Business name'}</span>
          <input
            type="text"
            required
            value={businessName}
            onChange={e => setBusinessName(e.target.value)}
            placeholder="Acme Inc."
            className="mt-1.5 w-full rounded-xl border border-[#d2d2d7] px-4 py-3 text-[15px] outline-none transition-colors focus:border-[#7a5fff]"
          />
        </label>

        <label className="block mb-8">
          <span className="text-sm font-medium">{isFr ? 'Secteur' : 'Industry'}</span>
          <select
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-[#d2d2d7] px-4 py-3 text-[15px] outline-none transition-colors focus:border-[#7a5fff]"
          >
            <option value="">{isFr ? 'Choisir…' : 'Select…'}</option>
            {INDUSTRIES.map(key => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
        </label>

        <div className="space-y-3">
          {PLANS.map(plan => (
            <button
              key={plan.key}
              type="button"
              onClick={() => setSelectedPlan(plan.key)}
              aria-pressed={selectedPlan === plan.key}
              className={`w-full flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-2xl border-2 transition-colors text-left ${
                selectedPlan === plan.key
                  ? 'border-[#7a5fff] bg-white'
                  : 'border-[#d2d2d7] bg-white hover:border-[#86868b]'
              }`}
            >
              <div className={`mt-1 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                selectedPlan === plan.key ? 'border-[#7a5fff] bg-[#7a5fff]' : 'border-[#d2d2d7]'
              }`}>
                {selectedPlan === plan.key && <Check size={12} className="text-white" />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-semibold">{plan.name}</span>
                  {plan.popular && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-[#7a5fff] text-white px-2 py-0.5 rounded-full">
                      {isFr ? 'Populaire' : 'Popular'}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#86868b] mt-0.5">
                  {plan.minutes.toLocaleString()} {isFr ? 'minutes incluses' : 'minutes included'}
                </p>
                <p className="text-[11px] font-semibold text-emerald-600 mt-1.5">
                  {isFr ? `${TRIAL_DAYS} jours d'essai` : `${TRIAL_DAYS}-day trial`}
                </p>
              </div>

              <div className="flex-shrink-0 text-right leading-tight whitespace-nowrap">
                <span className="text-lg font-semibold">{plan.price}&nbsp;€</span>
                <span className="text-sm text-[#86868b]">{isFr ? '/mois' : '/mo'}</span>
              </div>
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={submit}
          disabled={loading || !businessName.trim()}
          className="mt-8 w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#1d1d1f] px-6 py-4 text-[15px] font-medium text-white transition-colors duration-300 hover:bg-[#7a5fff] disabled:opacity-40"
        >
          {loading && <Loader2 size={16} className="animate-spin" />}
          {loading
            ? (isFr ? 'Redirection…' : 'Redirecting…')
            : (isFr ? 'Enregistrer ma carte' : 'Add my card')}
        </button>

        <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-[#86868b]">
          <ShieldCheck size={15} className="mt-0.5 flex-shrink-0 text-[#7a5fff]" aria-hidden="true" />
          {isFr
            ? `Paiement sécurisé par Stripe. Aucun débit pendant ${TRIAL_DAYS} jours, annulable à tout moment avant la fin de l'essai.`
            : `Secured by Stripe. Nothing is charged for ${TRIAL_DAYS} days, cancel any time before the trial ends.`}
        </p>
      </div>
    </div>
  );
}
