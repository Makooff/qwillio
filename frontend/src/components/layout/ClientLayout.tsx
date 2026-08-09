import {
  LayoutDashboard, Phone, Users, BarChart3, CreditCard,
  Bot, UserCircle, HelpCircle,
} from '../icons';
import AiStatusPill from '../AiStatusPill';
import DashboardShell, { NavItem } from './DashboardShell';

const PRIMARY_NAV: NavItem[] = [
  { path: '/dashboard',              icon: LayoutDashboard, label: "Vue d'ensemble", exact: true },
  { path: '/dashboard/calls',        icon: Phone,           label: 'Appels' },
  { path: '/dashboard/leads',        icon: Users,           label: 'Leads' },
  { path: '/dashboard/analytics',    icon: BarChart3,       label: 'Analytique' },
  /* « Contacts » a disparu du menu: les leads et les contacts sont les mêmes
     personnes, puisqu'un contact naît de l'appel qui a produit le lead. Deux
     entrées pour une réalité, avec deux vocabulaires d'état, faisaient croire
     à deux répertoires. La fiche de contact reste, comme détail d'une ligne. */
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
  /* Analytique a pris la place des paramètres (demande utilisateur): on
     consulte ses chiffres tous les jours, on règle son compte deux fois par
     an. Les réglages restent atteignables par l'avatar, en haut à droite,
     qui mène désormais quelque part.
     L'IA passe tout à droite, au bout de la barre: c'est là que le pouce
     tombe, et c'est la seule entrée où l'on va pour AGIR sur l'agent, les
     quatre autres ne font que regarder ce qu'il a produit. */
  { icon: BarChart3,       label: 'Analytique', path: '/dashboard/analytics' },
  /* Vers la PAGE, pas vers un panneau (demande utilisateur): on arrive sur le
     hub, donc sur le chat, qui est ce qu'on vient faire ici neuf fois sur dix.
     La machinerie de fragment reste en place côté page: un lien peut viser
     `#identite` pour ouvrir un panneau directement, mais la barre ne le fait
     plus. */
  { icon: Bot,             label: 'IA',     path: '/dashboard/receptionist' },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':              'Vue d\'ensemble',
  '/dashboard/calls':        'Appels',
  '/dashboard/leads':        'Leads et contacts',
  '/dashboard/analytics':    'Analytique',
  '/dashboard/receptionist': 'Réceptionniste IA',
  '/dashboard/crm/:id':        'Contact',
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
