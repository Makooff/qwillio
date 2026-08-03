import {
  LayoutDashboard, Phone, Users, BarChart3, CreditCard,
  Bot, UserCircle, HelpCircle, Settings, Contact, Plug, PhoneForwarded,
  SlidersHorizontal, Sparkles, PhoneCall, Mic,
} from 'lucide-react';
import AiStatusPill from '../../AiStatusPill';
import AppShell, { type ShellNavItem } from './AppShell';
import type { CommandItem } from './CommandPalette';

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

/* Pages hors nav (icône dédiée) et actions rapides de la palette Cmd+K.
   Les routes restantes de PAGE_TITLES sont ajoutées automatiquement par AppShell. */
const COMMANDS: CommandItem[] = [
  { id: 'page-crm', label: 'CRM', to: '/dashboard/crm', group: 'Pages', icon: Contact, keywords: 'contacts deals pipeline' },
  { id: 'page-integrations', label: 'Intégrations', to: '/dashboard/account/integrations', group: 'Pages', icon: Plug, keywords: 'google calendar api webhook' },
  { id: 'page-agent', label: 'Qwillio Agent', to: '/dashboard/agent', group: 'Pages', icon: Sparkles, keywords: 'ia modules automation' },
  { id: 'page-forwarding', label: "Renvoi d'appel", to: '/dashboard/setup/call-forwarding', group: 'Pages', icon: PhoneForwarded, keywords: 'numero transfert setup' },
  { id: 'page-customize', label: 'Personnalisation', to: '/dashboard/setup/customize', group: 'Pages', icon: SlidersHorizontal, keywords: 'script accueil setup' },
  {
    id: 'action-test-call',
    label: 'Appel test',
    to: '/dashboard/receptionist',
    group: 'Actions rapides',
    icon: PhoneCall,
    hint: 'Réceptionniste IA',
    keywords: 'tester essayer appeler demo',
  },
  {
    id: 'action-clone-voice',
    label: 'Cloner ma voix',
    to: '/dashboard/receptionist#identite',
    group: 'Actions rapides',
    icon: Mic,
    hint: 'Identité',
    keywords: 'clone voix enregistrer micro',
  },
];

export default function ClientLayoutV2() {
  return (
    <AppShell
      extraCommands={COMMANDS}
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
