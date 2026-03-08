import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useLang } from '../../stores/langStore';
import LangToggle from '../LangToggle';
import QwillioLogo from '../QwillioLogo';
import {
  LayoutDashboard, Phone, Users, Bot, UserCircle,
  HelpCircle, LogOut, Menu, X,
} from 'lucide-react';
import { useState } from 'react';

export default function ClientLayout() {
  const { user, logout } = useAuthStore();
  const { t } = useLang();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: t('cdash.nav.overview') },
    { path: '/dashboard/calls', icon: Phone, label: t('cdash.nav.calls') },
    { path: '/dashboard/leads', icon: Users, label: t('cdash.nav.leads') },
    { path: '/dashboard/receptionist', icon: Bot, label: t('cdash.nav.receptionist') },
    { path: '/dashboard/account', icon: UserCircle, label: t('cdash.nav.account') },
    { path: '/dashboard/support', icon: HelpCircle, label: t('cdash.nav.support') },
  ];

  const isActive = (path: string) => {
    if (path === '/dashboard') return location.pathname === '/dashboard';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f]">
      {/* ── Top header ── */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]/60">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QwillioLogo size={28} />
            <span className="text-xl font-semibold tracking-tight hidden sm:block">Qwillio</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-[#86868b]">{user?.email}</p>
            </div>
            <LangToggle />
            <button
              onClick={logout}
              className="hidden md:inline-flex items-center gap-1.5 text-sm text-[#86868b] hover:text-red-500 transition-colors"
              title={t('cdash.logout')}
            >
              <LogOut size={16} />
            </button>
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden text-[#86868b] hover:text-[#1d1d1f]"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1280px] mx-auto flex">
        {/* ── Sidebar (desktop) ── */}
        <aside className="hidden md:block w-56 flex-shrink-0 border-r border-[#d2d2d7]/40 min-h-[calc(100vh-3.5rem)] sticky top-14 self-start">
          <nav className="py-4 px-3 space-y-1">
            {navItems.map(item => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? 'bg-[#6366f1]/10 text-[#6366f1]'
                      : 'text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7]'
                  }`}
                >
                  <item.icon size={18} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 py-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile bottom nav ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-xl border-t border-[#d2d2d7]/60 safe-bottom">
        <div className="grid grid-cols-6 py-1">
          {navItems.map(item => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  active ? 'text-[#6366f1]' : 'text-[#86868b]'
                }`}
              >
                <item.icon size={20} />
                <span className="truncate max-w-full px-1">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Mobile slide-out menu ── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-64 bg-white shadow-xl p-6">
            <div className="flex justify-end mb-6">
              <button onClick={() => setMobileOpen(false)} className="text-[#86868b]">
                <X size={22} />
              </button>
            </div>
            <div className="mb-6">
              <p className="text-sm font-medium">{user?.name}</p>
              <p className="text-xs text-[#86868b]">{user?.email}</p>
            </div>
            <nav className="space-y-1">
              {navItems.map(item => {
                const active = isActive(item.path);
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                      active ? 'bg-[#6366f1]/10 text-[#6366f1]' : 'text-[#86868b]'
                    }`}
                  >
                    <item.icon size={18} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <button
              onClick={() => { logout(); setMobileOpen(false); }}
              className="flex items-center gap-2 mt-8 text-sm text-red-500"
            >
              <LogOut size={16} />
              {t('cdash.logout')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
