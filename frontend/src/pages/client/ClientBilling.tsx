import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, AlertTriangle, Shield, Phone, FileText, Download, CreditCard } from '../../components/icons';
import api from '../../services/api';
import { formatDate } from '../../utils/format';

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
  /** La carte enregistrée chez Stripe. Absente si aucune, ou si Stripe ne
      répond pas: la ligne disparaît alors au lieu d'inventer une carte. */
  paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null;
  /** Vrai quand Stripe n'a pas répondu. À ne pas confondre avec « pas de
      carte »: l'un appelle une action du client, l'autre non. */
  paymentMethodUnavailable?: boolean;
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
      'Intégrations CRM natives',
      'Support prioritaire',
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

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  active:    { bg: 'rgba(34,197,94,0.12)',  text: '#4ade80', label: 'Actif' },
  trial:     { bg: 'rgba(251,191,36,0.12)', text: '#fbbf24', label: 'Essai' },
  cancelled: { bg: 'rgba(239,68,68,0.12)',  text: '#f87171', label: 'Annulé' },
  past_due:  { bg: 'rgba(249,115,22,0.12)', text: '#fb923c', label: 'En retard' },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES['active'];
  return (
    <span
      className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
      style={{ background: s.bg, color: s.text }}
    >
      {s.label}
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ClientBilling() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  /* Le numéro de TVA vit dans les réglages du client, pas dans l'aperçu de
     facturation: c'est une donnée d'identité, pas un état d'abonnement. La page
     le lit donc à part, et l'écrit par le même PUT que le reste des réglages. */
  const [vatNumber, setVatNumber] = useState('');
  const [vatSaved, setVatSaved] = useState<string | null>(null);
  /* Le CHARGEMENT a-t-il réussi, question distincte de « le numéro est-il
     vide ». Sans elle, un échec de `GET /settings` laissait le champ vide et le
     bouton actif: un clic effaçait alors un numéro de TVA qu'on n'avait jamais
     réussi à lire. */
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [vatSaving, setVatSaving] = useState(false);
  const [vatError, setVatError] = useState<string | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  /* L'erreur de résiliation vit À CÔTÉ du bouton, pas dans le bandeau du haut
     de page: la boîte d'annulation est tout en bas, et un message affiché à
     900 px au-dessus passe inaperçu au moment précis où il compte. */
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelInput, setCancelInput] = useState('');
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);
  const [invoiceOpening, setInvoiceOpening] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    // `allSettled`, et non `all`: les deux requêtes sont indépendantes, et
    // `all` les liait au point qu'une seule qui échoue effaçait l'autre. C'est
    // ce qui se passait, `/payments` n'existant pas côté serveur: l'aperçu
    // arrivait bien, puis était jeté avec, et la page repartait sur ses
    // valeurs par défaut sans que rien ne le signale.
    Promise.allSettled([
      api.get('/my-dashboard/billing'),
      api.get('/my-dashboard/payments'),
      api.get('/my-dashboard/settings'),
    ])
      .then(([billingRes, paymentsRes, settingsRes]) => {
        if (billingRes.status === 'fulfilled') setOverview(billingRes.value.data);
        else setLoadError("Impossible de charger votre abonnement. Rechargez la page, ou contactez-nous si cela persiste.");
        if (paymentsRes.status === 'fulfilled') {
          const body = paymentsRes.value.data;
          setPayments(body?.data || body || []);
        }
        if (settingsRes.status === 'fulfilled') {
          const vat = settingsRes.value.data?.vatNumber || '';
          setVatNumber(vat);
          setVatSaved(vat);
          setSettingsLoaded(true);
        }
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
      const { data } = await api.post('/my-dashboard/upgrade', { planType: planId });
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

  /* Le portail Stripe, ouvert dans le MÊME onglet.
     Un `window.open` serait bloqué par le navigateur: la réponse arrive après
     un aller-retour réseau, donc hors du geste de l'utilisateur, et le bloqueur
     de fenêtres ne fait pas la différence avec une publicité. */
  /* L'enregistrement est explicite, pas automatique: un numéro de TVA
     incomplet part chez Stripe à chaque frappe si on le sauve en continu, et
     Stripe refuse alors la moitié des tentatives. */
  const saveVatNumber = async () => {
    setVatSaving(true);
    setVatError(null);
    try {
      await api.put('/my-dashboard/settings', { vatNumber });
      setVatSaved(vatNumber);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setVatError(msg || 'Enregistrement impossible. Réessayez.');
    } finally {
      setVatSaving(false);
    }
  };

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

  const currentPlanId = (overview?.plan ?? 'starter') as PlanId;
  const currentPlan = PLANS.find(p => p.id === currentPlanId) ?? PLANS[0];
  const minutesUsed = overview?.minutesUsed ?? 0;
  const minutesLimit = overview?.minutesLimit ?? currentPlan.minutes;
  const minutesPct = minutesLimit > 0 ? Math.min(Math.round((minutesUsed / minutesLimit) * 100), 100) : 0;
  const isCancelled = overview?.status === 'cancelled';

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[22px] font-semibold text-[#F5F5F7] tracking-tight">Facturation</h1>
        <p className="text-[12.5px] text-[#A1A1A8] mt-0.5">Gérez votre abonnement et vos factures</p>
      </motion.div>

      {/* Une page de facturation qui se trompe en silence est pire qu'une page
          qui s'excuse: le client croit connaître son plan. */}
      {loadError && (
        <div
          className="flex items-start gap-3 rounded-xl border px-5 py-4"
          style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.25)' }}
          role="alert"
        >
          <AlertTriangle size={18} className="text-[#f87171] mt-0.5 shrink-0" />
          <p className="text-[13px] text-[#F5F5F7]">{loadError}</p>
        </div>
      )}

      {/* Trial banner */}
      {overview?.isTrial && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 rounded-xl border px-5 py-4"
          style={{ background: 'rgba(122,95,255,0.08)', borderColor: 'rgba(122,95,255,0.25)' }}
        >
          <Shield size={18} className="text-[#7349fe] mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-[#F5F5F7]">
              Période d'essai en cours
            </p>
            {overview.trialEndsAt && (
              <p className="text-xs text-[#A1A1A8] mt-0.5">
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
        style={{ borderColor: 'rgba(122,95,255,0.35)', background: 'rgba(122,95,255,0.06)' }}
      >
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <p className="text-xs text-[#A1A1A8] mb-1">Plan actuel</p>
            <p className="text-2xl font-bold text-[#F5F5F7]">{currentPlan.name}</p>
            {overview?.renewalDate && !isCancelled && (
              <p className="text-xs text-[#A1A1A8] mt-1">
                Renouvellement le {formatDate(overview.renewalDate)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={overview?.status ?? 'active'} />
            <div className="text-right hidden sm:block">
              <span className="text-2xl font-bold text-[#F5F5F7]">{currentPlan.monthly.toLocaleString()}€</span>
              <span className="text-xs text-[#A1A1A8]">/mois</span>
            </div>
          </div>
        </div>

        {/* Minute usage progress */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs text-[#A1A1A8]">
              <Phone size={12} />
              Minutes utilisées ce mois
            </span>
            <span className="text-xs font-medium text-[#F5F5F7]">
              {minutesUsed.toLocaleString()} / {minutesLimit.toLocaleString()} min
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${minutesPct}%`, background: '#7349fe' }}
            />
          </div>
          {minutesPct > 80 && (
            <p className="text-[11px] mt-1.5" style={{ color: '#fbbf24' }}>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#A1A1A8] mb-3">
              Ce que votre plan inclut
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              {currentPlan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-[13px] text-[#D4D4D8]">
                  <Check size={13} className="mt-[3px] flex-shrink-0" style={{ color: '#b9a8ff' }} aria-hidden="true" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </motion.div>

      {/* Plan grid */}
      <div>
        <h2 className="text-sm font-semibold text-[#F5F5F7] mb-4">Plans disponibles</h2>
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
                  borderColor: isCurrent ? '#7349fe' : 'rgba(255,255,255,0.07)',
                  background: isCurrent
                    ? 'rgba(122,95,255,0.07)'
                    : 'rgba(255,255,255,0.025)',
                }}
              >
                {/* Badge */}
                {isCurrent && (
                  <span
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-0.5 rounded-full text-white whitespace-nowrap"
                    style={{ background: '#22c55e' }}
                  >
                    ACTUEL
                  </span>
                )}
                {plan.popular && !isCurrent && (
                  <span
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] font-bold px-3 py-0.5 rounded-full text-white whitespace-nowrap"
                    style={{ background: '#7349fe' }}
                  >
                    Recommandé
                  </span>
                )}

                <div className="mb-4">
                  <p className="text-base font-bold text-[#F5F5F7] mb-1">{plan.name}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold text-[#F5F5F7]">{plan.monthly.toLocaleString()}€</span>
                    <span className="text-xs text-[#A1A1A8]">/mois</span>
                  </div>
                  <p className="text-[11px] text-[#A1A1A8] mt-1">
                    {plan.minutes.toLocaleString()} min · {plan.overage.toFixed(2).replace('.', ',')} €/min supp.
                  </p>
                </div>

                <ul className="space-y-2 mb-5 flex-1">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-xs text-[#C4C4D0]">
                      <Check size={13} className="text-emerald-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {!isCurrent && (
                  <button
                    onClick={() => handleUpgrade(plan.id)}
                    disabled={upgrading === plan.id}
                    className="w-full py-2 text-sm font-medium rounded-lg border border-[#7349fe] text-[#7349fe] hover:bg-[#7349fe] hover:text-white transition-colors disabled:opacity-50"
                  >
                    {upgrading === plan.id ? 'Redirection…' : isHigher ? 'Upgrader' : 'Réduire'}
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
        style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)' }}
      >
        <h2 className="text-sm font-semibold text-[#F5F5F7] mb-4 flex items-center gap-2">
          <FileText size={15} style={{ color: '#7349fe' }} />
          Historique des paiements
        </h2>

        {payments.length === 0 ? (
          <p className="text-[12.5px] text-[#A1A1A8]">Aucun paiement enregistré pour l'instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-[11px] text-[#A1A1A8] border-b"
                  style={{ borderColor: 'rgba(255,255,255,0.07)' }}
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
                    <td className="py-3 pr-4 font-semibold text-[#F5F5F7]">
                      {Number(p.amount).toFixed(2)}{p.currency === 'EUR' ? '€' : '$'}
                    </td>
                    <td className="py-3 pr-4 text-[#A1A1A8] text-xs max-w-[160px] truncate">
                      {p.description || '—'}
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill status={p.status} />
                    </td>
                    <td className="py-3 pr-4 text-[#A1A1A8] text-xs whitespace-nowrap">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="py-3">
                      <button
                        type="button"
                        onClick={() => openInvoice(p.id)}
                        disabled={invoiceOpening === p.id}
                        className="flex items-center gap-1 text-xs hover:underline disabled:opacity-50 active:scale-[0.97] transition-transform"
                        style={{ color: '#7349fe' }}
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
        style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.025)' }}
      >
        <h2 className="text-sm font-semibold text-[#F5F5F7] mb-1 flex items-center gap-2">
          <CreditCard size={15} style={{ color: '#7349fe' }} />
          Moyen de paiement
        </h2>
        {/* LA CARTE, ÉCRITE. Sans cette ligne, la page annonçait un prix sans
            jamais dire ce qui allait être débité, et il fallait ouvrir le
            portail Stripe pour le savoir. Les quatre derniers chiffres et la
            date d'expiration suffisent à reconnaître sa carte; le reste ne
            transite jamais par nous. */}
        {overview?.paymentMethod ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4">
            <span className="text-sm font-medium text-[#F5F5F7]">
              {CARD_BRANDS[overview.paymentMethod.brand] || overview.paymentMethod.brand}
            </span>
            <span className="text-sm text-[#F5F5F7] tabular-nums">
              •••• {overview.paymentMethod.last4}
            </span>
            <span className="text-xs text-[#A1A1A8] tabular-nums">
              expire {String(overview.paymentMethod.expMonth).padStart(2, '0')}/
              {String(overview.paymentMethod.expYear).slice(-2)}
            </span>
          </div>
        ) : overview?.paymentMethodUnavailable ? (
          <p className="text-xs text-[#A1A1A8] mb-4">
            Votre carte n'a pas pu être lue à l'instant. Elle reste bien enregistrée ; le portail ci-dessous l'affiche.
          </p>
        ) : (
          <p className="text-xs text-[#A1A1A8] mb-4">
            Aucune carte enregistrée pour le moment.
          </p>
        )}
        <p className="text-xs text-[#A1A1A8] mb-4">
          Votre carte est conservée par Stripe, notre prestataire de paiement. Le portail permet de la
          remplacer, de mettre à jour l'adresse de facturation et de télécharger vos factures.
        </p>
        <button
          type="button"
          onClick={openBillingPortal}
          disabled={openingPortal}
          className="px-4 py-2 text-sm font-medium rounded-full bg-[#7349fe] text-white hover:bg-[#8560ff] disabled:opacity-40 transition-colors active:scale-[0.97]"
        >
          {openingPortal ? 'Ouverture…' : 'Gérer mon moyen de paiement'}
        </button>

        {/* NUMÉRO DE TVA. Il ne sert pas à nous: il sert à la facture, que le
            comptable du client regarde. Sans lui, un assujetti belge ne peut
            pas la porter en compte, et un client d'un autre État membre ne
            bénéficie pas de l'autoliquidation. Le champ vit sous le moyen de
            paiement parce que c'est la même question: à qui et comment on
            facture. */}
        <div className="mt-6 pt-6 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <label htmlFor="vat" className="block text-xs font-medium text-[#F5F5F7] mb-1">
            Numéro de TVA
          </label>
          <p className="text-xs text-[#A1A1A8] mb-3">
            Il apparaîtra sur vos factures. Laissez vide si vous n'êtes pas assujetti.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="vat"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="BE 0123.456.789"
              spellCheck={false}
              className="px-4 py-2.5 text-sm rounded-xl border border-white/[0.07] bg-white/[0.02] text-[#F5F5F7] placeholder-[#8B8BA7] focus:outline-none focus:border-[#7349fe]/50 transition-colors w-[220px]"
            />
            <button
              type="button"
              onClick={saveVatNumber}
              disabled={vatSaving || !settingsLoaded || vatNumber === vatSaved}
              className="px-4 py-2 text-sm font-medium rounded-full border border-white/[0.12] text-[#F5F5F7] hover:bg-white/[0.06] disabled:opacity-40 transition-colors active:scale-[0.97]"
            >
              {vatSaving ? 'Enregistrement…' : vatNumber === vatSaved ? 'Enregistré' : 'Enregistrer'}
            </button>
          </div>
          {!settingsLoaded && (
            <p className="text-xs text-[#A1A1A8] mt-2">
              Vos réglages n'ont pas pu être chargés. Rechargez la page avant de modifier ce champ.
            </p>
          )}
          {vatError && <p className="text-xs text-red-400 mt-2">{vatError}</p>}
        </div>
      </motion.div>

      {/* Danger zone — cancel */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-xl border p-6"
        style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.04)' }}
      >
        <h2 className="text-sm font-semibold text-red-400 mb-1 flex items-center gap-2">
          <AlertTriangle size={15} />
          Zone de danger
        </h2>
        <p className="text-xs text-[#A1A1A8] mb-4">
          {/* La résiliation prend effet AU TERME de la période déjà payée
              (`cancel_at_period_end` chez Stripe), et non à la seconde du clic:
              le mois est payé, il est dû, et le client garde sa réceptionniste
              jusque-là. L'ancien texte annonçait une coupure immédiate. */}
          Aucun nouveau prélèvement. Votre réceptionniste continue de répondre jusqu'à la fin de la période déjà payée, puis s'arrête.
        </p>

        {!showCancel ? (
          <button
            onClick={() => setShowCancel(true)}
            disabled={isCancelled}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors"
          >
            {isCancelled ? 'Abonnement annulé' : "Annuler l'abonnement"}
          </button>
        ) : (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
            <p className="text-xs text-[#A1A1A8]">
              Tapez <span className="font-mono font-bold text-[#F5F5F7]">ANNULER</span> pour confirmer l'annulation.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 max-w-sm">
              <input
                type="text"
                value={cancelInput}
                onChange={e => setCancelInput(e.target.value)}
                placeholder="Tapez ANNULER"
                className="flex-1 px-4 py-2 text-sm font-mono rounded-lg border bg-transparent text-[#F5F5F7] placeholder-[#8B8BA7] focus:outline-none transition-colors"
                style={{ borderColor: 'rgba(239,68,68,0.4)' }}
              />
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => { setShowCancel(false); setCancelInput(''); }}
                  className="px-4 py-2 text-sm font-medium rounded-lg border text-[#A1A1A8] hover:bg-white/5 transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                >
                  Annuler
                </button>
                <button
                  onClick={handleCancel}
                  disabled={cancelInput !== 'ANNULER'}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-40 transition-colors"
                >
                  Confirmer
                </button>
              </div>
            </div>
            {cancelError && (
              <p className="text-[12.5px] text-[#f87171]" role="alert">{cancelError}</p>
            )}
          </motion.div>
        )}
      </motion.div>

    </div>
  );
}
