import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import QwillioLogo from '../QwillioLogo';
import AiStatusPill from '../AiStatusPill';
import { t } from '../../styles/admin-theme';
import {
  LayoutDashboard, Phone, Users, BarChart3, CreditCard,
  Bot, UserCircle, HelpCircle, LogOut, Menu, X, Settings,
  ChevronLeft, ChevronRight, ChevronDown,
} from 'lucide-react';

const PRIMARY_NAV = [
  { path: '/dashboard',           icon: LayoutDashboard, label: "Vue d'ensemble", exact: true },
  { path: '/dashboard/calls',     icon: Phone,           label: 'Appels' },
  { path: '/dashboard/leads',     icon: Users,           label: 'Leads' },
  { path: '/dashboard/analytics', icon: BarChart3,       label: 'Analytique' },
];

const SETTINGS_NAV = [
  { path: '/dashboard/account',      icon: UserCircle,  label: 'Compte' },
  { path: '/dashboard/receptionist', icon: Bot,         label: 'Réceptionniste IA' },
  { path: '/dashboard/billing',      icon: CreditCard,  label: 'Facturation' },
  { path: '/dashboard/support',      icon: HelpCircle,  label: 'Support' },
];

export default function ClientLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    SETTINGS_NAV.some(i => location.pathname.startsWith(i.path))
  );

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const initials =
    user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'CL';

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

  const SubNavLink = ({ item }: { item: { path: string; label: string; icon: any } }) => {
    const active = isActive(item.path);
    return (
      <Link
        to={item.path}
        onClick={() => setMobileOpen(false)}
        className={`flex items-center gap-3 py-2 rounded-xl transition-colors
          ${collapsed ? 'px-0 justify-center' : 'pl-9 pr-3'}
          ${active ? '' : 'hover:bg-white/[0.04]'}`}
        style={{ color: active ? t.brand : t.textSec }}
      >
        <item.icon className="w-4 h-4 flex-shrink-0" />
        {!collapsed && <span className="text-[13px] font-medium">{item.label}</span>}
      </Link>
    );
  };

  const SidebarContent = () => {
    const settingsIsActive = SETTINGS_NAV.some(i => isActive(i.path));
    return (
      <div className="flex flex-col h-full min-h-0">
        {/* Logo — mirrors admin */}
        <div className={`flex items-center gap-3 mb-6 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'px-1'}`}>
          <QwillioLogo size={32} />
          {!collapsed && (
            <span className="text-base font-bold tracking-tight" style={{ color: t.text }}>
              Qwillio
            </span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide min-h-0 pb-2">
          <div className="space-y-0.5">
            {PRIMARY_NAV.map(item => <SidebarLink key={item.path} item={item} exact={item.exact} />)}

            {/* Settings expandable */}
            <button
              onClick={() => {
                if (collapsed) return;
                setSettingsOpen(v => !v);
              }}
              title={collapsed ? 'Paramètres' : undefined}
              className={`w-full relative flex items-center gap-3 rounded-xl transition-all duration-150 group
                ${collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5'}
                ${settingsIsActive ? '' : 'hover:bg-white/[0.04]'}`}
              style={{ color: settingsIsActive ? t.brand : t.textSec }}
            >
              {settingsIsActive && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: t.brand }} />
              )}
              <Settings className="w-[18px] h-[18px] flex-shrink-0" />
              {!collapsed && <span className="text-sm font-medium flex-1 text-left">Paramètres</span>}
              {!collapsed && (
                <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${settingsOpen ? 'rotate-0' : '-rotate-90'}`} style={{ color: t.textTer }} />
              )}
              {collapsed && (
                <span
                  className="absolute left-full ml-3 px-2 py-1 text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl backdrop-blur-xl"
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
                    {SETTINGS_NAV.map(item => <SubNavLink key={item.path} item={item} />)}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </nav>

        {/* Bottom — user + sign out (mirrors admin) */}
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
  };

  return (
    <div className="min-h-screen flex" style={{ background: t.bg, color: t.text }}>

      {/* Desktop Sidebar — mirrors admin exactly */}
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 flex-shrink-0
          backdrop-blur-xl transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[64px] px-2 py-5' : 'w-[220px] px-4 py-5'}`}
        style={{ background: t.panel, borderRight: `1px solid ${t.border}` }}
      >
        <SidebarContent />

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
          style={{ background: t.panelSolid, border: `1px solid ${t.borderHi}`, color: t.textSec }}
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </aside>

      {/* Mobile Sidebar overlay */}
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
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-[240px] px-4 py-5 backdrop-blur-xl"
              style={{ background: t.panelSolid, borderRight: `1px solid ${t.border}` }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4 transition-colors hover:text-white"
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
        {/* Top bar — mirrors admin (56 px, translucent blur) */}
        <header
          className="sticky top-0 z-30 h-14 flex items-center gap-4 px-4 md:px-6 backdrop-blur-xl"
          style={{ background: 'rgba(9,9,11,0.72)', borderBottom: `1px solid ${t.border}` }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1 transition-colors hover:text-white"
            style={{ color: t.textSec }}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2">
            <QwillioLogo size={24} />
            <span className="text-sm font-bold tracking-tight" style={{ color: t.text }}>Qwillio</span>
          </div>

          {/* Right: AI status pill + profile bubble */}
          <div className="ml-auto flex items-center gap-3">
            <AiStatusPill />
            <Link
              to="/dashboard/account"
              title="Compte"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ background: `${t.brand}30` }}
            >
              <span className="text-xs font-bold" style={{ color: t.brand }}>{initials}</span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-32 md:pb-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
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
          {[
            { icon: LayoutDashboard, label: 'Home',   path: '/dashboard',           exact: true },
            { icon: Phone,           label: 'Appels', path: '/dashboard/calls' },
            { icon: Users,           label: 'Leads',  path: '/dashboard/leads' },
            { icon: BarChart3,       label: 'Stats',  path: '/dashboard/analytics' },
            { icon: Settings,        label: 'Params', path: '/dashboard/account' },
          ].map(item => {
            const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className="relative z-10 flex flex-col items-center gap-0.5 w-[18%] py-0.5"
                style={{ color: active ? t.text : t.textTer }}
              >
                {active && (
                  <motion.span
                    layoutId="client-nav-bubble"
                    className="absolute rounded-full"
                    style={{
                      width: 60, height: 60,
                      top: '50%', left: '50%',
                      x: '-50%', y: '-50%',
                      background: `${t.brand}26`,
                      border: `1px solid ${t.brand}55`,
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.8 }}
                  />
                )}
                <item.icon className="relative z-10 w-[21px] h-[21px]" />
                <span className="relative z-10 text-[9px] font-medium mt-0.5 tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
