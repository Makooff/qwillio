import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  LogOut, X, ChevronDown,
  Settings as SettingsIcon, LayoutDashboard, RefreshCw,
  HelpCircle, BookOpen, type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import QwillioLogo from '../QwillioLogo';
import { t } from '../../styles/admin-theme';

/**
 * Shared dashboard shell — sidebar, top bar, mobile bottom nav.
 * Dark Luxury AI direction: glassmorphism sidebar, purple accent glow.
 *
 * Every dashboard (admin, client, closeuse) uses this component.
 * Only the content of the nav arrays changes; design and animations
 * are identical everywhere.
 */

export interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
}

export interface DashboardShellProps {
  /** Main sidebar nav — rendered at the top of the sidebar. */
  primaryNav: NavItem[];
  /**
   * Optional expandable "Settings" section — renders a chevron-collapsible
   * group at the bottom of the primary nav, with pl-9 sub-items.
   */
  settingsSub?: NavItem[];
  settingsLabel?: string;
  /** Exact-pathname â†’ page title map used in the top bar (md+). */
  pageTitles: Record<string, string>;
  pageTitleFallback?: string;
  /** 5-item list for the mobile bottom pill nav. */
  mobileNav: NavItem[];
  /** e.g. "admin", "closeuse" — shown next to the Qwillio wordmark. */
  brandSuffix?: string;
  /** Show the Help + Documentation links above the user footer (default true). */
  showHelp?: boolean;
  /** Unique id — used so each dashboard has its own motion scope. */
  scope: string;
  /** Fallback label if user.name is empty. */
  userFallbackName: string;
  /** Fallback initials if user.name is empty. */
  userFallbackInitials: string;
  /** Extra buttons rendered in the top bar, between the refresh and avatar. */
  topBarExtras?: React.ReactNode;
  /**
   * Extra markup rendered at the very bottom of the layout
   * (outside main/nav). Useful for modals like the Command Palette.
   */
  overlay?: React.ReactNode;
}

