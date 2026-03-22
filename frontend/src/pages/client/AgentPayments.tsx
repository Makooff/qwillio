import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard, TrendingUp, DollarSign, Percent, Download,
  ToggleLeft, ToggleRight, CheckCircle2, Clock, AlertCircle,
  ChevronDown, ExternalLink, Bell, MessageSquare
} from 'lucide-react';

interface Payment {
  id: string;
  client: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed' | 'refunded';
  date: string;
  method: string;
  type: string;
}

const PAYMENTS: Payment[] = [
  { id: 'pay_001', client: 'Sarah Jones', amount: 150.00, status: 'paid', date: 'Mar 22, 2026', method: 'Visa •••• 4242', type: 'Appointment deposit' },
  { id: 'pay_002', client: 'Mike Chen', amount: 350.00, status: 'pending', date: 'Mar 21, 2026', method: 'Awaiting', type: 'Package payment' },
  { id: 'pay_003', client: 'Lisa Martin', amount: 75.00, status: 'paid', date: 'Mar 20, 2026', method: 'Mastercard •••• 8912', type: 'Appointment deposit' },
  { id: 'pay_004', client: 'David Hall', amount: 50.00, status: 'failed', date: 'Mar 19, 2026', method: 'Visa •••• 1234', type: 'No-show fee' },
  { id: 'pay_005', client: 'Emma Wilson', amount: 200.00, status: 'paid', date: 'Mar 18, 2026', method: 'Amex •••• 5678', type: 'Monthly retainer' },
  { id: 'pay_006', client: 'James Brown', amount: 125.00, status: 'refunded', date: 'Mar 17, 2026', method: 'Visa •••• 9999', type: 'Appointment deposit' },
  { id: 'pay_007', client: 'Anna White', amount: 75.00, status: 'paid', date: 'Mar 16, 2026', method: 'Mastercard •••• 3344', type: 'Appointment deposit' },
  { id: 'pay_008', client: 'Tom Harris', amount: 250.00, status: 'pending', date: 'Mar 15, 2026', method: 'Awaiting', type: 'Package payment' },
];

