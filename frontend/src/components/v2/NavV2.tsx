import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Building2, ChevronDown, Handshake, Headphones, HelpCircle,
  Mail, Menu, Newspaper, Play, Sparkles, Tag, X,
} from '../icons';
import type { LucideIcon } from '../icons';
import QwillioLogo from '../QwillioLogo';
import LangToggle from '../LangToggle';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../../stores/themeStore';
import { useLang } from '../../stores/langStore';
import { EASE_OUT_EXPO } from './motion/reducedMotion';
import { useGlow } from './motion/GlowCard';
import GlassSkin, { GLASS_FILTER_ID, GlassFilter, useLiquidGlassSupport } from './ui/liquid-glass';
import TryVoiceButton from './TryVoiceButton';

/* Nav V2 (demande utilisateur, deux états) :
   - AU REPOS (haut de page) : aucune surface blanche sous le logo/menu.
     À la place, un voile de flou progressif permanent sur la bande d'entête :
     très flou tout en haut, de moins en moins flou en descendant (backdrop
     blur masqué par un dégradé vertical qui se prolonge sous la barre).
   - AU SCROLL (hystérésis 80/40px) : la barre se détache en BULLE flottante
     compacte (ressort framer réversible), et le fond de la bulle est
     TRANSPARENT FLOU (verre : backdrop-blur + teinte crème très légère),
     plus jamais blanc. Le voile de repos s'efface pendant que la bulle vit.
   - AU-DESSUS D'UNE SECTION SOMBRE : la teinte crème et le filet clair
     dessinaient un anneau blanc sur le drenched. Le verre passe alors en
     sombre. Les sections concernées se signalent déjà elles-mêmes par
     `data-register="drenched"` (Primitives.tsx), il suffit de regarder si l'une
     d'elles croise la bande de l'entête.

   Exception glassmorphism assumée et bornée: le `backdrop-blur` n'existe QUE
   sur ce chrome de nav. Le ban reste entier partout ailleurs
   (DA/v2-direction.md).

   Aucun décalage de mise en page: l'en-tête est `fixed`, PublicShell réserve
   déjà les 64px de haut.

   CTA unique: pilule encre « Essayer » vers /register. */

interface PanelLink {
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  /* Annoncé, pas encore ouvert. L'entrée reste visible pour dire qu'il existe,
     mais elle ne mène nulle part: aucune page Agent n'est publique. */
  soon?: boolean;
}

type PanelKey = 'product' | 'company';
type HoverKey = PanelKey | 'pricing';

/* Ressort raide: la pilule de survol rattrape le curseur sans traîner */
const PILL_SPRING = { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.6 };

/* Ressort du détachement: plus souple, il porte une masse plus grande */
const DETACH_SPRING = { type: 'spring' as const, stiffness: 260, damping: 30, mass: 0.9 };

/* Seuils du détachement, en pixels de scroll (hystérésis) */
const DETACH_AT = 80;
const REATTACH_AT = 40;

const PANEL_MAX = 760;

/* Le panneau s'aligne sur son trigger, et ne recule que s'il allait dépasser
   la gouttière droite du conteneur. L'origine de la transformation reste le
   centre du trigger dans tous les cas: l'ouverture part toujours de lui. */
function measurePanel(button: HTMLElement) {
  const nav = button.closest('nav');
  if (!nav) return null;
  const navBox = nav.getBoundingClientRect();
  const style = getComputedStyle(nav);
  const contentLeft = navBox.left + parseFloat(style.paddingLeft);
  const contentRight = navBox.right - parseFloat(style.paddingRight);
  const width = Math.min(PANEL_MAX, window.innerWidth - 48);
  const btn = button.getBoundingClientRect();
  const left = Math.max(contentLeft, Math.min(btn.left, contentRight - width));
  return { dx: left - btn.left, origin: btn.left + btn.width / 2 - left };
}

