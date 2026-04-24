import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Phone, Zap, Target, Brain,
  CreditCard, Settings, ExternalLink, TrendingUp,
  ScrollText, Activity, DollarSign, RotateCcw, Send, PhoneMissed,
  Crosshair,
} from 'lucide-react';
import { t } from '../../styles/admin-theme';
import CommandPalette from '../ui/CommandPalette';
import DashboardShell, { NavItem } from './DashboardShell';

const PRIMARY_NAV: NavItem[] = [
  { path: '/admin',             icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/admin/prospects',   icon: Target,          label: 'Prospects' },
  { path: '/admin/calls',       icon: Phone,           label: 'Appels' },
  { path: '/admin/leads',       icon: Zap,             label: 'Leads' },
  { path: '/admin/clients',     icon: Users,           label: 'Clients' },
  { path: '/admin/prospecting', icon: Crosshair,       label: 'Prospection' },
  { path: '/admin/ai-learning', icon: Brain,           label: 'IA' },
  { path: '/admin/logs',        icon: ScrollText,      label: 'Logs' },
  { path: '/admin/billing',     icon: CreditCard,      label: 'Facturation' },
];

const SETTINGS_SUB: NavItem[] = [
  { path: '/admin/settings',          icon: Settings,    label: 'Général' },
  { path: '/admin/system',            icon: Activity,    label: 'Système' },
  { path: '/admin/monitor',           icon: TrendingUp,  label: 'Moniteur live' },
  { path: '/admin/phone-validation',  icon: PhoneMissed, label: 'Validation tél.' },
  { path: '/admin/campaigns',         icon: Send,        label: 'Campagnes' },
  { path: '/admin/followups',         icon: RotateCcw,   label: 'Suivis' },
  { path: '/admin/costs',             icon: DollarSign,  label: 'Coûts' },
  { path: '/admin/retention',         icon: Users,       label: 'Rétention' },
];

const MOBILE_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Home',      path: '/admin',            exact: true },
  { icon: Users,           label: 'Clients',   path: '/admin/clients' },
  { icon: Phone,           label: 'Calls',     path: '/admin/calls' },
  { icon: TrendingUp,      label: 'Prospects', path: '/admin/prospects' },
  { icon: ScrollText,      label: 'Logs',      path: '/admin/logs' },
];

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/prospects': 'Prospects',
  '/admin/calls': 'Appels',
  '/admin/leads': 'Leads',
  '/admin/clients': 'Clients',
  '/admin/prospecting': 'Prospection',
  '/admin/ai-learning': 'IA',
  '/admin/ai-decisions': 'IA — Décisions',
  '/admin/billing': 'Facturation',
  '/admin/settings': 'Paramètres',
  '/admin/campaigns': 'Campagnes',
  '/admin/followups': 'Suivis',
  '/admin/costs': 'Coûts',
  '/admin/retention': 'Rétention',
  '/admin/phone-validation': 'Validation tél.',
  '/admin/monitor': 'Moniteur live',
  '/admin/logs': 'Logs',
  '/admin/system': 'Système',
};

export default function Layout() {
  const navigate = useNavigate();
  const [cmdOpen, setCmdOpen] = useState(false);

  // cmd+K command palette
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Keyboard nav shortcuts: g then {o|c|l|p|a|b}
  useEffect(() => {
    let lastKey = '';
    const handler = (e: KeyboardEvent) => {
      if (cmdOpen) return;
      if (e.key === 'g') { lastKey = 'g'; return; }
      if (lastKey === 'g') {
        const shortcuts: Record<string, string> = {
          o: '/admin', c: '/admin/clients', l: '/admin/leads',
          p: '/admin/prospects', a: '/admin/calls', b: '/admin/billing',
        };
        if (shortcuts[e.key]) navigate(shortcuts[e.key]);
        lastKey = '';
        return;
      }
      lastKey = '';
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, cmdOpen]);

  return (
    <DashboardShell
      scope="admin"
      brandSuffix="admin"
      primaryNav={PRIMARY_NAV}
      settingsSub={SETTINGS_SUB}
      pageTitles={PAGE_TITLES}
      pageTitleFallback="Admin"
      mobileNav={MOBILE_NAV}
      userFallbackName="Admin"
      userFallbackInitials="AD"
      topBarExtras={
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-xl hover:bg-white/[0.06] transition-all"
          style={{ color: t.textSec }}
          title="Voir le site"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      }
      overlay={<CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />}
    />
  );
}
