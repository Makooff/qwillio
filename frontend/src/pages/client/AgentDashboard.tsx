import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { motion } from 'framer-motion';
import {
  Mail, CreditCard, BookOpen, Package,
  Megaphone, Star, CalendarClock, LifeBuoy,
  Plus, Activity, Zap, ChevronRight, ToggleLeft, ToggleRight
} from 'lucide-react';

type ModuleStatus = 'active' | 'setup_required' | 'paused';
type ActivityType = 'email' | 'payment' | 'accounting' | 'inventory';

interface Module {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  iconStyle: { color: string; background: string };
  status: ModuleStatus;
  enabled: boolean;
  href: string;
}

interface ActivityItem {
  id: number;
  module: string;
  action: string;
  time: string;
  type: ActivityType;
}

interface SavedModule {
  id: string;
  enabled: boolean;
}

interface DashboardSettings {
  vapiConfig?: {
    agentModules?: SavedModule[];
  };
}

interface StatItem {
  label: string;
  value: string;
  sub: string;
  icon: React.ElementType;
  iconStyle: { color: string; background: string };
}

const ICON_STYLES: Record<string, { color: string; background: string }> = {
  blue:       { color: 'oklch(60% 0.20 230)', background: 'oklch(60% 0.20 230 / 0.12)' },
  emerald:    { color: 'oklch(65% 0.17 162)', background: 'oklch(65% 0.17 162 / 0.12)' },
  indigo:     { color: 'oklch(56% 0.22 264)', background: 'oklch(56% 0.22 264 / 0.12)' },
  violet:     { color: 'oklch(67% 0.26 299)', background: 'oklch(67% 0.26 299 / 0.12)' },
  amber:      { color: 'oklch(75% 0.18 85)',  background: 'oklch(75% 0.18 85 / 0.12)'  },
};

const INITIAL_MODULES: Module[] = [
  {
    id: 'email',
    name: 'Email AI',
    description: 'Classifies, auto-replies, and triages your inbox. Handles appointment and payment emails autonomously.',
    icon: Mail,
    iconStyle: ICON_STYLES.blue,
    status: 'active',
    enabled: true,
    href: '/dashboard/agent/email',
  },
  {
    id: 'payments',
    name: 'Payments AI',
    description: 'Sends deposit requests, tracks payment status, and triggers SMS reminders automatically.',
    icon: CreditCard,
    iconStyle: ICON_STYLES.emerald,
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/payments',
  },
  {
    id: 'accounting',
    name: 'Accounting AI',
    description: 'Generates invoices, tracks revenue vs expenses, and sends overdue reminders on schedule.',
    icon: BookOpen,
    iconStyle: ICON_STYLES.violet,
    status: 'paused',
    enabled: false,
    href: '/dashboard/agent/accounting',
  },
  {
    id: 'inventory',
    name: 'Inventory AI',
    description: 'Monitors stock levels, triggers low-stock alerts, and can auto-order from suppliers.',
    icon: Package,
    iconStyle: ICON_STYLES.amber,
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/inventory',
  },
  {
    id: 'marketing',
    name: 'Marketing AI',
    description: 'Generates on-brand social posts, campaign emails, and ad copy tailored to your niche.',
    icon: Megaphone,
    iconStyle: ICON_STYLES.indigo,
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/marketing',
  },
  {
    id: 'reputation',
    name: 'Reputation AI',
    description: 'Monitors Google and Facebook reviews, drafts replies, escalates low ratings.',
    icon: Star,
    iconStyle: ICON_STYLES.amber,
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/reputation',
  },
  {
    id: 'scheduling',
    name: 'Scheduling AI',
    description: 'Optimizes appointment slots, cuts no-shows via reminders, recommends best times.',
    icon: CalendarClock,
    iconStyle: ICON_STYLES.violet,
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/scheduling',
  },
  {
    id: 'support',
    name: 'Support AI',
    description: 'Triages inbound tickets, drafts replies, escalates urgent issues to humans.',
    icon: LifeBuoy,
    iconStyle: ICON_STYLES.emerald,
    status: 'setup_required',
    enabled: false,
    href: '/dashboard/agent/support',
  },
];

