import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Phone, Zap, Target, Brain,
  CreditCard, Settings, LogOut, ChevronLeft, ChevronRight, ChevronDown,
  Search, RefreshCw, X, Crosshair, ExternalLink, TrendingUp,
  ScrollText, Activity, DollarSign, RotateCcw, Send, PhoneMissed,
} from 'lucide-react';
import QwillioLogo from '../QwillioLogo';
import CommandPalette from '../ui/CommandPalette';
import { t, glass } from '../../styles/admin-theme';

const PRIMARY_NAV = [
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

const SETTINGS_SUB = [
  { path: '/admin/settings',          icon: Settings,    label: 'Général' },
  { path: '/admin/system',            icon: Activity,    label: 'Système' },
  { path: '/admin/monitor',           icon: TrendingUp,  label: 'Moniteur live' },
  { path: '/admin/phone-validation',  icon: PhoneMissed, label: 'Validation tél.' },
  { path: '/admin/campaigns',         icon: Send,        label: 'Campagnes' },
  { path: '/admin/followups',         icon: RotateCcw,   label: 'Suivis' },
  { path: '/admin/costs',             icon: DollarSign,  label: 'Coûts' },
  { path: '/admin/retention',         icon: Users,       label: 'Rétention' },
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

  const [settingsOpen, setSettingsOpen] = useState(
    SETTINGS_SUB.some(i => location.pathname.startsWith(i.path))
  );
  const settingsActive = SETTINGS_SUB.some(i => isActive(i.path));

  const SidebarLink = ({ item, exact }: { item: { path: string; label: string; icon: any }; exact?: boolean }) => {
    const active = isActive(item.path, exact);
    return (
      <Link
        to={item.path}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? item.label : undefined}
        className={`relative flex items-center gap-3 rounded-xl transition-all duration-150 group
          ${collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5'}
          ${active ? 'text-[#7B5CF0]' : 'hover:bg-white/[0.04]'}`}
        style={{ color: active ? t.brand : t.textSec }}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: t.brand }} />
        )}
        <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
        {collapsed && (
          <span
            className="absolute left-full ml-3 px-2 py-1 text-xs rounded-lg
              opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl backdrop-blur-xl"
            style={{ background: t.panelSolid, color: t.text, border: `1px solid ${t.borderHi}` }}
          >
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  const SettingsSubLink = ({ item }: { item: { path: string; label: string; icon: any } }) => {
    const active = isActive(item.path);
    return (
      <Link
        to={item.path}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 py-2 rounded-xl transition-colors pl-9 pr-3
          ${active ? '' : 'hover:bg-white/[0.04]'}`}
        style={{ color: active ? t.brand : t.textSec }}
      >
        <item.icon className="w-4 h-4 flex-shrink-0" />
        <span className="text-[13px] font-medium">{item.label}</span>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full min-h-0">
      {/* Logo */}
      <div className={`flex items-center gap-3 mb-6 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'px-1'}`}>
        <QwillioLogo size={32} />
        {!collapsed && (
          <span className="text-base font-bold tracking-tight" style={{ color: t.text }}>Qwillio <span style={{ color: t.brand }}>admin</span></span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide min-h-0 pb-2">
        <div className="space-y-0.5">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink key={item.path} item={item} exact={item.exact} />
          ))}

          {/* Paramètres — expandable with organized sub-items */}
          <button
            onClick={() => { if (!collapsed) setSettingsOpen(v => !v); }}
            title={collapsed ? 'Paramètres' : undefined}
            className={`w-full relative flex items-center gap-3 rounded-xl transition-all duration-150 group
              ${collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5'}
              ${settingsActive ? '' : 'hover:bg-white/[0.04]'}`}
            style={{ color: settingsActive ? t.brand : t.textSec }}
          >
            {settingsActive && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: t.brand }} />
            )}
            <Settings className="w-[18px] h-[18px] flex-shrink-0" />
            {!collapsed && <span className="text-sm font-medium flex-1 text-left">Paramètres</span>}
            {!collapsed && (
              <ChevronDown
                className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${settingsOpen ? 'rotate-0' : '-rotate-90'}`}
                style={{ color: t.textTer }}
              />
            )}
            {collapsed && (
              <span
                className="absolute left-full ml-3 px-2 py-1 text-xs rounded-lg
                  opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl backdrop-blur-xl"
                style={{ background: t.panelSolid, color: t.text, border: `1px solid ${t.borderHi}` }}
              >
                Paramètres
              </span>
            )}
          </button>

          {!collapsed && settingsOpen && (
            <div className="space-y-0.5 py-0.5">
              {SETTINGS_SUB.map(item => <SettingsSubLink key={item.path} item={item} />)}
            </div>
          )}
        </div>
      </nav>

      {/* Bottom — user + logout (fixed, non scrollable) */}
      <div className="flex-shrink-0 space-y-1 mt-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
        {/* User */}
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${t.brand}30` }}>
            <span className="text-[10px] font-bold" style={{ color: t.brand }}>{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: t.text }}>{user?.name ?? 'Admin'}</p>
              <p className="text-[10px] truncate" style={{ color: t.textSec }}>{user?.email}</p>
            </div>
          )}
        </div>

        <button
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:text-red-400 hover:bg-red-500/[0.08] transition-all text-sm
            ${collapsed ? 'justify-center' : ''}`}
          style={{ color: t.textSec }}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && 'Sign out'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: t.bg, color: t.text }}>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 flex-shrink-0
          backdrop-blur-xl transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[64px] px-2 py-5' : 'w-[220px] px-4 py-5'}`}
        style={{ background: t.panel, borderRight: `1px solid ${t.border}` }}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full
            flex items-center justify-center hover:bg-white/[0.08] transition-all shadow-lg"
          style={{ background: t.panelSolid, border: `1px solid ${t.borderHi}`, color: t.textSec }}
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
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-[240px] px-4 pt-5 pb-28"
              style={{ background: t.panelSolid, borderRight: `1px solid ${t.border}` }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4"
                style={{ color: t.textSec }}
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
        <header
          className="sticky top-0 z-30 h-14 flex items-center gap-4 px-4 md:px-6 backdrop-blur-xl"
          style={{ background: `${t.bg}CC`, borderBottom: `1px solid ${t.border}` }}
        >

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden"
            style={{ color: t.textSec }}
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>

          {/* Page title */}
          <div className="hidden md:block">
            <h1 className="text-sm font-semibold" style={{ color: t.text }}>{pageTitle}</h1>
          </div>

          {/* Search */}
          <button
            onClick={() => setCmdOpen(true)}
            className="flex items-center gap-2 flex-1 max-w-xs mx-auto md:mx-0 md:ml-4
              px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.06]
              text-sm hover:bg-white/[0.08] transition-all"
            style={{ color: t.textSec }}
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
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-all"
              style={{ color: t.textSec }}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {/* View site */}
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-all"
              style={{ color: t.textSec }}
              title="View site"
            >
              <ExternalLink className="w-4 h-4" />
            </a>

            {/* Avatar */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${t.brand}30` }}>
              <span className="text-xs font-bold" style={{ color: t.brand }}>{initials}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-32 md:pb-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />

      {/* Mobile bottom nav — floating pill */}
      <div className="fixed bottom-5 left-0 right-0 z-50 flex md:hidden flex-col items-center gap-2 px-4">
        {/* Pill — bg div separate so bubble can overflow without clip */}
        <div className="relative w-full flex items-center justify-around py-3 px-2">
          {/* Ultra-transparent frosted background */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'rgba(255,255,255,0.04)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          />

          {[
            { icon: LayoutDashboard, label: 'Home',      path: '/admin',            exact: true },
            { icon: Users,           label: 'Clients',   path: '/admin/clients' },
            { icon: Phone,           label: 'Calls',     path: '/admin/calls' },
            { icon: TrendingUp,      label: 'Prospects', path: '/admin/prospects' },
            { icon: ScrollText,      label: 'Logs',      path: '/admin/logs' },
          ].map(item => {
            const Icon = item.icon;
            const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className="relative z-10 flex flex-col items-center gap-0.5 w-[18%] py-0.5"
                style={{ color: active ? '#fff' : 'rgba(255,255,255,0.38)' }}
              >
                {/* Animated bubble — layoutId makes it slide between items with spring morph */}
                {active && (
                  <motion.span
                    layoutId="admin-nav-bubble"
                    className="absolute rounded-full"
                    style={{
                      width: 68, height: 68,
                      top: '50%', left: '50%',
                      x: '-50%', y: '-50%',
                      background: 'rgba(123,92,240,0.30)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1.5px solid rgba(123,92,240,0.50)',
                      boxShadow: '0 0 28px rgba(123,92,240,0.30), inset 0 1px 0 rgba(255,255,255,0.14)',
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 380,
                      damping: 26,
                      mass: 0.8,
                    }}
                  />
                )}
                <Icon className="relative z-10 w-[22px] h-[22px]" />
                <span className="relative z-10 text-[9px] font-medium mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
