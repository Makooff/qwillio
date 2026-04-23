import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import QwillioLogo from '../QwillioLogo';
import AiStatusPill from '../AiStatusPill';
import { t } from '../../styles/admin-theme';
import {
  LayoutDashboard, Phone, Users, BarChart3, CreditCard,
  Bot, UserCircle, HelpCircle, LogOut, X,
  ChevronLeft, ChevronRight, ChevronDown, Settings, RefreshCw,
} from 'lucide-react';

const PRIMARY_NAV = [
  { path: '/dashboard',              icon: LayoutDashboard, label: "Vue d'ensemble", exact: true },
  { path: '/dashboard/calls',        icon: Phone,           label: 'Appels' },
  { path: '/dashboard/leads',        icon: Users,           label: 'Leads' },
  { path: '/dashboard/analytics',    icon: BarChart3,       label: 'Analytique' },
  { path: '/dashboard/receptionist', icon: Bot,             label: 'Réceptionniste IA' },
];

const SETTINGS_SUB = [
  { path: '/dashboard/account',  icon: UserCircle, label: 'Compte' },
  { path: '/dashboard/billing',  icon: CreditCard, label: 'Facturation' },
  { path: '/dashboard/support',  icon: HelpCircle, label: 'Support' },
];

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':              'Vue d\'ensemble',
  '/dashboard/calls':        'Appels',
  '/dashboard/leads':        'Leads',
  '/dashboard/analytics':    'Analytique',
  '/dashboard/receptionist': 'Réceptionniste IA',
  '/dashboard/account':      'Compte',
  '/dashboard/billing':      'Facturation',
  '/dashboard/support':      'Support',
};

export default function ClientLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    SETTINGS_SUB.some(i => location.pathname.startsWith(i.path))
  );
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Qwillio';
  const initials =
    user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'CL';
  const settingsActive = SETTINGS_SUB.some(i => isActive(i.path));

  const handleRefresh = () => {
    setRefreshing(true);
    window.location.reload();
  };

  const SidebarLink = ({ item, exact }: { item: { path: string; label: string; icon: any }; exact?: boolean }) => {
    const active = isActive(item.path, exact);
    return (
      <Link
        to={item.path}
        onClick={() => setMobileOpen(false)}
        title={collapsed ? item.label : undefined}
        className={`relative flex items-center gap-3 rounded-xl transition-all duration-150 group
          ${collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5'}
          ${active ? '' : 'hover:bg-white/[0.04]'}`}
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

  const SubLink = ({ item }: { item: { path: string; label: string; icon: any } }) => {
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
          <span className="text-base font-bold tracking-tight" style={{ color: t.text }}>Qwillio</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide min-h-0 pb-2">
        <div className="space-y-0.5">
          {PRIMARY_NAV.map(item => <SidebarLink key={item.path} item={item} exact={item.exact} />)}

          {/* Paramètres — expandable (tooltip only when collapsed) */}
          <button
            onClick={() => {
              if (collapsed) return;
              setSettingsOpen(v => !v);
            }}
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

          <AnimatePresence initial={false}>
            {!collapsed && settingsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="space-y-0.5 py-0.5">
                  {SETTINGS_SUB.map(item => <SubLink key={item.path} item={item} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>

      {/* Bottom — user + sign out (identical to admin) */}
      <div className="flex-shrink-0 space-y-1 mt-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${t.brand}30` }}>
            <span className="text-[10px] font-bold" style={{ color: t.brand }}>{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: t.text }}>{user?.name ?? 'Client'}</p>
              <p className="text-[10px] truncate" style={{ color: t.textSec }}>{user?.email}</p>
            </div>
          )}
        </div>

        <button
          onClick={logout}
          title={collapsed ? 'Sign out' : undefined}
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
        <header
          className="sticky top-0 z-30 h-14 flex items-center gap-4 px-4 md:px-6 backdrop-blur-xl"
          style={{ background: `${t.bg}CC`, borderBottom: `1px solid ${t.border}` }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden"
            style={{ color: t.textSec }}
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>

          <div className="hidden md:block">
            <h1 className="text-sm font-semibold" style={{ color: t.text }}>{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <AiStatusPill />

            <button
              onClick={handleRefresh}
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-all"
              style={{ color: t.textSec }}
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${t.brand}30` }}>
              <span className="text-xs font-bold" style={{ color: t.brand }}>{initials}</span>
            </div>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 p-4 md:p-6 pb-32 md:pb-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav pathname={location.pathname} />
    </div>
  );
}

const MOBILE_NAV = [
  { icon: LayoutDashboard, label: 'Home',   path: '/dashboard',           exact: true },
  { icon: Phone,           label: 'Appels', path: '/dashboard/calls' },
  { icon: Users,           label: 'Leads',  path: '/dashboard/leads' },
  { icon: Bot,             label: 'IA',     path: '/dashboard/receptionist' },
  { icon: Settings,        label: 'Params', path: '/dashboard/account' },
];

function MobileBottomNav({ pathname }: { pathname: string }) {
  const activeIdx = MOBILE_NAV.findIndex(item =>
    item.exact ? pathname === item.path : pathname.startsWith(item.path)
  );
  const itemPct = 100 / MOBILE_NAV.length;
  const showBubble = activeIdx >= 0;

  return (
    <div className="fixed bottom-5 left-0 right-0 z-50 flex md:hidden flex-col items-center gap-2 px-4">
      <div className="relative w-full flex items-center justify-around py-3 px-2">
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'rgba(17,17,19,0.78)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${t.border}`,
          }}
        />

        {showBubble && (
          <motion.span
            className="absolute rounded-full pointer-events-none"
            initial={false}
            animate={{ left: `${activeIdx * itemPct + itemPct / 2}%` }}
            transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.8 }}
            style={{
              width: 60, height: 60,
              top: '50%',
              x: '-50%', y: '-50%',
              background: `${t.brand}26`,
              border: `1px solid ${t.brand}55`,
            }}
          />
        )}

        {MOBILE_NAV.map((item, i) => {
          const active = i === activeIdx;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative z-10 flex flex-col items-center gap-0.5 w-[18%] py-0.5"
              style={{ color: active ? t.text : t.textTer }}
            >
              <item.icon className="relative z-10 w-[21px] h-[21px]" />
              <span className="relative z-10 text-[9px] font-medium mt-0.5 tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
