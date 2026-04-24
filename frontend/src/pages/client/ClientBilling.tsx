import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard, Check, AlertTriangle, Shield, Phone, Users, FileText, Download,
} from 'lucide-react';
import api from '../../services/api';
import StatusBadge from '../../components/client-dashboard/StatusBadge';
import { formatDate, daysUntil } from '../../utils/format';
import OrbsLoader from "../../components/OrbsLoader";

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 197,
    setup: 697,
    calls: 200,
    features: ['200 appels/mois', 'Réceptionniste IA', 'Capture de leads', 'Analytiques', 'Support email'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 347,
    setup: 997,
    calls: 500,
    features: ['500 appels/mois', 'Tout Starter inclus', 'Support prioritaire', 'Analytiques avancées', 'Scripts personnalisés'],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 497,
    setup: 1497,
    calls: 1000,
    features: ['1 000 appels/mois', 'Tout Pro inclus', 'Responsable dédié', 'Accès API', 'Intégrations custom'],
  },
];

export default function ClientBilling() {
  const [overview, setOverview] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelInput, setCancelInput] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [ov, billing] = await Promise.all([
          api.get('/my-dashboard/overview'),
          api.get('/my-dashboard/billing').catch(() => ({ data: [] })),
        ]);
        setOverview(ov.data);
        setPayments(billing.data || []);
      } catch (err) {
        console.error('Billing fetch error', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleCancel = async () => {
    try {
      await api.post('/my-dashboard/cancel');
      setShowCancel(false);
      setCancelInput('');
      setOverview((prev: any) => ({ ...prev, client: { ...prev.client, subscriptionStatus: 'cancelled' } }));
    } catch (err) {
      console.error('Cancel error', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <OrbsLoader size={40} fullscreen={false} />
      </div>
    );
  }

  const client = overview?.client || {};
  const currentPlan = PLANS.find(p => p.id === client.planType) || PLANS[0];

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-[22px] font-semibold text-[#F5F5F7] tracking-tight">Facturation</h1>
        <p className="text-[12.5px] text-[#A1A1A8] mt-0.5">Gérez votre abonnement et vos factures</p>
      </motion.div>

      {/* Trial banner */}
      {client.isTrial && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 bg-[#7B5CF0]/10 border border-[#7B5CF0]/20 rounded-xl px-5 py-4 mb-6"
        >
          <Shield size={18} className="text-[#7B5CF0] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-[#F5F5F7]">Essai gratuit — <strong>{daysUntil(client.trialEndDate)} jours restants</strong></p>
            <p className="text-xs text-[#A1A1A8]">Votre IA s'arrêtera si vous ne passez pas à un plan payant avant la fin de l'essai</p>
          </div>
        </motion.div>
      )}

      {/* Current plan */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-[#7B5CF0]/30 bg-gradient-to-br from-[#7B5CF0]/20 to-[#7B5CF0]/5 p-6 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-[#A1A1A8]">Plan actuel</p>
            <p className="text-2xl font-bold text-[#F5F5F7] capitalize">{currentPlan.name}</p>
          </div>
          <StatusBadge status={client.subscriptionStatus || 'active'} />
        </div>
        <div className="flex items-baseline gap-1 mb-5">
          <span className="text-3xl font-bold text-[#F5F5F7]">{client.currency === 'EUR' ? '€' : '$'}{client.monthlyFee || currentPlan.monthly}</span>
          <span className="text-[#A1A1A8]">/mois</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-white/[0.06] rounded-xl px-4 py-3">
            <Phone size={14} className="text-[#A1A1A8] mb-1" />
            <p className="text-sm font-semibold text-[#F5F5F7]">{overview?.calls?.quotaUsed || 0} / {client.monthlyCallsQuota || currentPlan.calls}</p>
            <p className="text-[10px] text-[#A1A1A8]">Appels utilisés</p>
          </div>
          <div className="bg-white/[0.06] rounded-xl px-4 py-3">
            <Users size={14} className="text-[#A1A1A8] mb-1" />
            <p className="text-sm font-semibold text-[#F5F5F7]">{overview?.leads?.thisMonth || 0}</p>
            <p className="text-[10px] text-[#A1A1A8]">Leads ce mois</p>
          </div>
          <div className="bg-white/[0.06] rounded-xl px-4 py-3 hidden md:block">
            <CreditCard size={14} className="text-[#A1A1A8] mb-1" />
            <p className="text-sm font-semibold text-[#F5F5F7]">{client.currency === 'EUR' ? '€' : '$'}{client.setupFee || currentPlan.setup}</p>
            <p className="text-[10px] text-[#A1A1A8]">Frais de setup (payé)</p>
          </div>
        </div>
        <div>
          <div className="h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
            <div className="h-full bg-[#7B5CF0] rounded-full transition-all"
              style={{ width: `${Math.min(overview?.calls?.quotaPercent || 0, 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-[#A1A1A8] mt-1">{overview?.calls?.quotaPercent || 0}% du quota mensuel utilisé</p>
        </div>
      </motion.div>

      {/* Plans */}
      <h2 className="text-base font-semibold text-[#F5F5F7] mb-4">Plans disponibles</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PLANS.map((plan, i) => {
          const isCurrent = plan.id === client.planType;
          return (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`rounded-xl border p-6 relative ${
                isCurrent
                  ? 'border-[#7B5CF0] bg-[#7B5CF0]/[0.06]'
                  : plan.popular
                    ? 'border-[#7B5CF0]/30 bg-white/[0.03]'
                    : 'border-white/[0.07] bg-white/[0.03]'
              }`}
            >
              {plan.popular && !isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#7B5CF0] text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                  POPULAIRE
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                  ACTUEL
                </span>
              )}
              <p className="text-base font-bold text-[#F5F5F7] mb-1">{plan.name}</p>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-bold text-[#F5F5F7]">${plan.monthly}</span>
                <span className="text-sm text-[#A1A1A8]">/mois</span>
              </div>
              <p className="text-xs text-[#A1A1A8] mb-4">+ ${plan.setup} setup</p>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-[#F5F5F7]">
                    <Check size={14} className="text-emerald-400 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {!isCurrent && (
                <button className="w-full py-2.5 text-sm font-medium rounded-xl border border-[#7B5CF0] text-[#7B5CF0] hover:bg-[#7B5CF0] hover:text-white transition-all">
                  {PLANS.indexOf(plan) > PLANS.indexOf(currentPlan) ? 'Upgrader' : 'Réduire'}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Invoice history */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-6 mb-6">
        <h2 className="text-sm font-semibold text-[#F5F5F7] mb-4 flex items-center gap-2">
          <FileText size={16} className="text-[#7B5CF0]" />
          Historique des paiements
        </h2>
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#A1A1A8] border-b border-white/[0.07]">
                  <th className="pb-3 pr-4">Montant</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Statut</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-3 pr-4 font-semibold text-[#F5F5F7]">${Number(p.amount).toFixed(2)}</td>
                    <td className="py-3 pr-4 capitalize text-[#A1A1A8]">{p.paymentType}</td>
                    <td className="py-3 pr-4"><StatusBadge status={p.status} /></td>
                    <td className="py-3 pr-4 text-[#A1A1A8]">{formatDate(p.paidAt)}</td>
                    <td className="py-3">
                      {p.invoiceUrl && (
                        <a href={p.invoiceUrl} target="_blank" rel="noreferrer"
                          className="text-[#7B5CF0] hover:underline text-xs flex items-center gap-1"
                        >
                          <Download size={12} /> PDF
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-[12.5px] text-[#A1A1A8] mt-0.5">Aucune facture pour l'instant</p>
        )}
      </div>

      {/* Cancel */}
      <div className="rounded-xl border border-red-400/20 bg-red-400/[0.04] p-6">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-400">
          <AlertTriangle size={16} />
          Annuler l'abonnement
        </h2>
        <p className="text-sm text-[#A1A1A8] mb-4">
          Une fois annulé, votre réceptionniste IA cessera de répondre. Cette action est irréversible.
        </p>
        <button
          onClick={() => setShowCancel(true)}
          disabled={client.subscriptionStatus === 'cancelled'}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-40 transition-colors"
        >
          {client.subscriptionStatus === 'cancelled' ? 'Abonnement annulé' : 'Annuler l\'abonnement'}
        </button>
      </div>

      {/* Cancel dialog */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowCancel(false); setCancelInput(''); }} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="relative bg-white/[0.02] border border-white/[0.07] rounded-2xl shadow-2xl max-w-sm w-full p-6 z-10"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-400/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} className="text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-[#F5F5F7] text-center mb-2">Annuler l'abonnement ?</h3>
            <p className="text-sm text-[#A1A1A8] text-center mb-4">
              Votre IA s'arrêtera immédiatement. Tapez <strong className="text-[#F5F5F7]">ANNULER</strong> pour confirmer.
            </p>
            <input
              type="text"
              value={cancelInput}
              onChange={e => setCancelInput(e.target.value)}
              placeholder="Tapez ANNULER"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-white/[0.07] bg-[#0A0A0F] text-[#F5F5F7] placeholder-[#8B8BA7] focus:outline-none focus:border-red-400/50 mb-4 text-center font-mono"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowCancel(false); setCancelInput(''); }}
                className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-white/[0.07] text-[#A1A1A8] hover:bg-white/[0.04] transition-colors"
              >
                Garder mon plan
              </button>
              <button onClick={handleCancel} disabled={cancelInput !== 'ANNULER'}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-40 transition-colors"
              >
                Annuler
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
