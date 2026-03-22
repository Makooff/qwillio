import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Mail, CreditCard, BookOpen, Package,
  Plus, Activity, CheckCircle2, AlertCircle,
  Clock, TrendingUp, Zap, ChevronRight, ToggleLeft, ToggleRight
} from 'lucide-react';

type ModuleStatus = 'active' | 'setup_required' | 'paused';

interface Module {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  status: ModuleStatus;
  enabled: boolean;
  href: string;
}

const INITIAL_MODULES: Module[] = [
  {
    id: 'email',
    name: 'Email AI',
    description: 'Classifies, auto-replies, and triages your inbox. Handles appointment and payment emails autonomously.',
    icon: Mail,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    status: 'active',
    enabled: true,
    href: '/dashboard/agent/email',
  },
  {
    id: 'payments',
    name: 'Payments AI',
    description: 'Sends deposit requests, tracks payment status, and triggers SMS reminders automatically.',
    icon: CreditCard,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/payments',
  },
  {
    id: 'accounting',
    name: 'Accounting AI',
    description: 'Generates invoices, tracks revenue vs expenses, and sends overdue reminders on schedule.',
    icon: BookOpen,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    status: 'paused',
    enabled: false,
    href: '/dashboard/agent/accounting',
  },
  {
    id: 'inventory',
    name: 'Inventory AI',
    description: 'Monitors stock levels, triggers low-stock alerts, and can auto-order from suppliers.',
    icon: Package,
    color: 'text-amber-600',
    bgColor: 'bg-amber-50',
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/inventory',
  },
];

const ACTIVITY_FEED = [
  { id: 1, module: 'Email AI', action: 'Auto-replied to appointment inquiry from sarah@email.com', time: '2 min ago', type: 'email' },
  { id: 2, module: 'Email AI', action: 'Classified 3 emails as Urgent — moved to review queue', time: '8 min ago', type: 'email' },
  { id: 3, module: 'Payments AI', action: 'Deposit reminder sent via SMS to +1 (555) 234-5678', time: '15 min ago', type: 'payment' },
  { id: 4, module: 'Email AI', action: 'Spam detected and moved: "Win a prize now!"', time: '22 min ago', type: 'email' },
  { id: 5, module: 'Accounting AI', action: 'Invoice #1042 generated for Johnson & Co. — $850.00', time: '1 hr ago', type: 'accounting' },
  { id: 6, module: 'Inventory AI', action: 'Low stock alert: "Massage Oil 500ml" below threshold (3 units)', time: '2 hr ago', type: 'inventory' },
  { id: 7, module: 'Email AI', action: 'Daily digest compiled — 12 emails processed overnight', time: '8 hr ago', type: 'email' },
  { id: 8, module: 'Payments AI', action: 'No-show fee of $50 charged to client ID #2201', time: '9 hr ago', type: 'payment' },
  { id: 9, module: 'Accounting AI', action: 'Overdue reminder (14d) sent to Martinez LLC — $1,200 outstanding', time: '10 hr ago', type: 'accounting' },
  { id: 10, module: 'Email AI', action: 'Auto-reply sent: payment confirmation to mike@domain.com', time: '11 hr ago', type: 'email' },
  { id: 11, module: 'Inventory AI', action: 'Auto-order placed: "Lavender Candles x24" from GreenSupply Co.', time: '12 hr ago', type: 'inventory' },
  { id: 12, module: 'Accounting AI', action: 'Monthly P&L exported to QuickBooks — March 2026', time: '1 day ago', type: 'accounting' },
];

