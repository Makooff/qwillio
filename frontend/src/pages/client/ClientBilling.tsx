import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, AlertTriangle, Shield, Phone, FileText, Download, CreditCard, Zap } from '../../components/icons';
import api from '../../services/api';
import { formatDate } from '../../utils/format';
import { annualTotalEur, annualMonthlyEquivalentEur } from '../../lib/pricing';
import Button from '../../components/ui/Button';
import { ds, badgeStyle, type Tone } from '../../styles/design-system';
import { t } from '../../styles/admin-theme';

// ── Types ────────────────────────────────────────────────────────────────────

interface BillingOverview {
  plan: string;
  status: string;
  /** Absent tant que Stripe ne donne pas de date: on n'en invente pas. */
  renewalDate: string | null;
  minutesUsed: number;
  minutesLimit: number;
  trialEndsAt: string | null;
  isTrial: boolean;
  /** Mensuel ou annuel. Décide des prix affichés ET de l'existence du bouton
      « Passer à l'annuel » sur le forfait courant. */
  billingPeriod?: 'monthly' | 'annual';
  /** La carte enregistrée chez Stripe. Absente si aucune, ou si Stripe ne
      répond pas: la ligne disparaît alors au lieu d'inventer une carte. */
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  /** Vrai quand Stripe n'a pas répondu. À ne pas confondre avec « pas de
      carte »: l'un appelle une action du client, l'autre non. */
  paymentMethodUnavailable?: boolean;
  /** L'option Superagent: incluse au forfait, achetée, achetable, ou bloquée.
      Une seule lecture côté serveur (`superagentOffer`) décide des quatre, pour
      que l'écran ne puisse pas proposer ce que la route refusera. */
  superagent?: {
    included: boolean;
    active: boolean;
    priceEur: number | null;
    period: 'monthly' | 'annual';
    sellable: boolean;
    blockedReason: string | null;
  };
}

/* « visa » devient « Visa », « amex » devient « American Express ». Stripe rend
   la marque en minuscules et sans espace, ce qui se lit comme une valeur de
   base au milieu d'une page soignée. */
const CARD_BRANDS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
  cartes_bancaires: 'Cartes Bancaires',
};

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  description: string;
}

// ── Plans data ───────────────────────────────────────────────────────────────

