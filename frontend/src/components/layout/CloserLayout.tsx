import { LayoutDashboard, Users, Bell, UserCircle } from 'lucide-react';
import DashboardShell, { NavItem } from './DashboardShell';

const PRIMARY_NAV: NavItem[] = [
  { path: '/closer',            icon: LayoutDashboard, label: "Vue d'ensemble", exact: true },
  { path: '/closer/prospects',  icon: Users,           label: 'Prospects' },
  { path: '/closer/followups',  icon: Bell,            label: 'Follow-ups' },
  { path: '/closer/account',    icon: UserCircle,      label: 'Compte' },
];

const MOBILE_NAV: NavItem[] = [
  { path: '/closer',            icon: LayoutDashboard, label: "Home",      exact: true },
  { path: '/closer/prospects',  icon: Users,           label: 'Prospects' },
  { path: '/closer/followups',  icon: Bell,            label: 'Suivis' },
  { path: '/closer/account',    icon: UserCircle,      label: 'Compte' },
];

const PAGE_TITLES: Record<string, string> = {
  '/closer':            "Vue d'ensemble",
  '/closer/prospects':  'Prospects',
  '/closer/followups':  'Follow-ups',
  '/closer/account':    'Compte',
};

export default function CloserLayout() {
  return (
    <DashboardShell
      scope="closer"
      brandSuffix="closeuse"
      primaryNav={PRIMARY_NAV}
      pageTitles={PAGE_TITLES}
      mobileNav={MOBILE_NAV}
      userFallbackName="Closeuse"
      userFallbackInitials="CL"
    />
  );
}
