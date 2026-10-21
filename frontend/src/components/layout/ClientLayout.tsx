import {
  LayoutDashboard, Phone, Users, BarChart3, CreditCard,
  Bot, UserCircle, HelpCircle, Target, Activity, Link2, Calendar, Settings,
} from '../icons';
import AiStatusPill from '../AiStatusPill';
import DashboardShell, { NavItem } from './DashboardShell';
import { useAuthStore } from '../../stores/authStore';
import { planAllows, type PlanCapability } from '../../lib/planCapabilities';

/* Une entrée peut appartenir à un forfait. Absente d'un menu, elle reste
   défendue par le serveur: le filtrage ci-dessous évite d'offrir une porte qui
   répondra 403, il ne remplace pas la serrure. */
type PlanNavItem = NavItem & { capability?: PlanCapability };

const PRIMARY_NAV: PlanNavItem[] = [
  { path: '/dashboard',              icon: LayoutDashboard, label: "Vue d'ensemble", exact: true },
  { path: '/dashboard/calls',        icon: Phone,           label: 'Appels' },
  { path: '/dashboard/leads',        icon: Users,           label: 'Leads' },
  /* Les rendez-vous pris par l'agent, et le seul endroit où en annuler un
     (13/09/2026) : c'est la réservation en base que l'agent lit, pas
     l'agenda Google. */
  { path: '/dashboard/bookings',     icon: Calendar,        label: 'Rendez-vous' },
  { path: '/dashboard/analytics',    icon: BarChart3,       label: 'Analytique', capability: 'advancedAnalytics' },
  /* « Contacts » a disparu du menu: les leads et les contacts sont les mêmes
     personnes, puisqu'un contact naît de l'appel qui a produit le lead. Deux
     entrées pour une réalité, avec deux vocabulaires d'état, faisaient croire
     à deux répertoires. La fiche de contact reste, comme détail d'une ligne. */
  { path: '/dashboard/receptionist', icon: Bot,             label: 'Réceptionniste IA' },
  /* Pipeline et Activité étaient ROUTÉS mais sans aucun lien: on ne pouvait y
     arriver qu'en tapant l'adresse à la main. Deux écrans entretenus que
     personne ne pouvait voir.
     Ils ont désormais de quoi s'afficher: chaque appel crée un contact et
     l'activité qui va avec. Le pipeline, lui, se remplit à la main, ce qui est
     le propre d'un pipeline: c'est le client qui décide qu'une affaire existe. */
  { path: '/dashboard/crm/deals',      icon: Target,          label: 'Pipeline', capability: 'crm' },
  { path: '/dashboard/crm/activities', icon: Activity,        label: 'Activité', capability: 'crm' },
];

const SETTINGS_SUB: NavItem[] = [
  { path: '/dashboard/account',  icon: UserCircle, label: 'Compte' },
  { path: '/dashboard/billing',  icon: CreditCard, label: 'Facturation' },
  { path: '/dashboard/integrations', icon: Link2, label: 'Intégrations' },
  { path: '/dashboard/support',  icon: HelpCircle, label: 'Support' },
];

const MOBILE_NAV: PlanNavItem[] = [
  /* L'accueil revient, et il revient à GAUCHE (demande utilisateur): c'est la
     page d'arrivée, et un retour à la maison se cherche à gauche. `exact` est
     indispensable: sans lui, `/dashboard` resterait actif sur toutes les pages
     du portail. */
  { icon: LayoutDashboard, label: 'Accueil', path: '/dashboard', exact: true },
  { icon: Phone,           label: 'Appels',  path: '/dashboard/calls' },
  /* Les rendez-vous sont ce que le client vient CONSULTER le plus souvent
     depuis son téléphone (il vérifie son agenda du lendemain). Ils prennent la
     place des leads et de la vue d'ensemble: ces deux pages restent dans le
     tiroir, et le tiroir est à un geste.
     L'IA reste au troisième rang: c'est la seule entrée où l'on va pour AGIR
     sur l'agent, pas pour regarder ce qu'il a produit. */
  { icon: Calendar,        label: 'Rendez-vous', path: '/dashboard/bookings' },
  /* Vers la PAGE, pas vers un panneau (demande utilisateur): on arrive sur le
     hub, donc sur le chat, qui est ce qu'on vient faire ici neuf fois sur dix.
     La machinerie de fragment reste en place côté page: un lien peut viser
     `#identite` pour ouvrir un panneau directement, mais la barre ne le fait
     plus. */
  { icon: Bot,             label: 'IA',      path: '/dashboard/receptionist' },
  /* « Paramètres » (demande utilisateur) : la barre du bas n'en portait plus,
     et le tiroir le laissait sous la ligne de flottaison sur un téléphone
     court. Le compte, la facturation et le support doivent être à un geste.
     `match` fait suivre l'onglet actif sur TOUTES les pages de réglages, pas
     seulement sur celle vers laquelle il pointe. */
  { icon: Settings,        label: 'Paramètres', path: '/dashboard/account',
    match: ['/dashboard/billing', '/dashboard/integrations', '/dashboard/support'] },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':              'Vue d\'ensemble',
  '/dashboard/calls':        'Appels',
  '/dashboard/leads':        'Leads et contacts',
  '/dashboard/bookings':     'Rendez-vous',
  '/dashboard/analytics':    'Analytique',
  '/dashboard/receptionist': 'Réceptionniste IA',
  '/dashboard/crm/:id':        'Contact',
  '/dashboard/crm/deals':      'Pipeline',
  '/dashboard/crm/activities': 'Activité',
  '/dashboard/account':      'Compte',
  '/dashboard/billing':      'Facturation',
  '/dashboard/integrations': 'Intégrations',
  '/dashboard/support':      'Support',
};

export default function ClientLayout() {
  const { user } = useAuthStore();
  const plan = (user as unknown as Record<string, unknown> | undefined)?.planType;

  /* Le forfait n'est pas encore chargé au premier rendu: on affiche alors les
     entrées ouvertes à tous, et les autres apparaissent dès qu'il arrive. Le
     contraire — tout montrer puis retirer — ferait clignoter le menu et
     laisserait cliquer sur une porte fermée. */
  const visible = (items: PlanNavItem[]) =>
    items.filter(item => !item.capability || planAllows(typeof plan === 'string' ? plan : null, item.capability));

  return (
    <DashboardShell
      scope="client"
      primaryNav={visible(PRIMARY_NAV)}
      settingsSub={SETTINGS_SUB}
      pageTitles={PAGE_TITLES}
      mobileNav={visible(MOBILE_NAV)}
      userFallbackName="Client"
      userFallbackInitials="CL"
      topBarExtras={<AiStatusPill />}
    />
  );
}
