import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChevronDown, LogOut, Menu, Search, X, type LucideIcon } from '../../icons';
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
      className={`relative flex items-center gap-3 h-11 md:h-9 px-3 rounded-lg text-[13px] transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 ${
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

/* Pilule de navigation basse, mobile uniquement. Le verre est translucide et
   très flouté, la bulle glisse en ressort quasi critique pour qu'un saut du
   premier au dernier item n'oscille pas. Le morphing de la bulle tourne en
   boucle lente, coupé en reduced-motion. */
function MobileBottomNav({
  items,
  activeIndex,
  reduce,
}: {
  items: ShellNavItem[];
  activeIndex: number;
  reduce: boolean;
}) {
  if (items.length === 0) return null;
  const itemPct = 100 / items.length;

  return (
    <nav
      aria-label="Navigation mobile"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 px-4 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
    >
      <div className="relative w-full flex items-center py-1.5 pointer-events-auto">
        <div
          aria-hidden="true"
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, oklch(30% 0.01 265 / 0.22) 0%, oklch(16% 0.01 265 / 0.34) 100%)',
            backdropFilter: 'blur(28px) saturate(1.6)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
            border: '1px solid rgba(255,255,255,0.12)',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.25), 0 12px 32px rgba(0,0,0,0.38)',
          }}
        />

        {activeIndex >= 0 && (
          <motion.span
            aria-hidden="true"
            className="absolute pointer-events-none"
            initial={false}
            animate={{
              left: `${activeIndex * itemPct + itemPct / 2}%`,
              borderRadius: reduce
                ? '50%'
                : [
                    '46% 54% 52% 48% / 52% 46% 54% 48%',
                    '54% 46% 48% 52% / 48% 56% 44% 52%',
                    '48% 52% 55% 45% / 54% 48% 52% 46%',
                    '46% 54% 52% 48% / 52% 46% 54% 48%',
                  ],
            }}
            transition={{
              left: reduce
                ? { duration: 0 }
                : { type: 'spring', stiffness: 280, damping: 30, mass: 0.8 },
              borderRadius: reduce ? { duration: 0 } : { duration: 5, repeat: Infinity, ease: 'easeInOut' },
            }}
            style={{
              width: 56,
              height: 56,
              top: '50%',
              x: '-50%',
              y: '-50%',
              background:
                'linear-gradient(180deg, oklch(56% 0.22 264 / 0.30) 0%, rgba(255,255,255,0.05) 60%, rgba(255,255,255,0.10) 100%)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.22)',
              boxShadow:
                'inset 0 2px 4px rgba(255,255,255,0.22), inset 0 -3px 6px rgba(0,0,0,0.20), 0 6px 18px rgba(0,0,0,0.28)',
            }}
          />
        )}

        {items.map((item, i) => {
          const active = i === activeIndex;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className={`relative z-10 flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 min-h-[52px] transition-transform duration-100 active:scale-[0.97] motion-reduce:active:scale-100 ${
                active ? 'text-white' : 'text-q2-fog'
              }`}
            >
              <item.icon size={21} aria-hidden="true" className="relative z-10 shrink-0" />
              {!active && (
                <span className="relative z-10 text-[9.5px] font-medium leading-none truncate max-w-full px-0.5">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
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
        className="flex items-center gap-2.5 px-4 h-14 md:h-16 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50 rounded-md"
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
          <aside
            className="absolute inset-y-0 left-0 w-[min(84vw,264px)] bg-q2-carbon border-r border-q2-graphite-d"
            style={{
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              paddingLeft: 'env(safe-area-inset-left)',
            }}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Fermer le menu"
              className="absolute top-2 right-2 w-11 h-11 rounded-lg flex items-center justify-center text-q2-fog hover:text-white"
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
          <div className="flex items-center gap-2 md:gap-3 h-12 md:h-14 px-3.5 md:px-8">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
              className="md:hidden w-11 h-11 -ml-2.5 rounded-lg flex items-center justify-center text-q2-mist hover:bg-q2-obsidian transition-colors duration-100"
            >
              <Menu size={18} aria-hidden="true" />
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
                  className="q2p-page-title text-white truncate !text-[17px] md:!text-[20px]"
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
              className="shrink-0 inline-flex items-center justify-center gap-2 w-11 md:w-auto h-11 md:h-8 rounded-lg border border-q2-graphite-d px-0 md:px-2 text-q2-fog hover:text-q2-mist hover:border-q2-smoke-d transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/50"
            >
              <Search size={15} aria-hidden="true" />
              {/* .q2p-kbd fixe son display et est chargé après les utilitaires:
                  sans important, `hidden` ne masquerait pas la touche sur mobile */}
              <span className="q2p-kbd !hidden md:!inline-flex">{shortcutLabel()}</span>
            </button>

            {topBarExtras}
          </div>
        </header>

        <main
          data-scroll-root
          className="flex-1 overflow-y-auto px-3.5 md:px-8 py-4 md:py-6 pb-[124px] md:pb-8"
        >
          <div key={location.pathname} className="q2p-page max-w-[1100px]">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Nav basse mobile: pilule flottante en verre, bulle « goutte d'eau »
          derrière l'item actif (motif V1 du DashboardShell, teinté q2) */}
      <MobileBottomNav items={mobileNav} activeIndex={mobileNav.findIndex(isActive)} reduce={reduce} />

      <CommandPalette open={paletteOpen} onClose={closePalette} commands={commands} />
    </div>
  );
}