const PLANS = [
  {
    id: 'solo',
    name: 'Solo',
    monthly: 99,
    minutes: 250,
    overage: 0.45,
    popular: false,
    features: [
      '250 minutes/mois incluses',
      'Réceptionniste IA 24/7',
      'Prise de RDV + agenda',
      'Analytiques',
      'Support email',
      'Transcription des appels',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    monthly: 249,
    minutes: 750,
    overage: 0.39,
    popular: false,
    features: [
      '750 minutes/mois incluses',
      'Tout Solo inclus',
      'Capture de leads',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 599,
    minutes: 2000,
    overage: 0.35,
    popular: true,
    features: [
      '2 000 minutes/mois incluses',
      'Tout Starter inclus',
      'Intégrations CRM natives',
      'Analytiques avancées + sentiments',
      "Transfert d'appel intelligent",
      'Support prioritaire',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 1290,
    minutes: 5000,
    overage: 0.30,
    popular: false,
    features: [
      '5 000 minutes/mois incluses',
      'Tout Pro inclus',
      'Responsable dédié',
      'SLA 99.5% uptime',
      'Accès API complet',
      'IA auto-apprenante',
    ],
  },
] as const;

type PlanId = (typeof PLANS)[number]['id'];

// ── Status badge ─────────────────────────────────────────────────────────────

/* Les libellés restent ceux de la page; la forme vient du design system
   (`badgeStyle`), une seule définition des tons au lieu de quatre hex en
   dur qui dérivaient du reste du portail. */
const STATUS_META: Record<string, { tone: Tone; label: string }> = {
  active:    { tone: 'success', label: 'Actif' },
  trial:     { tone: 'warning', label: 'Essai' },
  cancelled: { tone: 'danger',  label: 'Annulé' },
  past_due:  { tone: 'warning', label: 'En retard' },
  succeeded: { tone: 'success', label: 'Réussi' },
  failed:    { tone: 'danger',  label: 'Échoué' },
  refunded:  { tone: 'info',    label: 'Remboursé' },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_META[status] ?? { tone: 'neutral' as Tone, label: status };
  return <span style={badgeStyle(s.tone)}>{s.label}</span>;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ClientBilling() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  /* L'erreur de résiliation vit À CÔTÉ du bouton, pas dans le bandeau du haut
     de page: la boîte d'annulation est tout en bas, et un message affiché à
     900 px au-dessus passe inaperçu au moment précis où il compte. */
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelInput, setCancelInput] = useState('');
  const [upgrading, setUpgrading] = useState<string | null>(null);
  /* Le sélecteur s'ouvre sur la période du client, pas sur « mensuel » par
     défaut: un client annuel qui arrive ici doit voir SES prix, pas ceux d'une
     formule qu'il n'a pas prise. */
  const [billingChoice, setBillingChoice] = useState<'monthly' | 'annual'>('monthly');
  const [openingPortal, setOpeningPortal] = useState(false);
  const [superagentBusy, setSuperagentBusy] = useState(false);
  const [invoiceOpening, setInvoiceOpening] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /* Panne de la route payments, distincte du « aucun paiement » réel: la
     première appelle un retry, la seconde est un état légitime. Les confondre
     faisait croire à un client solvable qu'il n'avait jamais payé. */
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const loadPayments = async () => {
    setPaymentsError(null);
    try {
      const { data } = await api.get('/my-dashboard/payments');
      /* `Array.isArray` et non `|| []`: la route peut répondre un objet
         (enveloppe, message d'erreur applicatif rendu en 200), et
         `body?.data || body` le laissait passer tel quel. La page tombait
         alors sur « payments.map is not a function », c'est-à-dire un écran
         blanc pour une simple liste vide. */
      const rows = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
      setPayments(rows);
    } catch {
      setPaymentsError("L'historique des paiements n'a pas pu être chargé.");
    }
  };

  useEffect(() => {
    // `allSettled`, et non `all`: les deux requêtes sont indépendantes, et
    // `all` les liait au point qu'une seule qui échoue effaçait l'autre. C'est
    // ce qui se passait, `/payments` n'existant pas côté serveur: l'aperçu
    // arrivait bien, puis était jeté avec, et la page repartait sur ses
    // valeurs par défaut sans que rien ne le signale.
    Promise.allSettled([
      api.get('/my-dashboard/billing'),
      loadPayments(),
    ])
      .then(([billingRes]) => {
        if (billingRes.status === 'fulfilled') {
          setOverview(billingRes.value.data);
          /* Le sélecteur suit le client. Le poser après la réponse et non à
             l'initialisation: à ce moment-là on ne savait pas encore ce qu'il
             paie. */
          if (billingRes.value.data?.billingPeriod === 'annual') setBillingChoice('annual');
        }
        else setLoadError("Impossible de charger votre abonnement. Rechargez la page, ou contactez-nous si cela persiste.");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    setLoadError(null);
    try {
      // `planType`, et non `plan`: c'est la clé que le serveur lit. Avec
      // l'ancienne, il ne voyait aucun plan, répondait 400 « Invalid plan », et
      // la page rechargeait comme si de rien n'était — un bouton qui ne pouvait
      // pas marcher et ne le disait pas.
      const { data } = await api.post('/my-dashboard/upgrade', {
        planType: planId,
        /* Ce que l'écran AFFICHE part à la caisse. Sans cette clé, le serveur
           gardait la période de la fiche, et un client mensuel n'avait aucun
           chemin vers l'annuel: la remise de 20 % était vendue sur la page
           tarifs et inatteignable depuis le portail. */
        billingPeriod: billingChoice,
      });
      // Le paiement se fait chez Stripe. Recharger la page à la place, c'est
      // ramener le client sur son ancien plan sans lui avoir rien demandé.
      if (data?.checkoutUrl) window.location.href = data.checkoutUrl;
      else window.location.reload();
    } catch (e: any) {
      setLoadError(
        e?.response?.data?.error === 'Already on this plan'
          ? 'Vous êtes déjà sur ce plan.'
          : "Le changement de plan n'a pas pu démarrer. Réessayez dans un instant.",
      );
    } finally {
      setUpgrading(null);
    }
  };

  /* L'option Superagent, prise ou rendue sans passer par une caisse: la ligne
     s'ajoute à l'abonnement en cours, donc Stripe calcule le prorata et la date
     de renouvellement ne bouge pas.
     La page ne décide de rien: elle affiche ce que `overview.superagent` dit et
     relit l'aperçu après coup. Deviner l'état ici, c'est le faire diverger de
     ce qui est facturé. */
  const toggleSuperagent = async (enabled: boolean) => {
    setSuperagentBusy(true);
    setLoadError(null);
    try {
      await api.post('/my-dashboard/superagent-option', { enabled });
      const { data } = await api.get('/my-dashboard/billing');
      setOverview(data);
    } catch (e: any) {
      /* Le serveur répond 409 avec une phrase déjà écrite pour l'écran (forfait
         qui l'inclut, option indisponible): on l'affiche telle quelle. */
      setLoadError(
        e?.response?.data?.message
          ?? "L'option n'a pas pu être modifiée. Réessayez dans un instant.",
      );
    } finally {
      setSuperagentBusy(false);
    }
  };

  /* Le portail Stripe, ouvert dans le MÊME onglet.
     Un `window.open` serait bloqué par le navigateur: la réponse arrive après
     un aller-retour réseau, donc hors du geste de l'utilisateur, et le bloqueur
     de fenêtres ne fait pas la différence avec une publicité. */

  const openBillingPortal = async () => {
    setOpeningPortal(true);
    setLoadError(null);
    try {
      const { data } = await api.post('/my-dashboard/billing-portal');
      if (data?.url) window.location.href = data.url;
      else setLoadError("Le portail n'a pas pu s'ouvrir. Réessayez dans un instant.");
    } catch (e: any) {
      /* Le serveur répond 409 avec une phrase déjà écrite pour l'écran quand
         aucun dossier Stripe n'existe: on l'affiche telle quelle plutôt que de
         la remplacer par un message générique qui en dirait moins. */
      setLoadError(
        e?.response?.data?.error
          ?? "Le portail n'a pas pu s'ouvrir. Réessayez dans un instant.",
      );
    } finally {
      setOpeningPortal(false);
    }
  };

  /* La facture, chez Stripe. Le tableau proposait `/api/invoices/:id/pdf`, une
     route qui n'existe pas: chaque ligne de l'historique donnait un 404. Même
     mécanique que le portail, et pour la même raison: l'adresse arrive après un
     aller-retour, donc `window.open` serait bloqué. */
  const openInvoice = async (paymentId: string) => {
    setInvoiceOpening(paymentId);
    setLoadError(null);
    try {
      const { data } = await api.get(`/my-dashboard/payments/${paymentId}/invoice`);
      if (data?.url) window.location.href = data.url;
      else setLoadError("La facture n'est pas disponible pour ce paiement.");
    } catch (e: any) {
      setLoadError(
        e?.response?.data?.error ?? "La facture n'est pas disponible pour ce paiement.",
      );
    } finally {
      setInvoiceOpening(null);
    }
  };

  const handleCancel = async () => {
    setCancelError(null);
    try {
      await api.post('/my-dashboard/cancel');
      setOverview(prev => prev ? { ...prev, status: 'cancelled' } : prev);
      setShowCancel(false);
      setCancelInput('');
    } catch (e: any) {
      /* Plus de silence ici: la route résilie désormais CHEZ STRIPE, et elle
         échoue franchement quand Stripe refuse plutôt que d'écrire « résilié »
         en base sur un abonnement toujours prélevé. Avaler cette erreur
         laisserait le client croire qu'il a résilié. La fenêtre reste ouverte,
         pour qu'il puisse réessayer. */
      setCancelError(
        e?.response?.data?.error ?? "La résiliation n'a pas pu être enregistrée. Réessayez, ou écrivez-nous.",
      );
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-2"><div className="h-7 w-44 rounded-lg bg-white/[0.06] animate-pulse" /><div className="h-4 w-60 rounded bg-white/[0.05] animate-pulse" /></div>
        <div className="h-44 rounded-2xl bg-white/[0.04] animate-pulse" />
        <div className="h-44 rounded-2xl bg-white/[0.04] animate-pulse" />
      </div>
    );
  }

  /* Sans aperçu, il n'y a RIEN à afficher de contractuel: ni plan (le défaut
     « starter » inventait un forfait), ni statut (« Actif » tombait du ciel),
     ni minutes (0 n'étaient pas les siennes), ni résiliation (agir dans le
     vide sur un abonnement inconnu est dangereux). On garde le bandeau
     d'erreur et le catalogue n'affiche pas de badge ACTUEL. */
  if (!overview) {
    return (
      <div className="space-y-6 pb-10">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: t.text }}>Facturation</h1>
          <p className="text-[12.5px] mt-0.5" style={{ color: t.textSec }}>Gérez votre abonnement et vos factures</p>
        </motion.div>
        {loadError && (
          <div
            className="flex items-start gap-3 rounded-xl border px-5 py-4"
            style={{ background: `color-mix(in oklab, ${t.danger} 8%, transparent)`, borderColor: `color-mix(in oklab, ${t.danger} 25%, transparent)` }}
            role="alert"
          >
            <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: t.danger }} />
            <div>
              <p className="text-[13px]" style={{ color: t.text }}>{loadError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-2 text-[12.5px] font-medium hover:underline"
                style={{ color: t.brand }}
              >
                Recharger la page
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const currentPlanId = overview.plan as PlanId;
  const currentPlan = PLANS.find(p => p.id === currentPlanId) ?? PLANS[0];
  /* La période RÉELLE de l'aperçu, pas celle du sélecteur: celui-ci sert à
     COMPARER une autre offre et ne doit pas réécrire ce que le client paie
     déjà. */
  const currentPeriod = overview.billingPeriod === 'annual' ? 'annual' : 'monthly';
  const minutesUsed = overview.minutesUsed;
  const minutesLimit = overview.minutesLimit ?? currentPlan.minutes;
  const minutesPct = minutesLimit > 0 ? Math.min(Math.round((minutesUsed / minutesLimit) * 100), 100) : 0;
  const isCancelled = overview.status === 'cancelled';

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[22px] font-semibold tracking-tight" style={{ color: t.text }}>Facturation</h1>
        <p className="text-[12.5px] mt-0.5" style={{ color: t.textSec }}>Gérez votre abonnement et vos factures</p>
      </motion.div>

      {/* Une page de facturation qui se trompe en silence est pire qu'une page
          qui s'excuse: le client croit connaître son plan. */}
      {loadError && (
        <div
          className="flex items-start gap-3 rounded-xl border px-5 py-4"
          style={{ background: `color-mix(in oklab, ${t.danger} 8%, transparent)`, borderColor: `color-mix(in oklab, ${t.danger} 25%, transparent)` }}
          role="alert"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0" style={{ color: t.danger }} />
          <p className="text-[13px]" style={{ color: t.text }}>{loadError}</p>
        </div>
      )}

      {/* Trial banner */}
      {overview?.isTrial && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 rounded-xl border px-5 py-4"
          style={{ background: t.panel, borderColor: t.accentBrd }}
        >
          <Shield size={18} className="mt-0.5 shrink-0" style={{ color: t.brand }} />
          <div>
            <p className="text-sm font-medium" style={{ color: t.text }}>
              Période d'essai en cours
            </p>
            {overview.trialEndsAt && (
              <p className="text-xs mt-0.5" style={{ color: t.textSec }}>
                Expire le {formatDate(overview.trialEndsAt)} — passez à un plan payant pour continuer.
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Current plan card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-xl border p-6"
        style={{ borderColor: t.accentBrd, background: t.panel }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs mb-1" style={{ color: t.textSec }}>Plan actuel</p>
            <p className="text-2xl font-bold" style={{ color: t.text }}>{currentPlan.name}</p>
            {overview?.renewalDate && !isCancelled && (
              <p className="text-xs mt-1" style={{ color: t.textSec }}>
                Renouvellement le {formatDate(overview.renewalDate)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={overview.status} />
            <div className="text-right hidden sm:block">
              {/* Le montant de SON abonnement, dans SA période: un annuel lit
                  l'équivalent mensuel remisé et le total prélevé, pas le
                  mensuel plein qu'il ne paie jamais. Les deux chiffres
                  dérivent des mêmes constantes que le comparateur et que le
                  backend (`annualTotalEur`), donc ils cohèrent entre eux. */}
              {currentPeriod === 'annual' ? (
                <>
                  <span className="text-2xl font-bold" style={{ color: t.text }}>
                    {annualMonthlyEquivalentEur(currentPlan.monthly).toLocaleString()}€
                  </span>
                  <span className="text-xs" style={{ color: t.textSec }}>/mois</span>
                  <p className="text-[11px] mt-0.5" style={{ color: t.textSec }}>
                    Facturé {annualTotalEur(currentPlan.monthly).toLocaleString('fr-FR')} €/an
                  </p>
                </>
              ) : (
                <>
                  <span className="text-2xl font-bold" style={{ color: t.text }}>{currentPlan.monthly.toLocaleString()}€</span>
                  <span className="text-xs" style={{ color: t.textSec }}>/mois</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Minute usage progress */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs" style={{ color: t.textSec }}>
              <Phone size={12} />
              Minutes utilisées ce mois
            </span>
            <span className="text-xs font-medium" style={{ color: t.text }}>
              {minutesUsed.toLocaleString()} / {minutesLimit.toLocaleString()} min
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${minutesPct}%`, background: t.brand }}
            />
          </div>
          {minutesPct > 80 && (
            <p className="text-[11px] mt-1.5" style={{ color: t.warning }}>
              ⚠ {minutesPct}% du quota mensuel utilisé — envisagez un upgrade
            </p>
          )}
        </div>

        {/* Ce que le plan inclut: sa place est ici, à côté du plan et de la
            consommation, et non sur l'accueil où treize lignes cochées
            repoussaient tout le reste sous la ligne de flottaison.

            La source reste `PLANS`, le catalogue de ce fichier: ce sont des
            libellés de packaging, pas des données du client. `/my-dashboard/
            billing` renvoie désormais un vrai aperçu (plan, statut, quota,
            essai) — c'est de là que viennent le plan affiché et la jauge, et
            de nulle part ailleurs. */}
        {currentPlan.features.length > 0 && (
          <div className="mt-5 pt-5 border-t border-white/[0.06]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] mb-3" style={{ color: t.textSec }}>
              Ce que votre plan inclut
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {currentPlan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px]" style={{ color: t.text }}>
                  <Check size={13} className="mt-[3px] flex-shrink-0" style={{ color: t.violet }} aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>

      {/* ── L'option Superagent ──────────────────────────────────────────────
          Délibérément PAS une quatrième carte de forfait: ce n'est pas un plan
          qu'on compare, c'est un interrupteur sur le plan qu'on a déjà. D'où
          une bande, un seul geste, et la phrase qui dit ce que ça change à
          l'appel plutôt qu'une liste de fonctions cochées.
          L'état vient entièrement du serveur (`overview.superagent`): l'écran
          ne propose jamais ce que la route refuserait. */}
      {overview?.superagent && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="rounded-xl border p-5"
          style={{
            borderColor: overview.superagent.active || overview.superagent.included
              ? t.accentBrd
              : t.border,
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-1.5">
                <Zap size={15} style={{ color: t.violet }} aria-hidden="true" />
                <p className="text-sm font-semibold" style={{ color: t.text }}>Superagent</p>
                {overview.superagent.included && (
                  <span style={badgeStyle('brand')}>
                    Inclus
                  </span>
                )}
                {overview.superagent.active && !overview.superagent.included && (
                  <span style={badgeStyle('brand')}>
                    Active
                  </span>
                )}
              </div>
              <p className="text-[13px] leading-relaxed" style={{ color: t.textSec }}>
                La voix passe en temps réel: votre réceptionniste entend et répond
                directement, sans passer par une transcription. Les silences sont plus
                courts et l'intonation suit la conversation.
              </p>
              {overview.superagent.blockedReason && !overview.superagent.included && !overview.superagent.active && (
                <p className="text-[12px] mt-2" style={{ color: t.warning }}>
                  Indisponible pour le moment.
                </p>
              )}
            </div>

            <div className="flex items-center gap-4">
              {overview.superagent.priceEur !== null && !overview.superagent.included && (
                <div className="text-right">
                  <span className="text-lg font-bold" style={{ color: t.text }}>
                    +{overview.superagent.priceEur}€
                  </span>
                  <span className="text-xs" style={{ color: t.textSec }}>
                    /{overview.superagent.period === 'annual' ? 'an' : 'mois'}
                  </span>
                </div>
              )}
              {!overview.superagent.included && (
                <Button
                  variant={overview.superagent.active ? 'ghost' : 'primary'}
                  onClick={() => toggleSuperagent(!overview.superagent!.active)}
                  disabled={superagentBusy || (!overview.superagent.active && !overview.superagent.sellable)}
                  loading={superagentBusy}
                >
                  {overview.superagent.active ? 'Désactiver' : 'Activer'}
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Plan grid */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-sm font-semibold" style={{ color: t.text }}>Plans disponibles</h2>

          {/* Même geste que le sélecteur de la page tarifs, et comme lui il ne
              s'anime PAS: un contrôle qu'on bascule pour comparer doit répondre
              à l'instant, pas jouer une transition à chaque aller-retour. */}
          <div
            role="group"
            aria-label="Fréquence de facturation"
            className="inline-flex items-center gap-1 p-1 rounded-full border"
            style={{ borderColor: t.border, background: 'rgba(255,255,255,0.03)' }}
          >
            {(['monthly', 'annual'] as const).map(période => (
              /* L'option choisie ne se peint PLUS en mauve plein (demande
                 utilisateur): lavage neutre + contour mauve en boîte
                 interne, donc aucun décalage de mise en page au bascule. */
              <button
                key={période}
                type="button"
                onClick={() => setBillingChoice(période)}
                aria-pressed={billingChoice === période}
                className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[12px] font-medium active:scale-[0.97] transition-transform"
                style={billingChoice === période
                  ? { background: 'rgba(255,255,255,0.10)', color: '#fff', boxShadow: `inset 0 0 0 1px ${t.brand}` }
                  : { color: t.textSec }}
              >
                {période === 'monthly' ? 'Mensuel' : 'Annuel'}
                {période === 'annual' && (
                  <span
                    className="text-[10px] font-semibold tracking-[0.08em] uppercase px-1.5 py-0.5 rounded-full"
                    style={billingChoice === 'annual'
                      ? { background: 'rgba(255,255,255,0.16)', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.06)', color: t.textSec }}
                  >
                    −20&nbsp;%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((plan, i) => {
            const isCurrent = plan.id === currentPlanId;
            const isHigher = PLANS.indexOf(plan) > PLANS.indexOf(currentPlan);
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.06 }}
                className="relative rounded-xl border p-5 flex flex-col"
                style={{
                  borderColor: isCurrent ? t.brand : t.border,
                  background: isCurrent
                    ? t.accentGlow
                    : 'rgba(255,255,255,0.025)',
                }}
              >
                {/* Badge */}
                {isCurrent && (
                  <span
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-0.5 rounded-full text-white whitespace-nowrap"
                    style={{ background: t.success }}
                  >
                    ACTUEL
                  </span>
                )}
                {plan.popular && !isCurrent && (
                  /* Décision 2026-10: plus de pastille mauve pleine — contour
                     mauve, fond transparent, texte mauve clair (AA sur fond
                     sombre). */
                  <span
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-0.5 rounded-full whitespace-nowrap border"
                    style={{ background: 'transparent', borderColor: t.brand, color: t.brandHi }}
                  >
                    Recommandé
                  </span>
                )}

                <div className="mb-4">
                  <p className="text-base font-bold mb-1" style={{ color: t.text }}>{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold" style={{ color: t.text }}>
                      {(billingChoice === 'annual'
                        ? annualMonthlyEquivalentEur(plan.monthly)
                        : plan.monthly).toLocaleString()}€
                    </span>
                    <span className="text-xs" style={{ color: t.textSec }}>/mois</span>
                  </div>
                  {billingChoice === 'annual' && (
                    /* Le montant réellement prélevé, en une fois. L'équivalent
                       mensuel au-dessus aide à comparer, celui-ci engage. */
                    <p className="text-[11px] mt-1" style={{ color: t.textSec }}>
                      Facturé {annualTotalEur(plan.monthly).toLocaleString('fr-FR')} €/an
                    </p>
                  )}
                  <p className="text-[11px] mt-1" style={{ color: t.textSec }}>
                    {plan.minutes.toLocaleString()} min · {plan.overage.toFixed(2).replace('.', ',')} €/min supp.
                  </p>
                </div>

                <ul className="space-y-2 mb-5 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs" style={{ color: t.textSec }}>
                      <Check size={13} style={{ color: t.success }} className="shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Le forfait COURANT garde un bouton quand la période choisie
                    n'est pas la sienne: « passer à l'annuel » est un vrai
                    changement, et le cacher laissait la remise de 20 % visible
                    sur la page tarifs et inatteignable depuis le portail.
                    Outline-marque: fond transparent + contour mauve, en
                    classes (plus d'état de survol JS — décision 2026-10:
                    jamais de remplissage mauve, même au survol). Le texte
                    #8a6fff tient ~5,4:1 sur le fond sombre des cartes. */}
                {(!isCurrent || billingChoice !== currentPeriod) && (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={upgrading === plan.id}
                    className="w-full rounded-full border py-2 text-[13px] font-medium transition-colors hover:bg-white/[0.06] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    style={{ borderColor: t.brandHi, color: t.brandHi }}
                  >
                    {upgrading === plan.id
                      ? 'Redirection…'
                      : isCurrent
                        ? (billingChoice === 'annual' ? 'Passer à l\'annuel' : 'Passer au mensuel')
                        : isHigher ? 'Upgrader' : 'Réduire'}
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Payment history */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-xl border p-6"
        style={{ borderColor: t.border, background: 'rgba(255,255,255,0.025)' }}
      >
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2" style={{ color: t.text }}>
          <FileText size={15} style={{ color: t.brand }} />
          Historique des paiements
        </h2>

        {paymentsError ? (
          <div className="flex flex-wrap items-center gap-3" role="alert">
            <p className="text-[12.5px]" style={{ color: t.danger }}>{paymentsError}</p>
            <button
              type="button"
              onClick={loadPayments}
              className="text-[12.5px] font-medium hover:underline"
              style={{ color: t.brand }}
            >
              Réessayer
            </button>
          </div>
        ) : payments.length === 0 ? (
          <p className="text-[12.5px]" style={{ color: t.textSec }}>Aucun paiement enregistré pour l'instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[11px] border-b"
                  style={{ color: t.textSec, borderColor: t.border }}
                >
                  <th className="pb-3 pr-4 font-medium">Montant</th>
                  <th className="pb-3 pr-4 font-medium">Description</th>
                  <th className="pb-3 pr-4 font-medium">Statut</th>
                  <th className="pb-3 pr-4 font-medium">Date</th>
                  <th className="pb-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b last:border-0"
                    style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                  >
                    <td className="py-3 pr-4 font-semibold" style={{ color: t.text }}>
                      {Number(p.amount).toFixed(2)}{p.currency === 'EUR' ? '€' : '$'}
                    </td>
                    <td className="py-3 pr-4 text-xs max-w-[160px] truncate" style={{ color: t.textSec }}>
                      {p.description || '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="py-3 pr-4 text-xs whitespace-nowrap" style={{ color: t.textSec }}>
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => openInvoice(p.id)}
                        disabled={invoiceOpening === p.id}
                        className="flex items-center gap-1 text-xs hover:underline disabled:opacity-50 active:scale-[0.97] transition-transform"
                        style={{ color: t.brand }}
                      >
                        <Download size={11} /> {invoiceOpening === p.id ? 'Ouverture…' : 'Facture'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Moyen de paiement.
          C'est ce qui manquait: la ligne « Moyens de paiement » des Paramètres
          menait bien ici, mais la page ne proposait AUCUN moyen de voir ou de
          changer la carte enregistrée.
          Le bouton part vers le portail Stripe plutôt que vers un formulaire
          maison: saisir un numéro de carte, c'est entrer dans le périmètre PCI,
          et le seul moyen sûr de ne pas y entrer est de ne jamais voir le
          numéro. */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="rounded-xl border p-6"
        style={{ borderColor: t.border, background: 'rgba(255,255,255,0.025)' }}
      >
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: t.text }}>
          <CreditCard size={15} style={{ color: t.brand }} />
          Moyen de paiement
        </h2>
        {/* LA CARTE, ÉCRITE. Sans cette ligne, la page annonçait un prix sans
            jamais dire ce qui allait être débité, et il fallait ouvrir le
            portail Stripe pour le savoir. Les quatre derniers chiffres et la
            date d'expiration suffisent à reconnaître sa carte; le reste ne
            transite jamais par nous. */}
        {overview?.paymentMethod ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
            <span className="text-sm font-medium" style={{ color: t.text }}>
              {CARD_BRANDS[overview.paymentMethod.brand] || overview.paymentMethod.brand}
            </span>
            <span className="text-sm tabular-nums" style={{ color: t.text }}>
              •••• {overview.paymentMethod.last4}
            </span>
            <span className="text-xs tabular-nums" style={{ color: t.textSec }}>
              expire {String(overview.paymentMethod.expMonth).padStart(2, '0')}/
              {String(overview.paymentMethod.expYear).slice(-2)}
            </span>
          </div>
        ) : overview?.paymentMethodUnavailable ? (
          <p className="text-xs mb-4" style={{ color: t.textSec }}>
            Votre carte n'a pas pu être lue à l'instant. Elle reste bien enregistrée ; le portail ci-dessous l'affiche.
          </p>
        ) : (
          <p className="text-xs mb-4" style={{ color: t.textSec }}>
            Aucune carte enregistrée pour le moment.
          </p>
        )}
        <p className="text-xs mb-4" style={{ color: t.textSec }}>
          Votre carte est conservée par Stripe, notre prestataire de paiement. Le portail permet de la
          remplacer, de mettre à jour l'adresse de facturation et de télécharger vos factures.
        </p>
        <Button onClick={openBillingPortal} loading={openingPortal}>
          {openingPortal ? 'Ouverture…' : 'Gérer mon moyen de paiement'}
        </Button>

        {/* Le NUMÉRO DE TVA a quitté cette page (demande utilisateur): il vit
            désormais avec le nom et le métier, dans « Identité de l'entreprise »
            sur la page Compte, parce que c'est une donnée d'identité de la
            société et non un état d'abonnement. Il ne reste ici qu'un renvoi:
            quelqu'un qui le cherchait sur Facturation doit savoir où il est
            parti, sinon le champ a simplement disparu pour lui. */}
        <p className="mt-6 pt-6 border-t text-xs" style={{ borderColor: t.border, color: t.textSec }}>
          Votre numéro de TVA, qui apparaît sur ces factures, se renseigne dans{' '}
          <Link to="/dashboard/account" className="hover:underline" style={{ color: t.brand }}>
            Compte, Identité de l'entreprise
          </Link>
          .
        </p>
      </motion.div>

      {/* Danger zone — cancel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border p-6"
        style={{ borderColor: `color-mix(in oklab, ${t.danger} 20%, transparent)`, background: `color-mix(in oklab, ${t.danger} 4%, transparent)` }}
      >
        <h2 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: t.danger }}>
          <AlertTriangle size={15} />
          Zone de danger
        </h2>
        <p className="text-xs mb-4" style={{ color: t.textSec }}>
          {/* La résiliation prend effet AU TERME de la période déjà payée
              (`cancel_at_period_end` chez Stripe), et non à la seconde du clic:
              le mois est payé, il est dû, et le client garde sa réceptionniste
              jusque-là. L'ancien texte annonçait une coupure immédiate. */}
          Aucun nouveau prélèvement. Votre réceptionniste continue de répondre jusqu'à la fin de la période déjà payée, puis s'arrête.
        </p>

        {!showCancel ? (
          <Button variant="danger" onClick={() => setShowCancel(true)} disabled={isCancelled}>
            {isCancelled ? 'Abonnement annulé' : "Annuler l'abonnement"}
          </Button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
            <p className="text-xs" style={{ color: t.textSec }}>
              Tapez <span className="font-mono font-bold" style={{ color: t.text }}>ANNULER</span> pour confirmer l'annulation.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-sm">
              <input
                type="text"
                value={cancelInput}
                onChange={e => setCancelInput(e.target.value)}
                placeholder="Tapez ANNULER"
                className={`flex-1 font-mono ${ds.inputCls}`}
                style={{ borderColor: `color-mix(in oklab, ${t.danger} 40%, transparent)` }}
              />
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="ghost"
                  style={{ border: `1px solid ${t.border}` }}
                  onClick={() => { setShowCancel(false); setCancelInput(''); }}
                >
                  Annuler
                </Button>
                <Button variant="danger" onClick={handleCancel} disabled={cancelInput !== 'ANNULER'}>
                  Confirmer
                </Button>
              </div>
            </div>
            {cancelError && (
              <p className="text-[12.5px]" role="alert" style={{ color: t.danger }}>{cancelError}</p>
            )}
          </motion.div>
        )}
      </motion.div>

    </div>
  );
}
