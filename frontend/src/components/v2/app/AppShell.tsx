import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown, LogOut, Menu, Search, X, type LucideIcon } from 'lucide-react';
import QwillioLogo from '../../QwillioLogo';
import { useAuthStore } from '../../../stores/authStore';
import CommandPalette, { shortcutLabel, type CommandItem } from './CommandPalette';

/* Châssis produit V2 « instrument » (DA/v2-direction.md, addendum produit).
   Remplace DashboardShell pour le portail client: sidebar carbon hairline,
   titres de page rendus ICI (répare le bug V1 du titre jamais affiché),
   topbar mobile sobre, nav basse simple. Contrats conservés: authStore
   (nom/email/logout), data-scroll-root + remise à zéro du scroll. */

export interface ShellNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

interface AppShellProps {
  primaryNav: ShellNavItem[];
  settingsSub?: ShellNavItem[];
  settingsLabel?: string;
  /* Titre par route; les clés peuvent être des préfixes (résolution du plus long préfixe) */
  pageTitles: Record<string, string>;
  pageTitleFallback?: string;
  mobileNav: ShellNavItem[];
  topBarExtras?: ReactNode;
  userFallbackName?: string;
  userFallbackInitials?: string;
  /* Commandes supplémentaires de la palette (actions rapides, pages à icône dédiée) */
  extraCommands?: CommandItem[];
}

const SPRING = { type: 'spring' as const, stiffness: 400, damping: 32 };

function resolveTitle(pathname: string, titles: Record<string, string>, fallback: string) {
  if (titles[pathname]) return titles[pathname];
  let best = '';
  for (const key of Object.keys(titles)) {
    if (pathname.startsWith(key) && key.length > best.length) best = key;
  }
  return best ? titles[best] : fallback;
}

function NavLink({
  item,
  active,
  scope,
  onNavigate,
  reduce,
}: {
  item: ShellNavItem;
  active: boolean;
  scope: string;
  onNavigate?: () => void;
  reduce: boolean;
}) {
  return (
    <Link
      to={item.to}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={`relative flex items-center gap-3 h-9 px-3 rounded-lg text-[13px] transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
        active ? 'bg-q2-obsidian text-white' : 'text-q2-fog hover:text-q2-mist hover:bg-q2-obsidian/50'
      }`}
    >
      {/* Barre d'accent de l'item actif: glisse d'un item à l'autre (layoutId) */}
      {active && (
        <motion.span
          layoutId={`q2p-nav-active-${scope}`}
          aria-hidden="true"
          transition={reduce ? { duration: 0 } : SPRING}
          className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-q2-indigo"
        />
      )}
      <item.icon size={15} aria-hidden="true" className={active ? 'text-q2-lift' : ''} />
      {item.label}
    </Link>
  );
}

