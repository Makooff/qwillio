import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import {
  Phone, Bot, Zap, Clock, ArrowRight, Check, Play,
  Building2, Stethoscope, Scale, Wrench, UtensilsCrossed,
  GraduationCap, Car, Dumbbell, Scissors, Home as HomeIcon,
  Landmark, ShoppingBag, Star, ChevronRight, Sparkles,
  Shield, Users, BarChart3, Globe, Cpu, Rocket
} from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';

/* ── FadeIn wrapper (scroll-triggered via CSS) ── */
function FadeIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── Animated counter ── */
function Counter({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const done = useRef(false);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !done.current) {
        done.current = true;
        let t0 = 0;
        const step = (ts: number) => {
          if (!t0) t0 = ts;
          const p = Math.min((ts - t0) / 2000, 1);
          setN(Math.floor((1 - Math.pow(1 - p, 3)) * value));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value]);

  return <span ref={ref}>{prefix}{n.toLocaleString()}{suffix}</span>;
}

/* ── Main Page ── */
export default function Home() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  useSEO({
    title: 'Qwillio',
    description: isFr
      ? 'Qwillio est votre réceptionniste IA qui répond à chaque appel, prend les rendez-vous et ne dort jamais. Automatisez votre entreprise 24/7.'
      : 'Qwillio is your AI receptionist that answers every call, books appointments, and never sleeps. Automate your business 24/7.',
    canonical: 'https://qwillio.com/',
  });

  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Firefly particles — edge-to-edge, gentle perpendicular curve, slow uniform speed */
  const antParticles = useMemo(() => {
    const r = (n: number) => ((n * 9301 + 49297) % 233280) / 233280;
    const cols = ['#6366f1','#8b5cf6','#4f46e5','#a855f7','#6366f1'];

    const onEdge = (edge: number, t: number) => {
      switch (edge) {
        case 0: return { x: -6,  y: t * 100 };
        case 1: return { x: 106, y: t * 100 };
        case 2: return { x: t * 100, y: -6  };
        default: return { x: t * 100, y: 106 };
      }
    };

    return Array.from({ length: 5 }, (_, i) => {
      const s = i * 23 + 7;
      const startEdge = i % 4;
      const endEdge   = (startEdge + 1 + (i % 3)) % 4;
      // Evenly spaced along each edge for good distribution
      const p0 = onEdge(startEdge, i * 0.2 + 0.1);
      const p1 = onEdge(endEdge,   (i * 0.2 + 0.4) % 1);
      // Midpoint ON the straight line + small perpendicular offset → gentle curve
      const mxBase = (p0.x + p1.x) / 2;
      const myBase = (p0.y + p1.y) / 2;
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const len = Math.sqrt(dx*dx + dy*dy) || 1;
      const offset = (r(s+9) - 0.5) * 16; // ±8 units — barely perceptible curve
      return {
        id: i,
        x0: +p0.x.toFixed(1),                     y0: +p0.y.toFixed(1),
        xm: +(mxBase + (-dy/len)*offset).toFixed(1), ym: +(myBase + (dx/len)*offset).toFixed(1),
        x1: +p1.x.toFixed(1),                     y1: +p1.y.toFixed(1),
        size: [10, 42, 18, 50, 14][i],  // explicitly varied: small, large, medium, XL, tiny
        blur: Math.round(8  + r(s+5) * 8),   // 8–16px
        opacity: +(0.28 + r(s+6) * 0.22).toFixed(2),
        color: cols[i % cols.length],
        dur:  +(7.5 + r(s+7) * 2.0).toFixed(1),   // 7.5–9.5s, small spread
        delay: +(-(r(s+8) * 10)).toFixed(1),
      };
    });
  }, []);

  const particleCSS = useMemo(() =>
    antParticles.map(p => `
      @keyframes ant${p.id} {
        0%   { transform: translate(${p.x0}vw,${p.y0}vh); opacity:0; }
        12%  { opacity:${p.opacity}; }
        50%  { transform: translate(${p.xm}vw,${p.ym}vh); opacity:${p.opacity}; }
        88%  { opacity:${p.opacity}; }
        100% { transform: translate(${p.x1}vw,${p.y1}vh); opacity:0; }
      }`).join('\n')
  , [antParticles]);

  const industries = [
    { icon: Stethoscope, name: isFr ? 'Sante' : 'Healthcare', desc: isFr ? 'Cliniques, dentistes, optometristes' : 'Clinics, dentists, optometrists' },
    { icon: Scale, name: isFr ? 'Juridique' : 'Legal', desc: isFr ? 'Cabinets d\'avocats, notaires' : 'Law firms, notaries' },
    { icon: HomeIcon, name: isFr ? 'Immobilier' : 'Real Estate', desc: isFr ? 'Agents, courtiers, gestion' : 'Agents, brokers, property mgmt' },
    { icon: Wrench, name: isFr ? 'Services' : 'Home Services', desc: isFr ? 'Plombiers, electriciens, HVAC' : 'Plumbers, electricians, HVAC' },
    { icon: UtensilsCrossed, name: isFr ? 'Restauration' : 'Restaurants', desc: isFr ? 'Reservations, commandes' : 'Reservations, orders' },
    { icon: GraduationCap, name: isFr ? 'Education' : 'Education', desc: isFr ? 'Ecoles, tutorat, formations' : 'Schools, tutoring, training' },
    { icon: Car, name: isFr ? 'Automobile' : 'Automotive', desc: isFr ? 'Concessionnaires, ateliers' : 'Dealerships, repair shops' },
    { icon: Dumbbell, name: isFr ? 'Fitness' : 'Fitness', desc: isFr ? 'Gyms, studios, coachs' : 'Gyms, studios, coaches' },
    { icon: Scissors, name: isFr ? 'Beaute' : 'Beauty', desc: isFr ? 'Salons, spas, barbiers' : 'Salons, spas, barbers' },
    { icon: Landmark, name: isFr ? 'Finance' : 'Finance', desc: isFr ? 'Comptables, conseillers' : 'Accountants, advisors' },
    { icon: ShoppingBag, name: isFr ? 'Commerce' : 'Retail', desc: isFr ? 'Boutiques, e-commerce' : 'Shops, e-commerce' },
    { icon: Building2, name: isFr ? 'Startups' : 'Startups', desc: isFr ? 'SaaS, tech, agences' : 'SaaS, tech, agencies' },
  ];

  const testimonials = [
    {
      quote: isFr
        ? "Qwillio a transforme notre cabinet. On ne manque plus un seul appel et les rendez-vous se prennent tout seuls."
        : "Qwillio transformed our practice. We never miss a call and appointments book themselves.",
      name: 'Dr. Sarah Chen',
      role: isFr ? 'Directrice de clinique' : 'Clinic Director',
      company: 'Bright Dental',
    },
    {
      quote: isFr
        ? "Le ROI est incroyable. En 2 semaines, on a recupere l'investissement et gagne 35% de rendez-vous en plus."
        : "The ROI is incredible. Within 2 weeks we recouped the investment and gained 35% more appointments.",
      name: 'Marcus Rivera',
      role: isFr ? 'Proprietaire' : 'Owner',
      company: 'Rivera HVAC',
    },
    {
      quote: isFr
        ? "Nos clients pensent parler a une vraie personne. La qualite vocale et la rapidite sont impressionnantes."
        : "Our clients think they\'re speaking to a real person. The voice quality and speed are impressive.",
      name: 'Emily Larsson',
      role: isFr ? 'Associee gerante' : 'Managing Partner',
      company: 'Larsson & Associates Law',
    },
  ];

  const steps = [
    {
      num: '01',
      title: isFr ? 'Inscrivez-vous' : 'Sign Up',
      desc: isFr ? 'Creez votre compte en 2 minutes. Premier mois offert, sans engagement.' : 'Create your account in 2 minutes. First month free, no commitment.',
      icon: Rocket,
    },
    {
      num: '02',
      title: isFr ? 'Configurez' : 'Configure',
      desc: isFr ? 'Personnalisez votre IA: voix, scripts, horaires, integrations calendrier.' : 'Customize your AI: voice, scripts, hours, calendar integrations.',
      icon: Cpu,
    },
    {
      num: '03',
      title: isFr ? 'Lancez-vous' : 'Go Live',
      desc: isFr ? 'Activez et recevez vos premiers appels. Support 24/7 inclus.' : 'Activate and receive your first calls. 24/7 support included.',
      icon: Zap,
    },
  ];

  return (
    <div className="min-h-screen bg-white">
      <PublicNavbar />

      {/* ══════════ HERO ══════════ */}
      <style>{`
        ${particleCSS}
        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position:  200% center; }
        }
        .card-premium:hover::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(105deg, transparent 40%, rgba(99,102,241,0.06) 50%, transparent 60%);
          background-size: 200% auto;
          animation: shimmer 1.2s ease-in-out;
          pointer-events: none;
        }
      `}</style>

      <section className="relative pt-28 pb-24 md:pt-40 md:pb-32 overflow-hidden bg-white">

        {/* ── Ant-colony: small blurry orbs travelling fast across the background ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {antParticles.map(p => (
            <div
              key={p.id}
              className="absolute rounded-full"
              style={{
                width: p.size,
                height: p.size,
                background: p.color,
                filter: `blur(${p.blur}px)`,
                opacity: 0,
                top: 0,
                left: 0,
                animationName: `ant${p.id}`,
                animationDuration: `${p.dur}s`,
                animationTimingFunction: 'ease-in-out',
                animationDelay: `${p.delay}s`,
                animationIterationCount: 'infinite',
              }}
            />
          ))}
        </div>

        <div className="relative max-w-[1120px] mx-auto px-6 text-center">
          <FadeIn delay={100}>
            <h1 className="text-4xl sm:text-5xl md:text-7xl font-semibold tracking-tight text-[#1d1d1f] leading-[1.08] mb-6">
              {isFr ? 'Votre entreprise.' : 'Your business.'}<br />
              <span className="bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
                {isFr ? "Amplifiée par l'IA." : 'Amplified by AI.'}
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={200}>
            <p className="text-lg md:text-xl text-[#86868b] max-w-2xl mx-auto mb-10 leading-relaxed">
              {isFr
                ? "Réceptionniste, agent, CRM, facturation — Qwillio réunit tout en une plateforme intelligente qui travaille pour vous 24/7."
                : 'Receptionist, agent, CRM, billing — Qwillio brings everything into one intelligent platform that works for you 24/7.'}
            </p>
          </FadeIn>

          <FadeIn delay={300}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <a
                href="/demo.html"
                className="group inline-flex items-center gap-2 bg-[#6366f1] text-white text-base font-medium px-8 py-3.5 rounded-full hover:bg-[#4f46e5] transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl hover:shadow-[#6366f1]/30 shadow-lg shadow-[#6366f1]/20"
              >
                <Play size={16} className="transition-transform duration-300 group-hover:scale-110" />
                {isFr ? 'Essayer la démo' : 'Try the demo'}
              </a>
              <Link
                to="/pricing"
                className="group inline-flex items-center gap-2 text-base font-medium text-[#1d1d1f] px-8 py-3.5 rounded-full border border-[#d2d2d7]/60 hover:border-[#6366f1]/30 hover:bg-[#6366f1]/5 hover:text-[#6366f1] transition-all duration-300"
              >
                {isFr ? 'Voir les tarifs' : 'View pricing'}
                <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </div>
          </FadeIn>

          {/* Stats row */}
          <FadeIn delay={400}>
            <div className="flex flex-row items-stretch justify-center w-full">
              {[
                { value: '98%',    label: isFr ? 'Taux de réponse'      : 'Answer rate' },
                { value: '2 500+', label: isFr ? 'Appels / jour'         : 'Calls / day' },
                { value: '35%',    label: isFr ? 'Plus de rendez-vous'   : 'More appointments' },
              ].map((stat, i) => (
                <div key={i} className={`flex-1 flex flex-col items-center justify-center px-2 md:px-8 py-3 transition-all duration-300 hover:scale-105 ${i > 0 ? 'border-l border-[#d2d2d7]/60' : ''}`}>
                  <p className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-tight text-[#1d1d1f] whitespace-nowrap bg-gradient-to-br from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">{stat.value}</p>
                  <p className="text-[10px] sm:text-sm text-[#86868b] mt-1 text-center leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════ PRODUCT SHOWCASE ══════════ */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-[1120px] mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-[#6366f1] uppercase tracking-wider mb-3">
                {isFr ? 'Nos produits' : 'Our Products'}
              </p>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f]">
                {isFr ? 'Deux solutions. ' : 'Two solutions. '}
                <span className="text-[#1d1d1f]">
                  {isFr ? 'Un impact total.' : 'Total impact.'}
                </span>
              </h2>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Receptionist AI */}
            <FadeIn delay={100}>
              <div className="relative group rounded-2xl border border-[#d2d2d7]/60 bg-gradient-to-br from-white to-[#f5f5f7] p-8 md:p-10 hover:shadow-xl hover:shadow-[#6366f1]/5 transition-all duration-500 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#6366f1]/5 to-transparent rounded-bl-full pointer-events-none" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#4f46e5] flex items-center justify-center mb-6 shadow-lg shadow-[#6366f1]/20">
                    <Phone size={24} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight text-[#1d1d1f] mb-2">Receptionist AI</h3>
                  <p className="text-[#86868b] mb-6 leading-relaxed">
                    {isFr
                      ? 'Votre standardiste IA qui repond a chaque appel, prend les rendez-vous et ne dort jamais.'
                      : 'Your AI receptionist that answers every call, books appointments, and never sleeps.'}
                  </p>
                  <ul className="space-y-3 mb-8">
                    {(isFr
                      ? ['Reponse en moins d\'1 seconde', 'Prise de rendez-vous automatique', 'Transfert intelligent des appels', 'Support multilingue']
                      : ['Sub-1 second response time', 'Automatic appointment booking', 'Intelligent call routing', 'Multilingual support']
                    ).map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-[#424245]">
                        <Check size={16} className="text-[#6366f1] flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#86868b]">
                      {isFr ? 'A partir de ' : 'From '}
                      <span className="text-[#1d1d1f] font-semibold">$497/mo</span>
                      <span className="ml-1 text-xs text-[#6366f1] font-medium">
                        {isFr ? '1er mois offert' : '1st month free'}
                      </span>
                    </p>
                    <Link to="/receptionist" className="inline-flex items-center gap-1 text-sm font-medium text-[#6366f1] hover:gap-2 transition-all">
                      {isFr ? 'En savoir plus' : 'Learn more'} <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* Qwillio Agent */}
            <FadeIn delay={200}>
              <div className="relative group rounded-2xl border border-[#d2d2d7]/60 bg-gradient-to-br from-white to-[#f5f5f7] p-8 md:p-10 hover:shadow-xl hover:shadow-[#a855f7]/5 transition-all duration-500 overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-[#a855f7]/5 to-transparent rounded-bl-full pointer-events-none" />
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#a855f7] to-[#7c3aed] flex items-center justify-center mb-6 shadow-lg shadow-[#a855f7]/20">
                    <Bot size={24} className="text-white" />
                  </div>
                  <h3 className="text-2xl font-semibold tracking-tight text-[#1d1d1f] mb-2">Qwillio Agent</h3>
                  <p className="text-[#86868b] mb-6 leading-relaxed">
                    {isFr
                      ? 'Des modules IA avances: CRM, facturation, suivi clients, et bien plus.'
                      : 'Advanced AI modules: CRM, billing, client follow-up, and much more.'}
                  </p>
                  <ul className="space-y-3 mb-8">
                    {(isFr
                      ? ['CRM intelligent integre', 'Facturation automatisee', 'Suivi et relances clients', 'Tableaux de bord analytiques']
                      : ['Built-in intelligent CRM', 'Automated invoicing', 'Client follow-up & reminders', 'Analytics dashboards']
                    ).map((f, i) => (
                      <li key={i} className="flex items-center gap-3 text-sm text-[#424245]">
                        <Check size={16} className="text-[#a855f7] flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-[#86868b]">
                      {isFr ? 'A partir de ' : 'From '}
                      <span className="text-[#1d1d1f] font-semibold">$97/mo</span>
                      <span className="ml-1 text-xs text-[#a855f7] font-medium">
                        {isFr ? 'par module' : 'per module'}
                      </span>
                    </p>
                    <Link to="/agent" className="inline-flex items-center gap-1 text-sm font-medium text-[#a855f7] hover:gap-2 transition-all">
                      {isFr ? 'En savoir plus' : 'Learn more'} <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section className="py-20 md:py-28 bg-[#f5f5f7]">
        <div className="max-w-[1120px] mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-[#6366f1] uppercase tracking-wider mb-3">
                {isFr ? 'Comment ca marche' : 'How it works'}
              </p>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f]">
                {isFr ? 'Lancez-vous en ' : 'Get started in '}
                <span className="bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
                  {isFr ? '3 etapes.' : '3 steps.'}
                </span>
              </h2>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <FadeIn key={i} delay={i * 150}>
                <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-8 text-center hover:shadow-lg transition-all duration-500 group">
                  <div className="w-16 h-16 rounded-2xl bg-[#f5f5f7] flex items-center justify-center mx-auto mb-6 group-hover:bg-[#6366f1]/10 transition-colors">
                    <step.icon size={28} className="text-[#6366f1]" />
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-[#1d1d1f] mb-3">{step.title}</h3>
                  <p className="text-sm text-[#86868b] leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ KEY NUMBERS (DARK) ══════════ */}
      <section className="py-20 md:py-28 bg-[#1d1d1f] text-white relative overflow-hidden">
        {/* Decorative gradient orbs */}
        <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#6366f1]/10 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-[#a855f7]/10 blur-3xl pointer-events-none" />

        <div className="relative max-w-[1120px] mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-[#a78bfa] uppercase tracking-wider mb-3">
                {isFr ? 'En chiffres' : 'By the numbers'}
              </p>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
                {isFr ? 'Des resultats qui ' : 'Results that '}
                <span>
                  {isFr ? 'parlent.' : 'speak.'}
                </span>
              </h2>
            </div>
          </FadeIn>

          <FadeIn>
            <div className="flex flex-row w-full">
              {[
                { value: 98,   suffix: '%', label: isFr ? 'Taux de reponse' : 'Answer rate',      icon: Phone },
                { value: 2500, suffix: '+', label: isFr ? 'Appels par jour' : 'Calls per day',     icon: BarChart3 },
                { value: 35,   suffix: '%', label: isFr ? 'Plus de rendez-vous' : 'More appts',    icon: Users },
              ].map((stat, i) => (
                <div key={i} className={`flex-1 flex flex-col items-center justify-center px-1 py-2 text-center group ${i > 0 ? 'border-l border-white/10' : ''}`}>
                  <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center mx-auto mb-2 group-hover:bg-[#6366f1]/20 transition-colors">
                    <stat.icon size={16} className="text-[#a78bfa]" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-semibold tracking-tight whitespace-nowrap mb-0.5">
                    <Counter value={stat.value} suffix={stat.suffix} />
                  </p>
                  <p className="text-[10px] sm:text-xs text-white/50 leading-tight">{stat.label}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ══════════ INDUSTRIES ══════════ */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-[1120px] mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-[#6366f1] uppercase tracking-wider mb-3">
                {isFr ? 'Industries' : 'Industries'}
              </p>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f]">
                {isFr ? 'Concu pour ' : 'Built for '}
                <span className="bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
                  {isFr ? 'votre industrie.' : 'your industry.'}
                </span>
              </h2>
            </div>
          </FadeIn>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {industries.map((ind, i) => (
              <FadeIn key={i} delay={i * 60}>
                <div className="rounded-2xl border border-[#d2d2d7]/60 bg-[#f5f5f7]/50 p-5 hover:bg-white hover:shadow-lg hover:shadow-[#6366f1]/5 hover:border-[#6366f1]/20 transition-all duration-300 group cursor-default">
                  <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center mb-3 group-hover:bg-[#6366f1]/10 transition-colors border border-[#d2d2d7]/40">
                    <ind.icon size={20} className="text-[#6366f1]" />
                  </div>
                  <h3 className="text-sm font-semibold text-[#1d1d1f] mb-1">{ind.name}</h3>
                  <p className="text-xs text-[#86868b] leading-relaxed">{ind.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ TESTIMONIALS ══════════ */}
      <section className="py-20 md:py-28 bg-[#f5f5f7]">
        <div className="max-w-[1120px] mx-auto px-6">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-semibold text-[#6366f1] uppercase tracking-wider mb-3">
                {isFr ? 'Temoignages' : 'Testimonials'}
              </p>
              <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#1d1d1f]">
                {isFr ? 'Ils nous font confiance.' : 'They trust us.'}
              </h2>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <FadeIn key={i} delay={i * 150}>
                <div className="bg-white rounded-2xl border border-[#d2d2d7]/60 p-8 hover:shadow-lg transition-all duration-500 flex flex-col h-full">
                  <div className="flex gap-1 mb-5">
                    {[...Array(5)].map((_, j) => (
                      <Star key={j} size={16} className="text-[#f59e0b] fill-[#f59e0b]" />
                    ))}
                  </div>
                  <p className="text-[#424245] leading-relaxed mb-6 flex-1 text-sm italic">
                    "{t.quote}"
                  </p>
                  <div className="flex items-center gap-3 pt-4 border-t border-[#d2d2d7]/40">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#a855f7] flex items-center justify-center text-white text-sm font-semibold">
                      {t.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[#1d1d1f]">{t.name}</p>
                      <p className="text-xs text-[#86868b]">{t.role}, {t.company}</p>
                    </div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-[1120px] mx-auto px-6">
          <FadeIn>
            <div className="relative rounded-3xl bg-gradient-to-br from-[#6366f1] to-[#4f46e5] p-10 md:p-16 text-center text-white overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-60 h-60 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4 pointer-events-none" />

              <div className="relative">
                <h2 className="text-3xl md:text-5xl font-semibold tracking-tight mb-4">
                  {isFr ? 'Pret a transformer votre entreprise ?' : 'Ready to transform your business?'}
                </h2>
                <p className="text-white/70 text-lg max-w-xl mx-auto mb-8">
                  {isFr
                    ? 'Rejoignez des centaines d\'entreprises qui utilisent Qwillio pour grandir. Premier mois offert.'
                    : 'Join hundreds of businesses using Qwillio to grow. First month free.'}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <a
                    href="/demo.html"
                    className="inline-flex items-center gap-2 bg-white text-[#6366f1] text-base font-medium px-8 py-3.5 rounded-full hover:bg-white/90 transition-all hover:scale-105 shadow-lg"
                  >
                    <Play size={16} /> {isFr ? 'Essayer la demo' : 'Try the demo'}
                  </a>
                  <Link
                    to="/pricing"
                    className="inline-flex items-center gap-2 text-base font-medium text-white px-8 py-3.5 rounded-full border border-white/30 hover:bg-white/10 transition-all"
                  >
                    {isFr ? 'Voir les tarifs' : 'View pricing'} <ArrowRight size={16} />
                  </Link>
                </div>
                <p className="text-white/40 text-sm mt-6">
                  {isFr ? 'Sans engagement. Configuration en 2 minutes.' : 'No commitment. 2-minute setup.'}
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
