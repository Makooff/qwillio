import { useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import QwillioLogo from '../QwillioLogo';
import {
  LayoutDashboard, Phone, Users, BarChart3, CreditCard,
  Bot, UserCircle, HelpCircle, LogOut, Menu, X,
} from 'lucide-react';

const NAV = [
  { path: '/dashboard',             icon: LayoutDashboard, label: 'Vue d\'ensemble', exact: true },
  { path: '/dashboard/calls',       icon: Phone,            label: 'Appels' },
  { path: '/dashboard/leads',       icon: Users,            label: 'Leads' },
  { path: '/dashboard/analytics',   icon: BarChart3,        label: 'Analytique' },
  { path: '/dashboard/receptionist',icon: Bot,              label: 'Réceptionniste' },
  { path: '/dashboard/billing',     icon: CreditCard,       label: 'Facturation' },
  { path: '/dashboard/account',     icon: UserCircle,       label: 'Compte' },
  { path: '/dashboard/support',     icon: HelpCircle,       label: 'Support' },
];

export default function ClientLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string, exact?: boolean) => {
    if (exact) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) ?? 'CL';

  const NavLink = ({ item }: { item: typeof NAV[0] }) => {
    const active = isActive(item.path, item.exact);
    return (
      <Link
        to={item.path}
        onClick={() => setMobileOpen(false)}
        className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
          ${active
            ? 'bg-[#7B5CF0]/15 text-[#7B5CF0]'
            : 'text-[#8B8BA7] hover:text-[#F8F8FF] hover:bg-white/[0.04]'
          }`}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#7B5CF0] rounded-r-full" />
        )}
        <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
        <span>{item.label}</span>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full min-h-0">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8 px-1 flex-shrink-0">
        <QwillioLogo size={32} />
        <span className="text-base font-bold text-[#F8F8FF] tracking-tight">Qwillio</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto space-y-0.5 pb-4">
        {NAV.map(item => <NavLink key={item.path} item={item} />)}
      </nav>

      {/* User + logout */}
      <div className="flex-shrink-0 pt-3 border-t border-white/[0.06] space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-7 h-7 rounded-full bg-[#7B5CF0]/30 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-[#7B5CF0]">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#F8F8FF] truncate">{user?.name ?? 'Client'}</p>
            <p className="text-[10px] text-[#8B8BA7] truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[#8B8BA7] hover:text-red-400 hover:bg-red-500/[0.08] transition-all text-sm"
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          Déconnexion
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#0A0A0F] text-[#F8F8FF]">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col h-screen sticky top-0 w-[220px] flex-shrink-0 bg-[#0D0D15] border-r border-white/[0.06] px-4 py-5">
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
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 flex items-center gap-4 px-4 md:px-6 bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-white/[0.06]">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-[#8B8BA7] hover:text-[#F8F8FF] p-1"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Mobile logo */}
          <div className="md:hidden flex items-center gap-2">
            <QwillioLogo size={24} />
            <span className="text-sm font-bold text-[#F8F8FF]">Qwillio</span>
          </div>

          {/* Right: avatar */}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-xs font-medium text-[#F8F8FF]">{user?.name}</p>
              <p className="text-[10px] text-[#8B8BA7]">{user?.email}</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-[#7B5CF0]/30 flex items-center justify-center cursor-pointer" onClick={logout} title="Déconnexion">
              <span className="text-xs font-bold text-[#7B5CF0]">{initials}</span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 pb-32 md:pb-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav — floating pill */}
      <div className="fixed bottom-5 left-0 right-0 z-50 flex md:hidden flex-col items-center gap-2 px-4">
        {/* Sign out — above the pill */}
        <button
          onClick={logout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.2)' }}
        >
          <LogOut className="w-3 h-3" />
          Déconnexion
        </button>

        {/* Pill nav — background div is separate so items can overflow without clip */}
        <div className="relative w-full flex items-center justify-around px-1 py-3">
          {/* Background layer */}
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background: 'rgba(18,18,28,0.78)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.55)',
            }}
          />
          {[
            { icon: LayoutDashboard, label: 'Home',   path: '/dashboard',           exact: true },
            { icon: Phone,           label: 'Appels', path: '/dashboard/calls' },
            { icon: Users,           label: 'Leads',  path: '/dashboard/leads' },
            { icon: BarChart3,       label: 'Stats',  path: '/dashboard/analytics' },
            { icon: UserCircle,      label: 'Compte', path: '/dashboard/account' },
          ].map(item => {
            const active = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className="relative z-10 flex flex-col items-center gap-0.5 px-4 py-1 transition-all"
                style={{ color: active ? '#7B5CF0' : '#8B8BA7' }}
              >
                {active && (
                  <span
                    className="absolute rounded-2xl transition-all"
                    style={{
                      inset: '-10px -8px',
                      background: 'rgba(123,92,240,0.22)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid rgba(123,92,240,0.3)',
                      boxShadow: '0 0 20px rgba(123,92,240,0.15)',
                    }}
                  />
                )}
                <item.icon className="relative z-10 w-[20px] h-[20px]" />
                <span className="relative z-10 text-[9px] font-medium mt-0.5">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
