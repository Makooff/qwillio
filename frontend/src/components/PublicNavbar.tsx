import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Play, ChevronDown, Phone, Bot, Building2, BookOpen, Mail as MailIcon, Home, DollarSign, Menu, X } from 'lucide-react';
import QwillioLogo from './QwillioLogo';
import LangToggle from './LangToggle';
import { useLang } from '../stores/langStore';

function Dropdown({ label, items, scrolled }: { label: string; items: { to: string; icon: any; label: string; desc: string }[]; scrolled: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 hover:text-[#1d1d1f] transition-colors"
      >
        {label} <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-72 bg-white rounded-2xl shadow-xl border border-[#d2d2d7]/60 p-2 z-50">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 px-4 py-3 rounded-xl hover:bg-[#f5f5f7] transition-colors"
            >
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

function MobileAccordion({ label, items, onNavigate }: { label: string; items: { to: string; icon: any; label: string; desc: string }[]; onNavigate: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-3 text-base font-medium text-[#1d1d1f]"
      >
        {label}
        <ChevronDown size={16} className={`transition-transform duration-200 text-[#86868b] ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="pb-2 pl-1 space-y-1">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#f5f5f7] transition-colors"
            >
              <item.icon size={18} className="text-[#6366f1] flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[#1d1d1f]">{item.label}</p>
                <p className="text-xs text-[#86868b]">{item.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PublicNavbar() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const productItems = [
    { to: '/receptionist', icon: Phone, label: 'Receptionist AI', desc: isFr ? 'Votre standardiste IA 24/7' : 'Your 24/7 AI receptionist' },
    { to: '/agent', icon: Bot, label: 'Qwillio Agent', desc: isFr ? 'Modules IA avanc\u00e9s' : 'Advanced AI modules' },
  ];

  const companyItems = [
    { to: '/about', icon: Building2, label: isFr ? 'A propos' : 'About', desc: isFr ? 'Notre mission et vision' : 'Our mission and vision' },
    { to: '/blog', icon: BookOpen, label: 'Blog', desc: isFr ? 'Articles et actualit\u00e9s' : 'Articles and news' },
    { to: '/contact', icon: MailIcon, label: 'Contact', desc: isFr ? 'Nous contacter' : 'Get in touch' },
    { to: '/affiliate', icon: DollarSign, label: isFr ? 'Affiliation' : 'Affiliate', desc: isFr ? 'Gagnez en nous recommandant' : 'Earn by referring us' },
  ];

  const closeMobile = () => setMobileOpen(false);

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled || mobileOpen ? 'bg-white/80 backdrop-blur-xl shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-[1120px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[#1d1d1f]">
            <QwillioLogo size={30} /> Qwillio
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#1d1d1f]/70">
            <Link to="/" className="hover:text-[#1d1d1f] transition-colors">Home</Link>
            <Dropdown label={isFr ? 'Produit' : 'Product'} items={productItems} scrolled={scrolled} />
            <Dropdown label={isFr ? 'Entreprise' : 'Company'} items={companyItems} scrolled={scrolled} />
            <Link to="/pricing" className="hover:text-[#1d1d1f] transition-colors">{isFr ? 'Tarifs' : 'Pricing'}</Link>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-[#1d1d1f]/70 hover:text-[#1d1d1f] transition-colors hidden sm:block">
              {isFr ? 'Connexion' : 'Login'}
            </Link>
            <a
              href="/demo.html"
              className="inline-flex items-center gap-2 bg-[#6366f1] text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-[#4f46e5] transition-colors"
            >
              <Play size={14} /> {isFr ? 'Essayer' : 'Try it'}
            </a>
            <LangToggle />
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-colors text-[#1d1d1f]"
              aria-label="Menu"
            >
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <div
        className={`fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300 md:hidden ${mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={closeMobile}
      />

      {/* Mobile menu panel */}
      <div
        className={`fixed top-14 left-0 right-0 z-40 bg-white/95 backdrop-blur-xl border-b border-[#d2d2d7]/60 shadow-xl md:hidden transition-all duration-300 ${mobileOpen ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0 pointer-events-none'}`}
        style={{ maxHeight: 'calc(100vh - 3.5rem)', overflowY: 'auto' }}
      >
        <div className="px-6 py-4 space-y-1">
          <Link to="/" onClick={closeMobile} className="block py-3 text-base font-medium text-[#1d1d1f] hover:text-[#6366f1] transition-colors">
            Home
          </Link>
          <div className="border-t border-[#e5e5ea]" />
          <MobileAccordion label={isFr ? 'Produit' : 'Product'} items={productItems} onNavigate={closeMobile} />
          <div className="border-t border-[#e5e5ea]" />
          <MobileAccordion label={isFr ? 'Entreprise' : 'Company'} items={companyItems} onNavigate={closeMobile} />
          <div className="border-t border-[#e5e5ea]" />
          <Link to="/pricing" onClick={closeMobile} className="block py-3 text-base font-medium text-[#1d1d1f] hover:text-[#6366f1] transition-colors">
            {isFr ? 'Tarifs' : 'Pricing'}
          </Link>
          <div className="border-t border-[#e5e5ea]" />
          <Link to="/login" onClick={closeMobile} className="block py-3 text-base font-medium text-[#1d1d1f] hover:text-[#6366f1] transition-colors sm:hidden">
            {isFr ? 'Connexion' : 'Login'}
          </Link>
        </div>
      </div>
    </>
  );
}