export default function DashboardShell(props: DashboardShellProps) {
  const {
    primaryNav, settingsSub, settingsLabel = 'Paramètres',
    pageTitles, pageTitleFallback = 'Qwillio',
    mobileNav, brandSuffix, scope,
    userFallbackName, userFallbackInitials,
    topBarExtras, overlay, showHelp = true,
  } = props;

  const { user, logout } = useAuthStore();
  const location = useLocation();
  const [collapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    (settingsSub || []).some(i => location.pathname.startsWith(i.path))
  );
  const mainRef = useRef<HTMLElement>(null);

  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
      mainRef.current.scrollLeft = 0;
    }
    window.scrollTo(0, 0);
    if (document.documentElement) document.documentElement.scrollTop = 0;
    if (document.body) document.body.scrollTop = 0;
  };

  useEffect(() => {
    scrollToTop();
    const r = requestAnimationFrame(scrollToTop);
    return () => cancelAnimationFrame(r);
  }, [location.pathname]);

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  const pageTitle = pageTitles[location.pathname] ?? pageTitleFallback;
  const initials =
    user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    ?? userFallbackInitials;
  const settingsActive = (settingsSub || []).some(i => isActive(i.path));

  const SidebarLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.path, item.exact);
    return (
      <Link
        to={item.path}
        onClick={() => { setMobileOpen(false); scrollToTop(); }}
        title={collapsed ? item.label : undefined}
        className={`relative flex items-center gap-3 rounded-[10px] transition-colors duration-150 group
          ${collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5'}`}
        style={active ? {
          background: 'oklch(100% 0 0 / 0.05)',
          color: t.text,
        } : {
          color: t.textSec,
        }}
      >
        {active && (
          <span
            className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full"
            style={{ background: t.brand }}
          />
        )}
        <item.icon
          className="w-[18px] h-[18px] flex-shrink-0"
          style={active ? { color: t.brandHi } : undefined}
        />
        {!collapsed && (
          <span className="text-sm font-medium">{item.label}</span>
        )}
        {!active && !collapsed && (
          <span
            className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(255,255,255,0.03)' }}
          />
        )}
        {collapsed && (
          <span
            className="absolute left-full ml-3 px-2 py-1 text-xs rounded-lg
              opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl backdrop-blur-xl"
            style={{
              background: t.elevated,
              color: t.text,
              border: `1px solid ${t.borderHi}`,
              boxShadow: t.shadowFloat,
            }}
          >
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  const SubLink = ({ item }: { item: NavItem }) => {
    const active = isActive(item.path);
    return (
      <Link
        to={item.path}
        onClick={() => { setMobileOpen(false); scrollToTop(); }}
        className={`flex items-center gap-3 py-2 rounded-xl transition-colors pl-9 pr-3
          ${active ? '' : 'hover:bg-white/[0.03]'}`}
        style={{ color: active ? t.brand : t.textSec }}
      >
        <item.icon className="w-4 h-4 flex-shrink-0" />
        <span className="text-[13px] font-medium">{item.label}</span>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full min-h-0" style={{ position: 'relative', zIndex: 1 }}>
      {/* Logo */}
      <div
        className={`flex items-center gap-3 mb-5 flex-shrink-0 pb-4 ${collapsed ? 'justify-center px-0' : 'px-1'}`}
        style={{ borderBottom: `1px solid ${t.border}` }}
      >
        <QwillioLogo size={32} />
        {!collapsed && (
          <span className="text-base font-bold tracking-tight" style={{ color: t.text }}>
            Qwillio{brandSuffix
              ? (
                <>
                  {' '}
                  <span style={{ color: t.brand }}>
                    {brandSuffix}
                  </span>
                </>
              )
              : null}
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-hide min-h-0 pb-2">
        {!collapsed && (
          <p
            className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-[0.12em]"
            style={{ color: t.textTer }}
          >
            Menu
          </p>
        )}
        <div className="space-y-0.5">
          {primaryNav.map(item => <SidebarLink key={item.path} item={item} />)}

          {settingsSub && settingsSub.length > 0 && (
            <>
              <button
                onClick={() => { if (!collapsed) setSettingsOpen(v => !v); }}
                title={collapsed ? settingsLabel : undefined}
                className={`w-full relative flex items-center gap-3 rounded-[10px] transition-colors duration-150 group
                  ${collapsed ? 'px-0 py-3 justify-center' : 'px-3 py-2.5'}`}
                style={settingsActive ? {
                  background: 'oklch(100% 0 0 / 0.05)',
                  color: t.text,
                } : {
                  color: t.textSec,
                }}
              >
                {settingsActive && (
                  <span
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full"
                    style={{ background: t.brand }}
                  />
                )}
                <SettingsIcon className="w-[18px] h-[18px] flex-shrink-0" style={settingsActive ? { color: t.brandHi } : undefined} />
                {!collapsed && <span className="text-sm font-medium flex-1 text-left">{settingsLabel}</span>}
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
                    style={{ background: t.elevated, color: t.text, border: `1px solid ${t.borderHi}` }}
                  >
                    {settingsLabel}
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
                      {settingsSub.map(item => <SubLink key={item.path} item={item} />)}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </nav>

      {/* Help + Docs */}
      {showHelp && !collapsed && (
        <div className="flex-shrink-0 space-y-0.5 mb-1">
          <a
            href="mailto:contact@qwillio.com"
            className="flex items-center gap-3 px-3 py-2 rounded-[10px] transition-colors hover:bg-white/[0.03]"
            style={{ color: t.textSec }}
          >
            <HelpCircle className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="text-[13px] font-medium">Aide</span>
          </a>
          <a
            href="https://qwillio.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-[10px] transition-colors hover:bg-white/[0.03]"
            style={{ color: t.textSec }}
          >
            <BookOpen className="w-[18px] h-[18px] flex-shrink-0" />
            <span className="text-[13px] font-medium">Documentation</span>
          </a>
        </div>
      )}

      {/* Bottom — user + logout */}
      <div className="flex-shrink-0 space-y-1 mt-3 pt-3" style={{ borderTop: `1px solid ${t.border}` }}>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${collapsed ? 'justify-center' : ''}`}>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: t.accentGrad }}
          >
            <span className="text-[10px] font-bold" style={{ color: '#fff' }}>{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: t.text }}>{user?.name ?? userFallbackName}</p>
              <p className="text-[10px] truncate" style={{ color: t.textSec }}>{user?.email}</p>
            </div>
          )}
        </div>

        <button
          onClick={logout}
          title={collapsed ? 'Déconnexion' : undefined}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:text-red-400 hover:bg-red-500/[0.08] transition-colors text-sm
            ${collapsed ? 'justify-center' : ''}`}
          style={{ color: t.textSec }}
        >
          <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
          {!collapsed && 'Déconnexion'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen md:h-screen flex overflow-hidden" style={{ height: '100dvh', background: t.inset, color: t.text }}>
      {/* Desktop Sidebar */}
      <aside
        className={`sidebar-surface hidden md:flex flex-col h-screen sticky top-0 flex-shrink-0
          backdrop-blur-xl transition-colors duration-300 ease-in-out
          ${collapsed ? 'w-[64px] px-2 py-5' : 'w-[220px] px-4 py-5'}`}
        style={{
          background: t.elevated,
          position: 'relative',
        }}
      >
        {/* Mesh gradient overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: t.mesh,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
        <SidebarContent />
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
              className="sidebar-surface md:hidden fixed left-0 top-0 bottom-0 z-50 w-[240px] px-4 pt-5 pb-28"
              style={{
                background: t.elevated,
                borderRight: `1px solid ${t.border}`,
                position: 'fixed',
              }}
            >
              {/* Mesh gradient overlay */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: t.mesh,
                  pointerEvents: 'none',
                  zIndex: 0,
                }}
              />
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute right-3 top-4"
                style={{ color: t.textSec, zIndex: 2 }}
              >
                <X className="w-5 h-5" />
              </button>
              <SidebarContent />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main — inset rounded panel against the darker sidebar gutter */}
      <div
        className="flex-1 flex flex-col min-w-0 overflow-hidden md:rounded-tl-[45px] md:border-l-2 md:border-t-2 border-white/[0.08]"
        style={{ background: t.panel }}
      >
        <header
          className="md:hidden sticky top-0 z-30 h-14 flex items-center gap-4 px-4"
          style={{
            background: 'rgba(10,10,10,0.85)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderBottom: '1px solid oklch(24% 0 0 / 0.4)',
          }}
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
            {topBarExtras}

            <button
              onClick={() => window.location.reload()}
              title="Rafraîchir"
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
              style={{ color: t.textSec }}
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: t.accentGrad }}
            >
              <span className="text-xs font-bold" style={{ color: '#fff' }}>{initials}</span>
            </div>
          </div>
        </header>

        <main ref={mainRef} data-scroll-root className="flex-1 p-4 md:p-8 pb-32 md:pb-8 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav — floating pill with sliding bubble (scoped per dashboard) */}
      <MobileBottomNav items={mobileNav} pathname={location.pathname} scope={scope} onTap={scrollToTop} />

      {overlay}
    </div>
  );
}

function MobileBottomNav({
  items, pathname, scope, onTap,
}: { items: NavItem[]; pathname: string; scope: string; onTap?: () => void }) {
  const activeIdx = items.findIndex(item =>
    item.exact ? pathname === item.path : pathname.startsWith(item.path)
  );
  const itemPct = 100 / items.length;
  const showBubble = activeIdx >= 0;
  const reduceMotion = useReducedMotion();

  return (
    <div className="fixed bottom-5 left-0 right-0 z-50 flex md:hidden flex-col items-center gap-2 px-4">
      <div className="relative w-full flex items-center py-1.5">
        {/* Morph-glass bar — fully translucent, heavy blur, glass edge highlights */}
        <div
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, oklch(30% 0.01 265 / 0.20) 0%, oklch(16% 0.01 265 / 0.28) 100%)',
            backdropFilter: 'blur(28px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.25), 0 12px 32px rgba(0,0,0,0.35)',
          }}
        />

        {/* Water-drop bubble — wobbly spring travel + continuous liquid morph */}
        {showBubble && (
          <motion.span
            key={scope}
            className="absolute pointer-events-none"
            initial={false}
            animate={{
              left: `${activeIdx * itemPct + itemPct / 2}%`,
              borderRadius: reduceMotion
                ? '50%'
                : [
                    '46% 54% 52% 48% / 52% 46% 54% 48%',
                    '54% 46% 48% 52% / 48% 56% 44% 52%',
                    '48% 52% 55% 45% / 54% 48% 52% 46%',
                    '46% 54% 52% 48% / 52% 46% 54% 48%',
                  ],
            }}
            transition={{
              // Near-critically damped so long jumps (first ↔ last) don't overshoot.
              left: { type: 'spring', stiffness: 280, damping: 30, mass: 0.8 },
              borderRadius: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
            }}
            style={{
              width: 64, height: 64,
              top: '50%',
              x: '-50%', y: '-50%',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.10) 100%)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.22)',
              boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.25), inset 0 -3px 6px rgba(0,0,0,0.20), 0 6px 18px rgba(0,0,0,0.25)',
            }}
          />
        )}

        {items.map((item, i) => {
          const active = i === activeIdx;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => onTap?.()}
              aria-label={item.label}
              className="relative z-10 flex-1 flex flex-col items-center justify-center gap-0.5 py-0.5 min-h-[52px] transition-transform active:scale-[0.97]"
              style={{ color: active ? '#fff' : 'rgba(255,255,255,0.40)' }}
            >
              {/* Active item: just the icon, centred inside the water bubble */}
              <item.icon className="relative z-10 w-[22px] h-[22px]" />
              {!active && (
                <span className="relative z-10 text-[9px] font-medium mt-0.5">{item.label}</span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
