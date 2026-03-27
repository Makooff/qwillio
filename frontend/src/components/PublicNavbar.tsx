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

      {/* ── NAV — never moves, always fixed at top ── */}
      <nav className="fixed top-0 left-0 right-0 z-50">

        {/* Desktop nav background (appears on scroll) */}
        <div className={`absolute inset-0 -z-10 transition-all duration-300 md:${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-sm' : 'bg-transparent'}`} />

        <div className="max-w-[1120px] mx-auto px-4 h-14 flex items-center justify-between">

          {/* ── LOGO — bubble appears around it on scroll (mobile) ── */}
          <Link to="/" className="relative flex items-center">
            {/* Bubble bg — grows around logo on scroll */}
            <span className={`absolute -inset-[6px] rounded-full transition-all duration-300 md:hidden ${
              scrolled ? 'bg-white/80 backdrop-blur-md shadow-md scale-100 opacity-100' : 'bg-white/0 scale-75 opacity-0'
            }`} />
            <span className="relative z-10 flex items-center gap-2">
              <QwillioLogo size={28} />
              <span className={`text-xl font-semibold tracking-tight text-[#1d1d1f] transition-all duration-300 ${
                scrolled ? 'opacity-0 w-0 overflow-hidden md:opacity-100 md:w-auto' : 'opacity-100'
              }`}>Qwillio</span>
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-8 text-sm text-[#1d1d1f]/70">
            <Link to="/" className="hover:text-[#1d1d1f] transition-colors">Home</Link>
            <Dropdown label={isFr ? 'Produit' : 'Product'} items={productItems} />
            <Dropdown label={isFr ? 'Entreprise' : 'Company'} items={companyItems} />
            <Link to="/pricing" className="hover:text-[#1d1d1f] transition-colors">{isFr ? 'Tarifs' : 'Pricing'}</Link>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Link to="/login" className="hidden md:block text-sm text-[#1d1d1f]/70 hover:text-[#1d1d1f] transition-colors">
              {isFr ? 'Connexion' : 'Login'}
            </Link>
            {/* Try it — hides on scroll on mobile */}
            <a href="/demo.html" className={`inline-flex items-center gap-2 bg-[#6366f1] text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-[#4f46e5] transition-all duration-300 ${
              scrolled ? 'opacity-0 pointer-events-none w-0 px-0 overflow-hidden md:opacity-100 md:pointer-events-auto md:w-auto md:px-5' : 'opacity-100'
            }`}>
              <Play size={14} /> <span className="whitespace-nowrap">{isFr ? 'Essayer' : 'Try it'}</span>
            </a>
            <div className="hidden md:flex"><LangToggle /></div>

            {/* ── HAMBURGER — bubble appears around it on scroll (mobile) ── */}
            <div className="relative md:hidden">
              {/* Bubble bg — grows around hamburger on scroll/open */}
              <span className={`absolute -inset-[6px] rounded-full transition-all duration-300 ${
                scrolled || menuOpen ? 'bg-white/80 backdrop-blur-md shadow-md scale-100 opacity-100' : 'bg-white/0 scale-75 opacity-0'
              }`} />
              <button onClick={toggle} aria-label="Menu"
                className="relative z-10 w-9 h-9 flex items-center justify-center text-[#1d1d1f]">
                <span className={`absolute transition-all duration-200 ${menuOpen ? 'opacity-100 rotate-0' : 'opacity-0 rotate-90'}`}>
                  <X size={18} />
                </span>
                <span className={`absolute transition-all duration-200 ${menuOpen ? 'opacity-0 -rotate-90' : 'opacity-100 rotate-0'}`}>
                  <Menu size={18} />
                </span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── BUBBLE MENU ── */}
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
