import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, AlertTriangle, Shield, Phone, FileText, Download } from 'lucide-react';
import api from '../../services/api';
import { formatDate } from '../../utils/format';

// ── Types ────────────────────────────────────────────────────────────────────

interface BillingOverview {
  plan: string;
  status: string;
  renewalDate: string;
  callsUsed: number;
  callsLimit: number;
  trialEndsAt: string | null;
  isTrial: boolean;
}

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
    id: 'starter',
    name: 'Starter',
    monthly: 497,
    calls: 800,
    overage: 0.22,
    popular: false,
    features: [
      '800 appels/mois',
      'Réceptionniste IA 24/7',
      'Capture de leads',
      'Analytiques',
      'Support email',
      'Transcription des appels',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 1297,
    calls: 2000,
    overage: 0.18,
    popular: true,
    features: [
      '2 000 appels/mois',
      'Tout Starter inclus',
      'Analytiques avancées + sentiments',
      "Transfert d'appel intelligent",
      'Support prioritaire',
      'Intégrations CRM natives',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 2497,
    calls: 4000,
    overage: 0.15,
    popular: false,
    features: [
      '4 000 appels/mois',
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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelInput, setCancelInput] = useState('');
  const [upgrading, setUpgrading] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/my-dashboard/billing'),
      api.get('/my-dashboard/payments'),
    ])
      .then(([billingRes, paymentsRes]) => {
        setOverview(billingRes.data);
        setPayments(paymentsRes.data?.data || paymentsRes.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (planId: string) => {
    setUpgrading(planId);
    try {
      await api.post('/my-dashboard/upgrade', { plan: planId });
      window.location.reload();
    } catch {
      // silent — UX handled via disabled state
    } finally {
      setUpgrading(null);
    }
  };

  const handleCancel = async () => {
    try {
      await api.post('/my-dashboard/cancel');
      setOverview(prev => prev ? { ...prev, status: 'cancelled' } : prev);
      setShowCancel(false);
      setCancelInput('');
    } catch {
      // silent
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
  const callsUsed = overview?.callsUsed ?? 0;
  const callsLimit = overview?.callsLimit ?? currentPlan.calls;
  const callsPct = callsLimit > 0 ? Math.min(Math.round((callsUsed / callsLimit) * 100), 100) : 0;
  const isCancelled = overview?.status === 'cancelled';

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-[22px] font-semibold text-[#F5F5F7] tracking-tight">Facturation</h1>
        <p className="text-[12.5px] text-[#A1A1A8] mt-0.5">Gérez votre abonnement et vos factures</p>
      </motion.div>

      {/* Trial banner */}
      {overview?.isTrial && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3 rounded-xl border px-5 py-4"
          style={{ background: 'rgba(99,102,241,0.08)', borderColor: 'rgba(99,102,241,0.25)' }}
        >
          <Shield size={18} className="text-[#493cbe] mt-0.5 shrink-0" />
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
        style={{ borderColor: 'rgba(99,102,241,0.35)', background: 'rgba(99,102,241,0.06)' }}
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

        {/* Call usage progress */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="flex items-center gap-1.5 text-xs text-[#A1A1A8]">
              <Phone size={12} />
              Appels utilisés ce mois
            </span>
            <span className="text-xs font-medium text-[#F5F5F7]">
              {callsUsed.toLocaleString()} / {callsLimit.toLocaleString()}
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div
              className="h-full rounded-full transition-[width] duration-500 ease-out"
              style={{ width: `${callsPct}%`, background: '#493cbe' }}
            />
          </div>
          {callsPct > 80 && (
            <p className="text-[11px] mt-1.5" style={{ color: '#fbbf24' }}>
              ⚠ {callsPct}% du quota mensuel utilisé — envisagez un upgrade
            </p>
          )}
        </div>
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
                  borderColor: isCurrent ? '#493cbe' : 'rgba(255,255,255,0.07)',
                  background: isCurrent
                    ? 'rgba(99,102,241,0.07)'
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
                    style={{ background: '#493cbe' }}
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
                    {plan.calls.toLocaleString()} appels · {plan.overage}€/appel supp.
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
                    className="w-full py-2 text-sm font-medium rounded-lg border border-[#493cbe] text-[#493cbe] hover:bg-[#493cbe] hover:text-white transition-colors disabled:opacity-50"
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
          <FileText size={15} style={{ color: '#493cbe' }} />
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
                      <a
                        href={`/api/invoices/${p.id}/pdf`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs hover:underline"
                        style={{ color: '#493cbe' }}
                      >
                        <Download size={11} /> PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
          Une fois annulé, votre réceptionniste IA cessera de répondre aux appels. Cette action est irréversible.
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
          </motion.div>
        )}
      </motion.div>

    </div>
  );
}
