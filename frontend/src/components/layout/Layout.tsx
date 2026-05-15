import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Phone, Zap, Bot, Settings, ExternalLink, Building2,
} from 'lucide-react';
import { t } from '../../styles/admin-theme';
import CommandPalette from '../ui/CommandPalette';
import DashboardShell, { NavItem } from './DashboardShell';

const PRIMARY_NAV: NavItem[] = [
  { path: '/admin',          icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/admin/leads',    icon: Zap,             label: 'Leads' },
  { path: '/admin/calls',    icon: Phone,           label: 'Appels' },
  { path: '/admin/agents',   icon: Bot,             label: 'Agents IA' },
  { path: '/admin/clients',  icon: Users,           label: 'Clients' },
  { path: '/admin/agency',   icon: Building2,       label: 'Agences' },
  { path: '/admin/settings', icon: Settings,        label: 'Paramètres' },
];

const MOBILE_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Home',       path: '/admin',          exact: true },
  { icon: Zap,             label: 'Leads',      path: '/admin/leads' },
  { icon: Phone,           label: 'Appels',     path: '/admin/calls' },
  { icon: Bot,             label: 'Agents',     path: '/admin/agents' },
  { icon: Settings,        label: 'Paramètres', path: '/admin/settings' },
];

const PAGE_TITLES: Record<string, string> = {
  '/admin':          'Dashboard',
  '/admin/leads':    'Leads',
  '/admin/calls':    'Appels',
  '/admin/agents':   'Agents IA',
  '/admin/clients':  'Clients',
  '/admin/agency':   'Agences & API',
  '/admin/settings': 'Paramètres',
  // sub-routes that still exist
  '/admin/billing':  'Facturation',
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
      // Don't hijack typing in inputs/textareas/contenteditable
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      }
      // Modifier keys mean the user is using a real shortcut (cmd+L, etc.)
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'g') { lastKey = 'g'; return; }
      if (lastKey === 'g') {
        const shortcuts: Record<string, string> = {
          o: '/admin', c: '/admin/clients', l: '/admin/leads',
          p: '/admin/agents', a: '/admin/calls', b: '/admin/settings',
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
