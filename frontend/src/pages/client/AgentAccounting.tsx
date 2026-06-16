import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BookOpen, TrendingUp, TrendingDown, DollarSign, Download,
  ToggleLeft, ToggleRight, AlertCircle, CheckCircle2, Clock,
  ExternalLink, FileText, ChevronRight
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Legend } from 'recharts';

interface Invoice {
  id: string;
  client: string;
  amount: number;
  status: 'paid' | 'outstanding' | 'overdue';
  dueDate: string;
  issuedDate: string;
}

const REVENUE_DATA = [
  { month: 'Oct', revenue: 8200, expenses: 3100 },
  { month: 'Nov', revenue: 9400, expenses: 3400 },
  { month: 'Dec', revenue: 11200, expenses: 3800 },
  { month: 'Jan', revenue: 10100, expenses: 3200 },
  { month: 'Feb', revenue: 12800, expenses: 4100 },
  { month: 'Mar', revenue: 14320, expenses: 4600 },
];

const INVOICES: Invoice[] = [
  { id: 'INV-1042', client: 'Johnson & Co.', amount: 850.00, status: 'outstanding', dueDate: 'Mar 28, 2026', issuedDate: 'Mar 14, 2026' },
  { id: 'INV-1041', client: 'Martinez LLC', amount: 1200.00, status: 'overdue', dueDate: 'Mar 8, 2026', issuedDate: 'Feb 22, 2026' },
  { id: 'INV-1040', client: 'Sarah Jones', amount: 300.00, status: 'paid', dueDate: 'Mar 15, 2026', issuedDate: 'Mar 1, 2026' },
  { id: 'INV-1039', client: 'Apex Studios', amount: 2200.00, status: 'outstanding', dueDate: 'Apr 1, 2026', issuedDate: 'Mar 18, 2026' },
  { id: 'INV-1038', client: 'Green Valley Spa', amount: 750.00, status: 'paid', dueDate: 'Mar 10, 2026', issuedDate: 'Feb 24, 2026' },
  { id: 'INV-1037', client: 'Bright Minds Co.', amount: 490.00, status: 'overdue', dueDate: 'Mar 1, 2026', issuedDate: 'Feb 15, 2026' },
];

