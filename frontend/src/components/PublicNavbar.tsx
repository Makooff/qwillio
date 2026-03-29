import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Play, ChevronDown, Phone, Bot, Building2, BookOpen, Mail as MailIcon, DollarSign } from 'lucide-react';
import QwillioLogo from './QwillioLogo';
import LangToggle from './LangToggle';
import { useLang } from '../stores/langStore';

function Dropdown({ label, items }: { label: string; items: { to: string; icon: any; label: string; desc: string }[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 hover:text-[#1d1d1f] transition-colors">
        {label} <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 bg-white rounded-2xl shadow-xl border border-[#d2d2d7]/60 p-2 z-50">
          {items.map((item) => (
            <Link key={item.to} to={item.to} onClick={() => setOpen(false)}
              className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-[#f5f5f7] transition-colors">
              <item.icon size={20} className="text-[#6366f1] mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#1d1d1f]">{item.label}</p>
                <p className="text-xs text-[#86868b] mt-0.5">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PublicNavbar() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const savedScrollY = useRef(0);
  const location = useLocation();

  useEffect(() => { closeMenu(); }, [location.pathname]);

  // Desktop nav background on scroll
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

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

  const openMenu = () => {
    setMenuOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setMenuVisible(true)));
  };
  const closeMenu = () => {
    setMenuVisible(false);
    setTimeout(() => setMenuOpen(false), 220);
  };
  const toggle = () => menuOpen ? closeMenu() : openMenu();

  const productItems = [
    { to: '/receptionist', icon: Phone, label: 'Receptionist AI', desc: isFr ? 'Votre standardiste IA 24/7' : 'Your 24/7 AI receptionist' },
    { to: '/agent', icon: Bot, label: 'Qwillio Agent', desc: isFr ? 'Modules IA avancés' : 'Advanced AI modules' },
  ];
  const companyItems = [
    { to: '/about', icon: Building2, label: isFr ? 'À propos' : 'About', desc: isFr ? 'Notre mission et vision' : 'Our mission and vision' },
    { to: '/blog', icon: BookOpen, label: 'Blog', desc: isFr ? 'Articles et actualités' : 'Articles and news' },
    { to: '/contact', icon: MailIcon, label: 'Contact', desc: isFr ? 'Nous contacter' : 'Get in touch' },
    { to: '/affiliate', icon: DollarSign, label: isFr ? 'Affiliation' : 'Affiliate', desc: isFr ? 'Gagnez en nous recommandant' : 'Earn by referring us' },
  ];

  return (
    <>
      {/* ══ DESKTOP NAV ══ */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50">
        <div className={`absolute inset-0 -z-10 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-sm' : ''}`} />
        <div className="max-w-[1120px] mx-auto px-4 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <QwillioLogo size={28} />
            <span className="text-xl font-semibold tracking-tight text-[#1d1d1f]">Qwillio</span>
          </Link>
          <div className="flex items-center gap-8 text-sm text-[#1d1d1f]/70">
            <Link to="/" className="hover:text-[#1d1d1f] transition-colors">Home</Link>
            <Dropdown label={isFr ? 'Produit' : 'Product'} items={productItems} />
            <Dropdown label={isFr ? 'Entreprise' : 'Company'} items={companyItems} />
            <Link to="/pricing" className="hover:text-[#1d1d1f] transition-colors">{isFr ? 'Tarifs' : 'Pricing'}</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-[#1d1d1f]/70 hover:text-[#1d1d1f] transition-colors">
              {isFr ? 'Connexion' : 'Login'}
            </Link>
            <a href="/demo.html" className="inline-flex items-center gap-2 bg-[#6366f1] text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-[#4f46e5] transition-colors">
              <Play size={14} /> {isFr ? 'Essayer' : 'Try it'}
            </a>
            <LangToggle />
          </div>
        </div>
      </nav>

      {/* ══ MOBILE HAMBURGER — floating, no header bar ══ */}
      <button
        onClick={toggle}
        aria-label="Menu"
        className="md:hidden fixed z-[61] flex items-center justify-center w-11 h-11 rounded-full"
        style={{
          top: 'calc(env(safe-area-inset-top) + 12px)',
          right: '16px',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          background: menuOpen ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.55)',
          boxShadow: '0 1px 8px rgba(0,0,0,0.10)',
        }}
      >
        <div className="flex flex-col justify-center items-center w-5 h-4 gap-[5px]">
          <span className={`block h-[1.5px] w-5 bg-[#1d1d1f] rounded-full origin-center transition-all duration-300 ease-in-out ${menuOpen ? 'rotate-45 translate-y-[6.5px]' : ''}`} />
          <span className={`block h-[1.5px] w-5 bg-[#1d1d1f] rounded-full transition-all duration-300 ease-in-out ${menuOpen ? 'opacity-0 scale-x-0' : ''}`} />
          <span className={`block h-[1.5px] w-5 bg-[#1d1d1f] rounded-full origin-center transition-all duration-300 ease-in-out ${menuOpen ? '-rotate-45 -translate-y-[6.5px]' : ''}`} />
        </div>
      </button>


      {/* ── FULLSCREEN MENU — slides in from top ── */}
      {menuOpen && (
        <>
          {/* Instant full-screen blur backdrop — covers page including bottom */}
          <div className="md:hidden fixed inset-0 z-[59]" style={{
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            background: 'rgba(255,255,255,0.5)',
            opacity: menuVisible ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }} />
        <div
          className="md:hidden fixed left-0 right-0 bottom-0 z-[60] flex flex-col overflow-hidden"
          style={{
            top: 0,
            background: 'rgba(255,255,255,0.72)',
            paddingTop: 'calc(env(safe-area-inset-top) + 72px)',
            paddingBottom: 'env(safe-area-inset-bottom)',
            transform: menuVisible ? 'translateY(0)' : 'translateY(-100%)',
            transition: 'transform 0.42s cubic-bezier(0.4, 0, 0.15, 1)',
          }}
        >
          {/* Nav links */}
          <nav className="flex-1 overflow-y-auto px-8 pt-10 pb-4">
            <div className="space-y-0">
              {[
                { to: '/', label: isFr ? 'Accueil' : 'Home',          wave: '35%' },
                { to: '/receptionist', label: 'Receptionist AI',       wave: '62%' },
                { to: '/agent', label: 'Qwillio Agent',                wave: '48%' },
                { to: '/pricing', label: isFr ? 'Tarifs' : 'Pricing', wave: '28%' },
                { to: '/affiliate', label: isFr ? 'Affiliation' : 'Affiliate', wave: '54%' },
              ].map((item) => (
                <Link key={item.to} to={item.to} onClick={closeMenu}
                  className="group block px-2 py-3.5 transition-all duration-200"
                >
                  <span className="text-2xl font-normal tracking-tight text-[#6366f1] group-hover:text-[#4f46e5] transition-colors">
                    {item.label}
                  </span>
                  <div className="mt-1.5 h-[1px] bg-[#6366f1]/25 group-hover:bg-[#6366f1]/50 transition-colors duration-200" style={{ width: item.wave }} />
                </Link>
              ))}
            </div>
          </nav>

          {/* Bottom CTAs */}
          <div className="px-6 pb-6 flex-shrink-0">
            <div className="border-t border-[#d2d2d7]/60 mb-5" />
            <Link to="/login" onClick={closeMenu}
              className="flex items-center justify-center w-full text-white text-base font-medium px-4 py-4 rounded-full transition-all hover:opacity-90 active:scale-[0.98] mb-3"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)' }}>
              {isFr ? 'Connexion' : 'Login'}
            </Link>
            <Link to="/register" onClick={closeMenu}
              className="flex items-center justify-center w-full border border-[#d2d2d7] text-[#1d1d1f] text-base font-normal px-4 py-4 rounded-full hover:bg-black/5 transition-colors mb-4">
              {isFr ? "S'inscrire" : 'Sign up'}
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
