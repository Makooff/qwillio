import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronDown, Menu, X } from 'lucide-react';
import QwillioLogo from '../QwillioLogo';
import LangToggle from '../LangToggle';
import { useLang } from '../../stores/langStore';

/* Nav V2 — barre crème hairline, typographique, sans animation (élément fréquent).
   CTA unique: pilule encre « Essayer » vers /register (plus de demo.html en CTA principal). */

interface NavItem {
  to: string;
  label: string;
}

function Dropdown({ label, items }: { label: string; items: NavItem[] }) {
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
        className="flex items-center gap-1 text-sm text-q2-graphite hover:text-q2-ink transition-colors duration-150 focus:outline-none focus-visible:text-q2-ink"
      >
        {label}
        <ChevronDown
          size={12}
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute top-full left-0 mt-3 z-50 min-w-[180px] rounded-xl bg-q2-canvas border border-q2-plate py-1.5"
          style={{ boxShadow: 'var(--q2-shadow-whisper)', transformOrigin: 'top left' }}
        >
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-q2-ink hover:bg-q2-band focus:bg-q2-band focus:outline-none transition-colors duration-100"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NavV2() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const savedScrollY = useRef(0);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  const product: NavItem[] = [
    { to: '/receptionist', label: 'Receptionist AI' },
    { to: '/agent', label: 'Qwillio Agent' },
  ];
  const company: NavItem[] = [
    { to: '/about', label: isFr ? 'À propos' : 'About' },
    { to: '/blog', label: 'Blog' },
    { to: '/contact', label: 'Contact' },
    { to: '/affiliate', label: isFr ? 'Affiliation' : 'Affiliate' },
  ];

  const mobileLinks: NavItem[] = [
    { to: '/receptionist', label: 'Receptionist AI' },
    { to: '/agent', label: 'Qwillio Agent' },
    { to: '/pricing', label: isFr ? 'Tarifs' : 'Pricing' },
    { to: '/about', label: isFr ? 'À propos' : 'About' },
    { to: '/blog', label: 'Blog' },
    { to: '/contact', label: 'Contact' },
    { to: '/affiliate', label: isFr ? 'Affiliation' : 'Affiliate' },
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
        className={`fixed top-0 inset-x-0 z-50 bg-q2-canvas/95 backdrop-blur-sm transition-colors duration-200 ${
          scrolled ? 'border-b border-q2-plate' : 'border-b border-transparent'
        }`}
      >
        <nav
          aria-label={isFr ? 'Navigation principale' : 'Main navigation'}
          className="max-w-[1200px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between gap-6"
        >
          <Link
            to="/"
            className="flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 rounded-md"
          >
            <QwillioLogo size={26} />
            <span className="text-[15px] font-semibold tracking-tight text-q2-ink">Qwillio</span>
          </Link>

          <div className="hidden md:flex items-center gap-7">
            <Dropdown label={isFr ? 'Produit' : 'Product'} items={product} />
            <Dropdown label={isFr ? 'Société' : 'Company'} items={company} />
            <Link
              to="/pricing"
              className="text-sm text-q2-graphite hover:text-q2-ink transition-colors duration-150"
            >
              {isFr ? 'Tarifs' : 'Pricing'}
            </Link>
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
              className="inline-flex items-center rounded-full bg-q2-ink text-white text-sm font-medium px-5 py-2 hover:bg-black transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-q2-indigo/40 focus-visible:ring-offset-2"
            >
              {isFr ? 'Essayer' : 'Try it'}
            </Link>
          </div>

          <button
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

      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-q2-canvas md:hidden pt-20 px-6 overflow-y-auto">
          <nav aria-label={isFr ? 'Menu mobile' : 'Mobile menu'} className="flex flex-col">
            {mobileLinks.map((link, i) => (
              <Link
                key={link.to}
                to={link.to}
                className={`py-4 text-xl font-light tracking-tight text-q2-ink ${
                  i > 0 ? 'border-t border-q2-plate' : ''
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3 mt-8 pb-10">
            <Link
              to="/register"
              className="flex-1 inline-flex items-center justify-center rounded-full bg-q2-ink text-white text-[15px] font-medium px-6 py-3.5"
            >
              {isFr ? 'Essayer' : 'Try it'}
            </Link>
            <Link
              to="/login"
              className="flex-1 inline-flex items-center justify-center rounded-full border border-q2-plate text-q2-ink text-[15px] font-medium px-6 py-3.5"
            >
              {isFr ? 'Connexion' : 'Log in'}
            </Link>
            <LangToggle />
          </div>
        </div>
      )}
    </>
  );
}
