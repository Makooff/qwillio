import {
  LayoutDashboard, Phone, Users, BarChart3, CreditCard,
  Bot, UserCircle, HelpCircle, Settings,
} from 'lucide-react';
import AiStatusPill from '../../AiStatusPill';
import AppShell, { type ShellNavItem } from './AppShell';

/* Configuration du portail client V2. Les 19 routes ont un titre
   (la V1 en laissait 8 sans titre ni nav). */

const PRIMARY_NAV: ShellNavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: "Vue d'ensemble", exact: true },
  { to: '/dashboard/calls', icon: Phone, label: 'Appels' },
  { to: '/dashboard/leads', icon: Users, label: 'Leads' },
  { to: '/dashboard/analytics', icon: BarChart3, label: 'Analytique' },
  { to: '/dashboard/receptionist', icon: Bot, label: 'Réceptionniste IA' },
];

const SETTINGS_SUB: ShellNavItem[] = [
  { to: '/dashboard/account', icon: UserCircle, label: 'Compte' },
  { to: '/dashboard/billing', icon: CreditCard, label: 'Facturation' },
  { to: '/dashboard/support', icon: HelpCircle, label: 'Support' },
];

const MOBILE_NAV: ShellNavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Home', exact: true },
  { to: '/dashboard/calls', icon: Phone, label: 'Appels' },
  { to: '/dashboard/leads', icon: Users, label: 'Leads' },
  { to: '/dashboard/receptionist', icon: Bot, label: 'IA' },
  { to: '/dashboard/account', icon: Settings, label: 'Params' },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': "Vue d'ensemble",
  '/dashboard/calls': 'Appels',
  '/dashboard/leads': 'Leads',
  '/dashboard/analytics': 'Analytique',
  '/dashboard/receptionist': 'Réceptionniste IA',
  '/dashboard/account': 'Compte',
  '/dashboard/account/integrations': 'Intégrations',
  '/dashboard/billing': 'Facturation',
  '/dashboard/support': 'Support',
  '/dashboard/setup/call-forwarding': "Renvoi d'appel",
  '/dashboard/setup/customize': 'Personnalisation',
  '/dashboard/agent': 'Qwillio Agent',
  '/dashboard/crm': 'CRM',
};

export default function ClientLayoutV2() {
  return (
    <AppShell
      primaryNav={PRIMARY_NAV}
      settingsSub={SETTINGS_SUB}
      pageTitles={PAGE_TITLES}
      pageTitleFallback="Dashboard"
      mobileNav={MOBILE_NAV}
      userFallbackName="Client"
      userFallbackInitials="CL"
      topBarExtras={<AiStatusPill />}
    />
  );
}