export default function AppShell({
  primaryNav,
  settingsSub,
  settingsLabel = 'Paramètres',
  pageTitles,
  pageTitleFallback = '',
  mobileNav,
  topBarExtras,
  userFallbackName = 'Compte',
  userFallbackInitials = 'Q',
  extraCommands,
}: AppShellProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const reduce = useReducedMotion() ?? false;
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [intro, setIntro] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(
    () => (settingsSub ?? []).some((s) => location.pathname.startsWith(s.to)),
  );

  const title = useMemo(
    () => resolveTitle(location.pathname, pageTitles, pageTitleFallback),
    [location.pathname, pageTitles, pageTitleFallback],
  );

  useEffect(() => {
    setMobileOpen(false);
    document.querySelectorAll<HTMLElement>('[data-scroll-root]').forEach((el) => {
      el.scrollTop = 0;
    });
  }, [location.pathname]);

  useEffect(() => {
    if ((settingsSub ?? []).some((s) => location.pathname.startsWith(s.to))) setSettingsOpen(true);
  }, [location.pathname, settingsSub]);

  /* Le stagger de la nav ne joue qu'au premier montage */
  useEffect(() => {
    const id = window.setTimeout(() => setIntro(false), 600);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && (event.key === 'k' || event.key === 'K')) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];
    /* Les routes déjà décrites par la nav ou par extraCommands ne sont pas
       redérivées depuis pageTitles (les actions rapides, elles, cohabitent). */
    const described = new Set<string>((extraCommands ?? []).map((c) => c.to));
    for (const item of primaryNav) {
      described.add(item.to);
      list.push({ id: `nav-${item.to}`, label: item.label, to: item.to, group: 'Navigation', icon: item.icon });
    }
    for (const item of settingsSub ?? []) {
      described.add(item.to);
      list.push({ id: `set-${item.to}`, label: item.label, to: item.to, group: settingsLabel, icon: item.icon });
    }
    for (const [to, label] of Object.entries(pageTitles)) {
      if (described.has(to)) continue;
      described.add(to);
      list.push({ id: `page-${to}`, label, to, group: 'Pages', icon: ArrowRight });
    }
    return [...list, ...(extraCommands ?? [])];
  }, [primaryNav, settingsSub, settingsLabel, pageTitles, extraCommands]);

  const isActive = (item: ShellNavItem) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  const name = user?.name || userFallbackName;
  const initials =
    (user?.name || userFallbackInitials)
      .split(' ')
      .map((p: string) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || userFallbackInitials;

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const renderSidebar = (scope: string) => (
    <div className="flex flex-col h-full">
      <Link
        to="/dashboard"
        className="flex items-center gap-2.5 px-4 h-16 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded-md"
      >
        <QwillioLogo size={26} />
        <span className="text-[14px] font-semibold tracking-tight text-white">Qwillio</span>
      </Link>

      <nav aria-label="Navigation" className="flex-1 px-2.5 py-2 space-y-0.5 overflow-y-auto">
        {primaryNav.map((item, i) => (
          <motion.div
            key={item.to}
            initial={intro && !reduce ? { opacity: 0, x: -4 } : false}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.16, delay: i * 0.025, ease: [0.16, 1, 0.3, 1] }}
          >
            <NavLink
              item={item}
              active={isActive(item)}
              scope={scope}
              reduce={reduce}
              onNavigate={() => setMobileOpen(false)}
            />
          </motion.div>
        ))}

        {settingsSub && settingsSub.length > 0 && (
          <div className="pt-3">
            <button
              type="button"
              onClick={() => setSettingsOpen(!settingsOpen)}
              aria-expanded={settingsOpen}
              className="w-full flex items-center justify-between h-8 px-3 rounded-lg text-[11px] font-medium uppercase tracking-[0.08em] text-q2-fog hover:text-q2-mist transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
            >
              {settingsLabel}
              <ChevronDown
                size={12}
                aria-hidden="true"
                className={`transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`}
              />
            </button>
            {settingsOpen && (
              <div className="space-y-0.5 mt-0.5">
                {settingsSub.map((item) => (
                  <NavLink
                    key={item.to}
                    item={item}
                    active={isActive(item)}
                    scope={scope}
                    reduce={reduce}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="shrink-0 border-t border-q2-graphite-d p-3">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 shrink-0 rounded-full bg-q2-indigo text-white text-[11px] font-semibold flex items-center justify-center">
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-white truncate">{name}</p>
            {user?.email && <p className="text-[11px] text-q2-fog truncate">{user.email}</p>}
          </div>
          <button
            type="button"
            onClick={handleLogout}
            title="Déconnexion"
            aria-label="Déconnexion"
            className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center text-q2-fog hover:text-q2-mist hover:bg-q2-obsidian transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
          >
            <LogOut size={14} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-q2-carbon text-q2-mist font-outfit flex">
      {/* Sidebar desktop, plate, sans bordure: la séparation vient du panneau */}
      <aside className="hidden md:block w-[220px] shrink-0 bg-q2-carbon sticky top-0 h-dvh">
        {renderSidebar('desktop')}
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-0 left-0 w-[240px] bg-q2-carbon border-r border-q2-graphite-d">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Fermer le menu"
              className="absolute top-4 right-3 w-9 h-9 rounded-lg flex items-center justify-center text-q2-fog hover:text-white"
            >
              <X size={16} aria-hidden="true" />
            </button>
            {renderSidebar('mobile')}
          </aside>
        </div>
      )}

      {/* Colonne principale: panneau incrusté, arrondi 45px en haut-gauche
          avec liseré (le motif signature du shell V1) */}
      <div className="flex-1 min-w-0 flex flex-col bg-q2-void overflow-hidden md:rounded-tl-[45px] md:border-l-2 md:border-t-2 border-white/[0.08]">
        <header
          className="sticky top-0 z-40 bg-q2-void/95 backdrop-blur-sm border-b border-q2-graphite-d"
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="flex items-center gap-3 h-14 px-4 md:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
              className="md:hidden w-9 h-9 -ml-1 rounded-lg flex items-center justify-center text-q2-mist hover:bg-q2-obsidian transition-colors duration-100"
            >
              <Menu size={17} aria-hidden="true" />
            </button>

            {/* Le titre permute au changement de route, sans décaler la barre */}
            <div className="relative flex-1 min-w-0">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.h1
                  key={title}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
                  transition={{ duration: reduce ? 0 : 0.14, ease: [0.16, 1, 0.3, 1] }}
                  className="q2p-page-title text-white truncate"
                >
                  {title}
                </motion.h1>
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Ouvrir la palette de commandes"
              aria-haspopup="dialog"
              className="shrink-0 inline-flex items-center gap-2 h-8 rounded-lg border border-q2-graphite-d px-2 text-q2-fog hover:text-q2-mist hover:border-q2-smoke-d transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
            >
              <Search size={14} aria-hidden="true" />
              <span className="q2p-kbd hidden sm:inline-block">{shortcutLabel()}</span>
            </button>

            {topBarExtras}
          </div>
        </header>

        <main
          data-scroll-root
          className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-28 md:pb-8"
        >
          <div key={location.pathname} className="q2p-page max-w-[1100px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Nav basse mobile, simple, sans bulle décorative (fréquent = pas d'animation) */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-q2-carbon border-t border-q2-graphite-d"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex">
          {mobileNav.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-current={active ? 'page' : undefined}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors duration-100 ${
                  active ? 'text-q2-lift' : 'text-q2-fog'
                }`}
              >
                <item.icon size={17} aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <CommandPalette open={paletteOpen} onClose={closePalette} commands={commands} />
    </div>
  );
}
