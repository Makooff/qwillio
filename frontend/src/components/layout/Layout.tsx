import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Phone, Zap, Target, Brain,
  CreditCard, Settings, LogOut, ChevronLeft, ChevronRight,
  Search, RefreshCw, X, Crosshair, ExternalLink, TrendingUp,
} from 'lucide-react';
import QwillioLogo from '../QwillioLogo';
import CommandPalette from '../ui/CommandPalette';

const NAV_SECTIONS = [
  {
    label: '',
    items: [
      { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
      { path: '/admin/prospects', icon: Target, label: 'Prospects' },
      { path: '/admin/calls', icon: Phone, label: 'Appels' },
      { path: '/admin/leads', icon: Zap, label: 'Leads' },
      { path: '/admin/clients', icon: Users, label: 'Clients' },
      { path: '/admin/prospecting', icon: Crosshair, label: 'Prospection' },
      { path: '/admin/ai-learning', icon: Brain, label: 'IA' },
      { path: '/admin/billing', icon: CreditCard, label: 'Facturation' },
      { path: '/admin/settings', icon: Settings, label: 'Paramètres' },
    ],
  },
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
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const searchRef = useRef<HTMLInputElement>(null);

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Admin';

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

  // Keyboard nav shortcuts
  useEffect(() => {
    let lastKey = '';
    const handler = (e: KeyboardEvent) => {
      if (searchOpen || cmdOpen) return;
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
  }, [navigate, searchOpen, cmdOpen]);

  const handleRefresh = async () => {
    setRefreshing(true);
    window.dispatchEvent(new CustomEvent('admin-refresh'));
    setTimeout(() => setRefreshing(false), 1000);
  };

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'AD';

  const SidebarLink = ({ item, exact }: { item: (typeof NAV_SECTIONS[0]['items'][0]); exact?: boolean }) => {
    const active = isActive(item.path, exact);
    return (
      <Link
        to={item.path}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? item.label : undefined}
        className={`relative flex items-center gap-3 rounded-xl transition-all duration-150 group
          ${collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5'}
          ${active
            ? 'bg-[#7B5CF0]/15 text-[#7B5CF0]'
            : 'text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.04]'
          }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#7B5CF0] rounded-r-full" />
        )}
        <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
        {collapsed && (
          <span className="absolute left-full ml-3 px-2 py-1 bg-[#1E1E2E] text-[#F8F8FF] text-xs rounded-lg
            opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 border border-white/[0.08] shadow-xl">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full min-h-0">
      {/* Logo */}
      <div className={`flex items-center gap-3 mb-6 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'px-1'}`}>
        <QwillioLogo size={32} />
        {!collapsed && (
          <span className="text-base font-bold text-[#F8F8FF] tracking-tight">Qwillio <span className="text-[#7B5CF0]">admin</span></span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide min-h-0 pb-2">
        <div className="space-y-0.5">
          {NAV_SECTIONS[0].items.map((item) => (
            <SidebarLink key={item.path} item={item} exact={'exact' in item ? (item as any).exact : undefined} />
          ))}
        </div>
      </nav>

      {/* Bottom — user + logout (fixed, non scrollable) */}
      <div className="flex-shrink-0 space-y-1 mt-3 pt-3 border-t border-white/[0.06]">
        {/* User */}
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full bg-[#7B5CF0]/30 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-[#7B5CF0]">{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[#F8F8FF] truncate">{user?.name ?? 'Admin'}</p>
              <p className="text-[10px] text-[#8B8BA7] truncate">{user?.email}</p>
            </div>
          )}
        </div>

        <button
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[#8B8BA7] hover:text-red-400 hover:bg-red-500/[0.08] transition-all text-sm
            ${collapsed ? 'justify-center' : ''}`}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#0A0A0F] text-[#F8F8FF]">

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 flex-shrink-0
          bg-[#0D0D15] border-r border-white/[0.06] transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[64px] px-2 py-5' : 'w-[220px] px-4 py-5'}`}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full bg-[#1E1E2E] border border-white/[0.08]
            flex items-center justify-center text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-[#7B5CF0]/20 transition-all shadow-lg"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-[240px] bg-[#0D0D15] border-r border-white/[0.06] px-4 py-5"
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 text-[#8B8BA7] hover:text-[#F8F8FF]"
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TopBar */}
        <header className="sticky top-0 z-30 h-14 flex items-center gap-4 px-4 md:px-6
          bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-white/[0.06]">

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-[#8B8BA7] hover:text-[#F8F8FF]"
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>

          {/* Page title */}
          <div className="hidden md:block">
            <h1 className="text-sm font-semibold text-[#F8F8FF]">{pageTitle}</h1>
          </div>

          {/* Search */}
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-2 flex-1 max-w-xs mx-auto md:mx-0 md:ml-4
              px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.06]
              text-[#8B8BA7] text-sm hover:bg-white/[0.08] hover:border-[#7B5CF0]/30 transition-all"
          >
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="hidden sm:block flex-1 text-left">Search...</span>
            <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] bg-white/[0.06] px-1.5 py-0.5 rounded-md border border-white/[0.08]">
              ⌘K
            </kbd>
          </button>

          <div className="flex items-center gap-2 ml-auto">
            {/* Refresh */}
            <button
              onClick={handleRefresh}
              className="p-2 rounded-xl text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.06] transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* View site */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.06] transition-all"
              title="View site"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-[#7B5CF0]/30 flex items-center justify-center">
              <span className="text-xs font-bold text-[#7B5CF0]">{initials}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Mobile bottom nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden items-center justify-around bg-[#12121F] border-t border-white/10 py-2 px-1 safe-area-bottom">
        {[
          { icon: LayoutDashboard, label: 'Home', path: '/admin' },
          { icon: Users, label: 'Clients', path: '/admin/clients' },
          { icon: Phone, label: 'Calls', path: '/admin/calls' },
          { icon: TrendingUp, label: 'Prospects', path: '/admin/prospects' },
          { icon: Settings, label: 'Settings', path: '/admin/settings' },
        ].map(item => {
          const Icon = item.icon;
          const active = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors ${active ? 'text-[#7B5CF0]' : 'text-[#8B8BA7]'}`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