const STATUS_CONFIG = {
  paid: { label: 'Paid', classes: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  pending: { label: 'Pending', classes: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  failed: { label: 'Failed', classes: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
  refunded: { label: 'Refunded', classes: 'bg-[#f5f5f7] text-[#86868b]', dot: 'bg-[#86868b]' },
};

function exportCSV(payments: Payment[]) {
  const header = 'ID,Client,Amount,Status,Date,Method,Type\n';
  const rows = payments.map(p =>
    `${p.id},"${p.client}",${p.amount},${p.status},"${p.date}","${p.method}","${p.type}"`
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'payments-export.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function AgentPayments() {
  const [stripeConnected, setStripeConnected] = useState(false);
  const [autoSendSMS, setAutoSendSMS] = useState(true);
  const [noShowFeeEnabled, setNoShowFeeEnabled] = useState(true);
  const [noShowFee, setNoShowFee] = useState('50');
  const [reminderTiming, setReminderTiming] = useState('24');
  const [depositPercent, setDepositPercent] = useState('30');

  const mrr = PAYMENTS.filter(p => p.status === 'paid').reduce((s, p) => s + p.amount, 0);
  const avgTicket = mrr / PAYMENTS.filter(p => p.status === 'paid').length;
  const paymentRate = Math.round((PAYMENTS.filter(p => p.status === 'paid').length / PAYMENTS.length) * 100);

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Payments AI</h1>
        <p className="text-sm text-[#86868b]">Automated deposit requests, reminders, and no-show fees</p>
      </motion.div>

      {/* Stripe Connect */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5 mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#635bff]/10 flex items-center justify-center">
            <CreditCard size={20} className="text-[#635bff]" />
          </div>
          <div>
            <p className="text-sm font-semibold">Stripe</p>
            <p className="text-xs text-[#86868b]">
              {stripeConnected ? 'Connected · acct_1234567890' : 'Connect to accept payments and track revenue'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {stripeConnected && (
            <a href="#" className="inline-flex items-center gap-1 text-xs text-[#6366f1] font-medium hover:underline">
              Stripe Dashboard <ExternalLink size={11} />
            </a>
          )}
          <button
            onClick={() => setStripeConnected(c => !c)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              stripeConnected
                ? 'bg-[#f5f5f7] text-[#86868b] hover:bg-red-50 hover:text-red-600 border border-[#d2d2d7]/60'
                : 'bg-[#635bff] text-white hover:bg-[#5851e8]'
            }`}
          >
            {stripeConnected ? 'Disconnect' : 'Connect Stripe'}
          </button>
        </div>
      </div>

      {/* Revenue KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Monthly Revenue', value: `$${mrr.toFixed(2)}`, sub: 'paid this month', icon: DollarSign, color: 'emerald' },
          { label: 'Average Ticket', value: `$${avgTicket.toFixed(2)}`, sub: 'per transaction', icon: TrendingUp, color: 'blue' },
          { label: 'Payment Rate', value: `${paymentRate}%`, sub: 'of invoices paid', icon: Percent, color: 'purple' },
        ].map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5 hover:shadow-md hover:border-[#d2d2d7] transition-all"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${kpi.color}-50 text-${kpi.color}-600 mb-3`}>
              <kpi.icon size={18} />
            </div>
            <p className="text-2xl font-bold tracking-tight">{kpi.value}</p>
            <p className="text-xs text-[#86868b] mt-1">{kpi.label}</p>
            <p className="text-[10px] text-[#86868b]/60 mt-0.5">{kpi.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Payments Table */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold">Recent Payments</h3>
            <p className="text-xs text-[#86868b] mt-0.5">Last 30 days</p>
          </div>
          <button
            onClick={() => exportCSV(PAYMENTS)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] border border-[#d2d2d7]/60 transition-all"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#d2d2d7]/40">
                <th className="text-left text-xs font-medium text-[#86868b] pb-3">Client</th>
                <th className="text-left text-xs font-medium text-[#86868b] pb-3">Type</th>
                <th className="text-right text-xs font-medium text-[#86868b] pb-3">Amount</th>
                <th className="text-left text-xs font-medium text-[#86868b] pb-3 pl-4">Status</th>
                <th className="text-left text-xs font-medium text-[#86868b] pb-3">Method</th>
                <th className="text-left text-xs font-medium text-[#86868b] pb-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {PAYMENTS.map((p, i) => {
                const sc = STATUS_CONFIG[p.status];
                return (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-[#d2d2d7]/20 hover:bg-[#f5f5f7] transition-colors"
                  >
                    <td className="py-3 font-medium">{p.client}</td>
                    <td className="py-3 text-[#86868b] text-xs">{p.type}</td>
                    <td className="py-3 text-right font-semibold">${p.amount.toFixed(2)}</td>
                    <td className="py-3 pl-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${sc.classes}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-[#86868b]">{p.method}</td>
                    <td className="py-3 text-xs text-[#86868b]">{p.date}</td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Deposit Settings */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-5">Deposit Settings</h3>
          <div className="space-y-5">
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-2">Deposit Percentage</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={depositPercent}
                  onChange={e => setDepositPercent(e.target.value)}
                  min={0}
                  max={100}
                  className="w-24 text-sm border border-[#d2d2d7]/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30"
                />
                <span className="text-sm text-[#86868b]">% of total</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-send SMS reminder</p>
                <p className="text-xs text-[#86868b] mt-0.5">Send SMS when deposit is due</p>
              </div>
              <button onClick={() => setAutoSendSMS(v => !v)}>
                {autoSendSMS
                  ? <ToggleRight size={24} className="text-[#6366f1]" />
                  : <ToggleLeft size={24} className="text-[#86868b]" />
                }
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-2">Reminder timing (hours before)</label>
              <select
                value={reminderTiming}
                onChange={e => setReminderTiming(e.target.value)}
                className="w-full text-sm border border-[#d2d2d7]/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 bg-white"
              >
                <option value="1">1 hour before</option>
                <option value="6">6 hours before</option>
                <option value="24">24 hours before</option>
                <option value="48">48 hours before</option>
              </select>
            </div>
          </div>
        </div>

        {/* No-show Fee */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-5">No-show Fee</h3>
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Enable no-show fee</p>
                <p className="text-xs text-[#86868b] mt-0.5">Charge automatically when client no-shows</p>
              </div>
              <button onClick={() => setNoShowFeeEnabled(v => !v)}>
                {noShowFeeEnabled
                  ? <ToggleRight size={24} className="text-[#6366f1]" />
                  : <ToggleLeft size={24} className="text-[#86868b]" />
                }
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#86868b] mb-2">Fee Amount ($)</label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#86868b]">$</span>
                <input
                  type="number"
                  value={noShowFee}
                  onChange={e => setNoShowFee(e.target.value)}
                  disabled={!noShowFeeEnabled}
                  className="flex-1 text-sm border border-[#d2d2d7]/60 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#6366f1]/30 disabled:opacity-40 disabled:cursor-not-allowed"
                />
              </div>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs text-amber-700">
                <strong>Note:</strong> No-show fees are charged to the payment method on file. Ensure clients acknowledge this policy during booking.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