function PanelItem({ link, onNavigate }: { link: PanelLink; onNavigate: () => void }) {
  const Icon = link.icon;

  /* Un item « bientôt » n'est PAS un lien désactivé: c'est du texte. Un lien
     mort qui garde son curseur et sa flèche promet une page qui n'existe
     pas. */
  if (link.soon) {
    return (
      <div className="flex items-start gap-3 rounded-2xl px-3 py-3">
        <span className="mt-0.5 w-8 h-8 shrink-0 rounded-full bg-q2-band border border-q2-plate flex items-center justify-center">
          <Icon size={15} className="text-q2-faint" aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-[14px] text-q2-body">
            {link.label}
            <span className="rounded-full bg-q2-band px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-q2-faint">
              Bientôt
            </span>
          </span>
          <span className="block mt-0.5 text-[12px] leading-snug text-q2-faint q2-body-text">
            {link.desc}
          </span>
        </span>
      </div>
    );
  }

  return (
    <Link
      to={link.to}
      onClick={onNavigate}
      className="group flex items-start gap-3 rounded-2xl px-3 py-3 hover:bg-q2-band focus:outline-none focus-visible:bg-q2-band transition-colors duration-150"
    >
      <span className="mt-0.5 w-8 h-8 shrink-0 rounded-full bg-q2-band border border-q2-plate flex items-center justify-center group-hover:bg-q2-canvas transition-colors duration-150">
        <Icon size={15} className="text-q2-indigo" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 text-[14px] text-q2-ink">
          {link.label}
          <ArrowRight
            size={12}
            aria-hidden="true"
            className="text-q2-faint transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5"
          />
        </span>
        <span className="block mt-0.5 text-[12px] leading-snug text-q2-body q2-body-text">
          {link.desc}
        </span>
      </span>
    </Link>
  );
}

interface NavPanelProps {
  label: string;
  links: PanelLink[];
  aside: ReactNode;
  open: boolean;
  hovered: boolean;
  onDark: boolean;
  onOpen: () => void;
  onClose: () => void;
  onHover: () => void;
}

