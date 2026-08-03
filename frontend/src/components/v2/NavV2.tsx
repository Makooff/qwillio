import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowRight, Building2, ChevronDown, Handshake, Headphones, HelpCircle,
  Mail, Menu, Newspaper, Sparkles, Tag, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import QwillioLogo from '../QwillioLogo';
import LangToggle from '../LangToggle';
import { useLang } from '../../stores/langStore';
import { EASE_OUT_EXPO } from './motion/reducedMotion';
import { useGlow } from './motion/GlowCard';

/* Nav V2: barre typographique crème qui se condense au scroll (64 vers 52px)
   et laisse alors apparaître un fond translucide plus un hairline.

   Exception glassmorphism assumée et bornée: le `backdrop-blur` n'existe QUE
   sur le chrome de nav une fois scrollé, là où du contenu passe dessous. Au
   repos la barre est totalement transparente, donc aucun filtre à composer.
   Le ban glassmorphism reste entier partout ailleurs (DA/v2-direction.md).

   CTA unique: pilule encre « Essayer » vers /register. */

interface PanelLink {
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
}

type PanelKey = 'product' | 'company';
type HoverKey = PanelKey | 'pricing';

/* Ressort raide: la pilule de survol rattrape le curseur sans traîner */
const PILL_SPRING = { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.6 };

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
  onOpen: () => void;
  onClose: () => void;
  onHover: () => void;
}

function NavPanel({ label, links, aside, open, hovered, onOpen, onClose, onHover }: NavPanelProps) {
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
    return () => window.removeEventListener('resize', measure);
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
          className="absolute inset-0 rounded-full bg-q2-band"
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
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-q2-graphite hover:text-q2-ink transition-colors duration-150 focus:outline-none focus-visible:text-q2-ink"
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
  const [scrolled, setScrolled] = useState(false);
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
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const mobileGroups = [
    { label: isFr ? 'Produit' : 'Product', links: product },
    { label: isFr ? 'Société' : 'Company', links: company },
  ];

  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:bg-q2-ink focus:text-white focus:px-4 focus:py-2 focus:rounded-full text-sm"
      >
        {isFr ? 'Aller au contenu' : 'Skip to content'}
      </a>

      <header
        id="q2-nav-header"
        className={`fixed top-0 inset-x-0 z-50 border-b transition-colors duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          menuOpen
            ? 'bg-q2-canvas border-transparent'
            : scrolled
              ? 'bg-q2-canvas/95 backdrop-blur-xl border-q2-plate'
              : 'bg-transparent border-transparent'
        }`}
      >
        <nav
          aria-label={isFr ? 'Navigation principale' : 'Main navigation'}
          className={`max-w-[1200px] mx-auto px-6 lg:px-10 flex items-center justify-between gap-6 transition-[height] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
            scrolled && !menuOpen ? 'h-[52px]' : 'h-16'
          }`}
        >
          <Link
            to="/"
            className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-md"
          >
            <QwillioLogo size={26} />
            <span className="text-[15px] font-semibold tracking-tight text-q2-ink">Qwillio</span>
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
                  className="absolute inset-0 rounded-full bg-q2-band"
                  style={{ zIndex: -1 }}
                  transition={reduced ? { duration: 0 } : PILL_SPRING}
                />
              )}
              <Link
                to="/pricing"
                className="block px-3 py-1.5 text-sm text-q2-graphite hover:text-q2-ink transition-colors duration-150"
              >
                {isFr ? 'Tarifs' : 'Pricing'}
              </Link>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <LangToggle />
            <Link
              to="/login"
              className="text-sm text-q2-graphite hover:text-q2-ink transition-colors duration-150 px-2"
            >
              {isFr ? 'Connexion' : 'Log in'}
            </Link>
            <Link
              to="/register"
              className="q2-pill inline-flex items-center rounded-full bg-q2-ink text-white text-sm font-medium px-5 py-2 hover:bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 focus-visible:ring-offset-2"
            >
              {isFr ? 'Essayer' : 'Try it'}
            </Link>
          </div>

          <button
            ref={burgerRef}
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={menuOpen ? (isFr ? 'Fermer le menu' : 'Close menu') : isFr ? 'Ouvrir le menu' : 'Open menu'}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-full text-q2-ink hover:bg-q2-band transition-colors duration-150"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            ref={mobileRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reduced ? { duration: 0 } : { duration: 0.2, ease: EASE_OUT_EXPO }}
            className="fixed inset-0 z-40 bg-q2-canvas md:hidden pt-20 px-6 overflow-y-auto"
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

            <motion.div
              className="flex items-center gap-3 mt-10 pb-12"
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduced ? { duration: 0 } : { duration: 0.42, ease: EASE_OUT_EXPO, delay: 0.44 }
              }
            >
              <Link
                to="/register"
                className="q2-pill flex-1 inline-flex items-center justify-center rounded-full bg-q2-ink text-white text-[15px] font-medium px-6 py-3.5"
              >
                {isFr ? 'Essayer' : 'Try it'}
              </Link>
              <Link
                to="/login"
                className="q2-pill flex-1 inline-flex items-center justify-center rounded-full border border-q2-plate text-q2-ink text-[15px] font-medium px-6 py-3.5"
              >
                {isFr ? 'Connexion' : 'Log in'}
              </Link>
              <LangToggle />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
