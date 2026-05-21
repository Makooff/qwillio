import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Play, ChevronDown, Phone, Bot, Building2, BookOpen,
  Mail as MailIcon, DollarSign,
  type LucideIcon,
} from 'lucide-react';
import QwillioLogo from './QwillioLogo';
import LangToggle from './LangToggle';
import { useLang } from '../stores/langStore';

interface MenuItem {
  to: string;
  icon: LucideIcon;
  label: string;
  desc: string;
}

function Dropdown({ label, items }: { label: string; items: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="true"
        aria-expanded={open}
        className="flex items-center gap-[5px] text-[#1d1d1f]/60 hover:text-[#1d1d1f] transition-colors duration-150 focus:outline-none focus-visible:text-[#1d1d1f]"
      >
        {label}
        <ChevronDown
          size={12}
          className={`mt-px transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute top-full left-0 mt-2 z-50 overflow-hidden"
          style={{
            minWidth: 172,
            background: '#fff',
            borderRadius: 12,
            border: '1px solid rgba(0,0,0,0.08)',
            boxShadow: '0 4px 24px rgba(0,0,0,0.09), 0 1px 4px rgba(0,0,0,0.06)',
          }}
        >
          <div style={{ height: 2, background: '#6366f1' }} aria-hidden="true" />
          <div className="py-1.5">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                role="menuitem"
                onClick={() => setOpen(false)}
                className="block px-5 py-2.5 text-[13.5px] font-medium text-[#1d1d1f] hover:text-[#6366f1] hover:bg-[#f5f5f7] focus:bg-[#f5f5f7] focus:text-[#6366f1] focus:outline-none transition-colors duration-100"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PublicNavbar() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [scrollY, setScrollY] = useState(0);
  const [bubblesVisible, setBubblesVisible] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const savedScrollY = useRef(0);
  const location = useLocation();

  useEffect(() => { closeMenu(); }, [location.pathname]);

  useEffect(() => {
    const fn = () => {
      const y = window.scrollY;
      setScrollY(y);
      setBubblesVisible((prev) => {
        if (!prev && y > 55) return true;
        if (prev && y < 25) return false;
        return prev;
      });
    };
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const textOpacity = Math.max(0, 1 - scrollY / 28);

  // iOS-safe scroll lock: position:fixed keeps body from scrolling behind menu
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

  // ESC closes mobile menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && menuOpen) closeMenu(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const openMenu = () => {
    setMenuOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setMenuVisible(true)));
  };
  const closeMenu = () => {
    setMenuVisible(false);
    setTimeout(() => setMenuOpen(false), 220);
  };
  const toggle = () => (menuOpen ? closeMenu() : openMenu());

  const productItems: MenuItem[] = [
    { to: '/receptionist', icon: Phone, label: 'Receptionist AI', desc: isFr ? 'Votre standardiste IA 24/7' : 'Your 24/7 AI receptionist' },
    { to: '/agent', icon: Bot, label: 'Qwillio Agent', desc: isFr ? 'Modules IA avancés' : 'Advanced AI modules' },
  ];
  const companyItems: MenuItem[] = [
    { to: '/about', icon: Building2, label: isFr ? 'À propos' : 'About', desc: isFr ? 'Notre mission et notre vision' : 'Our mission and vision' },
    { to: '/blog', icon: BookOpen, label: 'Blog', desc: isFr ? 'Articles et actualités' : 'Articles and news' },
    { to: '/contact', icon: MailIcon, label: 'Contact', desc: isFr ? 'Nous contacter' : 'Get in touch' },
    { to: '/affiliate', icon: DollarSign, label: isFr ? 'Affiliation' : 'Affiliate', desc: isFr ? 'Gagnez en nous recommandant' : 'Earn by referring us' },
  ];

  const mobileLinks = [
    { to: '/',             label: isFr ? 'Accueil' : 'Home',                wave: '35%' },
    { to: '/receptionist', label: 'Receptionist AI',                         wave: '62%' },
    { to: '/agent',        label: 'Qwillio Agent',                           wave: '48%' },
    { to: '/pricing',      label: isFr ? 'Tarifs' : 'Pricing',               wave: '28%' },
    { to: '/about',        label: isFr ? 'À propos' : 'About',               wave: '40%' },
    { to: '/blog',         label: 'Blog',                                    wave: '32%' },
    { to: '/contact',      label: 'Contact',                                 wave: '36%' },
    { to: '/affiliate',    label: isFr ? 'Affiliation' : 'Affiliate',        wave: '54%' },
  ];

  return (
    <>
      {/* Skip-to-content for a11y */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:bg-[#1d1d1f] focus:text-white focus:px-4 focus:py-2 focus:rounded-full focus:text-sm"
      >
        {isFr ? "Aller au contenu principal" : "Skip to main content"}
      </a>

      {/* ── DESKTOP NAV ────────────────────────────────────────────────── */}
      <nav
        aria-label={isFr ? 'Navigation principale' : 'Main navigation'}
        className="hidden md:block fixed top-0 left-0 right-0 z-50"
      >
        <div
          className={`absolute inset-0 -z-10 transition-colors duration-300 ${
            bubblesVisible ? 'bg-white/80 backdrop-blur-xl shadow-sm' : ''
          }`}
        />
        <div className="max-w-[1240px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1]/40 focus-visible:ring-offset-2 rounded-md">
            <QwillioLogo size={28} />
            <span className="text-xl font-semibold tracking-tight text-[#1d1d1f]">Qwillio</span>
          </Link>

          <ul className="flex items-center gap-8 text-sm text-[#1d1d1f]/70" role="list">
            <li>
              <Link to="/" className="hover:text-[#1d1d1f] transition-colors">
                {isFr ? 'Accueil' : 'Home'}
              </Link>
            </li>
            <li>
              <Dropdown label={isFr ? 'Produit' : 'Product'} items={productItems} />
            </li>
            <li>
              <Dropdown label={isFr ? 'Entreprise' : 'Company'} items={companyItems} />
            </li>
            <li>
              <Link to="/pricing" className="hover:text-[#1d1d1f] transition-colors">
                {isFr ? 'Tarifs' : 'Pricing'}
              </Link>
            </li>
          </ul>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-[#1d1d1f]/70 hover:text-[#1d1d1f] transition-colors">
              {isFr ? 'Connexion' : 'Login'}
            </Link>
            <a
              href="/demo.html"
              className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-sm font-medium pl-4 pr-5 py-2 rounded-full hover:bg-[#6366f1] transition-colors"
            >
              <Play size={13} fill="currentColor" aria-hidden="true" />
              {isFr ? 'Essayer' : 'Try it'}
            </a>
            <LangToggle />
          </div>
        </div>
      </nav>

      {/* ── MOBILE FLOATING ELEMENTS ───────────────────────────────────── */}
      <div
        className="md:hidden fixed left-0 right-0 z-[61] pointer-events-none"
        style={{ top: 'env(safe-area-inset-top)' }}
      >
        <div className="relative h-14">

          {/* LEFT: QW logo bubble + Qwillio text */}
          <div className="absolute left-4 top-0 bottom-0 flex items-center gap-2 pointer-events-auto">
            <div className="relative w-11 h-11 flex-shrink-0">
              <span
                className={`absolute inset-0 rounded-full transition-[width] duration-500 ease-out ease-in-out ${
                  bubblesVisible || menuOpen ? 'backdrop-blur-xl shadow-sm scale-100 opacity-100' : 'scale-50 opacity-0'
                }`}
                style={{ background: bubblesVisible || menuOpen ? 'rgba(255,255,255,0.55)' : 'transparent' }}
                aria-hidden="true"
              />
              <Link
                to="/"
                aria-label="Qwillio - Home"
                className="relative z-10 w-full h-full flex items-center justify-center"
              >
                <QwillioLogo size={28} />
              </Link>
            </div>
            <span
              className="text-xl font-semibold tracking-tight text-[#1d1d1f] select-none pointer-events-none transition-colors duration-500 ease-in-out"
              style={{
                opacity: menuOpen ? 1 : bubblesVisible ? 0 : textOpacity,
                transitionDelay: menuOpen ? '180ms' : '0ms',
              }}
              aria-hidden="true"
            >
              Qwillio
            </span>
          </div>

          {/* RIGHT: Try it pill + hamburger bubble */}
          <div className="absolute right-4 top-0 bottom-0 flex items-center gap-1.5 pointer-events-auto">
            <a
              href="/demo.html"
              aria-label={isFr ? 'Essayer la démo' : 'Try the demo'}
              className={`flex items-center justify-center bg-[#1d1d1f] text-white text-sm font-medium rounded-full overflow-hidden whitespace-nowrap transition-colors duration-500 ease-in-out min-w-[44px] h-11 ${
                menuOpen
                  ? 'max-w-0 opacity-0 pointer-events-none px-0'
                  : bubblesVisible
                    ? 'max-w-[44px] px-0 gap-0'
                    : 'max-w-[120px] px-4 gap-1.5'
              }`}
            >
              <Play size={13} className="flex-shrink-0 ml-0.5" aria-hidden="true" />
              <span
                className={`overflow-hidden transition-colors duration-500 ease-in-out ${
                  bubblesVisible || menuOpen ? 'max-w-0 opacity-0' : 'max-w-[80px] opacity-100'
                }`}
              >
                {isFr ? 'Essayer' : 'Try it'}
              </span>
            </a>

            {/* Hamburger → X */}
            <div className="relative w-11 h-11 flex items-center justify-center flex-shrink-0">
              <span
                className={`absolute inset-0 rounded-full transition-[width] duration-500 ease-out ease-in-out ${
                  bubblesVisible || menuOpen ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
                }`}
                style={{
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  background: 'rgba(255,255,255,0.55)',
                  boxShadow: '0 1px 8px rgba(0,0,0,0.10)',
                }}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={toggle}
                aria-label={menuOpen ? (isFr ? 'Fermer le menu' : 'Close menu') : (isFr ? 'Ouvrir le menu' : 'Open menu')}
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                className="relative z-10 w-full h-full flex items-center justify-center focus:outline-none"
              >
                <div className="flex flex-col justify-center items-center w-5 h-4 gap-[5px]" aria-hidden="true">
                  <span className={`block h-[1.5px] w-5 bg-[#1d1d1f] rounded-full origin-center transition-colors duration-300 ease-in-out ${menuOpen ? 'rotate-45 translate-y-[6.5px]' : ''}`} />
                  <span className={`block h-[1.5px] w-5 bg-[#1d1d1f] rounded-full transition-[width] duration-300 ease-out ease-in-out ${menuOpen ? 'opacity-0 scale-x-0' : ''}`} />
                  <span className={`block h-[1.5px] w-5 bg-[#1d1d1f] rounded-full origin-center transition-colors duration-300 ease-in-out ${menuOpen ? '-rotate-45 -translate-y-[6.5px]' : ''}`} />
                </div>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* ── FULLSCREEN MOBILE MENU ─────────────────────────────────────── */}
      {menuOpen && (
        <>
          <div
            aria-hidden="true"
            className="md:hidden fixed inset-0 z-[59]"
            style={{
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              background: 'rgba(255,255,255,0.5)',
              opacity: menuVisible ? 1 : 0,
              transition: 'opacity 0.3s ease',
            }}
          />
          <div
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label={isFr ? 'Menu principal' : 'Main menu'}
            className="md:hidden fixed left-0 right-0 bottom-0 z-[60] flex flex-col overflow-hidden"
            style={{
              top: 0,
              background: 'rgba(255,255,255,0.78)',
              paddingTop: 'calc(env(safe-area-inset-top) + 72px)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              transform: menuVisible ? 'translateY(0)' : 'translateY(-100%)',
              transition: 'transform 0.42s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <nav
              aria-label={isFr ? 'Menu mobile' : 'Mobile menu'}
              className="flex-1 overflow-y-auto px-8 pt-8 pb-4"
            >
              <ul className="space-y-0" role="list">
                {mobileLinks.map((item) => (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={closeMenu}
                      className="group block px-2 py-3.5 transition-colors duration-200"
                    >
                      <span className="text-lg font-normal tracking-tight text-[#1d1d1f] group-hover:text-[#6366f1] transition-colors">
                        {item.label}
                      </span>
                      <div
                        className="mt-1.5 h-[1px] bg-[#1d1d1f]/15 group-hover:bg-[#6366f1]/60 transition-colors duration-300"
                        style={{ width: item.wave }}
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            {/* Bottom CTAs */}
            <div className="px-6 pb-6 flex-shrink-0">
              <div className="border-t border-[#d2d2d7]/60 mb-5" aria-hidden="true" />
              <Link
                to="/register"
                onClick={closeMenu}
                className="flex items-center justify-center w-full bg-[#1d1d1f] text-white text-base font-medium px-4 py-4 rounded-full hover:bg-[#6366f1] transition-colors mb-3"
              >
                {isFr ? "S'inscrire" : 'Sign up'}
              </Link>
              <Link
                to="/login"
                onClick={closeMenu}
                className="flex items-center justify-center w-full border border-[#d2d2d7] text-[#1d1d1f] text-base font-normal px-4 py-4 rounded-full hover:bg-black/5 transition-colors mb-4"
              >
                {isFr ? 'Connexion' : 'Login'}
              </Link>
              <div className="flex justify-center">
                <LangToggle />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
