import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../stores/authStore';
import QwillioLogo from '../QwillioLogo';
import { pro } from '../../styles/pro-theme';
import {
  LayoutDashboard, Users, Bell, UserCircle, LogOut, X,
  ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react';

const NAV = [
  { path: '/closer',            icon: LayoutDashboard, label: "Vue d'ensemble", exact: true },
  { path: '/closer/prospects',  icon: Users,           label: 'Prospects' },
  { path: '/closer/followups',  icon: Bell,            label: 'Follow-ups' },
  { path: '/closer/account',    icon: UserCircle,      label: 'Compte' },
];

const TITLES: Record<string, string> = {
  '/closer':           "Vue d'ensemble",
  '/closer/prospects': 'Prospects',
  '/closer/followups': 'Follow-ups',
  '/closer/account':   'Compte',
};

export default function CloserLayout() {
  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname]);

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const pageTitle = TITLES[location.pathname] ?? 'Qwillio';
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
        style={{ color: active ? pro.accent : pro.textSec }}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full" style={{ background: pro.accent }} />
        )}
        <item.icon className="w-[18px] h-[18px] flex-shrink-0" />
        {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full min-h-0">
      <div className={`flex items-center gap-3 mb-6 flex-shrink-0 ${collapsed ? 'justify-center px-0' : 'px-1'}`}>
        <QwillioLogo size={32} />
        {!collapsed && (
          <div className="min-w-0">
            <span className="block text-base font-bold tracking-tight truncate" style={{ color: pro.text }}>Qwillio</span>
            <span className="block text-[10px] uppercase tracking-[0.1em]" style={{ color: pro.textTer }}>Closeuse</span>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide min-h-0 pb-2">
        <div className="space-y-0.5">
          {NAV.map(item => <SidebarLink key={item.path} item={item} exact={item.exact} />)}
        </div>
      </nav>

      <div className="flex-shrink-0 space-y-1 mt-3 pt-3" style={{ borderTop: `1px solid ${pro.border}` }}>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: `${pro.accent}30` }}>
            <span className="text-[10px] font-bold" style={{ color: pro.accent }}>{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: pro.text }}>{user?.name ?? 'Closeuse'}</p>
              <p className="text-[10px] truncate" style={{ color: pro.textSec }}>{user?.email}</p>
            </div>
          )}
        </div>

        <button
          onClick={logout}
          title={collapsed ? 'Déconnexion' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:text-red-400 hover:bg-red-500/[0.08] transition-all text-sm
            ${collapsed ? 'justify-center' : ''}`}
          style={{ color: pro.textSec }}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && 'Déconnexion'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: pro.bg, color: pro.text }}>
      <aside
        className={`hidden md:flex flex-col h-screen sticky top-0 flex-shrink-0
          backdrop-blur-xl transition-all duration-300 ease-in-out
          ${collapsed ? 'w-[64px] px-2 py-5' : 'w-[220px] px-4 py-5'}`}
        style={{ background: pro.panel, borderRight: `1px solid ${pro.border}` }}
      >
        <SidebarContent />
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-8 w-6 h-6 rounded-full flex items-center justify-center hover:bg-white/[0.08] transition-all shadow-lg"
          style={{ background: pro.panel, border: `1px solid ${pro.borderHi}`, color: pro.textSec }}
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
        </button>
      </aside>

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
              style={{ background: pro.bg, borderRight: `1px solid ${pro.border}` }}
            >
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4"
                style={{ color: pro.textSec }}
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="sticky top-0 z-30 h-14 flex items-center gap-4 px-4 md:px-6 backdrop-blur-xl"
          style={{ background: `${pro.bg}CC`, borderBottom: `1px solid ${pro.border}` }}
        >
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden"
            style={{ color: pro.textSec }}
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>

          <div className="hidden md:block">
            <h1 className="text-sm font-semibold" style={{ color: pro.text }}>{pageTitle}</h1>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => window.location.reload()}
              title="Rafraîchir"
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-all"
              style={{ color: pro.textSec }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${pro.accent}30` }}>
              <span className="text-xs font-bold" style={{ color: pro.accent }}>{initials}</span>
            </div>
          </div>
        </header>

        <main ref={mainRef} className="flex-1 p-4 md:p-6 pb-32 md:pb-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav — sliding bubble like ClientLayout */}
      <MobileBottomNav pathname={location.pathname} />
    </div>
  );
}

function MobileBottomNav({ pathname }: { pathname: string }) {
  const activeIdx = NAV.findIndex(item =>
    item.exact ? pathname === item.path : pathname.startsWith(item.path)
  );
  const itemPct = 100 / NAV.length;
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
            border: `1px solid ${pro.border}`,
          }}
        />
        {showBubble && (
          <motion.span
            className="absolute rounded-full pointer-events-none"
            initial={false}
            animate={{ left: `${activeIdx * itemPct + itemPct / 2}%` }}
            transition={{ type: 'spring', stiffness: 380, damping: 30, mass: 0.8 }}
            style={{
              width: 60, height: 60, top: '50%',
              x: '-50%', y: '-50%',
              background: `${pro.accent}26`,
              border: `1px solid ${pro.accent}55`,
            }}
          />
        )}
        {NAV.map((item, i) => {
          const active = i === activeIdx;
          return (
            <Link
              key={item.path}
              to={item.path}
              className="relative z-10 flex flex-col items-center gap-0.5 w-[22%] py-0.5"
              style={{ color: active ? pro.text : pro.textTer }}
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