function NavPanel({ label, links, aside, open, hovered, onDark, onOpen, onClose, onHover }: NavPanelProps) {
  const id = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const [geo, setGeo] = useState<{ dx: number; origin: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const btn = buttonRef.current;
      if (btn) setGeo(measurePanel(btn));
    };
    measure();
    window.addEventListener('resize', measure);
    /* La barre change de largeur au scroll: un panneau ouvert doit suivre
       son trigger plutôt que de rester ancré à l'ancienne géométrie */
    window.addEventListener('scroll', measure, { passive: true });
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      onClose();
      buttonRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className="relative" onPointerEnter={onHover}>
      {hovered && (
        <motion.span
          layoutId="q2-nav-pill"
          aria-hidden="true"
          className={`absolute inset-0 rounded-full ${onDark ? 'bg-white/10' : 'bg-q2-band'}`}
          style={{ zIndex: -1 }}
          transition={reduced ? { duration: 0 } : PILL_SPRING}
        />
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (open ? onClose() : onOpen())}
        onPointerEnter={onOpen}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={id}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors duration-150 focus:outline-none ${
          onDark
            ? 'text-white/75 hover:text-white focus-visible:text-white'
            : 'text-q2-graphite hover:text-q2-ink focus-visible:text-q2-ink'
        }`}
      >
        {label}
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={`transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={id}
            key="panel"
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -4 }}
            transition={reduced ? { duration: 0 } : { duration: 0.18, ease: EASE_OUT_EXPO }}
            /* Ouverture depuis l'origine du trigger, jamais depuis le centre */
            style={{
              left: geo ? geo.dx : 0,
              transformOrigin: `${geo ? geo.origin : 0}px top`,
              boxShadow: 'var(--q2-shadow-hover)',
            }}
            className="absolute top-full mt-2.5 z-50 w-[min(760px,calc(100vw-3rem))] rounded-[22px] border border-q2-plate bg-q2-canvas p-2.5"
          >
            <div className="grid sm:grid-cols-[1fr_228px] gap-2.5">
              <div className="grid sm:grid-cols-2 gap-1">
                {links.map((link) => (
                  <PanelItem key={link.to} link={link} onNavigate={onClose} />
                ))}
              </div>
              {aside}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function NavV2() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  /* Le thème est une dépendance de l'écouteur ci-dessous: sans lui, basculer
     clair/sombre ne repeindrait la barre qu'au premier scroll suivant. */
  const { theme } = useTheme();
  const [detached, setDetached] = useState(false);
  const [overDark, setOverDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<PanelKey | null>(null);
  const [hovered, setHovered] = useState<HoverKey | null>(null);
  const savedScrollY = useRef(0);
  const closeTimer = useRef<number | null>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const burgerRef = useRef<HTMLButtonElement>(null);
  const asideRef = useGlow<HTMLDivElement>();
  const location = useLocation();
  const reduced = useReducedMotion();

  useEffect(() => {
    setMenuOpen(false);
    setOpenPanel(null);
  }, [location.pathname]);

  useEffect(() => {
    /* Hauteur de la bande occupée par l'entête, bulle flottante comprise */
    const BAND = 72;
    const onScroll = () => {
      const y = window.scrollY;
      setDetached((was) => (was ? y > REATTACH_AT : y > DETACH_AT));
      /* Les sections sombres se signalent par `data-register="drenched"`
         (Primitives.tsx), mais elles ne sont pas les seules surfaces noires :
         la fenêtre du hero porte une capture de dashboard sombre et laissait
         la barre en version claire, texte foncé sur fond noir. Toute surface
         qui veut ce basculement se marque donc `data-nav-dark`. */
      /* En thème sombre, TOUTE la page est sombre: la barre doit être en
         version sombre partout, pas seulement au-dessus d'une section
         drenched. Sans ça elle restait en verre clair sur un fond noir, d'où
         la plaque grise. */
      const themeDark =
        document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.hasAttribute('data-theme') &&
          typeof matchMedia !== 'undefined' &&
          matchMedia('(prefers-color-scheme: dark)').matches);

      const dark =
        themeDark ||
        Array.from(
          document.querySelectorAll('[data-register="drenched"],[data-nav-dark]'),
        ).some((el) => {
          const r = el.getBoundingClientRect();
          return r.top < BAND && r.bottom > 0;
        });
      setOverDark(dark);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [theme]);

  /* Fermeture des panneaux au clic extérieur */
  useEffect(() => {
    if (openPanel === null) return;
    const onDown = (e: MouseEvent) => {
      const header = document.getElementById('q2-nav-header');
      if (header && !header.contains(e.target as Node)) setOpenPanel(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [openPanel]);

  useEffect(
    () => () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    },
    [],
  );

  const cancelClose = useCallback(() => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  /* Le trajet du trigger vers le panneau traverse une gouttière de 10px:
     un léger différé évite qu'il se ferme sous le curseur. */
  const scheduleClose = useCallback(() => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => {
      setOpenPanel(null);
      setHovered(null);
    }, 140);
  }, [cancelClose]);

  const openNow = useCallback(
    (key: PanelKey) => {
      cancelClose();
      setOpenPanel(key);
      setHovered(key);
    },
    [cancelClose],
  );

  const closePanel = useCallback(() => setOpenPanel(null), []);

  /* Scroll-lock iOS-safe repris du pattern V1 (position:fixed + restauration) */
  useEffect(() => {
    if (menuOpen) {
      savedScrollY.current = window.scrollY;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${savedScrollY.current}px`;
      document.body.style.width = '100%';
    } else {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, savedScrollY.current);
    }
    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
    };
  }, [menuOpen]);

  /* Piège à focus du menu plein écran. Le bouton de fermeture vit dans
     l'en-tête, au-dessus du panneau: on l'ajoute au cycle à la main. */
  useEffect(() => {
    if (!menuOpen) return;
    const node = mobileRef.current;
    if (!node) return;
    const SEL = 'a[href], button:not([disabled])';
    const list = () => {
      const items = Array.from(node.querySelectorAll<HTMLElement>(SEL));
      return burgerRef.current ? [burgerRef.current, ...items] : items;
    };
    list()[1]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        burgerRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = list();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const product: PanelLink[] = [
    {
      to: '/receptionist',
      label: 'Receptionist AI',
      icon: Headphones,
      desc: isFr
        ? 'Elle décroche 24/7, vérifie l’agenda et inscrit le rendez-vous.'
        : 'She answers 24/7, checks the calendar and books the appointment.',
    },
    {
      to: '/agent',
      label: 'Qwillio Agent',
      icon: Sparkles,
      soon: true,
      desc: isFr
        ? 'Email, facturation, inventaire et paiements greffés à l’accueil.'
        : 'Email, billing, inventory and payments bolted onto the front desk.',
    },
    {
      to: '/pricing',
      label: isFr ? 'Tarifs' : 'Pricing',
      icon: Tag,
      desc: isFr ? 'À partir de 99 € par mois, 7 jours d’essai.' : 'From €99 a month, 7-day trial.',
    },
    {
      to: '/faq',
      label: 'FAQ',
      icon: HelpCircle,
      desc: isFr
        ? 'Les réponses aux questions qu’on nous pose vraiment.'
        : 'Answers to the questions we actually get.',
    },
  ];

  const company: PanelLink[] = [
    {
      to: '/about',
      label: isFr ? 'À propos' : 'About',
      icon: Building2,
      desc: isFr ? 'Qui construit Qwillio, et depuis où.' : 'Who builds Qwillio, and from where.',
    },
    {
      to: '/blog',
      label: 'Blog',
      icon: Newspaper,
      desc: isFr
        ? 'Ce qu’on apprend en faisant décrocher une IA.'
        : 'What we learn making an AI answer the phone.',
    },
    {
      to: '/contact',
      label: 'Contact',
      icon: Mail,
      desc: isFr ? 'Une question, une démo, un devis.' : 'A question, a demo, a quote.',
    },
    {
      to: '/affiliate',
      label: isFr ? 'Affiliation' : 'Affiliate',
      icon: Handshake,
      desc: isFr
        ? 'Recommandez Qwillio, touchez une commission récurrente.'
        : 'Refer Qwillio, earn a recurring commission.',
    },
  ];

  /* Aperçu: une vraie capture du dashboard, pas une illustration */
  const productAside = (
    <div ref={asideRef} className="q2-glow hidden sm:flex flex-col rounded-2xl bg-q2-band p-3">
      <div className="rounded-xl overflow-hidden border border-q2-graphite-d bg-q2-carbon">
        <img
          src="/screens/appels.webp"
          alt=""
          loading="lazy"
          width={1600}
          height={930}
          className="w-full block aspect-[16/9] object-cover object-top"
        />
      </div>
      <p className="q2-eyebrow text-q2-graphite mt-3">{isFr ? 'Appels' : 'Calls'}</p>
      <p className="mt-1 text-[12px] leading-snug text-q2-body q2-body-text">
        {isFr
          ? 'Chaque appel arrive ici, avec son issue, sa durée et son transcript.'
          : 'Every call lands here, with its outcome, duration and transcript.'}
      </p>
    </div>
  );

  const companyAside = (
    <div className="hidden sm:flex flex-col justify-between rounded-2xl bg-q2-band p-4">
      <div>
        <p className="q2-eyebrow text-q2-indigo">Qwillio</p>
        <p className="mt-2 text-[12px] leading-snug text-q2-body q2-body-text">
          {isFr
            ? 'Construit à Bruxelles. Chaque premier client est accompagné personnellement.'
            : 'Built in Brussels. Every first customer is onboarded personally.'}
        </p>
      </div>
      <Link
        to="/partenaires-fiduciaires"
        onClick={closePanel}
        className="group mt-4 inline-flex items-center gap-1.5 text-[12px] text-q2-ink"
      >
        {isFr ? 'Partenaires fiduciaires' : 'Accounting partners'}
        <ArrowRight
          size={11}
          aria-hidden="true"
          className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5"
        />
      </Link>
    </div>
  );

  /* Le menu mobile plein écran reprend toute la largeur: la pilule se
     rattache le temps de son ouverture */
  const floating = detached && !menuOpen;

  /* Menu ouvert, la barre n'est plus posee sur la page mais sur le voile en
     `q2-canvas`. Garder `overDark` y peindrait la croix et le logo en blanc
     par-dessus la creme, en theme clair, au-dessus d'une section sombre. La
     branche claire est juste dans les DEUX themes, puisque `q2-ink` bascule. */
  const chromeDark = overDark && !menuOpen;

  const mobileGroups = [
    { label: isFr ? 'Produit' : 'Product', links: product },
    { label: isFr ? 'Société' : 'Company', links: company },
  ];

  /* Le verre liquide n'existe que là où le navigateur accepte un filtre SVG
     en backdrop. Ailleurs (WebKit), on retombe sur un flou classique et une
     teinte plus dense, pour que la barre reste non traversable. */
  const liquid = useLiquidGlassSupport();
  const restVeil = liquid
    ? `url("#${GLASS_FILTER_ID}")`
    : 'blur(30px) saturate(1.5)';

  return (
    <>
      <GlassFilter />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-q2-ink focus:text-q2-canvas focus:px-4 focus:py-2 focus:rounded-full text-sm"
      >
        {isFr ? 'Aller au contenu' : 'Skip to content'}
      </a>

      <motion.header
        id="q2-nav-header"
        className={`fixed top-0 inset-x-0 z-50 ${menuOpen ? 'bg-q2-canvas' : ''}`}
        animate={{
          paddingTop: floating ? 10 : 0,
          paddingLeft: floating ? 12 : 0,
          paddingRight: floating ? 12 : 0,
        }}
        transition={reduced ? { duration: 0 } : DETACH_SPRING}
      >
        {/* Voile de repos : flou progressif permanent sur la bande d'entête,
            très flou en haut, qui s'estompe en descendant et déborde sous la
            barre. Aucune surface blanche : juste le contenu qui fond. */}
        {/* DEUX éléments, et c'est le fond du problème iOS.
            Le masque et le `backdrop-filter` vivaient sur la MÊME boîte. Sur
            WebKit, un `-webkit-backdrop-filter` pose sur un élément qui porte
            aussi un `-webkit-mask-image` n'est pas rendu: le voile devenait
            une teinte plate, sans flou, ce qu'on lisait comme « le flou de la
            nav ne marche pas sur iPhone ». Blink s'en accommode, d'où un bug
            invisible au développement.
            Le masque reste donc sur le parent, qui ne filtre rien, et le
            filtre descend sur un enfant qui ne masque rien. Le rendu est le
            même partout, le dégradé du bord est conservé. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden"
          style={{
            height: '160%',
            opacity: floating || menuOpen ? 0 : 1,
            transition: 'opacity 320ms cubic-bezier(0.16, 1, 0.3, 1)',
            /* Le masque évite le bord franc sous l'entête. La COULEUR, elle,
               ne se dégrade pas (demande utilisateur) : teinte unie, c'est le
               verre qui travaille. */
            maskImage: 'linear-gradient(to bottom, black 30%, rgba(0,0,0,0.55) 62%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to bottom, black 30%, rgba(0,0,0,0.55) 62%, transparent 100%)',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backdropFilter: restVeil,
              WebkitBackdropFilter: restVeil,
              /* `translateZ(0)` plutôt que `will-change: backdrop-filter`:
                 Safari ne connaît pas cette valeur comme indice et la couche
                 restait photographiée au montage, donc figée au défilement. */
              transform: 'translateZ(0)',
              background: liquid
                ? (overDark ? 'rgba(8, 9, 10, 0.12)' : 'rgb(var(--q2-canvas) / 0.12)')
                : (overDark ? 'rgba(8, 9, 10, 0.58)' : 'rgb(var(--q2-canvas) / 0.56)'),
            }}
          />
        </div>
        <motion.nav
          aria-label={isFr ? 'Navigation principale' : 'Main navigation'}
          animate={{
            maxWidth: floating ? 880 : 1200,
            height: floating ? 52 : 64,
            borderRadius: floating ? 999 : 0,
          }}
          transition={reduced ? { duration: 0 } : DETACH_SPRING}
          /* Bulle en verre : la géométrie vient du ressort framer, la peau
             (teinte, bord, ombre) glisse en CSS. Fond transparent flouté,
             jamais blanc. Même matière que le dock iOS et que la pilule basse
             du dashboard : flou large et saturé, voile de 14 à 22 %, filet
             lumineux en haut du verre. */
          style={{
            transition: 'border-color 260ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className={`relative mx-auto px-6 lg:px-10 flex items-center justify-between gap-6 border ${
            floating
              ? overDark
                ? 'border-white/10'
                : 'border-white/40'
              : 'border-transparent'
          }`}
        >
          {/* Peau de verre liquide : le fond derrière la bulle est déformé par
              le filtre SVG, pas seulement flouté, et le biseau vient des
              inset box-shadow du composant d'origine. Aucun dégradé. */}
          {floating && (
            <GlassSkin
              onDark={overDark}
              radius={999}
              /* Dégradé conservé ici (décision utilisateur) : seule l'entête au
                 repos s'en passe. Teintes basses, le verre fait le reste. */
              /* Teintes abaissées (retour utilisateur : la bulle était grise et
                 pas assez transparente). Le verre garde sa matière par le flou,
                 la couleur ne fait plus que l'adoucir. */
              /* Sur fond sombre la teinte partait du GRIS (24,26,30 à 48 %),
                 et la barre se lisait comme une plaque grise posée sur du noir
                 (retour utilisateur). Elle part maintenant du noir de la
                 marque et reste basse: c'est le flou qui donne la matière. */
              tint={
                overDark
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(8,9,10,0.10) 100%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.04) 100%)'
              }
              tintFallback={
                overDark
                  ? 'linear-gradient(180deg, rgba(8,9,10,0.42) 0%, rgba(8,9,10,0.52) 100%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.52) 0%, rgb(var(--q2-canvas) / 0.40) 100%)'
              }
              style={{ zIndex: -1 }}
            />
          )}
          <Link
            to="/"
            className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-md"
          >
            <QwillioLogo size={26} />
            <span className={`text-[15px] font-semibold tracking-tight transition-colors duration-200 ${chromeDark ? 'text-white' : 'text-q2-ink'}`}>Qwillio</span>
          </Link>

          <div
            className="hidden md:flex items-center gap-1"
            onPointerEnter={cancelClose}
            onPointerLeave={scheduleClose}
          >
            <NavPanel
              label={isFr ? 'Produit' : 'Product'}
              links={product}
              aside={productAside}
              open={openPanel === 'product'}
              hovered={hovered === 'product'}
              onDark={overDark}
              onOpen={() => openNow('product')}
              onClose={closePanel}
              onHover={() => setHovered('product')}
            />
            <NavPanel
              label={isFr ? 'Société' : 'Company'}
              links={company}
              aside={companyAside}
              open={openPanel === 'company'}
              hovered={hovered === 'company'}
              onDark={overDark}
              onOpen={() => openNow('company')}
              onClose={closePanel}
              onHover={() => setHovered('company')}
            />
            <div
              className="relative"
              onPointerEnter={() => {
                setHovered('pricing');
                setOpenPanel(null);
              }}
            >
              {hovered === 'pricing' && (
                <motion.span
                  layoutId="q2-nav-pill"
                  aria-hidden="true"
                  className={`absolute inset-0 rounded-full ${overDark ? 'bg-white/10' : 'bg-q2-band'}`}
                  style={{ zIndex: -1 }}
                  transition={reduced ? { duration: 0 } : PILL_SPRING}
                />
              )}
              <Link
                to="/pricing"
                className={`block px-3 py-1.5 text-sm transition-colors duration-150 ${
                  overDark ? 'text-white/75 hover:text-white' : 'text-q2-graphite hover:text-q2-ink'
                }`}
              >
                {isFr ? 'Tarifs' : 'Pricing'}
              </Link>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <ThemeToggle onDark={overDark} />
            <LangToggle onDark={overDark} />
            <Link
              to="/login"
              className={`text-sm transition-colors duration-150 px-2 ${
                overDark ? 'text-white/75 hover:text-white' : 'text-q2-graphite hover:text-q2-ink'
              }`}
            >
              {isFr ? 'Connexion' : 'Log in'}
            </Link>
            <Link
              to="/register"
              /* Sur fond sombre la pilule encre disparaîtrait : elle s'inverse */
              className={`q2-pill inline-flex items-center rounded-full text-sm font-medium px-5 py-2 transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 focus-visible:ring-offset-2 ${
                overDark ? 'bg-white text-q2-ink hover:bg-white/90' : 'bg-q2-ink text-q2-canvas hover:opacity-90'
              }`}
            >
              {isFr ? 'Essayer' : 'Try it'}
            </Link>
          </div>

          {/* L'essai, sur mobile: l'icone seule sur un rond, a cote du burger.
              Son fond s'agrandit jusqu'a devenir celui de la carte. Il etait
              absent de la barre mobile, ou il ne restait que le burger: la
              seule action de la page d'accueil y etait donc invisible.

              Essai et burger sont dans UN groupe: la barre est en
              `justify-between`, donc deux enfants separes se seraient repartis
              sur la largeur et l'icone aurait flotte au milieu de la bande. */}
          {/* Gouttiere du glyphe, pas de la boite.
              Les boutons font 44 px pour le doigt, le glyphe n'en fait que 20:
              a `px-6`, le trait du burger tombait donc a 36 px du bord quand le
              logo touche a 24. `-mr-3` rend les 12 px de marge interne, et
              `gap-3` pose les memes 24 px entre le rond de l'essai et le trait
              du burger. Ce qu'on aligne, c'est ce qu'on voit. */}
          <div className="md:hidden flex items-center gap-3 -mr-3">
            {/* Menu ouvert, la langue et le theme prennent la place de l'essai,
                a cote de la croix (demande utilisateur). Ils vivaient en bas de
                la liste, la ou personne ne descend pour changer de langue, et
                l'essai n'a rien a faire ici puisque la barre d'actions en bas
                le propose deja en grand. */}
            {menuOpen ? (
              <>
                <ThemeToggle onDark={chromeDark} />
                <LangToggle onDark={chromeDark} />
              </>
            ) : (
              <TryVoiceButton
                shape="round"
                variant={overDark ? 'onDark' : 'outline'}
                /* Le fond suit la barre: rien en haut de page, blanc des que la
                   pilule se detache. */
                showSurface={floating}
                label={isFr ? 'Essayer la voix' : 'Try the voice'}
              >
                <Play size={15} fill="currentColor" aria-hidden="true" />
              </TryVoiceButton>
            )}

            <button
              ref={burgerRef}
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={menuOpen ? (isFr ? 'Fermer le menu' : 'Close menu') : isFr ? 'Ouvrir le menu' : 'Open menu'}
              className={`inline-flex items-center justify-center w-11 h-11 rounded-full transition-colors duration-150 ${
                chromeDark ? 'text-white hover:bg-white/10' : 'text-q2-ink hover:bg-q2-band'
              }`}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </motion.nav>
      </motion.header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            ref={mobileRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT_EXPO }}
            /* La barre d'actions est posee par-dessus, en `fixed`: le contenu
               doit donc pouvoir defiler jusque SOUS elle, d'ou la reserve en
               bas. Sans elle le dernier lien reste inatteignable, cache
               derriere les pilules. */
            className="fixed inset-0 z-40 bg-q2-canvas md:hidden pt-20 px-6 overflow-y-auto pb-[136px]"
          >
            <nav aria-label={isFr ? 'Menu mobile' : 'Mobile menu'} className="flex flex-col pb-4">
              {mobileGroups.map((group, g) => (
                <div key={group.label} className={g > 0 ? 'mt-9' : ''}>
                  <motion.p
                    className="q2-eyebrow text-q2-faint mb-1"
                    initial={reduced ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { duration: 0.42, ease: EASE_OUT_EXPO, delay: 0.04 + g * 0.2 }
                    }
                  >
                    {group.label}
                  </motion.p>
                  {group.links.map((link, i) => (
                    <motion.div
                      key={link.to}
                      initial={reduced ? false : { opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={
                        reduced
                          ? { duration: 0 }
                          : { duration: 0.42, ease: EASE_OUT_EXPO, delay: 0.08 + g * 0.2 + i * 0.04 }
                      }
                    >
                      <Link
                        to={link.to}
                        className={`block py-3.5 text-[28px] font-light tracking-tight text-q2-ink ${
                          i > 0 ? 'border-t border-q2-plate' : ''
                        }`}
                      >
                        {link.label}
                      </Link>
                    </motion.div>
                  ))}
                </div>
              ))}
            </nav>

            {/* Les deux actions restent SOUS LE POUCE, posees par-dessus la
                liste (demande utilisateur).
                Elles etaient en fin de liste: sur un menu qui defile, il
                fallait descendre jusqu'au bout pour s'inscrire ou se
                connecter, c'est-a-dire cacher la seule chose qu'on veut voir.
                Elles occupent maintenant toute la largeur, a parts egales, et
                le contenu passe DERRIERE: le degrade vers le bas dit qu'il y a
                encore quelque chose dessous, sans poser une barre opaque qui
                couperait la page en deux. */}
            <motion.div
              className="fixed inset-x-0 bottom-0 z-10 px-6 pt-10 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduced ? { duration: 0 } : { duration: 0.42, ease: EASE_OUT_EXPO, delay: 0.44 }
              }
            >
              {/* Le flou et le fond sont sur une couche a part, masquee en
                  degrade: le poser sur le conteneur flouterait aussi les
                  pilules, qui sont ses enfants. */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  backdropFilter: 'blur(18px) saturate(150%)',
                  WebkitBackdropFilter: 'blur(18px) saturate(150%)',
                  transform: 'translateZ(0)',
                  background:
                    'linear-gradient(to bottom, rgb(var(--q2-canvas) / 0) 0%, rgb(var(--q2-canvas) / 0.72) 38%, rgb(var(--q2-canvas) / 0.94) 100%)',
                  maskImage: 'linear-gradient(to bottom, transparent 0%, black 34%)',
                  WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 34%)',
                }}
              />
              <div className="relative mx-auto flex w-full max-w-[420px] items-center gap-3">
                <Link
                  to="/register"
                  onClick={() => setMenuOpen(false)}
                  className="q2-pill flex-1 inline-flex items-center justify-center rounded-full bg-q2-ink text-q2-canvas text-[16px] font-medium px-6 py-4"
                >
                  {isFr ? 'Essayer' : 'Try it'}
                </Link>
                <Link
                  to="/login"
                  onClick={() => setMenuOpen(false)}
                  className="q2-pill flex-1 inline-flex items-center justify-center rounded-full border border-q2-plate bg-q2-canvas text-q2-ink text-[16px] font-medium px-6 py-4"
                >
                  {isFr ? 'Connexion' : 'Log in'}
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
