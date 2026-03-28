import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Play, ChevronDown, Phone, Bot, Building2, BookOpen, Mail as MailIcon, DollarSign, Menu, X } from 'lucide-react';
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
  const location = useLocation();

  useEffect(() => { closeMenu(); }, [location.pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
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

  /* Menu panel top offset — below bubble when scrolled, below nav when not */
  const menuTop = scrolled ? 'top-[60px]' : 'top-14';

  return (
    <>
      <style>{`
        @keyframes bubbleIn {
          0%   { transform: scale(0.08); opacity: 0; }
          65%  { transform: scale(1.04); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
        @keyframes bubbleOut {
          0%   { transform: scale(1);   opacity: 1; }
          100% { transform: scale(0.08); opacity: 0; }
        }
      `}</style>

      {/*
        Single fixed container — NEVER moves on iOS Safari.
        All children are absolute/relative inside it.
        On mobile scrolled: height = 0, content fills full screen.
        On mobile not scrolled: full h-14 nav bar.
        On desktop: always full h-14 nav bar.
      */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 overflow-visible"
        style={{ willChange: 'transform', transform: 'translateZ(0)' }}
      >
        {/* ── DESKTOP: always-visible nav bar ── */}
        <div className="hidden md:block">
          {/* Desktop bg */}
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
                <Play size={14} /> <span className="whitespace-nowrap">{isFr ? 'Essayer' : 'Try it'}</span>
              </a>
              <LangToggle />
            </div>
          </div>
        </div>

        {/* ── MOBILE NOT SCROLLED: full nav bar — logo/hamburger at exact bubble positions ── */}
        <div className={`md:hidden transition-all duration-300 ${scrolled ? 'opacity-0 pointer-events-none h-0 overflow-hidden' : 'opacity-100 h-14'}`}>
          <div className="relative h-14">
            {/* Logo: left-4 with w-11 container → icon center matches bubble center */}
            <Link to="/" className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center">
              <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                <QwillioLogo size={28} />
              </div>
              <span className="text-xl font-semibold tracking-tight text-[#1d1d1f]">Qwillio</span>
            </Link>
            {/* Right group: hamburger in w-11 container at right-4 → center matches bubble center */}
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <a href="/demo.html" className="inline-flex items-center gap-2 bg-[#6366f1] text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-[#4f46e5] transition-colors">
                <Play size={14} /> <span className="whitespace-nowrap">{isFr ? 'Essayer' : 'Try it'}</span>
              </a>
              <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                <button onClick={toggle} aria-label="Menu" className="w-9 h-9 flex items-center justify-center text-[#1d1d1f]">
                  {menuOpen ? <X size={18} /> : <Menu size={18} />}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── MOBILE SCROLLED: floating logo bubble ── */}
        <Link
          to="/"
          className={`md:hidden absolute top-[9px] left-4 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
            scrolled
              ? 'bg-white/30 backdrop-blur-xl shadow-sm opacity-100 scale-100'
              : 'opacity-0 scale-75 pointer-events-none'
          }`}
        >
          <QwillioLogo size={28} />
        </Link>

        {/* ── MOBILE: floating hamburger bubble (scrolled or menu open) ── */}
        <button
          onClick={toggle}
          aria-label="Menu"
          className={`md:hidden absolute top-[9px] right-4 w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 text-[#1d1d1f] ${
            scrolled || menuOpen
              ? 'bg-white/30 backdrop-blur-xl shadow-sm opacity-100 scale-100'
              : 'opacity-0 scale-75 pointer-events-none'
          }`}
        >
          <span className={`absolute transition-all duration-200 ${menuOpen ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'}`}>
            <X size={18} />
          </span>
          <span className={`absolute transition-all duration-200 ${menuOpen ? 'opacity-0 -rotate-90' : 'opacity-100 rotate-0'}`}>
            <Menu size={18} />
          </span>
        </button>
      </nav>

      {/* ── BUBBLE MENU PANEL ── */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: menuVisible ? 'rgba(0,0,0,0.12)' : 'transparent', transition: 'background 0.2s', backdropFilter: menuVisible ? 'blur(2px)' : 'none' }}
          onClick={closeMenu}
        >
          <div
            className={`absolute ${menuTop} right-4 bg-white rounded-3xl shadow-2xl p-5 w-64`}
            style={{ transformOrigin: 'top right', animation: menuVisible ? 'bubbleIn 0.25s ease-out forwards' : 'bubbleOut 0.2s ease-in forwards' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="space-y-0.5 mb-3">
              <Link to="/" onClick={closeMenu} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors">Home</Link>
              <Link to="/receptionist" onClick={closeMenu} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors">Receptionist AI</Link>
              <Link to="/agent" onClick={closeMenu} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors">Qwillio Agent</Link>
              <Link to="/pricing" onClick={closeMenu} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors">{isFr ? 'Tarifs' : 'Pricing'}</Link>
              <Link to="/affiliate" onClick={closeMenu} className="block px-3 py-2.5 rounded-xl text-sm font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors">{isFr ? 'Affiliation' : 'Affiliate'}</Link>
            </div>
            <Link to="/login" onClick={closeMenu}
              className="flex items-center justify-center w-full bg-[#6366f1] text-white text-sm font-medium px-4 py-2.5 rounded-full hover:bg-[#4f46e5] transition-colors mb-2">
              {isFr ? 'Connexion' : 'Login'}
            </Link>
            <Link to="/register" onClick={closeMenu}
              className="flex items-center justify-center w-full border border-[#d2d2d7] text-[#1d1d1f] text-sm font-medium px-4 py-2.5 rounded-full hover:bg-[#f5f5f7] transition-colors mb-3">
              {isFr ? "S'inscrire" : 'Sign up'}
            </Link>
            <div className="border-t border-[#d2d2d7]/60 pt-3 flex justify-center">
              <LangToggle />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
