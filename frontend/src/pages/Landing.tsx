import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Phone, Calendar, BarChart3, Shield, Zap, Clock,
  ChevronRight, Play, ArrowRight, Check,
  MessageSquare, BrainCircuit, Globe,
  Mail, CreditCard, Calculator, Package, Plus,
  PhoneForwarded, Mic, Filter, Target, UserCheck, Send, Search, Link2, Activity, FileText, Headphones, Languages, Cpu, Lock, Gauge, Wifi
} from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {niches.map((n, i) => (
            <FadeIn key={n.key} delay={i * 50}>
              <div className="rounded-2xl bg-white border border-[#d2d2d7]/60 p-6 hover:border-[#6366f1]/40 hover:shadow-md transition-all duration-200 h-full">
                <p className="text-3xl mb-3">{n.emoji}</p>
                <p className="text-base font-semibold text-[#1d1d1f] mb-1.5">{t(`niches.${n.key}` as any)}</p>
                <p className="text-sm text-[#86868b] leading-relaxed">{t(`niches.${n.key}.desc` as any)}</p>
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
  const { t, lang } = useLang();
  const isFr = lang === 'fr';

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  /* ── Feature categories (simplified for card layout) ── */
  const callIntelligenceFeatures = [
    { icon: Phone, title: isFr ? 'R\u00e9ponse 24/7' : '24/7 Answering', desc: isFr ? 'Chaque appel d\u00e9croch\u00e9 en <1s, jour et nuit.' : 'Every call answered in <1s, day and night.' },
    { icon: Mic, title: isFr ? 'Voix naturelle' : 'Natural Voice', desc: isFr ? 'Ashley (EN) & Marie (FR) — voix ElevenLabs.' : 'Ashley (EN) & Marie (FR) — ElevenLabs voices.' },
    { icon: PhoneForwarded, title: isFr ? 'Transfert intelligent' : 'Smart Transfer', desc: isFr ? 'Routage vers la bonne personne selon le contexte.' : 'Route to the right person based on context.' },
    { icon: MessageSquare, title: isFr ? 'D\u00e9tection messagerie' : 'Voicemail Detection', desc: isFr ? 'D\u00e9tecte, r\u00e9essaie et laisse un message auto.' : 'Detects, retries, and leaves auto voicemail.' },
    { icon: Filter, title: isFr ? 'Anti-spam' : 'Spam Filtering', desc: isFr ? 'Bloque les appels ind\u00e9sirables automatiquement.' : 'Blocks unwanted calls automatically.' },
  ];

  const leadManagementFeatures = [
    { icon: Target, title: isFr ? 'Scoring des leads' : 'Lead Scoring', desc: isFr ? 'Score d\u2019int\u00e9r\u00eat de 1 \u00e0 10 pour chaque prospect.' : 'Interest score from 1 to 10 for every prospect.' },
    { icon: Calendar, title: isFr ? 'R\u00e9servation auto' : 'Auto Booking', desc: isFr ? 'R\u00e9serve le RDV pendant l\u2019appel + SMS de confirmation.' : 'Books appointment during the call + SMS confirmation.' },
    { icon: Send, title: isFr ? 'Relances SMS' : 'SMS Follow-Up', desc: isFr ? 'S\u00e9quences de relance automatiques post-appel.' : 'Automatic post-call follow-up sequences.' },
    { icon: Search, title: isFr ? 'Enrichissement' : 'Lead Enrichment', desc: isFr ? 'Google Places : adresse, avis, site web auto.' : 'Google Places: address, reviews, website auto.' },
    { icon: Link2, title: isFr ? 'Sync CRM' : 'CRM Sync', desc: isFr ? 'HubSpot, Salesforce, Pipedrive en temps r\u00e9el.' : 'HubSpot, Salesforce, Pipedrive in real time.' },
  ];

  const analyticsFeatures = [
    { icon: Activity, title: isFr ? 'Dashboard temps r\u00e9el' : 'Real-Time Dashboard', desc: isFr ? 'Appels, transcriptions, scores — tout en un.' : 'Calls, transcripts, scores — all in one.' },
    { icon: BrainCircuit, title: isFr ? 'Analyse de sentiment' : 'Sentiment Analysis', desc: isFr ? 'D\u00e9tecte le ton et les \u00e9motions des appelants.' : 'Detects caller tone and emotions.' },
    { icon: Headphones, title: isFr ? 'Enregistrement' : 'Call Recording', desc: isFr ? 'Audio + transcription compl\u00e8te de chaque appel.' : 'Audio + full transcript for every call.' },
    { icon: FileText, title: isFr ? 'Scripts par niche' : 'Niche Scripts', desc: isFr ? 'Scripts IA optimis\u00e9s par industrie.' : 'AI scripts optimized per industry.' },
    { icon: Languages, title: isFr ? 'Bilingue auto' : 'Auto Bilingual', desc: isFr ? 'D\u00e9tection EN/FR automatique en temps r\u00e9el.' : 'Automatic EN/FR detection in real time.' },
  ];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">

      {/* ── NAVBAR ── */}
      <PublicNavbar />

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
          <div className="mt-20 flex flex-row items-stretch justify-center divide-x divide-[#d2d2d7] w-full max-w-xl mx-auto">
            {[
              { value: 98,   suffix: '%', label: t('hero.stat1') },
              { value: 2500, suffix: '+', label: t('hero.stat2') },
              { value: 35,   suffix: '%', label: t('hero.stat3') },
            ].map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-center px-2 py-2">
                <p className="text-3xl md:text-4xl font-semibold tracking-tight whitespace-nowrap">
                  <Counter value={s.value} suffix={s.suffix} />
                </p>
                <p className="text-xs md:text-sm text-[#86868b] mt-1 text-center leading-tight">{s.label}</p>
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      {/* ── DIVIDER ── */}
      <div className="max-w-[1120px] mx-auto px-6"><div className="border-t border-[#d2d2d7]/60" /></div>

      {/* ── HOW IT WORKS (3 steps) ── */}
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
              {
                num: '01',
                title: isFr ? 'Configurez votre agent' : 'Configure your agent',
                desc: isFr
                  ? 'Décrivez votre activité, vos services et vos consignes. Qwillio crée un agent personnalisé en quelques minutes.'
                  : 'Describe your business, services and guidelines. Qwillio creates a custom agent in minutes.',
              },
              {
                num: '02',
                title: isFr ? 'Transférez vos appels' : 'Forward your calls',
                desc: isFr
                  ? 'Redirigez votre ligne en 30 secondes. Aucune installation, aucun matériel. Fonctionne avec tous les opérateurs.'
                  : 'Redirect your line in 30 seconds. No installation, no hardware. Works with any carrier.',
              },
              {
                num: '03',
                title: isFr ? 'L\u2019IA fait le reste' : 'AI does the rest',
                desc: isFr
                  ? 'Ashley ou Marie répond 24/7, qualifie les leads, réserve les rendez-vous et vous envoie un résumé en temps réel.'
                  : 'Ashley or Marie answers 24/7, qualifies leads, books appointments, and sends you a real-time summary.',
              },
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

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 md:py-32 px-6 bg-[#f5f5f7]">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-20">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('feat.label')}</p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {t('feat.title')}<br />{t('feat.title2')}
              </h2>
            </div>
          </FadeIn>

          {/* ── Bento Grid ── */}
          <div className="space-y-16">

            {/* ── Category 1: Call Intelligence ── */}
            <FadeIn>
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-[#6366f1] flex items-center justify-center">
                    <Phone size={18} className="text-white" />
                  </div>
                  <h3 className="text-xl font-semibold">{isFr ? 'Intelligence d’appel' : 'Call Intelligence'}</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {/* Big card */}
                  <div className="col-span-2 md:row-span-2 bg-gradient-to-br from-[#6366f1] to-[#818cf8] rounded-3xl p-7 text-white flex flex-col justify-between min-h-[240px] group hover:shadow-xl hover:shadow-[#6366f1]/20 transition-all duration-500">
                    <div>
                      <Phone size={28} className="text-white/80 mb-4" strokeWidth={1.5} />
                      <h4 className="text-lg font-semibold mb-2">{callIntelligenceFeatures[0].title}</h4>
                      <p className="text-sm text-white/70 leading-relaxed">{callIntelligenceFeatures[0].desc}</p>
                    </div>
                    <div className="mt-6 flex items-end gap-1">
                      {[40, 65, 45, 80, 55, 90, 70, 95].map((h, i) => (
                        <div key={i} className="flex-1 bg-white/20 rounded-sm group-hover:bg-white/30 transition-all duration-500" style={{ height: h + 'px' }} />
                      ))}
                    </div>
                  </div>
                  {/* 4 small cards */}
                  {callIntelligenceFeatures.slice(1).map((f, i) => (
                    <div key={i} className="col-span-1 md:col-span-2 bg-white rounded-2xl p-5 border border-[#e5e5ea] hover:border-[#6366f1]/30 hover:shadow-lg hover:shadow-[#6366f1]/5 transition-all duration-300 group">
                      <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center mb-3 group-hover:bg-[#6366f1]/15 transition-colors">
                        <f.icon size={20} className="text-[#6366f1]" strokeWidth={1.5} />
                      </div>
                      <h4 className="text-sm font-semibold mb-1.5">{f.title}</h4>
                      <p className="text-xs text-[#86868b] leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

            {/* ── Category 2: Lead Management ── */}
            <FadeIn>
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-[#8b5cf6] flex items-center justify-center">
                    <Target size={18} className="text-white" />
                  </div>
                  <h3 className="text-xl font-semibold">{isFr ? 'Gestion des leads' : 'Lead Management'}</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Top row - 3 cards */}
                  {leadManagementFeatures.slice(0, 3).map((f, i) => (
                    <div key={i} className="col-span-1 bg-white rounded-2xl p-5 border border-[#e5e5ea] hover:border-[#8b5cf6]/30 hover:shadow-lg hover:shadow-[#8b5cf6]/5 transition-all duration-300 group">
                      <div className="w-10 h-10 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center mb-3 group-hover:bg-[#8b5cf6]/15 transition-colors">
                        <f.icon size={20} className="text-[#8b5cf6]" strokeWidth={1.5} />
                      </div>
                      <h4 className="text-sm font-semibold mb-1.5">{f.title}</h4>
                      <p className="text-xs text-[#86868b] leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                  {/* Bottom row - 1 wide gradient + 1 card */}
                  <div className="col-span-2 bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa] rounded-3xl p-7 text-white flex items-center gap-8 group hover:shadow-xl hover:shadow-[#8b5cf6]/20 transition-all duration-500">
                    <div className="flex-1">
                      <Search size={28} className="text-white/80 mb-3" strokeWidth={1.5} />
                      <h4 className="text-lg font-semibold mb-2">{leadManagementFeatures[3].title}</h4>
                      <p className="text-sm text-white/70 leading-relaxed">{leadManagementFeatures[3].desc}</p>
                    </div>
                    <div className="hidden md:flex items-center gap-3 text-white/30">
                      <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center"><Search size={20} className="text-white/50" /></div>
                      <ArrowRight size={16} />
                      <div className="w-12 h-12 rounded-full border-2 border-white/20 flex items-center justify-center"><UserCheck size={20} className="text-white/50" /></div>
                      <ArrowRight size={16} />
                      <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center"><Check size={20} className="text-white/60" /></div>
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-1 bg-white rounded-2xl p-5 border border-[#e5e5ea] hover:border-[#8b5cf6]/30 hover:shadow-lg hover:shadow-[#8b5cf6]/5 transition-all duration-300 group">
                    <div className="w-10 h-10 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center mb-3 group-hover:bg-[#8b5cf6]/15 transition-colors">
                      <Link2 size={20} className="text-[#8b5cf6]" strokeWidth={1.5} />
                    </div>
                    <h4 className="text-sm font-semibold mb-1.5">{leadManagementFeatures[4].title}</h4>
                    <p className="text-xs text-[#86868b] leading-relaxed">{leadManagementFeatures[4].desc}</p>
                  </div>
                </div>
              </div>
            </FadeIn>

            {/* ── Category 3: Analytics & Control ── */}
            <FadeIn>
              <div>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-9 h-9 rounded-xl bg-[#6366f1] flex items-center justify-center">
                    <BarChart3 size={18} className="text-white" />
                  </div>
                  <h3 className="text-xl font-semibold">{isFr ? 'Analytique & contrôle' : 'Analytics & Control'}</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  {/* 2 small cards */}
                  {analyticsFeatures.slice(0, 2).map((f, i) => (
                    <div key={i} className="col-span-1 md:col-span-2 bg-white rounded-2xl p-5 border border-[#e5e5ea] hover:border-[#6366f1]/30 hover:shadow-lg hover:shadow-[#6366f1]/5 transition-all duration-300 group">
                      <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center mb-3 group-hover:bg-[#6366f1]/15 transition-colors">
                        <f.icon size={20} className="text-[#6366f1]" strokeWidth={1.5} />
                      </div>
                      <h4 className="text-sm font-semibold mb-1.5">{f.title}</h4>
                      <p className="text-xs text-[#86868b] leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                  {/* Big card on the right */}
                  <div className="col-span-2 md:row-span-2 bg-gradient-to-br from-[#6366f1] to-[#818cf8] rounded-3xl p-7 text-white flex flex-col justify-between min-h-[240px] group hover:shadow-xl hover:shadow-[#6366f1]/20 transition-all duration-500">
                    <div>
                      <Headphones size={28} className="text-white/80 mb-4" strokeWidth={1.5} />
                      <h4 className="text-lg font-semibold mb-2">{analyticsFeatures[2].title}</h4>
                      <p className="text-sm text-white/70 leading-relaxed">{analyticsFeatures[2].desc}</p>
                    </div>
                    <div className="mt-6 space-y-2">
                      {[85, 60, 92].map((w, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div className="h-full bg-white/30 rounded-full group-hover:bg-white/40 transition-all duration-700" style={{ width: w + '%' }} />
                          </div>
                          <span className="text-xs text-white/40 w-8">{w}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* 2 more small cards */}
                  {analyticsFeatures.slice(3).map((f, i) => (
                    <div key={i} className="col-span-1 md:col-span-2 bg-white rounded-2xl p-5 border border-[#e5e5ea] hover:border-[#6366f1]/30 hover:shadow-lg hover:shadow-[#6366f1]/5 transition-all duration-300 group">
                      <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center mb-3 group-hover:bg-[#6366f1]/15 transition-colors">
                        <f.icon size={20} className="text-[#6366f1]" strokeWidth={1.5} />
                      </div>
                      <h4 className="text-sm font-semibold mb-1.5">{f.title}</h4>
                      <p className="text-xs text-[#86868b] leading-relaxed">{f.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeIn>

          </div>
        </div>
      </section>

      {/* ── TECHNOLOGY ── */}
      <section className="py-24 md:py-32 px-6 bg-[#1d1d1f] text-white">
        <div className="max-w-[1120px] mx-auto">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-sm font-medium text-[#818cf8] tracking-wide uppercase mb-3">
                {isFr ? 'Technologie' : 'Technology'}
              </p>
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
                {isFr ? 'Propuls\u00e9 par les meilleurs' : 'Powered by the Best'}
              </h2>
              <p className="text-lg text-white/50 mt-4 max-w-lg mx-auto">
                {isFr
                  ? 'Une infrastructure de pointe pour des conversations ind\u00e9tectables de l\u2019IA.'
                  : 'Cutting-edge infrastructure for AI conversations indistinguishable from humans.'}
              </p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: Mic,
                title: isFr ? 'Synth\u00e8se vocale ElevenLabs' : 'ElevenLabs Voice Synthesis',
                desc: isFr
                  ? 'Ashley utilise la voix Rachel, Marie la voix Am\u00e9lie. Les voix les plus r\u00e9alistes du march\u00e9, avec intonation naturelle et \u00e9motion.'
                  : 'Ashley uses the Rachel voice, Marie uses the Amelie voice. The most realistic voices on the market, with natural intonation and emotion.',
              },
              {
                icon: Cpu,
                title: isFr ? 'Conversations GPT-4' : 'GPT-4 Powered Conversations',
                desc: isFr
                  ? 'Chaque conversation est pilot\u00e9e par GPT-4 pour une compr\u00e9hension contextuelle profonde, des r\u00e9ponses intelligentes et une adaptation en temps r\u00e9el.'
                  : 'Every conversation is powered by GPT-4 for deep contextual understanding, intelligent responses, and real-time adaptation.',
              },
              {
                icon: Gauge,
                title: isFr ? 'Temps de r\u00e9ponse < 1 seconde' : '<1 Second Response Time',
                desc: isFr
                  ? 'Latence inf\u00e9rieure \u00e0 une seconde entre chaque r\u00e9plique. La conversation coule naturellement, sans pauses artificielles ni d\u00e9lais perceptibles.'
                  : 'Sub-one-second latency between each reply. Conversation flows naturally with no artificial pauses or noticeable delays.',
              },
              {
                icon: Wifi,
                title: isFr ? 'SLA 99.5% de disponibilit\u00e9' : '99.5% Uptime SLA',
                desc: isFr
                  ? 'Infrastructure redondante avec basculement automatique. Votre r\u00e9ceptionniste IA est toujours en ligne, garanti par contrat.'
                  : 'Redundant infrastructure with automatic failover. Your AI receptionist is always online, guaranteed by contract.',
              },
              {
                icon: Lock,
                title: isFr ? 'Chiffrement bout en bout' : 'End-to-End Encryption',
                desc: isFr
                  ? 'Toutes les donn\u00e9es d\u2019appel, transcriptions et enregistrements sont chiffr\u00e9s en transit et au repos. Vos donn\u00e9es restent les v\u00f4tres.'
                  : 'All call data, transcripts, and recordings are encrypted in transit and at rest. Your data stays yours.',
              },
              {
                icon: Shield,
                title: isFr ? 'Conforme RGPD + CCPA' : 'GDPR + CCPA Compliant',
                desc: isFr
                  ? 'Pleinement conforme aux r\u00e9glementations europ\u00e9ennes (RGPD) et californiennes (CCPA). Suppression des donn\u00e9es sur demande, consentement enregistr\u00e9.'
                  : 'Fully compliant with European (GDPR) and California (CCPA) regulations. Data deletion on request, recorded consent.',
              },
            ].map((item, i) => (
              <FadeIn key={i} delay={i * 100}>
                <div className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-[#6366f1]/40 transition-colors duration-300 h-full">
                  <item.icon size={28} className="text-[#818cf8] mb-5" strokeWidth={1.5} />
                  <h3 className="text-lg font-semibold mb-2 tracking-tight">{item.title}</h3>
                  <p className="text-[15px] text-white/50 leading-relaxed">{item.desc}</p>
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
                <ul className="space-y-3 mb-6 flex-1">
                  {[t('pf.starter.1'), t('pf.starter.2'), t('pf.starter.3'), t('pf.starter.4'), t('pf.starter.5')].map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#1d1d1f]/80">
                      <Check size={16} className="text-[#6366f1] mt-0.5 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="space-y-2 mb-6">
                  <Link to="/register?plan=starter&bundle=true" className="flex items-center justify-between rounded-xl border border-dashed border-[#6366f1]/30 px-4 py-3 hover:border-[#6366f1] hover:bg-[#6366f1]/5 transition-colors">
                    <span className="flex items-center gap-2 text-sm font-medium text-[#6366f1]"><Plus size={16} /> Add Agent Bundle</span>
                    <span className="text-sm font-semibold text-[#6366f1]">+$597/mo</span>
                  </Link>
                  <a href="#addons" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#6366f1]/30 px-4 py-3 hover:border-[#6366f1] hover:bg-[#6366f1]/5 transition-colors">
                    <Plus size={16} className="text-[#6366f1]" />
                    <span className="text-sm font-medium text-[#6366f1]">Add add-ons</span>
                  </a>
                </div>
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
                <ul className="space-y-3 mb-6 flex-1">
                  {[t('pf.pro.1'), t('pf.pro.2'), t('pf.pro.3'), t('pf.pro.4'), t('pf.pro.5'), t('pf.pro.6')].map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-white/70">
                      <Check size={16} className="text-[#6366f1] mt-0.5 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="space-y-2 mb-6">
                  <Link to="/register?plan=pro&bundle=true" className="flex items-center justify-between rounded-xl border border-dashed border-white/20 px-4 py-3 hover:border-[#818cf8] hover:bg-white/5 transition-colors">
                    <span className="flex items-center gap-2 text-sm font-medium text-[#818cf8]"><Plus size={16} /> Add Agent Bundle</span>
                    <span className="text-sm font-semibold text-[#818cf8]">+$597/mo</span>
                  </Link>
                  <a href="#addons" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/20 px-4 py-3 hover:border-[#818cf8] hover:bg-white/5 transition-colors">
                    <Plus size={16} className="text-[#818cf8]" />
                    <span className="text-sm font-medium text-[#818cf8]">Add add-ons</span>
                  </a>
                </div>
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
                <ul className="space-y-3 mb-6 flex-1">
                  {[t('pf.enterprise.1'), t('pf.enterprise.2'), t('pf.enterprise.3'), t('pf.enterprise.4'), t('pf.enterprise.5'), t('pf.enterprise.6')].map((f, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-[#1d1d1f]/80">
                      <Check size={16} className="text-[#6366f1] mt-0.5 flex-shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <div className="space-y-2 mb-6">
                  <Link to="/register?plan=enterprise&bundle=true" className="flex items-center justify-between rounded-xl border border-dashed border-[#6366f1]/30 px-4 py-3 hover:border-[#6366f1] hover:bg-[#6366f1]/5 transition-colors">
                    <span className="flex items-center gap-2 text-sm font-medium text-[#6366f1]"><Plus size={16} /> Add Agent Bundle</span>
                    <span className="text-sm font-semibold text-[#6366f1]">+$597/mo</span>
                  </Link>
                  <a href="#addons" className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#6366f1]/30 px-4 py-3 hover:border-[#6366f1] hover:bg-[#6366f1]/5 transition-colors">
                    <Plus size={16} className="text-[#6366f1]" />
                    <span className="text-sm font-medium text-[#6366f1]">Add add-ons</span>
                  </a>
                </div>
                <Link to="/register?plan=enterprise" className="block text-center border border-[#6366f1] text-[#6366f1] text-sm font-medium px-6 py-3 rounded-full hover:bg-[#6366f1] hover:text-white transition-colors">
                  {t('price.choose')}
                </Link>
              </div>
            </FadeIn>
          </div>

          {/* ── Qwillio Agent Add-ons ── */}
          <FadeIn delay={300}>
            <div id="addons" className="mt-20 text-center mb-12 scroll-mt-24">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('agent.label')}</p>
              <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">{t('agent.title')}</h3>
              <p className="text-[#86868b] mt-3 max-w-lg mx-auto">{t('agent.subtitle')}</p>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Email AI', icon: Mail, price: 197, desc: t('agent.email'), features: [t('agent.email.1'), t('agent.email.2'), t('agent.email.3'), t('agent.email.4'), t('agent.email.5')] },
              { name: 'Payments AI', icon: CreditCard, price: 97, desc: t('agent.payments'), features: [t('agent.payments.1'), t('agent.payments.2'), t('agent.payments.3'), t('agent.payments.4'), t('agent.payments.5')] },
              { name: 'Accounting AI', icon: Calculator, price: 297, desc: t('agent.accounting'), features: [t('agent.accounting.1'), t('agent.accounting.2'), t('agent.accounting.3'), t('agent.accounting.4'), t('agent.accounting.5')] },
              { name: 'Inventory AI', icon: Package, price: 197, desc: t('agent.inventory'), features: [t('agent.inventory.1'), t('agent.inventory.2'), t('agent.inventory.3'), t('agent.inventory.4'), t('agent.inventory.5')] },
            ].map((mod, i) => (
              <FadeIn key={i} delay={i * 80}>
                <div className="rounded-2xl border border-[#d2d2d7] p-8 hover:border-[#6366f1]/40 transition-colors h-full flex flex-col">
                  <mod.icon size={28} className="text-[#6366f1] mb-4" strokeWidth={1.5} />
                  <h4 className="text-lg font-semibold mb-1">{mod.name}</h4>
                  <p className="text-sm text-[#86868b] mb-4 leading-relaxed">{mod.desc}</p>
                  <div className="mb-6">
                    <span className="text-3xl font-semibold tracking-tight">+${mod.price}</span>
                    <span className="text-[#86868b]">/mo</span>
                  </div>
                  <ul className="space-y-2.5 mb-8 flex-1">
                    {mod.features.map((f, j) => (
                      <li key={j} className="flex items-start gap-2.5 text-sm text-[#1d1d1f]/80">
                        <Check size={15} className="text-[#6366f1] mt-0.5 flex-shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link to="/register" className="block text-center border border-[#6366f1] text-[#6366f1] text-sm font-medium px-6 py-2.5 rounded-full hover:bg-[#6366f1] hover:text-white transition-colors">
                    Add
                  </Link>
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
      <PublicFooter />
    </div>
  );
}