const ACTIVITY_FEED: ActivityItem[] = [
  { id: 1,  module: 'Email AI',       action: 'Auto-replied to appointment inquiry from sarah@email.com',             time: '2 min ago',  type: 'email'      },
  { id: 2,  module: 'Email AI',       action: 'Classified 3 emails as Urgent — moved to review queue',               time: '8 min ago',  type: 'email'      },
  { id: 3,  module: 'Payments AI',    action: 'Deposit reminder sent via SMS to +1 (555) 234-5678',                  time: '15 min ago', type: 'payment'    },
  { id: 4,  module: 'Email AI',       action: 'Spam detected and moved: "Win a prize now!"',                         time: '22 min ago', type: 'email'      },
  { id: 5,  module: 'Accounting AI',  action: 'Invoice #1042 generated for Johnson & Co. — $850.00',                 time: '1 hr ago',   type: 'accounting' },
  { id: 6,  module: 'Inventory AI',   action: 'Low stock alert: "Massage Oil 500ml" below threshold (3 units)',      time: '2 hr ago',   type: 'inventory'  },
  { id: 7,  module: 'Email AI',       action: 'Daily digest compiled — 12 emails processed overnight',               time: '8 hr ago',   type: 'email'      },
  { id: 8,  module: 'Payments AI',    action: 'No-show fee of $50 charged to client ID #2201',                       time: '9 hr ago',   type: 'payment'    },
  { id: 9,  module: 'Accounting AI',  action: 'Overdue reminder (14d) sent to Martinez LLC — $1,200 outstanding',   time: '10 hr ago',  type: 'accounting' },
  { id: 10, module: 'Email AI',       action: 'Auto-reply sent: payment confirmation to mike@domain.com',            time: '11 hr ago',  type: 'email'      },
  { id: 11, module: 'Inventory AI',   action: 'Auto-order placed: "Lavender Candles x24" from GreenSupply Co.',     time: '12 hr ago',  type: 'inventory'  },
  { id: 12, module: 'Accounting AI',  action: 'Monthly P&L exported to QuickBooks — March 2026',                    time: '1 day ago',  type: 'accounting' },
];

const STATUS_CONFIG: Record<ModuleStatus, { label: string; dotColor: string; labelColor: string; bgColor: string }> = {
  active:         { label: 'Active',         dotColor: 'oklch(65% 0.17 162)',        labelColor: 'oklch(65% 0.17 162)',        bgColor: 'oklch(65% 0.17 162 / 0.10)' },
  setup_required: { label: 'Setup Required', dotColor: 'oklch(75% 0.18 85)',         labelColor: 'oklch(75% 0.18 85)',         bgColor: 'oklch(75% 0.18 85 / 0.10)'  },
  paused:         { label: 'Paused',         dotColor: 'oklch(55% 0.00 0)',          labelColor: 'oklch(60% 0.00 0)',          bgColor: 'oklch(55% 0.00 0 / 0.10)'   },
};

const ACTIVITY_ICON_MAP: Record<ActivityType, React.ElementType> = {
  email:      Mail,
  payment:    CreditCard,
  accounting: BookOpen,
  inventory:  Package,
};

const ACTIVITY_ICON_STYLES: Record<ActivityType, { color: string; background: string }> = {
  email:      ICON_STYLES.blue,
  payment:    ICON_STYLES.emerald,
  accounting: ICON_STYLES.violet,
  inventory:  ICON_STYLES.amber,
};

const STATS: StatItem[] = [
  { label: 'Emails handled',     value: '1,284',  sub: 'this month', icon: Mail,       iconStyle: ICON_STYLES.blue    },
  { label: 'Payments collected', value: '$14,320', sub: 'this month', icon: CreditCard, iconStyle: ICON_STYLES.emerald },
  { label: 'Invoices generated', value: '47',      sub: 'this month', icon: BookOpen,   iconStyle: ICON_STYLES.violet  },
  { label: 'Stock alerts',       value: '6',       sub: 'this month', icon: Package,    iconStyle: ICON_STYLES.amber   },
];

const SURFACE  = 'oklch(8% 0.009 265)';
const CARD_BG  = 'rgba(255,255,255,0.025)';
const CARD_BORDER = 'rgba(255,255,255,0.07)';
const TEXT_PRIMARY   = '#F2F2F2';
const TEXT_SECONDARY = '#9A9AA5';
const INDIGO = 'oklch(56% 0.22 264)';
const INDIGO_HOVER = 'oklch(50% 0.22 264)';

