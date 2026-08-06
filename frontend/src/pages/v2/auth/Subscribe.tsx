import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2, LogOut, ShieldCheck } from '../../../components/icons';
import LangToggle from '../../../components/LangToggle';
import { useLang } from '../../../stores/langStore';
import { useAuthStore } from '../../../stores/authStore';
import api from '../../../services/api';
import { captureBillingPeriod, clearBillingPeriod, readBillingPeriod } from '../../../lib/billingPeriod';
import AuthShell, { AUTH_ALERT, AUTH_FIELD, AUTH_LABEL, AUTH_SUBMIT } from './AuthShell';

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

  /* On peut aussi atterrir directement ici depuis un lien tarifaire. */
  useEffect(() => captureBillingPeriod(window.location.search), []);

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
        /* Choisie sur la page tarifs, portée jusqu'ici. Le back refait le
           contrôle: seul « annual » vaut annuel. */
        billingPeriod: readBillingPeriod(),
      });
      if (data?.checkoutUrl) {
        /* Le choix a servi: le laisser traîner ferait basculer en annuel une
           seconde souscription faite dans le même onglet. */
        clearBillingPeriod();
        window.location.href = data.checkoutUrl;
        return;
      }
      setError(isFr ? 'Le paiement est indisponible pour le moment.' : 'Checkout is unavailable right now.');
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        // Already subscribed, the guard will route on the refreshed user.
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
    <AuthShell
      wide
      title={isFr ? 'Votre forfait' : 'Your plan'}
      subtitle={isFr
        ? `${TRIAL_DAYS} jours d'essai. Carte requise, rien n'est débité avant la fin de l'essai.`
        : `${TRIAL_DAYS}-day trial. Card required, nothing is charged until the trial ends.`}
      headerRight={
        <>
          <span className="text-sm text-q2-body">{isFr ? 'Étape 1 / 2' : 'Step 1 / 2'}</span>
          <LangToggle />
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="inline-flex items-center gap-1.5 text-sm text-q2-body hover:text-[color:var(--q2-bad-ink)] transition-colors duration-150"
            title={isFr ? 'Se déconnecter' : 'Log out'}
          >
            <LogOut size={16} />
          </button>
        </>
      }
    >
      {error && (
        <p role="alert" className={`${AUTH_ALERT} mb-6`}>
          {error}
        </p>
      )}

      <label className="block mb-4">
        <span className={AUTH_LABEL}>{isFr ? 'Nom de votre entreprise' : 'Business name'}</span>
        <input
          type="text"
          required
          value={businessName}
          onChange={e => setBusinessName(e.target.value)}
          placeholder="Acme Inc."
          className={AUTH_FIELD}
        />
      </label>

      <label className="block mb-8">
        <span className={AUTH_LABEL}>{isFr ? 'Secteur' : 'Industry'}</span>
        <select
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          className={AUTH_FIELD}
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
            className={`w-full flex items-start gap-3 sm:gap-4 p-4 sm:p-5 rounded-[20px] border text-left transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 ${
              selectedPlan === plan.key
                ? 'border-q2-ink bg-q2-band'
                : 'border-q2-plate bg-q2-canvas hover:border-q2-faint'
            }`}
          >
            <span className={`mt-1 w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
              selectedPlan === plan.key ? 'border-q2-ink bg-q2-ink' : 'border-q2-plate'
            }`}>
              {selectedPlan === plan.key && <Check size={12} className="text-white" />}
            </span>

            <span className="flex-1 min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-base font-medium text-q2-ink">{plan.name}</span>
                {plan.popular && (
                  <span className="q2-eyebrow text-q2-indigo rounded-full border border-q2-indigo/30 px-2.5 py-1">
                    {isFr ? 'Populaire' : 'Popular'}
                  </span>
                )}
              </span>
              <span className="block text-sm text-q2-body mt-0.5 tabular-nums">
                {plan.minutes.toLocaleString()} {isFr ? 'minutes incluses' : 'minutes included'}
              </span>
              <span className="block text-[11px] font-medium text-q2-graphite mt-1.5">
                {isFr ? `${TRIAL_DAYS} jours d'essai` : `${TRIAL_DAYS}-day trial`}
              </span>
            </span>

            <span className="flex-shrink-0 text-right leading-tight whitespace-nowrap">
              <span className="text-lg font-light text-q2-ink tabular-nums">{plan.price}&nbsp;€</span>
              <span className="text-sm text-q2-body">{isFr ? '/mois' : '/mo'}</span>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={loading || !businessName.trim()}
        className={`${AUTH_SUBMIT} mt-8`}
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading
          ? (isFr ? 'Redirection…' : 'Redirecting…')
          : (isFr ? 'Enregistrer ma carte' : 'Add my card')}
      </button>

      <p className="mt-4 flex items-start gap-2 text-[13px] leading-relaxed text-q2-body q2-body-text">
        <ShieldCheck size={15} className="mt-0.5 flex-shrink-0 text-q2-indigo" aria-hidden="true" />
        {isFr
          ? `Paiement sécurisé par Stripe. Aucun débit pendant ${TRIAL_DAYS} jours, annulable à tout moment avant la fin de l'essai.`
          : `Secured by Stripe. Nothing is charged for ${TRIAL_DAYS} days, cancel any time before the trial ends.`}
      </p>
    </AuthShell>
  );
}
