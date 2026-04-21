import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import QwillioLogo from '../QwillioLogo';
import AiStatusPill from '../AiStatusPill';
import {
  LayoutDashboard, Phone, Users, BarChart3, CreditCard,
  Bot, UserCircle, HelpCircle, LogOut, Menu, X, Settings,
  ChevronDown, ChevronRight,
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

// Apple-minimal palette — muted neutrals with one restrained accent.
const C = {
  bg:       '#0B0B0D',
  panel:    '#101014',
  border:   'rgba(255,255,255,0.06)',
  borderHi: 'rgba(255,255,255,0.12)',
  text:     '#F2F2F2',
  textSec:  '#9A9AA5',
  textTer:  '#6B6B75',
  accent:   '#E5E5EA',       // active = warm white, not neon purple
  accentBg: 'rgba(255,255,255,0.06)',
};

export default function ClientLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
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

  const NavLink = ({ item, exact }: { item: { path: string; label: string; icon: any }; exact?: boolean }) => {
    const active = isActive(item.path, exact);
    return (
      <Link
        to={item.path}
        onClick={() => setMobileOpen(false)}
        className="relative flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] font-medium transition-colors"
        style={{
          color: active ? C.text : C.textSec,
          background: active ? C.accentBg : 'transparent',
        }}
      >
        <item.icon className="w-[17px] h-[17px] flex-shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  };

  const SubNavLink = ({ item }: { item: { path: string; label: string; icon: any } }) => {
    const active = isActive(item.path);
    return (
      <Link
        to={item.path}
        onClick={() => setMobileOpen(false)}
        className="flex items-center gap-3 pl-9 pr-3 h-8 rounded-lg text-[12.5px] transition-colors"
        style={{
          color: active ? C.text : C.textSec,
          background: active ? C.accentBg : 'transparent',
        }}
      >
        <item.icon className="w-[14px] h-[14px] flex-shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  };

  const SidebarContent = () => {
    const settingsIsActive = SETTINGS_NAV.some(i => isActive(i.path));
    return (
      <div className="flex flex-col h-full min-h-0">
        {/* Logo — compact, discreet */}
        <div className="flex items-center gap-2.5 mb-8 px-1 flex-shrink-0">
          <QwillioLogo size={22} />
          <span className="text-[13px] font-semibold tracking-tight" style={{ color: C.text }}>Qwillio</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto space-y-0.5 pb-4">
          {PRIMARY_NAV.map(item => <NavLink key={item.path} item={item} exact={item.exact} />)}

          {/* Settings expandable */}
          <button
            onClick={() => setSettingsOpen(v => !v)}
            className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] font-medium transition-colors"
            style={{
              color: settingsIsActive ? C.text : C.textSec,
              background: settingsIsActive ? C.accentBg : 'transparent',
            }}
          >
            <Settings className="w-[17px] h-[17px] flex-shrink-0" />
            <span className="flex-1 text-left">Paramètres</span>
            {settingsOpen
              ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
              : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-50" />
            }
          </button>

          <AnimatePresence initial={false}>
            {settingsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="space-y-0.5 py-1">
                  {SETTINGS_NAV.map(item => <SubNavLink key={item.path} item={item} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </nav>

        {/* Bottom — user + sign out (mirrors admin layout) */}
        <div className="flex-shrink-0 space-y-0.5 mt-3 pt-3" style={{ borderTop: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                 style={{ background: 'rgba(255,255,255,0.08)' }}>
              <span className="text-[10px] font-semibold" style={{ color: C.text }}>{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-medium truncate" style={{ color: C.text }}>{user?.name ?? 'Client'}</p>
              <p className="text-[10.5px] truncate" style={{ color: C.textTer }}>{user?.email}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center gap-3 px-3 h-9 rounded-lg text-[13px] transition-colors hover:text-red-400"
            style={{ color: C.textSec }}
          >
            <LogOut className="w-[17px] h-[17px] flex-shrink-0" />
            Sign out
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex" style={{ background: C.bg, color: C.text }}>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col h-screen sticky top-0 w-[220px] flex-shrink-0 px-3 py-4"
             style={{ background: C.panel, borderRight: `1px solid ${C.border}` }}>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
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
              className="md:hidden fixed left-0 top-0 bottom-0 z-50 w-[240px] px-3 py-4"
              style={{ background: C.panel, borderRight: `1px solid ${C.border}` }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-3 opacity-60 hover:opacity-100"
                style={{ color: C.text }}
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
        {/* Top bar — minimal, translucent */}
        <header className="sticky top-0 z-30 h-12 flex items-center gap-3 px-4 md:px-6"
                style={{ background: 'rgba(11,11,13,0.72)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${C.border}` }}>
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-1 opacity-60 hover:opacity-100"
            style={{ color: C.text }}
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2">
            <QwillioLogo size={20} />
            <span className="text-[12.5px] font-semibold tracking-tight" style={{ color: C.text }}>Qwillio</span>
          </div>

          {/* Right: AI pill + avatar (logout moved to sidebar settings) */}
          <div className="ml-auto flex items-center gap-2.5">
            <AiStatusPill />
            <Link
              to="/dashboard/account"
              title="Compte"
              className="w-8 h-8 rounded-full flex items-center justify-center transition-opacity hover:opacity-80"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <span className="text-[11px] font-semibold" style={{ color: C.text }}>{initials}</span>
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-32 md:pb-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav — subtle pill */}
      <div className="fixed bottom-4 left-0 right-0 z-50 flex md:hidden flex-col items-center gap-2 px-4">
        <div className="relative w-full flex items-center justify-around py-2.5 px-2">
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'rgba(16,16,20,0.78)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              border: '1px solid rgba(255,255,255,0.08)',
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
                style={{ color: active ? C.text : C.textTer }}
              >
                {active && (
                  <motion.span
                    layoutId="client-nav-bubble"
                    className="absolute rounded-full"
                    style={{
                      width: 54, height: 54,
                      top: '50%', left: '50%',
                      x: '-50%', y: '-50%',
                      background: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.10)',
                    }}
                    transition={{ type: 'spring', stiffness: 380, damping: 26, mass: 0.8 }}
                  />
                )}
                <item.icon className="relative z-10 w-[20px] h-[20px]" />
                <span className="relative z-10 text-[9px] font-medium mt-0.5 tracking-tight">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