const STATUS_CONFIG: Record<ModuleStatus, { label: string; classes: string; dot: string }> = {
  active: { label: 'Active', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  setup_required: { label: 'Setup Required', classes: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  paused: { label: 'Paused', classes: 'bg-[#f5f5f7] text-[#86868b] border-[#d2d2d7]', dot: 'bg-[#86868b]' },
};

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  email: Mail,
  payment: CreditCard,
  accounting: BookOpen,
  inventory: Package,
};

const ACTIVITY_COLORS: Record<string, string> = {
  email: 'bg-blue-50 text-blue-600',
  payment: 'bg-emerald-50 text-emerald-600',
  accounting: 'bg-purple-50 text-purple-600',
  inventory: 'bg-amber-50 text-amber-600',
};

export default function AgentDashboard() {
  const [modules, setModules] = useState<Module[]>(INITIAL_MODULES);

  const toggleModule = (id: string) => {
    setModules(prev =>
      prev.map(m =>
        m.id === id
          ? { ...m, enabled: !m.enabled, status: !m.enabled ? 'active' : 'paused' }
          : m
      )
    );
  };

  const stats = [
    { label: 'Emails handled', value: '1,284', sub: 'this month', icon: Mail, color: 'blue' },
    { label: 'Payments collected', value: '$14,320', sub: 'this month', icon: CreditCard, color: 'emerald' },
    { label: 'Invoices generated', value: '47', sub: 'this month', icon: BookOpen, color: 'purple' },
    { label: 'Stock alerts', value: '6', sub: 'this month', icon: Package, color: 'amber' },
  ];

  return (
    <div>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">AI Agent Hub</h1>
            <p className="text-sm text-[#86868b]">Manage your autonomous AI modules</p>
          </div>
          <Link
            to="/dashboard/billing"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl bg-[#6366f1] text-white hover:bg-[#4f46e5] transition-all"
          >
            <Plus size={15} /> Add Module
          </Link>
        </div>
      </motion.div>

      {/* Monthly Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-5 hover:shadow-md hover:border-[#d2d2d7] transition-all"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center bg-${s.color}-50 text-${s.color}-600 mb-3`}>
              <s.icon size={18} />
            </div>
            <p className="text-2xl font-bold tracking-tight">{s.value}</p>
            <p className="text-xs text-[#86868b] mt-1">{s.label}</p>
            <p className="text-[10px] text-[#86868b]/60 mt-0.5">{s.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Module Cards */}
      <div className="mb-8">
        <h2 className="text-base font-semibold mb-4">Your Modules</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            const statusCfg = STATUS_CONFIG[mod.status];
            return (
              <motion.div
                key={mod.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6 hover:shadow-md hover:border-[#d2d2d7] transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${mod.bgColor}`}>
                      <Icon size={22} className={mod.color} />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">{mod.name}</h3>
                      <span className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusCfg.classes}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleModule(mod.id)}
                    className="text-[#6366f1] hover:text-[#4f46e5] transition-colors"
                    title={mod.enabled ? 'Disable module' : 'Enable module'}
                  >
                    {mod.enabled
                      ? <ToggleRight size={28} className="text-[#6366f1]" />
                      : <ToggleLeft size={28} className="text-[#86868b]" />
                    }
                  </button>
                </div>
                <p className="text-sm text-[#86868b] leading-relaxed mb-4">{mod.description}</p>
                <Link
                  to={mod.href}
                  className="inline-flex items-center gap-1 text-xs font-medium text-[#6366f1] hover:underline"
                >
                  Configure <ChevronRight size={12} />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="rounded-2xl border border-[#d2d2d7]/60 bg-white p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Activity size={15} className="text-[#6366f1]" /> Recent AI Actions
            </h3>
            <p className="text-xs text-[#86868b] mt-0.5">Last 20 autonomous actions across all modules</p>
          </div>
          <span className="text-xs text-[#86868b]">Live</span>
        </div>
        <div className="space-y-1">
          {ACTIVITY_FEED.map((item, i) => {
            const Icon = ACTIVITY_ICONS[item.type] || Zap;
            const colorClass = ACTIVITY_COLORS[item.type] || 'bg-[#f5f5f7] text-[#86868b]';
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl hover:bg-[#f5f5f7] transition-colors"
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                  <Icon size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#86868b]">{item.module}</p>
                  <p className="text-sm truncate">{item.action}</p>
                </div>
                <span className="text-[11px] text-[#86868b] whitespace-nowrap">{item.time}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