export default function AgentDashboard() {
  const [modules, setModules] = useState<Module[]>(INITIAL_MODULES);

  useEffect(() => {
    api.get('/my-dashboard/settings').then((res) => {
      const saved = (res.data as DashboardSettings)?.vapiConfig?.agentModules;
      if (Array.isArray(saved) && saved.length > 0) {
        setModules(prev =>
          prev.map(m => {
            const s = saved.find(x => x.id === m.id);
            if (!s) return m;
            return { ...m, enabled: s.enabled, status: s.enabled ? 'active' : 'paused' };
          })
        );
      }
    }).catch(() => { /* keep defaults */ });
  }, []);

  const toggleModule = (id: string) => {
    const next = modules.map(m =>
      m.id === id
        ? { ...m, enabled: !m.enabled, status: (!m.enabled ? 'active' : 'paused') as ModuleStatus }
        : m
    );
    setModules(next);
    api.put('/my-dashboard/agent-modules', {
      modules: next.map(m => ({ id: m.id, enabled: m.enabled })),
    }).catch(() => { /* best-effort */ });
  };

  return (
    <main aria-label="AI Agent Hub">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-[22px] font-semibold tracking-tight mb-1"
              style={{ color: TEXT_PRIMARY }}
            >
              AI Agent Hub
            </h1>
            <p className="text-[13px]" style={{ color: TEXT_SECONDARY }}>
              Manage your autonomous AI modules
            </p>
          </div>
          <Link
            to="/dashboard/billing"
            aria-label="Add new AI module"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium rounded-xl transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: INDIGO,
              color: '#fff',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = INDIGO_HOVER)}
            onMouseLeave={e => (e.currentTarget.style.background = INDIGO)}
          >
            <Plus size={15} aria-hidden="true" />
            Add Module
          </Link>
        </div>
      </motion.div>

      {/* Monthly Stats */}
      <section aria-label="Monthly statistics">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-5 transition-colors"
              style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: s.iconStyle.background }}
                aria-hidden="true"
              >
                <s.icon size={18} style={{ color: s.iconStyle.color }} />
              </div>
              <p
                className="text-[22px] font-semibold tracking-tight tabular-nums"
                style={{ color: TEXT_PRIMARY }}
              >
                {s.value}
              </p>
              <p className="text-[12px] mt-1" style={{ color: TEXT_SECONDARY }}>
                {s.label}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: 'oklch(55% 0.00 0)' }}>
                {s.sub}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Module Cards */}
      <section aria-label="AI modules" className="mb-8">
        <h2
          className="text-[13px] font-semibold uppercase tracking-wider mb-4"
          style={{ color: TEXT_SECONDARY }}
        >
          Your Modules
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {modules.map((mod, i) => {
            const Icon = mod.icon;
            const statusCfg = STATUS_CONFIG[mod.status];
            return (
              <motion.article
                key={mod.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                aria-label={mod.name}
                className="rounded-2xl p-6 transition-colors"
                style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: mod.iconStyle.background }}
                      aria-hidden="true"
                    >
                      <Icon size={22} style={{ color: mod.iconStyle.color }} />
                    </div>
                    <div>
                      <h3
                        className="text-[13px] font-semibold"
                        style={{ color: TEXT_PRIMARY }}
                      >
                        {mod.name}
                      </h3>
                      <span
                        className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded-full text-[10px] font-medium"
                        style={{ background: statusCfg.bgColor, color: statusCfg.labelColor }}
                        aria-label={`Status: ${statusCfg.label}`}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: statusCfg.dotColor }}
                          aria-hidden="true"
                        />
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleModule(mod.id)}
                    aria-label={mod.enabled ? `Disable ${mod.name}` : `Enable ${mod.name}`}
                    aria-pressed={mod.enabled}
                    className="transition-opacity hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 rounded"
                    style={{ color: mod.enabled ? INDIGO : TEXT_SECONDARY }}
                  >
                    {mod.enabled
                      ? <ToggleRight size={28} aria-hidden="true" />
                      : <ToggleLeft  size={28} aria-hidden="true" />
                    }
                  </button>
                </div>
                <p
                  className="text-[13px] leading-relaxed mb-4"
                  style={{ color: TEXT_SECONDARY }}
                >
                  {mod.description}
                </p>
                <Link
                  to={mod.href}
                  aria-label={`Configure ${mod.name}`}
                  className="inline-flex items-center gap-1 text-[12px] font-medium hover:underline focus:outline-none focus-visible:ring-2 rounded"
                  style={{ color: INDIGO }}
                >
                  Configure <ChevronRight size={12} aria-hidden="true" />
                </Link>
              </motion.article>
            );
          })}
        </div>
      </section>

      {/* Activity Feed */}
      <section
        aria-label="Recent AI actions"
        className="rounded-2xl p-6"
        style={{ background: CARD_BG, border: `1px solid ${CARD_BORDER}` }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2
              className="text-[13px] font-semibold flex items-center gap-2"
              style={{ color: TEXT_PRIMARY }}
            >
              <Activity size={15} style={{ color: INDIGO }} aria-hidden="true" />
              Recent AI Actions
            </h2>
            <p className="text-[12px] mt-0.5" style={{ color: TEXT_SECONDARY }}>
              Last 20 autonomous actions across all modules
            </p>
          </div>
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ background: 'oklch(65% 0.17 162 / 0.12)', color: 'oklch(65% 0.17 162)' }}
            aria-label="Live feed"
          >
            Live
          </span>
        </div>
        <ol aria-label="Activity log" className="space-y-0.5">
          {ACTIVITY_FEED.map((item, i) => {
            const Icon = ACTIVITY_ICON_MAP[item.type] ?? Zap;
            const iconStyle = ACTIVITY_ICON_STYLES[item.type] ?? ICON_STYLES.blue;
            return (
              <motion.li
                key={item.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025 }}
                className="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors"
                style={{ background: 'transparent' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: iconStyle.background }}
                  aria-hidden="true"
                >
                  <Icon size={14} style={{ color: iconStyle.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium" style={{ color: TEXT_SECONDARY }}>
                    {item.module}
                  </p>
                  <p className="text-[13px] truncate" style={{ color: TEXT_PRIMARY }}>
                    {item.action}
                  </p>
                </div>
                <time
                  className="text-[11px] whitespace-nowrap flex-shrink-0"
                  style={{ color: TEXT_SECONDARY }}
                >
                  {item.time}
                </time>
              </motion.li>
            );
          })}
        </ol>
      </section>
    </main>
  );
}
