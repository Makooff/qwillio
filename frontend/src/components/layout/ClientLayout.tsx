import {
  LayoutDashboard, Phone, Users, BarChart3, CreditCard,
  Bot, UserCircle, HelpCircle, Settings, Contact,
} from '../icons';
import AiStatusPill from '../AiStatusPill';
import DashboardShell, { NavItem } from './DashboardShell';

const PRIMARY_NAV: NavItem[] = [
  { path: '/dashboard',              icon: LayoutDashboard, label: "Vue d'ensemble", exact: true },
  { path: '/dashboard/calls',        icon: Phone,           label: 'Appels' },
  { path: '/dashboard/leads',        icon: Users,           label: 'Leads' },
  { path: '/dashboard/analytics',    icon: BarChart3,       label: 'Analytique' },
  // Le CRM etait route et atteignable en tapant l'URL, mais absent du menu:
  // personne ne pouvait le trouver. Il se remplit desormais tout seul depuis
  // les appels, donc il a quelque chose a montrer.
  { path: '/dashboard/crm',          icon: Contact,         label: 'Contacts' },
  { path: '/dashboard/receptionist', icon: Bot,             label: 'Réceptionniste IA' },
];

const SETTINGS_SUB: NavItem[] = [
  { path: '/dashboard/account',  icon: UserCircle, label: 'Compte' },
  { path: '/dashboard/billing',  icon: CreditCard, label: 'Facturation' },
  { path: '/dashboard/support',  icon: HelpCircle, label: 'Support' },
];

const MOBILE_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: 'Home',   path: '/dashboard',           exact: true },
  { icon: Phone,           label: 'Appels', path: '/dashboard/calls' },
  { icon: Users,           label: 'Leads',  path: '/dashboard/leads' },
  { icon: Bot,             label: 'IA',     path: '/dashboard/receptionist' },
  { icon: Settings,        label: 'Params', path: '/dashboard/account' },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':              'Vue d\'ensemble',
  '/dashboard/calls':        'Appels',
  '/dashboard/leads':        'Leads',
  '/dashboard/analytics':    'Analytique',
  '/dashboard/receptionist': 'Réceptionniste IA',
  '/dashboard/crm':            'Contacts',
  '/dashboard/crm/deals':      'Pipeline',
  '/dashboard/crm/activities': 'Activité',
  '/dashboard/account':      'Compte',
  '/dashboard/billing':      'Facturation',
  '/dashboard/support':      'Support',
};

export default function ClientLayout() {
  return (
    <DashboardShell
      scope="client"
      primaryNav={PRIMARY_NAV}
      settingsSub={SETTINGS_SUB}
      pageTitles={PAGE_TITLES}
      mobileNav={MOBILE_NAV}
      userFallbackName="Client"
      userFallbackInitials="CL"
      topBarExtras={<AiStatusPill />}
    />
  );
}