const STATUS_CONFIG = {
  paid: { label: 'Paid', classes: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  outstanding: { label: 'Outstanding', classes: 'bg-blue-50 text-blue-700', dot: 'bg-blue-500' },
  overdue: { label: 'Overdue', classes: 'bg-red-50 text-red-700', dot: 'bg-red-500' },
};

const PL_DATA = [
  { label: 'Gross Revenue', value: 14320.00, type: 'revenue' },
  { label: 'Service Expenses', value: -4600.00, type: 'expense' },
  { label: 'Software & Tools', value: -890.00, type: 'expense' },
  { label: 'Marketing', value: -540.00, type: 'expense' },
  { label: 'Net Profit', value: 8290.00, type: 'total' },
];

export default function AgentAccounting() {
  const [qbConnected, setQbConnected] = useState(false);
  const [waveConnected, setWaveConnected] = useState(false);
  const [autoInvoice, setAutoInvoice] = useState(true);
  const [reminder7, setReminder7] = useState(true);
  const [reminder14, setReminder14] = useState(true);
  const [reminder30, setReminder30] = useState(false);

  const totalOutstanding = INVOICES.filter(i => i.status !== 'paid').reduce((s, i) => s + i.amount, 0);
  const totalOverdue = INVOICES.filter(i => i.status === 'overdue').reduce((s, i) => s + i.amount, 0);
  const currentMonthRevenue = REVENUE_DATA[REVENUE_DATA.length - 1].revenue;
  const currentMonthExpenses = REVENUE_DATA[REVENUE_DATA.length - 1].expenses;

  const exportTaxData = () => {
    const rows = [
      'Category,Amount',
      ...PL_DATA.map(r => `"${r.label}",${r.value}`),
    ].join('\n');
    const blob = new Blob([rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tax-export-mar-2026.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight mb-1">Accounting AI</h1>
        <p className="text-sm text-[#86868b]">Revenue tracking, invoicing, and overdue management</p>
      </motion.div>

      {/* Connect Providers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
              <BookOpen size={20} className="text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">QuickBooks</p>
              <p className="text-xs text-[#86868b]">{qbConnected ? 'Connected · Company ID 8812' : 'Sync invoices and expenses'}</p>
            </div>
          </div>
          <button
            onClick={() => setQbConnected(c => !c)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              qbConnected
                ? 'bg-[#f5f5f7] text-[#86868b] hover:bg-red-50 hover:text-red-600 border border-[#d2d2d7]/60'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {qbConnected ? 'Disconnect' : 'Connect QuickBooks'}
          </button>
        </div>
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <DollarSign size={20} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold">Wave</p>
              <p className="text-xs text-[#86868b]">{waveConnected ? 'Connected · Free tier' : 'Free accounting software'}</p>
            </div>
          </div>
          <button
            onClick={() => setWaveConnected(c => !c)}
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              waveConnected
                ? 'bg-[#f5f5f7] text-[#86868b] hover:bg-red-50 hover:text-red-600 border border-[#d2d2d7]/60'
                : 'bg-[#493cbe] text-white hover:bg-[#4f46e5]'
            }`}
          >
            {waveConnected ? 'Disconnect' : 'Connect Wave'}
          </button>
        </div>
      </div>

      {/* Stat Strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-[#d2d2d7]/60 bg-white mb-8 flex flex-col sm:flex-row items-stretch divide-y sm:divide-y-0 sm:divide-x divide-[#d2d2d7]/60 overflow-hidden"
      >
        <div className="flex-[2] p-6">
          <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest mb-2">Revenue (Mar)</p>
          <p className="text-4xl font-bold tracking-tight">${currentMonthRevenue.toLocaleString()}</p>
          <p className="text-xs text-emerald-600 font-medium mt-2">+12% vs Feb</p>
        </div>
        <div className="flex-1 p-6">
          <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest mb-2">Expenses</p>
          <p className="text-2xl font-bold">${currentMonthExpenses.toLocaleString()}</p>
          <p className="text-[10px] text-[#86868b]/50 mt-2">+8% vs Feb</p>
        </div>
        <div className="flex-1 p-6">
          <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest mb-2">Outstanding</p>
          <p className="text-2xl font-bold">${totalOutstanding.toLocaleString()}</p>
          <p className="text-[10px] text-[#86868b]/50 mt-2">{INVOICES.filter(i => i.status !== 'paid').length} invoices</p>
        </div>
        <div className="flex-1 p-6 bg-red-50/50">
          <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-2">Overdue</p>
          <p className="text-2xl font-bold text-red-600">${totalOverdue.toLocaleString()}</p>
          <p className="text-[10px] text-red-400/60 mt-2">{INVOICES.filter(i => i.status === 'overdue').length} invoices</p>
        </div>
      </motion.div>

      {/* Revenue vs Expenses Chart */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 mb-8">
        <h3 className="text-sm font-semibold mb-1">Revenue vs Expenses</h3>
        <p className="text-xs text-[#86868b] mb-5">Last 6 months</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={REVENUE_DATA}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#86868b' }} />
              <YAxis tick={{ fontSize: 11, fill: '#86868b' }} width={50} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                formatter={(v: number) => [`$${v.toLocaleString()}`, '']}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" fill="#493cbe" radius={[4, 4, 0, 0]} name="Revenue" />
              <Bar dataKey="expenses" fill="#f87171" radius={[4, 4, 0, 0]} name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 mb-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold">Outstanding Invoices</h3>
            <p className="text-xs text-[#86868b] mt-0.5">Requires your attention</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#86868b]">Auto-invoice</span>
            <button onClick={() => setAutoInvoice(v => !v)}>
              {autoInvoice
                ? <ToggleRight size={22} className="text-[#493cbe]" />
                : <ToggleLeft size={22} className="text-[#86868b]" />
              }
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#d2d2d7]/40">
                <th className="text-left text-xs font-medium text-[#86868b] pb-3">Invoice</th>
                <th className="text-left text-xs font-medium text-[#86868b] pb-3">Client</th>
                <th className="text-right text-xs font-medium text-[#86868b] pb-3">Amount</th>
                <th className="text-left text-xs font-medium text-[#86868b] pb-3 pl-4">Status</th>
                <th className="text-left text-xs font-medium text-[#86868b] pb-3">Issued</th>
                <th className="text-left text-xs font-medium text-[#86868b] pb-3">Due</th>
                <th className="text-left text-xs font-medium text-[#86868b] pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {INVOICES.map((inv, i) => {
                const sc = STATUS_CONFIG[inv.status];
                return (
                  <motion.tr
                    key={inv.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="border-b border-[#d2d2d7]/20 hover:bg-[#f5f5f7] transition-colors"
                  >
                    <td className="py-3 font-medium text-[#493cbe] text-xs">{inv.id}</td>
                    <td className="py-3 font-medium">{inv.client}</td>
                    <td className="py-3 text-right font-semibold">${inv.amount.toFixed(2)}</td>
                    <td className="py-3 pl-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${sc.classes}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </span>
                    </td>
                    <td className="py-3 text-xs text-[#86868b]">{inv.issuedDate}</td>
                    <td className={`py-3 text-xs ${inv.status === 'overdue' ? 'text-red-600 font-medium' : 'text-[#86868b]'}`}>{inv.dueDate}</td>
                    <td className="py-3">
                      {inv.status !== 'paid' && (
                        <button className="text-xs text-[#493cbe] font-medium hover:underline">Send reminder</button>
                      )}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Overdue Reminder Settings */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <h3 className="text-sm font-semibold mb-5">Overdue Reminders</h3>
          <div className="space-y-4">
            {[
              { label: '7-day reminder', value: reminder7, setter: setReminder7 },
              { label: '14-day reminder', value: reminder14, setter: setReminder14 },
              { label: '30-day reminder', value: reminder30, setter: setReminder30 },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between">
                <p className="text-sm">{item.label}</p>
                <button onClick={() => item.setter(v => !v)}>
                  {item.value
                    ? <ToggleRight size={22} className="text-[#493cbe]" />
                    : <ToggleLeft size={22} className="text-[#86868b]" />
                  }
                </button>
              </div>
            ))}
            <div className="rounded-xl bg-[#493cbe]/5 border border-[#493cbe]/20 p-3 mt-2">
              <p className="text-xs text-[#493cbe]">Reminders are sent via email and SMS to clients with outstanding invoices.</p>
            </div>
          </div>
        </div>

        {/* Monthly P&L */}
        <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="text-sm font-semibold">Monthly P&L — March 2026</h3>
              <p className="text-xs text-[#86868b] mt-0.5">Profit & Loss summary</p>
            </div>
            <button
              onClick={exportTaxData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl bg-[#f5f5f7] text-[#1d1d1f] hover:bg-[#e8e8ed] border border-[#d2d2d7]/60 transition-colors"
            >
              <Download size={12} /> Tax Export
            </button>
          </div>
          <div className="space-y-2">
            {PL_DATA.map(row => (
              <div
                key={row.label}
                className={`flex items-center justify-between py-2 px-3 rounded-xl ${
                  row.type === 'total'
                    ? 'bg-[#493cbe]/5 border border-[#493cbe]/20'
                    : 'hover:bg-[#f5f5f7]'
                } transition-colors`}
              >
                <span className={`text-sm ${row.type === 'total' ? 'font-semibold text-[#493cbe]' : ''}`}>{row.label}</span>
                <span className={`text-sm font-semibold ${
                  row.type === 'revenue' ? 'text-emerald-600' :
                  row.type === 'expense' ? 'text-red-500' :
                  'text-[#493cbe]'
                }`}>
                  {row.value < 0 ? `-$${Math.abs(row.value).toLocaleString()}` : `$${row.value.toLocaleString()}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
