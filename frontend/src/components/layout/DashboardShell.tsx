import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  LogOut, X, ChevronDown,
  Settings as SettingsIcon, LayoutDashboard,
  HelpCircle, BookOpen, type LucideIcon,
} from '../icons';
import { useAuthStore } from '../../stores/authStore';
import QwillioLogo from '../QwillioLogo';
import { t } from '../../styles/admin-theme';
import GlassSkin, { GlassFilter } from '../v2/ui/liquid-glass';
import { DARK_GLASS } from '../v2/ui/glassTints';

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
  /* Où mène l'avatar: la première entrée des réglages, qui est le compte.
     Sans sous-menu de réglages (l'admin), il retombe sur la racine du scope,
     plutôt que sur une adresse inventée qui rendrait un 404. */
  const settingsPath = settingsSub?.[0]?.path ?? primaryNav[0]?.path ?? '/';

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
        className="relative flex-1 flex flex-col min-w-0 overflow-hidden md:rounded-tl-[45px] md:border-l-2 md:border-t-2 border-white/[0.08]"
        style={{ background: t.panel }}
      >
        {/* Entête mobile en VIGNETTE (demande utilisateur).
         *
         * Elle portait une plaque opaque à 85 % et un filet en bas: deux traits
         * qui la découpaient du contenu et donnaient une barre posée dessus.
         * Elle n'a plus ni fond ni bord. À la place, un voile qui s'estompe:
         * très flou tout en haut, plus rien à mi-hauteur, si bien que le
         * contenu se dissout en montant au lieu de buter sur une ligne.
         *
         * DEUX éléments, et c'est le point technique. Sur WebKit, un
         * `-webkit-backdrop-filter` posé sur un élément qui porte aussi un
         * `-webkit-mask-image` n'est pas rendu: le voile devient une teinte
         * plate, sans flou. Le masque reste donc sur le parent, qui ne filtre
         * rien, et le filtre descend sur un enfant qui ne masque rien. Même
         * leçon que la barre du site, même correctif.
         *
         * Et elle est POSÉE SUR le contenu, pas au-dessus de lui.
         * `sticky` ne servait à rien ici: l'entête était la sœur de `<main>`,
         * qui est la zone de défilement. Le contenu commençait donc SOUS elle
         * et ne passait jamais derrière. Un voile qui n'a rien à dissoudre ne
         * se voit pas: on ne floutait que le fond plat du panneau, ce qui
         * revenait à ne rien faire, et la page butait sur un bord franc.
         * En `absolute`, le contenu glisse dessous et s'y efface, ce qui est
         * tout l'objet de la vignette. `<main>` réserve la hauteur en padding
         * pour que le haut de page reste lisible à l'arrêt. */}
        <header className="md:hidden absolute inset-x-0 top-0 z-30 h-14 flex items-center gap-4 px-4">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
            style={{
              /* Déborde SOUS la barre: c'est ce débordement qui fait la
                 dissolution. Un voile qui s'arrête à 56 px rendrait le bord
                 qu'on vient d'enlever. */
              height: '190%',
              maskImage: 'linear-gradient(to bottom, black 34%, rgba(0,0,0,0.45) 66%, transparent 100%)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 34%, rgba(0,0,0,0.45) 66%, transparent 100%)',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backdropFilter: 'blur(22px) saturate(140%)',
                WebkitBackdropFilter: 'blur(22px) saturate(140%)',
                /* `translateZ(0)` plutôt que `will-change: backdrop-filter`:
                   Safari ne connaît pas cette valeur comme indice et gardait la
                   couche photographiée au montage, donc figée au défilement. */
                transform: 'translateZ(0)',
                /* Une teinte basse, pas une plaque: elle empêche seulement le
                   texte de la page de traverser en clair. */
                background: 'rgba(10,10,10,0.42)',
              }}
            />
          </div>

          {/* `relative` sur ce qui doit rester LISIBLE: le voile est un
              élément positionné, donc peint au-dessus du contenu en flux. Sans
              ça, la grille, le titre et l'avatar passeraient dessous. */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden relative"
            style={{ color: t.textSec }}
          >
            <LayoutDashboard className="w-5 h-5" />
          </button>

          <div className="hidden md:block relative">
            <h1 className="text-sm font-semibold" style={{ color: t.text }}>{pageTitle}</h1>
          </div>

          <div className="relative flex items-center gap-2 ml-auto">
            {topBarExtras}

            {/*
              No refresh button. It reloaded the whole application to fetch
              numbers that now arrive on their own — on a timer, when the window
              regains focus, and when the app comes back from the background.
              A button whose job is done by the app itself is a button that
              teaches people the app cannot be trusted.
            */}

            {/* L'avatar MÈNE aux réglages.
                Il était décoratif, et c'était sans conséquence tant que la
                barre du bas portait « Params ». Depuis qu'Analytique y a pris
                sa place, c'est le seul chemin vers le compte, la facturation
                et la déconnexion sur téléphone: une pastille inerte y
                laisserait le client enfermé. */}
            <Link
              to={settingsPath}
              aria-label="Compte et réglages"
              className="w-8 h-8 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              style={{ background: t.accentGrad }}
            >
              <span className="text-xs font-bold" style={{ color: '#fff' }}>{initials}</span>
            </Link>
          </div>
        </header>

        {/* `pt-[68px]`: les 56 px de l'entête, plus une respiration. C'est du
            padding et non une marge, donc le contenu défile bien SOUS le
            voile au lieu de s'arrêter à son bord. */}
        <main ref={mainRef} data-scroll-root className="flex-1 p-4 pt-[68px] md:p-8 pb-32 md:pb-8 overflow-auto">
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
  /* Le fragment ne fait pas partie du chemin.
     Une entrée peut viser un panneau (`/dashboard/receptionist#identite`), et
     `pathname` ne contient jamais le `#`: comparer les chaînes telles quelles
     rendait l'onglet inactif et la bulle disparaissait alors qu'on est bien
     dessus. */
  const activeIdx = items.findIndex(item => {
    const base = item.path.split('#')[0];
    return item.exact ? pathname === base : pathname.startsWith(base);
  });
  const itemPct = 100 / items.length;
  const showBubble = activeIdx >= 0;
  const reduceMotion = useReducedMotion();

  return (
    <div className="fixed bottom-5 left-0 right-0 z-50 flex md:hidden flex-col items-center gap-2 px-4">
      <GlassFilter />
      {/* Le filet du bord vit sur la BOITE, pas sur le verre: `GlassSkin` est
          une couche en `inset-0` a laquelle un bord serait pose sans rayon,
          donc carre autour d'une pilule ronde. */}
      <div
        className="relative w-full flex items-center py-1.5 rounded-full border"
        style={{ borderColor: DARK_GLASS.border }}
      >
        {/* Barre en verre liquide : le fond est déformé par le filtre SVG,
            pas seulement flouté, et le biseau vient de ses inset box-shadow.

            La teinte est celle de la barre du SITE sur fond sombre, au
            caractère près (demande utilisateur): les deux barres sont le même
            objet et n'ont aucune raison d'avoir deux recettes. Celle d'ici
            partait d'un gris bleuté dense, exactement l'erreur déjà corrigée
            sur le site, où la barre se lisait comme une plaque grise posée sur
            du noir. Le filet du bord vient de la même source. */}
        <GlassSkin
          onDark
          radius={9999}
          tint={DARK_GLASS.tint}
          tintFallback={DARK_GLASS.tintFallback}
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
