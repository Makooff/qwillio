import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard, Check, ArrowRight, AlertTriangle, Shield, Zap,
  Phone, Users, FileText, Download
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLang } from '../../stores/langStore';
import api from '../../services/api';
import StatusBadge from '../../components/client-dashboard/StatusBadge';
import ConfirmDialog from '../../components/client-dashboard/ConfirmDialog';
import { formatDate, daysUntil } from '../../utils/format';

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 197,
    setup: 697,
    calls: 200,
    features: ['200 calls/month', 'AI receptionist', 'Lead capture', 'Call analytics', 'Email support'],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 347,
    setup: 997,
    calls: 500,
    features: ['500 calls/month', 'Everything in Starter', 'Priority support', 'Advanced analytics', 'Custom scripts'],
    popular: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthly: 497,
    setup: 1497,
    calls: 1000,
    features: ['1,000 calls/month', 'Everything in Pro', 'Dedicated account manager', 'API access', 'Custom integrations'],
  },
];

export default function ClientBilling() {
  const { t } = useLang();
  const [overview, setOverview] = useState<any>(null);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancel, setShowCancel] = useState(false);
  const [cancelInput, setCancelInput] = useState('');

  useEffect(() => {
    const fetchData = async () => {
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
    };
    fetchData();
  }, []);

  const handleCancel = async () => {
    try {
      await api.post('/my-dashboard/cancel');
      setShowCancel(false);
      setCancelInput('');
      setOverview((prev: any) => ({
        ...prev,
        client: { ...prev.client, subscriptionStatus: 'cancelled' },
      }));
    } catch (err) {
      console.error('Cancel error', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-2 border-[#6366f1] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const client = overview?.client || {};
  const currentPlan = PLANS.find(p => p.id === client.planType) || PLANS[0];

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Billing</h1>
        <p className="text-sm text-[#86868b]">Manage your subscription and invoices</p>
      </motion.div>

      {/* Trial banner */}
      {client.isTrial && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="flex items-center gap-3 bg-gradient-to-r from-[#6366f1]/5 to-purple-500/5 border border-[#6366f1]/20 rounded-2xl px-6 py-4 mb-6"
        >
          <Shield size={20} className="text-[#6366f1] flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Free trial — <strong>{daysUntil(client.trialEndDate)} days remaining</strong></p>
            <p className="text-xs text-[#86868b]">Your AI receptionist will pause when the trial ends unless you upgrade</p>
          </div>
        </motion.div>
      )}

      {/* Current plan card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-[#d2d2d7]/60 bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] p-6 text-white mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-white/70">Current plan</p>
            <p className="text-2xl font-bold capitalize">{currentPlan.name}</p>
          </div>
          <StatusBadge status={client.subscriptionStatus || 'active'} />
        </div>
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-3xl font-bold">${currentPlan.monthly}</span>
          <span className="text-white/70">/month</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="bg-white/10 rounded-xl px-4 py-3">
            <Phone size={14} className="text-white/70 mb-1" />
            <p className="text-sm font-semibold">{overview?.calls?.quotaUsed || 0} / {currentPlan.calls}</p>
            <p className="text-[10px] text-white/60">Calls used</p>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-3">
            <Users size={14} className="text-white/70 mb-1" />
            <p className="text-sm font-semibold">{overview?.leads?.thisMonth || 0}</p>
            <p className="text-[10px] text-white/60">Leads this month</p>
          </div>
          <div className="bg-white/10 rounded-xl px-4 py-3 hidden md:block">
            <CreditCard size={14} className="text-white/70 mb-1" />
            <p className="text-sm font-semibold">${currentPlan.setup}</p>
            <p className="text-[10px] text-white/60">Setup fee (paid)</p>
          </div>
        </div>
        <div className="mt-4">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${Math.min((overview?.calls?.quotaPercent || 0), 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-white/60 mt-1">{overview?.calls?.quotaPercent || 0}% of monthly quota used</p>
        </div>
      </motion.div>

      {/* Plans comparison */}
      <h2 className="text-lg font-semibold mb-4">Available plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {PLANS.map((plan, i) => {
          const isCurrent = plan.id === client.planType;
          return (
            <motion.div key={plan.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`rounded-2xl border p-6 relative ${
                isCurrent
                  ? 'border-[#6366f1] bg-[#6366f1]/[0.02]'
                  : plan.popular
                    ? 'border-[#6366f1]/30 bg-white'
                    : 'border-[#d2d2d7]/60 bg-white'
              }`}
            >
              {plan.popular && !isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#6366f1] text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                  POPULAR
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-emerald-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full">
                  CURRENT
                </span>
              )}
              <p className="text-lg font-bold mb-1">{plan.name}</p>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold">${plan.monthly}</span>
                <span className="text-sm text-[#86868b]">/mo</span>
              </div>
              <p className="text-xs text-[#86868b] mb-4">+ ${plan.setup} setup</p>
              <ul className="space-y-2 mb-6">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm">
                    <Check size={14} className="text-emerald-500 flex-shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {!isCurrent && (
                <button className="w-full py-2.5 text-sm font-medium rounded-xl border border-[#6366f1] text-[#6366f1] hover:bg-[#6366f1] hover:text-white transition-all">
                  {PLANS.indexOf(plan) > PLANS.indexOf(currentPlan) ? 'Upgrade' : 'Downgrade'}
                </button>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Invoice history */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <FileText size={16} className="text-[#6366f1]" />
          Invoice history
        </h2>
        {payments.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#86868b] border-b border-[#d2d2d7]/40">
                  <th className="pb-3 pr-4">Amount</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody>
                {payments.map((p: any) => (
                  <tr key={p.id} className="border-b border-[#d2d2d7]/20 last:border-0">
                    <td className="py-3 pr-4 font-semibold">${Number(p.amount).toFixed(2)}</td>
                    <td className="py-3 pr-4 capitalize text-[#86868b]">{p.paymentType}</td>
                    <td className="py-3 pr-4"><StatusBadge status={p.status} /></td>
                    <td className="py-3 pr-4 text-[#86868b]">{formatDate(p.paidAt)}</td>
                    <td className="py-3">
                      {p.invoiceUrl && (
                        <a href={p.invoiceUrl} target="_blank" rel="noreferrer"
                          className="text-[#6366f1] hover:underline text-xs flex items-center gap-1"
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
          <p className="text-sm text-[#86868b]">No invoices yet</p>
        )}
      </div>

      {/* Cancel subscription */}
      <div className="rounded-2xl border border-red-200 bg-red-50/30 p-6">
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-600">
          <AlertTriangle size={16} />
          Cancel subscription
        </h2>
        <p className="text-sm text-[#86868b] mb-4">
          Once cancelled, your AI receptionist will stop answering calls. This action cannot be undone.
        </p>
        <button
          onClick={() => setShowCancel(true)}
          disabled={client.subscriptionStatus === 'cancelled'}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-40 transition-colors"
        >
          {client.subscriptionStatus === 'cancelled' ? 'Subscription cancelled' : 'Cancel subscription'}
        </button>
      </div>

      {/* Cancel dialog */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/30" onClick={() => { setShowCancel(false); setCancelInput(''); }} />
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="relative bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 z-10"
          >
            <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-center mb-2">Cancel subscription?</h3>
            <p className="text-sm text-[#86868b] text-center mb-4">
              Your AI receptionist will stop immediately. Type <strong>CANCEL</strong> to confirm.
            </p>
            <input
              type="text"
              value={cancelInput}
              onChange={e => setCancelInput(e.target.value)}
              placeholder="Type CANCEL"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#d2d2d7]/60 bg-white focus:outline-none focus:ring-2 focus:ring-red-300 mb-4 text-center font-mono"
            />
            <div className="flex gap-3">
              <button onClick={() => { setShowCancel(false); setCancelInput(''); }}
                className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-[#d2d2d7]/60 hover:bg-[#f5f5f7] transition-colors"
              >
                Keep plan
              </button>
              <button onClick={handleCancel} disabled={cancelInput !== 'CANCEL'}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-red-500 rounded-xl hover:bg-red-600 disabled:opacity-40 transition-colors"
              >
                Cancel now
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
