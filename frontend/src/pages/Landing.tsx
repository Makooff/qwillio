import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone, Calendar, BarChart3, Shield, Zap, Clock,
  ChevronRight, Play, ArrowRight, Check,
  MessageSquare, BrainCircuit, Globe
} from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import { useLang } from '../stores/langStore';

/* ── Animated counter ── */
function Counter({ value, suffix = '' }: { value: number; suffix?: string }) {
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
          const p = Math.min((ts - t0) / 1800, 1);
          setN(Math.floor((1 - Math.pow(1 - p, 3)) * value));
          if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }
    }, { threshold: 0.4 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [value]);
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>;
}

/* ── Section observer for fade-in ── */
function FadeIn({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); obs.disconnect(); }
    }, { threshold: 0.1 });
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

/* ── Ashley / Marie Voice Demo Toggle ── */
function DemoVoiceToggle() {
  const [active, setActive] = useState<'en' | 'fr'>('en');
  const { t } = useLang();
  const bars = Array.from({ length: 32 }, (_, i) => i);

  return (
    <div className="mt-12 max-w-lg mx-auto">
      <div className="inline-flex rounded-full border border-[#d2d2d7] p-1 mb-6 bg-white">
        <button
          onClick={() => setActive('en')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${active === 'en' ? 'bg-[#1d1d1f] text-white' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
        >
          {t('demo.listenEn')}
        </button>
        <button
          onClick={() => setActive('fr')}
          className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${active === 'fr' ? 'bg-[#6366f1] text-white' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
        >
          {t('demo.listenFr')}
        </button>
      </div>
      {/* Placeholder waveform */}
      <div className="flex items-center justify-center gap-[3px] h-14 px-4">
        {bars.map((i) => {
          const h = 20 + Math.abs(Math.sin(i * 0.7 + (active === 'en' ? 0 : 1.2))) * 60;
          const color = active === 'en' ? '#1d1d1f' : '#6366f1';
          return (
            <div
              key={i}
              style={{ height: `${h}%`, backgroundColor: color, opacity: 0.5 + (h / 80) * 0.5 }}
              className="w-1 rounded-full transition-all duration-300"
            />
          );
        })}
      </div>
      <p className="text-xs text-[#86868b] mt-3">{t('demo.waveform')}</p>
    </div>
  );
}

/* ── Niches Section ── */
function NichesSection() {
  const { t } = useLang();
  const niches = [
    { key: 'dental', emoji: '🦷' },
    { key: 'medical', emoji: '🏥' },
    { key: 'law', emoji: '⚖️' },
    { key: 'realestate', emoji: '🏠' },
    { key: 'spa', emoji: '💆' },
    { key: 'plumber', emoji: '🔧' },
    { key: 'hvac', emoji: '❄️' },
    { key: 'restaurant', emoji: '🍽️' },
    { key: 'auto', emoji: '🚗' },
    { key: 'insurance', emoji: '🛡️' },
    { key: 'coaching', emoji: '🎯' },
    { key: 'accounting', emoji: '📊' },
  ] as const;

  return (
    <section className="py-24 md:py-32 px-6 bg-[#f5f5f7]">
      <div className="max-w-[1120px] mx-auto">
        <FadeIn>
          <div className="text-center mb-14">
            <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('niches.label')}</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">{t('niches.title')}</h2>
            <p className="text-lg text-[#86868b] mt-4 max-w-lg mx-auto">{t('niches.subtitle')}</p>
          </div>
        </FadeIn>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {niches.map((n, i) => (
            <FadeIn key={n.key} delay={i * 50}>
              <div className="rounded-2xl bg-white border border-[#d2d2d7]/60 p-5 text-center hover:border-[#6366f1]/40 hover:shadow-sm transition-all duration-200">
                <p className="text-3xl mb-2">{n.emoji}</p>
                <p className="text-sm font-medium text-[#1d1d1f] leading-tight">{t(`niches.${n.key}` as any)}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════
   LANDING PAGE — Apple-inspired minimal
   ═══════════════════════════════════════════ */
export default function Landing() {
  const [scrolled, setScrolled] = useState(false);
  const { t } = useLang();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const features = [
    { icon: Phone, title: t('feat.1.title'), desc: t('feat.1.desc') },
    { icon: BrainCircuit, title: t('feat.2.title'), desc: t('feat.2.desc') },
    { icon: Calendar, title: t('feat.3.title'), desc: t('feat.3.desc') },
    { icon: MessageSquare, title: t('feat.4.title'), desc: t('feat.4.desc') },
    { icon: BarChart3, title: t('feat.5.title'), desc: t('feat.5.desc') },
    { icon: Shield, title: t('feat.6.title'), desc: t('feat.6.desc') },
    { icon: Globe, title: t('feat.7.title'), desc: t('feat.7.desc') },
    { icon: Zap, title: t('feat.8.title'), desc: t('feat.8.desc') },
    { icon: Clock, title: t('feat.9.title'), desc: t('feat.9.desc') },
  ];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">

      {/* ── NAVBAR ── */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/80 backdrop-blur-xl shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-[1120px] mx-auto px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 text-xl font-semibold tracking-tight text-[#1d1d1f]">
            <QwillioLogo size={30} /> Qwillio
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-[#1d1d1f]/70">
            <a href="#features" className="hover:text-[#1d1d1f] transition-colors">{t('nav.features')}</a>
            <a href="#how" className="hover:text-[#1d1d1f] transition-colors">{t('nav.how')}</a>
            <a href="#pricing" className="hover:text-[#1d1d1f] transition-colors">{t('nav.pricing')}</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-[#1d1d1f]/70 hover:text-[#1d1d1f] transition-colors hidden sm:block">
              {t('nav.login')}
            </Link>
            <a
              href="/demo.html"
              className="inline-flex items-center gap-2 bg-[#6366f1] text-white text-sm font-medium px-5 py-2 rounded-full hover:bg-[#4f46e5] transition-colors"
            >
              <Play size={14} /> {t('nav.try')}
            </a>
            <LangToggle />
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="pt-32 pb-20 md:pt-44 md:pb-32 text-center px-6">
        <FadeIn>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] max-w-3xl mx-auto">
            {t('hero.title1')}<br />
            <span className="bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
              {t('hero.title2')}
            </span>
          </h1>
        </FadeIn>
        <FadeIn delay={100}>
          <p className="mt-6 text-lg md:text-xl text-[#86868b] max-w-xl mx-auto leading-relaxed">
            {t('hero.subtitle')}
          </p>
        </FadeIn>
        <FadeIn delay={200}>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-[#6366f1] text-white text-base font-medium px-8 py-3.5 rounded-full hover:bg-[#4f46e5] transition-colors"
            >
              {t('hero.cta')} <ArrowRight size={18} />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-1.5 text-[#6366f1] text-base font-medium hover:underline"
            >
              {t('hero.how')} <ChevronRight size={16} />
            </a>
          </div>
        </FadeIn>

        {/* Stats */}
        <FadeIn delay={400}>
          <div className="mt-20 grid grid-cols-3 text-center w-full max-w-xl mx-auto">
            <div>
              <p className="text-3xl md:text-4xl font-semibold tracking-tight">
                <Counter value={98} suffix="%" />
              </p>
              <p className="text-xs md:text-sm text-[#86868b] mt-1">{t('hero.stat1')}</p>
            </div>
            <div className="border-x border-[#d2d2d7]">
              <p className="text-3xl md:text-4xl font-semibold tracking-tight">
                <Counter value={2500} suffix="+" />
              </p>
              <p className="text-xs md:text-sm text-[#86868b] mt-1">{t('hero.stat2')}</p>
            </div>
            <div>
              <p className="text-3xl md:text-4xl font-semibold tracking-tight">
                <Counter value={35} suffix="%" />
              </p>
              <p className="text-xs md:text-sm text-[#86868b] mt-1">{t('hero.stat3')}</p>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ── DIVIDER ── */}
      <div className="max-w-[1120px] mx-auto px-6"><div className="border-t border-[#d2d2d7]/60" /></div>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 md:py-32 px-6">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('feat.label')}</p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {t('feat.title')}<br />{t('feat.title2')}
              </h2>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {features.map((f, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="group p-8 rounded-2xl bg-[#f5f5f7] hover:bg-[#e8e8ed] transition-colors duration-300">
                  <f.icon size={28} className="text-[#6366f1] mb-5" strokeWidth={1.5} />
                  <h3 className="text-lg font-semibold mb-2 tracking-tight">{f.title}</h3>
                  <p className="text-[15px] text-[#86868b] leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="how" className="py-24 md:py-32 px-6 bg-[#f5f5f7]">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-20">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('how.label')}</p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {t('how.title')}
              </h2>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
            {[
              { num: '01', title: t('how.1.title'), desc: t('how.1.desc') },
              { num: '02', title: t('how.2.title'), desc: t('how.2.desc') },
              { num: '03', title: t('how.3.title'), desc: t('how.3.desc') },
            ].map((step, i) => (
              <FadeIn key={i} delay={i * 150}>
                <div className="text-center">
                  <p className="text-6xl md:text-7xl font-bold mb-6 text-[#6366f1]">{step.num}</p>
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">{step.title}</h3>
                  <p className="text-[15px] text-[#86868b] leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO CTA ── */}
      <section className="py-24 md:py-32 px-6">
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-5">
              {t('demo.title')}
            </h2>
            <p className="text-lg text-[#86868b] max-w-lg mx-auto mb-10 leading-relaxed">
              {t('demo.subtitle')}
            </p>
            <a
              href="/demo.html"
              className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-base font-medium px-8 py-3.5 rounded-full hover:bg-[#424245] transition-colors"
            >
              <Phone size={18} /> {t('demo.cta')}
            </a>

            {/* ── Ashley / Marie audio demo toggle ── */}
            <DemoVoiceToggle />
          </div>
        </FadeIn>
      </section>

      {/* ── DIVIDER ── */}
      <div className="max-w-[1120px] mx-auto px-6"><div className="border-t border-[#d2d2d7]/60" /></div>

      {/* ── NICHES ── */}
      <NichesSection />

      {/* ── DIVIDER ── */}
      <div className="max-w-[1120px] mx-auto px-6"><div className="border-t border-[#d2d2d7]/60" /></div>

      {/* ── PRICING ── */}
      <section id="pricing" className="py-24 md:py-32 px-6">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('price.label')}</p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {t('price.title')}
              </h2>
              <p className="text-lg text-[#86868b] mt-4">
                {t('price.trial')}
              </p>
            </div>
          </FadeIn>

          {/* ── Ashley Receptionist Plans ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Starter */}
            <FadeIn delay={0}>
              <div className="rounded-2xl border border-[#d2d2d7] p-8 flex flex-col h-full">
                <h3 className="text-xl font-semibold mb-1">Starter</h3>
                <p className="text-[#86868b] text-sm mb-6">{t('price.starter.sub')}</p>
                <div className="mb-1">
                  <span className="text-4xl font-semibold tracking-tight">$0</span>
                  <span className="text-[#86868b]">/mo</span>
                  <span className="ml-2 text-sm text-[#86868b] line-through">$497</span>
                </div>
                <p className="text-sm text-[#6366f1] font-medium mb-1">{t('price.firstFree')}</p>
                <p className="text-xs text-[#86868b] mb-2">{t('price.then')} $497/mo</p>
                <p className="text-xs text-emerald-600 font-medium mb-4">{t('price.noSetup')}</p>
                <p className="text-sm font-medium text-[#6366f1] mb-1">800 {t('price.calls')}</p>
                <p className="text-xs text-[#86868b] mb-6">$0.22 {t('price.overage')}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {[t('pf.starter.1'), t('pf.starter.2'), t('pf.starter.3'), t('pf.starter.4'), t('pf.starter.5')].map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#1d1d1f]/80">
                      <Check size={16} className="text-[#6366f1] mt-0.5 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register?plan=starter" className="block text-center border border-[#6366f1] text-[#6366f1] text-sm font-medium px-6 py-3 rounded-full hover:bg-[#6366f1] hover:text-white transition-colors">
                  {t('price.choose')}
                </Link>
              </div>
            </FadeIn>

            {/* Pro */}
            <FadeIn delay={100}>
              <div className="rounded-2xl bg-[#1d1d1f] text-white p-8 flex flex-col h-full relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6366f1] text-white text-xs font-semibold px-4 py-1 rounded-full">
                  {t('price.popular')}
                </span>
                <h3 className="text-xl font-semibold mb-1">Pro</h3>
                <p className="text-white/50 text-sm mb-6">{t('price.pro.sub')}</p>
                <div className="mb-1">
                  <span className="text-4xl font-semibold tracking-tight">$0</span>
                  <span className="text-white/50">/mo</span>
                  <span className="ml-2 text-sm text-white/40 line-through">$1,297</span>
                </div>
                <p className="text-sm text-[#818cf8] font-medium mb-1">{t('price.firstFree')}</p>
                <p className="text-xs text-white/40 mb-2">{t('price.then')} $1,297/mo</p>
                <p className="text-xs text-emerald-400 font-medium mb-4">{t('price.noSetup')}</p>
                <p className="text-sm font-medium text-[#6366f1] mb-1">2,000 {t('price.calls')}</p>
                <p className="text-xs text-white/40 mb-6">$0.18 {t('price.overage')}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {[t('pf.pro.1'), t('pf.pro.2'), t('pf.pro.3'), t('pf.pro.4'), t('pf.pro.5'), t('pf.pro.6')].map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                      <Check size={16} className="text-[#6366f1] mt-0.5 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register?plan=pro" className="block text-center bg-[#6366f1] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-[#4f46e5] transition-colors">
                  {t('price.choose')}
                </Link>
              </div>
            </FadeIn>

            {/* Enterprise */}
            <FadeIn delay={200}>
              <div className="rounded-2xl border border-[#d2d2d7] p-8 flex flex-col h-full">
                <h3 className="text-xl font-semibold mb-1">Enterprise</h3>
                <p className="text-[#86868b] text-sm mb-6">{t('price.enterprise.sub')}</p>
                <div className="mb-1">
                  <span className="text-4xl font-semibold tracking-tight">$0</span>
                  <span className="text-[#86868b]">/mo</span>
                  <span className="ml-2 text-sm text-[#86868b] line-through">$2,497</span>
                </div>
                <p className="text-sm text-[#6366f1] font-medium mb-1">{t('price.firstFree')}</p>
                <p className="text-xs text-[#86868b] mb-2">{t('price.then')} $2,497/mo</p>
                <p className="text-xs text-emerald-600 font-medium mb-4">{t('price.noSetup')}</p>
                <p className="text-sm font-medium text-[#6366f1] mb-1">4,000 {t('price.calls')}</p>
                <p className="text-xs text-[#86868b] mb-6">$0.15 {t('price.overage')}</p>
                <ul className="space-y-3 mb-8 flex-1">
                  {[t('pf.enterprise.1'), t('pf.enterprise.2'), t('pf.enterprise.3'), t('pf.enterprise.4'), t('pf.enterprise.5'), t('pf.enterprise.6')].map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#1d1d1f]/80">
                      <Check size={16} className="text-[#6366f1] mt-0.5 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/register?plan=enterprise" className="block text-center border border-[#6366f1] text-[#6366f1] text-sm font-medium px-6 py-3 rounded-full hover:bg-[#6366f1] hover:text-white transition-colors">
                  {t('price.choose')}
                </Link>
              </div>
            </FadeIn>
          </div>

          {/* ── Qwillio Agent Add-ons ── */}
          <FadeIn delay={300}>
            <div className="mt-20 text-center mb-12">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('agent.label')}</p>
              <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">{t('agent.title')}</h3>
              <p className="text-[#86868b] mt-3 max-w-lg mx-auto">{t('agent.subtitle')}</p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { name: 'Email AI', price: 197, desc: t('agent.email') },
              { name: 'Payments AI', price: 97, desc: t('agent.payments') },
              { name: 'Accounting AI', price: 297, desc: t('agent.accounting') },
              { name: 'Inventory AI', price: 197, desc: t('agent.inventory') },
            ].map((mod, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="rounded-xl border border-[#d2d2d7] p-6 hover:border-[#6366f1]/40 transition-colors h-full">
                  <h4 className="text-base font-semibold mb-1">{mod.name}</h4>
                  <p className="text-2xl font-semibold tracking-tight mb-2">+${mod.price}<span className="text-sm text-[#86868b] font-normal">/mo</span></p>
                  <p className="text-sm text-[#86868b] leading-relaxed">{mod.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
          <FadeIn delay={400}>
            <div className="mt-6 rounded-xl bg-gradient-to-r from-[#6366f1]/5 to-[#a855f7]/5 border border-[#6366f1]/20 p-6 text-center">
              <p className="text-lg font-semibold">{t('agent.bundle')}</p>
              <p className="text-3xl font-semibold tracking-tight mt-1">+$597<span className="text-sm text-[#86868b] font-normal">/mo</span></p>
              <p className="text-sm text-[#86868b] mt-1">{t('agent.bundleSave')}</p>
            </div>
          </FadeIn>

          {/* ── Full Bundles ── */}
          <FadeIn delay={500}>
            <div className="mt-16 text-center mb-8">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('bundles.label')}</p>
              <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">{t('bundles.title')}</h3>
              <p className="text-[#86868b] mt-2 text-sm max-w-lg mx-auto">{t('bundles.subtitle')}</p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { plan: 'Starter', base: 497, bundle: 597, total: 997 },
              { plan: 'Pro', base: 1297, bundle: 597, total: 1797 },
              { plan: 'Enterprise', base: 2497, bundle: 597, total: 2997 },
            ].map((b, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="rounded-xl border border-[#d2d2d7] p-5 flex items-center justify-between gap-4 hover:border-[#6366f1]/40 transition-colors">
                  <div>
                    <p className="text-sm font-semibold">{b.plan} + Agent Bundle</p>
                    <p className="text-xs text-[#86868b] mt-0.5">${b.base} + ${b.bundle}/mo</p>
                  </div>
                  <p className="text-xl font-semibold tracking-tight text-[#6366f1] whitespace-nowrap">
                    ${b.total.toLocaleString()}<span className="text-xs text-[#86868b] font-normal">/mo</span>
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>

          {/* ── Integrations ── */}
          <FadeIn delay={500}>
            <div className="mt-20 text-center">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('integrations.label')}</p>
              <h3 className="text-2xl font-semibold tracking-tight mb-8">{t('integrations.title')}</h3>
              <div className="flex flex-wrap justify-center gap-6 text-[#86868b] text-sm font-medium">
                {['HubSpot', 'Salesforce', 'Pipedrive', 'Zoho CRM', 'GoHighLevel', 'Google Sheets', 'Notion', 'QuickBooks', 'Stripe', 'Google Calendar', 'Zapier'].map((name) => (
                  <span key={name} className="px-4 py-2 rounded-full bg-[#f5f5f7] border border-[#d2d2d7]/60">{name}</span>
                ))}
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 md:py-32 px-6 text-center">
        <FadeIn>
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight max-w-2xl mx-auto">
            {t('final.title')}
          </h2>
          <p className="mt-5 text-lg text-[#86868b] max-w-md mx-auto">
            {t('final.subtitle')}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="inline-flex items-center gap-2 bg-[#6366f1] text-white text-base font-medium px-8 py-3.5 rounded-full hover:bg-[#4f46e5] transition-colors"
            >
              {t('final.cta')} <ArrowRight size={18} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-[#6366f1] text-base font-medium hover:underline"
            >
              {t('final.dashboard')} <ArrowRight size={16} />
            </Link>
          </div>
        </FadeIn>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#d2d2d7]/60 bg-[#f5f5f7]">
        <div className="max-w-[1120px] mx-auto px-6 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <QwillioLogo size={24} />
                <p className="text-base font-semibold">Qwillio</p>
              </div>
              <p className="text-sm text-[#86868b] leading-relaxed">
                {t('footer.tagline')}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-3">{t('footer.product')}</p>
              <div className="space-y-2">
                <a href="#features" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{t('footer.features')}</a>
                <a href="#pricing" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{t('footer.pricing')}</a>
                <a href="/demo.html" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{t('footer.demo')}</a>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-3">{t('footer.company')}</p>
              <div className="space-y-2">
                <Link to="/about" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{t('footer.about')}</Link>
                <a href="#" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{t('footer.blog')}</a>
                <Link to="/contact" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{t('footer.contact')}</Link>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-[#86868b] uppercase tracking-wider mb-3">{t('footer.legal')}</p>
              <div className="space-y-2">
                <Link to="/privacy" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{t('footer.privacy')}</Link>
                <Link to="/terms" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{t('footer.terms')}</Link>
                <Link to="/gdpr" className="block text-sm text-[#424245] hover:text-[#1d1d1f]">{t('footer.gdpr')}</Link>
              </div>
            </div>
          </div>
          <div className="border-t border-[#d2d2d7]/60 pt-6">
            <p className="text-xs text-[#86868b]">{t('footer.rights')}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
