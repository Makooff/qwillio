import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import {
  Menu, X, Home, Users, Building2, Mail, FileText,
  Settings, LogOut, DollarSign, UserCheck, MessageSquare,
  PhoneCall, Crosshair, Bot, ChevronRight, Radio,
} from 'lucide-react';

// ── Bottom tab items (5 most important) ────────────────────────────────────
const tabItems = [
  { path: '/admin',            icon: Home,      label: 'Dashboard'  },
  { path: '/admin/prospects',  icon: Users,     label: 'Prospects'  },
  { path: '/admin/clients',    icon: Building2, label: 'Clients'    },
  { path: '/admin/campaigns',  icon: Mail,      label: 'Campagnes'  },
  { path: '/admin/settings',   icon: Settings,  label: 'Réglages'   },
];

// ── All drawer items ────────────────────────────────────────────────────────
const mainItems = [
  { path: '/admin',           icon: Home,      label: 'Dashboard' },
  { path: '/admin/prospects', icon: Users,     label: 'Prospects' },
  { path: '/admin/clients',   icon: Building2, label: 'Clients'   },
  { path: '/admin/quotes',    icon: FileText,  label: 'Devis'     },
  { path: '/admin/campaigns', icon: Mail,      label: 'Campagnes' },
];

const growthItems = [
  { path: '/admin/prospecting',    icon: Crosshair, label: 'Prospecting'    },
  { path: '/admin/mission-control', icon: Radio,    label: 'Mission Control' },
];

const analyticsItems = [
  { path: '/admin/costs',            icon: DollarSign,    label: 'Coûts'      },
  { path: '/admin/retention',        icon: UserCheck,     label: 'Rétention'  },
  { path: '/admin/followups',        icon: MessageSquare, label: 'Follow-ups' },
  { path: '/admin/phone-validation', icon: PhoneCall,     label: 'Validation' },
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function useIsActive(path: string) {
  const location = useLocation();
  if (path === '/admin') return location.pathname === '/admin';
  return location.pathname.startsWith(path);
}

function DrawerLink({
  item,
  onClose,
}: {
  item: { path: string; icon: any; label: string };
  onClose: () => void;
}) {
  const active = useIsActive(item.path);
  return (
    <Link
      to={item.path}
      onClick={onClose}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 group ${
        active
          ? 'bg-violet-50 text-violet-600'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      <item.icon
        className={`w-5 h-5 flex-shrink-0 transition-colors ${
          active ? 'text-violet-600' : 'text-gray-400 group-hover:text-gray-600'
        }`}
      />
      <span className="text-[15px] font-medium flex-1">{item.label}</span>
      {active && <ChevronRight className="w-4 h-4 text-violet-400" />}
    </Link>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-4 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-widest text-gray-400 select-none">
      {label}
    </p>
  );
}

// ── Main Layout ─────────────────────────────────────────────────────────────
export default function Layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const { user, logout } = useAuthStore();

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  // Close drawer on outside click
  useEffect(() => {
    if (!drawerOpen) return;
    function handleClick(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) {
        setDrawerOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [drawerOpen]);

  // Prevent body scroll while drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'A';

  const isTabActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Top Header ──────────────────────────────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-30 h-14 bg-white/90 backdrop-blur-md border-b border-gray-100 flex items-center px-4 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="w-9 h-9 flex items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 active:bg-gray-200 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex-1 flex justify-center items-center gap-2 pointer-events-none select-none">
          <Bot className="w-5 h-5 text-violet-600" />
          <span className="text-[17px] font-bold tracking-tight bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">
            Qwillio
          </span>
        </div>

        <button
          aria-label="User menu"
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold shadow-sm active:opacity-80 transition-opacity"
        >
          {initials}
        </button>
      </header>

      {/* ── Slide-out Drawer ────────────────────────────────────────────── */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity duration-300 ${
          drawerOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      <div
        ref={drawerRef}
        className={`fixed top-0 left-0 bottom-0 z-50 w-72 bg-white shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <Bot className="w-6 h-6 text-violet-600" />
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-violet-600 to-purple-500 bg-clip-text text-transparent">
              Qwillio
            </span>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Close menu"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
          {mainItems.map((item) => (
            <DrawerLink key={item.path} item={item} onClose={() => setDrawerOpen(false)} />
          ))}

          <SectionLabel label="Growth" />
          {growthItems.map((item) => (
            <DrawerLink key={item.path} item={item} onClose={() => setDrawerOpen(false)} />
          ))}

          <SectionLabel label="Analytics" />
          {analyticsItems.map((item) => (
            <DrawerLink key={item.path} item={item} onClose={() => setDrawerOpen(false)} />
          ))}

          <SectionLabel label="Admin" />
          <DrawerLink
            item={{ path: '/admin/settings', icon: Settings, label: 'Réglages' }}
            onClose={() => setDrawerOpen(false)}
          />
        </nav>

        <div className="border-t border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={() => { setDrawerOpen(false); logout(); }}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors py-1"
          >
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </button>
        </div>
      </div>

      {/* ── Page Content ────────────────────────────────────────────────── */}
      <main className="pt-14 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] min-h-screen">
        <div className="px-4 py-5 max-w-5xl mx-auto">
          <Outlet />
        </div>
      </main>

      {/* ── Bottom Tab Bar ───────────────────────────────────────────────── */}
      <nav
        aria-label="Bottom navigation"
        className="fixed bottom-0 inset-x-0 z-30 bg-white/90 backdrop-blur-md border-t border-gray-100 shadow-[0_-1px_0_0_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex h-[3.75rem]">
          {tabItems.map(({ path, icon: Icon, label }) => {
            const active = isTabActive(path);
            return (
              <Link
                key={path}
                to={path}
                className="flex-1 flex flex-col items-center justify-center gap-[3px] transition-colors active:opacity-70"
                aria-label={label}
              >
                <Icon
                  className={`w-[22px] h-[22px] transition-all duration-150 ${
                    active ? 'text-violet-600 scale-110' : 'text-gray-400'
                  }`}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                <span
                  className={`text-[10px] font-medium tracking-tight transition-colors ${
                    active ? 'text-violet-600' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
