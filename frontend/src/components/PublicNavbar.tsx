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

  return (
    <>
      <style>{`
        @keyframes bubbleIn {
          0%   { transform: scale(0.08) translateY(-6px); opacity: 0; }
          65%  { transform: scale(1.04) translateY(0);   opacity: 1; }
          100% { transform: scale(1)   translateY(0);   opacity: 1; }
        }
        @keyframes bubbleOut {
          0%   { transform: scale(1);   opacity: 1; }
          100% { transform: scale(0.08) translateY(-6px); opacity: 0; }
        }
      `}</style>

      {/* ── FULL NAV — slides away on scroll ── */}
      <nav className={`fixed top-0 left-0 right-0 z-40 transition-all duration-400 ${
        scrolled ? '-translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}>
        <div className="max-w-[1120px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[#1d1d1f]">
            <QwillioLogo size={30} /> Qwillio
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#1d1d1f]/70">
            <Link to="/" className="hover:text-[#1d1d1f] transition-colors">Home</Link>
            <Dropdown label={isFr ? 'Produit' : 'Product'} items={productItems} />
            <Dropdown label={isFr ? 'Entreprise' : 'Company'} items={companyItems} />
            <Link to="/pricing" className="hover:text-[#1d1d1f] transition-colors">{isFr ? 'Tarifs' : 'Pricing'}</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden md:block text-sm text-[#1d1d1f]/70 hover:text-[#1d1d1f] transition-colors">
              {isFr ? 'Connexion' : 'Login'}
            </Link>
            <a href="/demo.html" className="inline-flex items-center gap-2 bg-[#6366f1] text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-[#4f46e5] transition-colors">
              <Play size={14} /> {isFr ? 'Essayer' : 'Try it'}
            </a>
            <div className="hidden md:flex"><LangToggle /></div>
            {/* At-top hamburger (no bubble) */}
            <button onClick={toggle} aria-label="Menu"
              className="md:hidden w-9 h-9 flex items-center justify-center text-[#1d1d1f]">
              <Menu size={20} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── FLOATING QW LOGO BUBBLE — appears on scroll (mobile) ── */}
      <Link to="/"
        className={`fixed top-3 left-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-md shadow-md shadow-black/10 transition-opacity duration-300 md:hidden ${
          scrolled ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <QwillioLogo size={24} />
      </Link>

      {/* ── FLOATING HAMBURGER BUBBLE — always fixed, bubble on scroll/open ── */}
      <button
        onClick={toggle}
        aria-label="Menu"
        className={`fixed top-3 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 md:hidden ${
          scrolled || menuOpen
            ? 'bg-white/90 backdrop-blur-md shadow-md shadow-black/10 opacity-100 pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
      >
        <span className={`absolute transition-all duration-200 ${menuOpen ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'}`}>
          <X size={18} className="text-[#1d1d1f]" />
        </span>
        <span className={`absolute transition-all duration-200 ${menuOpen ? 'opacity-0 -rotate-90' : 'opacity-100 rotate-0'}`}>
          <Menu size={18} className="text-[#1d1d1f]" />
        </span>
      </button>

      {/* ── BUBBLE MENU — grows from hamburger ── */}
      {menuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40"
          style={{ background: menuVisible ? 'rgba(0,0,0,0.12)' : 'transparent', transition: 'background 0.2s', backdropFilter: menuVisible ? 'blur(2px)' : 'none' }}
          onClick={closeMenu}
        >
          <div
            className="absolute top-14 right-4 bg-white rounded-3xl shadow-2xl p-5 w-64"
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
