import { useState, useEffect, useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import IPhoneMockup from '../components/IPhoneMockup';
import { useSEO } from '../hooks/useSEO';
import { Link } from 'react-router-dom';
import {
  Phone, Calendar, BarChart3, Shield, Zap, Clock,
  ChevronRight, Play, Pause, ArrowRight, Check,
  MessageSquare, BrainCircuit, Globe,
  Mail, CreditCard, Calculator, Package, Plus,
  PhoneForwarded, Mic, Filter, Target, UserCheck, Send, Search, Link2, Activity, FileText, Headphones, Languages, Cpu, Lock, Gauge, Wifi,
  Stethoscope, Scale, Home as HomeIcon, Sparkles, Wrench, Wind, UtensilsCrossed, Car
} from 'lucide-react';
import QwillioLogo from '../components/QwillioLogo';
import LangToggle from '../components/LangToggle';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';

/* ── Waveform audio player ── */
function WaveformPlayer({ src, label }: { src: string; label: string }) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const bars = useRef(Array.from({ length: 32 }, () => Math.random() * 100));

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); }
    else { audioRef.current.play(); }
    setPlaying(!playing);
  };

  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/10">
      <button onClick={toggle} className="w-10 h-10 rounded-full bg-[#6366f1] flex items-center justify-center text-white hover:bg-[#5558e6] transition-colors flex-shrink-0">
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-white">{label}</div>
        <div className="flex items-center gap-[2px] h-4 mt-1">
          {bars.current.map((h, i) => (
            <div key={i} className={`w-[3px] rounded-full transition-all duration-150 ${playing ? 'bg-[#6366f1] animate-pulse' : 'bg-white/20'}`} style={{ height: `${h}%`, animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
      </div>
      <audio ref={audioRef} src={src} onEnded={() => setPlaying(false)} />
    </div>
  );
}

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

/* ── Niches Section — timeline with animated line ── */
const EASE_EXPO = [0.16, 1, 0.3, 1] as const;

function NichePair({
  left,
  right,
  isLast,
  t,
}: {
  left: { key: string; icon: React.ElementType; color: string };
  right: { key: string; icon: React.ElementType; color: string };
  isLast: boolean;
  t: (k: any) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-12%' });

  const cardBase = 'rounded-2xl bg-white border border-[#d2d2d7]/60 p-5 hover:border-[#6366f1]/40 hover:shadow-md transition-all duration-200 flex-1';

  return (
    <div ref={ref} className="grid gap-0" style={{ gridTemplateColumns: '1fr 48px 1fr' }}>

      {/* LEFT card */}
      <motion.div
        className={cardBase}
        initial={{ opacity: 0, x: -40 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.75, ease: EASE_EXPO }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
          style={{ background: `${left.color}15` }}>
          <left.icon size={18} style={{ color: left.color }} />
        </div>
        <p className="text-sm font-semibold text-[#1d1d1f] mb-1">{t(`niches.${left.key}` as any)}</p>
        <p className="text-xs text-[#86868b] leading-relaxed">{t(`niches.${left.key}.desc` as any)}</p>
      </motion.div>

      {/* CENTER: dot + line */}
      <div className="flex flex-col items-center">
        {/* Dot */}
        <motion.div
          className="w-3 h-3 rounded-full border-2 border-[#6366f1] bg-white mt-5 flex-shrink-0 z-10"
          initial={{ scale: 0, opacity: 0 }}
          animate={inView ? { scale: 1, opacity: 1 } : {}}
          transition={{ delay: 0.15, duration: 0.4, ease: EASE_EXPO }}
        />
        {/* Line segment to next row */}
        {!isLast && (
          <motion.div
            className="flex-1 w-px"
            style={{
              background: 'linear-gradient(to bottom, #6366f1, #a855f7)',
              minHeight: 32,
              originY: 0,
            }}
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : {}}
            transition={{ delay: 0.3, duration: 0.7, ease: EASE_EXPO }}
          />
        )}
      </div>

      {/* RIGHT card */}
      <motion.div
        className={cardBase}
        initial={{ opacity: 0, x: 40 }}
        animate={inView ? { opacity: 1, x: 0 } : {}}
        transition={{ duration: 0.75, ease: EASE_EXPO, delay: 0.08 }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
          style={{ background: `${right.color}15` }}>
          <right.icon size={18} style={{ color: right.color }} />
        </div>
        <p className="text-sm font-semibold text-[#1d1d1f] mb-1">{t(`niches.${right.key}` as any)}</p>
        <p className="text-xs text-[#86868b] leading-relaxed">{t(`niches.${right.key}.desc` as any)}</p>
      </motion.div>
    </div>
  );
}

function NichesSection() {
  const { t, isFr } = useLang();

  const niches: { key: string; icon: React.ElementType; color: string }[] = [
    { key: 'dental',     icon: Stethoscope,    color: '#6366f1' },
    { key: 'medical',    icon: Activity,        color: '#a855f7' },
    { key: 'law',        icon: Scale,           color: '#7c3aed' },
    { key: 'realestate', icon: HomeIcon,        color: '#6366f1' },
    { key: 'spa',        icon: Sparkles,        color: '#a855f7' },
    { key: 'plumber',    icon: Wrench,          color: '#7c3aed' },
    { key: 'hvac',       icon: Wind,            color: '#6366f1' },
    { key: 'restaurant', icon: UtensilsCrossed, color: '#a855f7' },
    { key: 'auto',       icon: Car,             color: '#7c3aed' },
    { key: 'insurance',  icon: Shield,          color: '#6366f1' },
    { key: 'coaching',   icon: Target,          color: '#a855f7' },
    { key: 'accounting', icon: Calculator,      color: '#7c3aed' },
  ];

  // Group into pairs
  const pairs: [typeof niches[0], typeof niches[0]][] = [];
  for (let i = 0; i < niches.length; i += 2) pairs.push([niches[i], niches[i + 1]]);

  const titleRef = useRef<HTMLDivElement>(null);
  const titleInView = useInView(titleRef, { once: true, margin: '-10%' });

  return (
    <section className="py-24 md:py-32 px-6 bg-[#f5f5f7]">
      <div className="max-w-[860px] mx-auto">

        {/* Title */}
        <motion.div
          ref={titleRef}
          className="text-center mb-16"
          initial={{ opacity: 0, y: 28 }}
          animate={titleInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: EASE_EXPO }}
        >
          <h2 className="text-4xl md:text-6xl font-semibold tracking-tight text-[#1d1d1f]">
            {isFr ? 'Pour qui ?' : 'For who?'}
          </h2>
          <p className="text-lg text-[#86868b] mt-4">
            {isFr
              ? 'Qwillio est pré-entraîné pour des dizaines de secteurs.'
              : 'Qwillio is pre-trained for dozens of industries.'}
          </p>
        </motion.div>

        {/* Timeline pairs */}
        <div className="flex flex-col gap-0">
          {pairs.map((pair, i) => (
            <NichePair
              key={i}
              left={pair[0]}
              right={pair[1]}
              isLast={i === pairs.length - 1}
              t={t}
            />
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
  const { scrollY } = useScroll();
  const heroPhoneY = useTransform(scrollY, [0, 600], [0, -60]);
  const heroStatsY = useTransform(scrollY, [0, 600], [0, -30]);
  useSEO({
    title: 'Receptionist AI',
    description: isFr
      ? 'Ashley (EN) ou Marie (FR) – votre réceptionniste IA répond à chaque appel, prend les rendez-vous et relance vos clients. 24/7, sans jamais dormir.'
      : 'Ashley (EN) or Marie (FR) – your AI receptionist answers every call, books appointments, and follows up with clients. Sub-1s response, 24/7.',
    canonical: 'https://qwillio.com/receptionist',
  });

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
        <motion.h1
          className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: EASE_EXPO }}
        >
          {t('hero.title1')}<br />
          <span className="bg-gradient-to-r from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
            {t('hero.title2')}
          </span>
        </motion.h1>
        <motion.p
          className="mt-6 text-lg md:text-xl text-[#86868b] max-w-xl mx-auto leading-relaxed"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: EASE_EXPO, delay: 0.12 }}
        >
          {t('hero.subtitle')}
        </motion.p>
        <motion.div
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: EASE_EXPO, delay: 0.22 }}
        >
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
        </motion.div>

        {/* Stats + iPhone mockup */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: EASE_EXPO, delay: 0.38 }}
        >
          <div className="mt-16 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20">

            {/* Stats column */}
            <motion.div style={{ y: heroStatsY }} className="flex flex-row lg:flex-col items-stretch justify-center divide-x lg:divide-x-0 lg:divide-y divide-[#d2d2d7]/60 w-full lg:w-auto lg:max-w-[180px]">
              {[
                { value: 86,   suffix: '%', label: isFr ? 'Taux de décrochage' : 'Pickup rate' },
                { value: 1,    suffix: 's',  label: isFr ? 'Temps de réponse'   : 'Response time', prefix: '<' },
                { value: 24,   suffix: '/7', label: isFr ? 'Toujours disponible' : 'Always on' },
              ].map((s, i) => (
                <div key={i} className="flex-1 lg:flex-none flex flex-col items-center justify-center px-3 lg:px-0 py-3 lg:py-5">
                  <p className="text-2xl sm:text-3xl font-semibold tracking-tight whitespace-nowrap bg-gradient-to-br from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent">
                    {s.prefix ?? ''}<Counter value={s.value} suffix={s.suffix} />
                  </p>
                  <p className="text-[10px] sm:text-xs text-[#86868b] mt-1 text-center leading-tight">{s.label}</p>
                </div>
              ))}
            </motion.div>

            {/* iPhone */}
            <motion.div style={{ y: heroPhoneY }} className="flex-shrink-0">
              <IPhoneMockup />
            </motion.div>

          </div>
        </motion.div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="max-w-[1120px] mx-auto px-6"><div className="border-t border-[#d2d2d7]/60" /></div>

      {/* ── HOW IT WORKS (3 steps) ── */}
      <section id="how" className="py-24 md:py-32 px-6 bg-[#f5f5f7]">
        <div className="max-w-[1120px] mx-auto">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-5%' }}
            transition={{ duration: 0.75, ease: EASE_EXPO }}
          >
            <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('how.label')}</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
              {t('how.title')}
            </h2>
          </motion.div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {[
              {
                num: '01',
                title: isFr ? 'Configurez votre agent' : 'Configure your agent',
                desc: isFr
                  ? 'D\u00e9crivez votre activit\u00e9, vos services et vos consignes. Qwillio cr\u00e9e un agent personnalis\u00e9 en quelques minutes.'
                  : 'Describe your business, services and guidelines. Qwillio creates a custom agent in minutes.',
              },
              {
                num: '02',
                title: isFr ? 'Transf\u00e9rez vos appels' : 'Forward your calls',
                desc: isFr
                  ? 'Redirigez votre ligne en 30 secondes. Aucune installation, aucun mat\u00e9riel. Fonctionne avec tous les op\u00e9rateurs.'
                  : 'Redirect your line in 30 seconds. No installation, no hardware. Works with any carrier.',
              },
              {
                num: '03',
                title: isFr ? 'L\u2019IA fait le reste' : 'AI does the rest',
                desc: isFr
                  ? 'Ashley ou Marie r\u00e9pond 24/7, qualifie les leads, r\u00e9serve les rendez-vous et vous envoie un r\u00e9sum\u00e9 en temps r\u00e9el.'
                  : 'Ashley or Marie answers 24/7, qualifies leads, books appointments, and sends you a real-time summary.',
              },
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 60, scale: 0.93 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, margin: '-5%' }}
                transition={{ duration: 0.85, ease: EASE_EXPO, delay: i * 0.14 }}
              >
                <div className="group relative text-center p-8 rounded-3xl hover:bg-white border border-transparent hover:border-[#6366f1]/10 hover:shadow-2xl hover:shadow-[#6366f1]/8 transition-all duration-500 cursor-default">
                  <motion.p
                    className="text-6xl md:text-7xl font-bold mb-6 bg-gradient-to-br from-[#6366f1] to-[#a855f7] bg-clip-text text-transparent"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.14 + 0.35 }}
                  >
                    {step.num}
                  </motion.p>
                  <h3 className="text-xl font-semibold mb-3 tracking-tight">{step.title}</h3>
                  <p className="text-[15px] text-[#86868b] leading-relaxed max-w-xs mx-auto">{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PRODUCT STATEMENT — Two modules. One brain. ── */}
      <section className="py-20 md:py-28 px-6 bg-white overflow-hidden">
        <div className="max-w-[900px] mx-auto text-center">
          <motion.h2
            className="text-5xl md:text-7xl lg:text-8xl tracking-tight leading-[1.05]"
            initial={{ opacity: 0, y: 48 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-8%' }}
            transition={{ duration: 0.9, ease: EASE_EXPO }}
          >
            <span className="font-semibold text-[#1d1d1f]">
              {isFr ? 'Deux modules.' : 'Two modules.'}
            </span>
            <br />
            <span className="font-normal text-[#86868b]">
              {isFr ? 'Un cerveau.' : 'One brain.'}
            </span>
          </motion.h2>
          <motion.p
            className="mt-8 text-lg md:text-xl text-[#86868b] max-w-lg mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-8%' }}
            transition={{ duration: 0.8, ease: EASE_EXPO, delay: 0.18 }}
          >
            {isFr
              ? "L'IA qui ne dort jamais. Pour les entreprises qui n'en ont pas le temps non plus."
              : "The AI that never sleeps. For businesses that don't either."}
          </motion.p>
          <motion.div
            className="mt-12 flex flex-wrap justify-center gap-3"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-8%' }}
            transition={{ duration: 0.7, ease: EASE_EXPO, delay: 0.3 }}
          >
            {[
              isFr ? 'Appels entrants' : 'Inbound Calls',
              isFr ? 'Scoring & relance' : 'Lead scoring & follow-up',
              isFr ? 'Analyse en temps r\u00e9el' : 'Real-time analytics',
            ].map((pill, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#f5f5f7] border border-[#d2d2d7]/60 text-sm text-[#1d1d1f]/70 font-medium"
              >
                {pill}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="py-24 md:py-32 px-6 bg-[#f5f5f7]">
        <div className="max-w-[1120px] mx-auto">
          <motion.div
            className="text-center mb-20"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-5%' }}
            transition={{ duration: 0.75, ease: EASE_EXPO }}
          >
            <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('feat.label')}</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
              {t('feat.title')}<br />{t('feat.title2')}
            </h2>
          </motion.div>

          {/* ── Bento Grid ── */}
          <div className="space-y-16">

            {/* ── Category 1: Call Intelligence ── */}
            <div>
              <motion.div
                className="flex items-center gap-3 mb-6"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-5%' }}
                transition={{ duration: 0.6, ease: EASE_EXPO }}
              >
                <div className="w-9 h-9 rounded-xl bg-[#6366f1] flex items-center justify-center">
                  <Phone size={18} className="text-white" />
                </div>
                <h3 className="text-xl font-semibold">{isFr ? 'Intelligence d’appel' : 'Call Intelligence'}</h3>
              </motion.div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {/* Big card */}
                <motion.div
                  className="col-span-2 md:row-span-2 bg-gradient-to-br from-[#6366f1] to-[#818cf8] rounded-3xl p-7 text-white flex flex-col justify-between min-h-[240px] group hover:shadow-xl hover:shadow-[#6366f1]/20 transition-all duration-500"
                  initial={{ opacity: 0, scale: 0.95, y: 24 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-3%' }}
                  transition={{ duration: 0.7, ease: EASE_EXPO }}
                >
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
                </motion.div>
                {/* 4 small cards */}
                {callIntelligenceFeatures.slice(1).map((f, i) => (
                  <motion.div
                    key={i}
                    className="col-span-1 md:col-span-2 bg-white rounded-2xl p-5 border border-[#e5e5ea] hover:border-[#6366f1]/30 hover:shadow-lg hover:shadow-[#6366f1]/5 transition-all duration-300 group"
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-3%' }}
                    transition={{ duration: 0.6, ease: EASE_EXPO, delay: i * 0.1 }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center mb-3 group-hover:bg-[#6366f1]/15 transition-colors">
                      <f.icon size={20} className="text-[#6366f1]" strokeWidth={1.5} />
                    </div>
                    <h4 className="text-sm font-semibold mb-1.5">{f.title}</h4>
                    <p className="text-xs text-[#86868b] leading-relaxed">{f.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ── Category 2: Lead Management ── */}
            <div>
              <motion.div
                className="flex items-center gap-3 mb-6"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-5%' }}
                transition={{ duration: 0.6, ease: EASE_EXPO }}
              >
                <div className="w-9 h-9 rounded-xl bg-[#8b5cf6] flex items-center justify-center">
                  <Target size={18} className="text-white" />
                </div>
                <h3 className="text-xl font-semibold">{isFr ? 'Gestion des leads' : 'Lead Management'}</h3>
              </motion.div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {/* Top row - 3 cards */}
                {leadManagementFeatures.slice(0, 3).map((f, i) => (
                  <motion.div
                    key={i}
                    className="col-span-1 bg-white rounded-2xl p-5 border border-[#e5e5ea] hover:border-[#8b5cf6]/30 hover:shadow-lg hover:shadow-[#8b5cf6]/5 transition-all duration-300 group"
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-3%' }}
                    transition={{ duration: 0.6, ease: EASE_EXPO, delay: i * 0.1 }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center mb-3 group-hover:bg-[#8b5cf6]/15 transition-colors">
                      <f.icon size={20} className="text-[#8b5cf6]" strokeWidth={1.5} />
                    </div>
                    <h4 className="text-sm font-semibold mb-1.5">{f.title}</h4>
                    <p className="text-xs text-[#86868b] leading-relaxed">{f.desc}</p>
                  </motion.div>
                ))}
                {/* Bottom row - 1 wide gradient + 1 card */}
                <motion.div
                  className="col-span-2 bg-gradient-to-r from-[#8b5cf6] to-[#a78bfa] rounded-3xl p-7 text-white flex items-center gap-8 group hover:shadow-xl hover:shadow-[#8b5cf6]/20 transition-all duration-500"
                  initial={{ opacity: 0, scale: 0.95, y: 24 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-3%' }}
                  transition={{ duration: 0.7, ease: EASE_EXPO, delay: 0.1 }}
                >
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
                </motion.div>
                <motion.div
                  className="col-span-2 md:col-span-1 bg-white rounded-2xl p-5 border border-[#e5e5ea] hover:border-[#8b5cf6]/30 hover:shadow-lg hover:shadow-[#8b5cf6]/5 transition-all duration-300 group"
                  initial={{ opacity: 0, y: 28 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-3%' }}
                  transition={{ duration: 0.6, ease: EASE_EXPO, delay: 0.2 }}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#8b5cf6]/10 flex items-center justify-center mb-3 group-hover:bg-[#8b5cf6]/15 transition-colors">
                    <Link2 size={20} className="text-[#8b5cf6]" strokeWidth={1.5} />
                  </div>
                  <h4 className="text-sm font-semibold mb-1.5">{leadManagementFeatures[4].title}</h4>
                  <p className="text-xs text-[#86868b] leading-relaxed">{leadManagementFeatures[4].desc}</p>
                </motion.div>
              </div>
            </div>

            {/* ── Category 3: Analytics & Control ── */}
            <div>
              <motion.div
                className="flex items-center gap-3 mb-6"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-5%' }}
                transition={{ duration: 0.6, ease: EASE_EXPO }}
              >
                <div className="w-9 h-9 rounded-xl bg-[#6366f1] flex items-center justify-center">
                  <BarChart3 size={18} className="text-white" />
                </div>
                <h3 className="text-xl font-semibold">{isFr ? 'Analytique & contrôle' : 'Analytics & Control'}</h3>
              </motion.div>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {/* 2 small cards */}
                {analyticsFeatures.slice(0, 2).map((f, i) => (
                  <motion.div
                    key={i}
                    className="col-span-1 md:col-span-2 bg-white rounded-2xl p-5 border border-[#e5e5ea] hover:border-[#6366f1]/30 hover:shadow-lg hover:shadow-[#6366f1]/5 transition-all duration-300 group"
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-3%' }}
                    transition={{ duration: 0.6, ease: EASE_EXPO, delay: i * 0.1 }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center mb-3 group-hover:bg-[#6366f1]/15 transition-colors">
                      <f.icon size={20} className="text-[#6366f1]" strokeWidth={1.5} />
                    </div>
                    <h4 className="text-sm font-semibold mb-1.5">{f.title}</h4>
                    <p className="text-xs text-[#86868b] leading-relaxed">{f.desc}</p>
                  </motion.div>
                ))}
                {/* Big card on the right */}
                <motion.div
                  className="col-span-2 md:row-span-2 bg-gradient-to-br from-[#6366f1] to-[#818cf8] rounded-3xl p-7 text-white flex flex-col justify-between min-h-[240px] group hover:shadow-xl hover:shadow-[#6366f1]/20 transition-all duration-500"
                  initial={{ opacity: 0, scale: 0.95, y: 24 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true, margin: '-3%' }}
                  transition={{ duration: 0.7, ease: EASE_EXPO }}
                >
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
                </motion.div>
                {/* 2 more small cards */}
                {analyticsFeatures.slice(3).map((f, i) => (
                  <motion.div
                    key={i}
                    className="col-span-1 md:col-span-2 bg-white rounded-2xl p-5 border border-[#e5e5ea] hover:border-[#6366f1]/30 hover:shadow-lg hover:shadow-[#6366f1]/5 transition-all duration-300 group"
                    initial={{ opacity: 0, y: 28 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-3%' }}
                    transition={{ duration: 0.6, ease: EASE_EXPO, delay: i * 0.1 + 0.1 }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-[#6366f1]/10 flex items-center justify-center mb-3 group-hover:bg-[#6366f1]/15 transition-colors">
                      <f.icon size={20} className="text-[#6366f1]" strokeWidth={1.5} />
                    </div>
                    <h4 className="text-sm font-semibold mb-1.5">{f.title}</h4>
                    <p className="text-xs text-[#86868b] leading-relaxed">{f.desc}</p>
                  </motion.div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── TECHNOLOGY ── */}
      <section className="py-24 md:py-32 px-6 bg-[#1d1d1f] text-white">
        <div className="max-w-[1120px] mx-auto">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-5%' }}
            transition={{ duration: 0.75, ease: EASE_EXPO }}
          >
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
          </motion.div>
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
              <motion.div
                key={i}
                className="p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-[#6366f1]/40 transition-colors duration-300 h-full"
                initial={{ opacity: 0, y: 36 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-3%' }}
                transition={{ duration: 0.65, ease: EASE_EXPO, delay: i * 0.09 }}
              >
                <item.icon size={28} className="text-[#818cf8] mb-5" strokeWidth={1.5} />
                <h3 className="text-lg font-semibold mb-2 tracking-tight">{item.title}</h3>
                <p className="text-[15px] text-white/50 leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO CTA ── */}
      <section className="py-24 md:py-32 px-6">
        <motion.div
          className="max-w-3xl mx-auto text-center"
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{ duration: 0.8, ease: EASE_EXPO }}
        >
          <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-5">
            {t('demo.title')}
          </h2>
          <p className="text-lg text-[#86868b] max-w-lg mx-auto mb-10 leading-relaxed">
            {t('demo.subtitle')}
          </p>
          <div className="max-w-md mx-auto mb-10 space-y-3">
            <WaveformPlayer src="/demo-ashley.mp3" label="Ashley (EN)" />
            <WaveformPlayer src="/demo-marie.mp3" label="Marie (FR)" />
          </div>
          <a
              href="/demo.html"
              className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-base font-medium px-8 py-3.5 rounded-full hover:bg-[#424245] transition-colors"
            >
              <Phone size={18} /> {t('demo.cta')}
          </a>
        </motion.div>
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
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-5%' }}
            transition={{ duration: 0.75, ease: EASE_EXPO }}
          >
            <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('price.label')}</p>
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight">
              {t('price.title')}
            </h2>
            <p className="text-lg text-[#86868b] mt-4">
              {t('price.trial')}
            </p>
          </motion.div>

          {/* ── Ashley Receptionist Plans ── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Starter */}
            <motion.div
              className="rounded-2xl border border-[#d2d2d7] p-8 flex flex-col h-full"
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-3%' }}
              transition={{ duration: 0.7, ease: EASE_EXPO }}
            >
                <h3 className="text-xl font-semibold mb-1">Starter</h3>
                <p className="text-[#86868b] text-sm mb-6">{t('price.starter.sub')}</p>
                <div className="mb-1">
                  <span className="text-4xl font-semibold tracking-tight">$497</span>
                  <span className="text-[#86868b]">/mo</span>
                </div>
                <p className="text-sm text-emerald-600 font-medium mb-1">✓ {t('price.firstFree')}</p>
                <p className="text-xs text-blue-500 font-medium mb-4">{t('price.noSetup')}</p>
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
                  <Link to="/register?plan=starter&bundle=true" className="flex items-center justify-between rounded-full border border-[#6366f1] px-4 py-3 text-[#6366f1] hover:bg-[#6366f1] hover:text-white transition-colors">
                    <span className="flex items-center gap-2 text-sm font-medium"><Plus size={16} /> Add Agent Bundle</span>
                    <span className="text-sm font-semibold">+$597/mo</span>
                  </Link>
                  <a href="#addons" className="flex items-center justify-center gap-2 rounded-full border border-[#6366f1] px-4 py-3 text-sm font-medium text-[#6366f1] hover:bg-[#6366f1] hover:text-white transition-colors">
                    <Plus size={16} />
                    <span>Add add-ons</span>
                  </a>
                </div>
                <Link to="/register?plan=starter" className="block text-center bg-[#6366f1] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-[#4f46e5] transition-colors">
                  {t('price.choose')}
                </Link>
            </motion.div>

            {/* Pro */}
            <motion.div
              className="rounded-2xl bg-[#1d1d1f] text-white p-8 flex flex-col h-full relative"
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-3%' }}
              transition={{ duration: 0.7, ease: EASE_EXPO, delay: 0.1 }}
            >
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#6366f1] text-white text-xs font-semibold px-4 py-1 rounded-full">
                  {t('price.popular')}
                </span>
                <h3 className="text-xl font-semibold mb-1">Pro</h3>
                <p className="text-white/50 text-sm mb-6">{t('price.pro.sub')}</p>
                <div className="mb-1">
                  <span className="text-4xl font-semibold tracking-tight">$1,297</span>
                  <span className="text-white/50">/mo</span>
                </div>
                <p className="text-sm text-emerald-400 font-medium mb-1">✓ {t('price.firstFree')}</p>
                <p className="text-xs text-blue-400 font-medium mb-4">{t('price.noSetup')}</p>
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
                  <Link to="/register?plan=pro&bundle=true" className="flex items-center justify-between rounded-full border border-white/40 px-4 py-3 text-white hover:bg-white/10 transition-colors">
                    <span className="flex items-center gap-2 text-sm font-medium"><Plus size={16} /> Add Agent Bundle</span>
                    <span className="text-sm font-semibold">+$597/mo</span>
                  </Link>
                  <a href="#addons" className="flex items-center justify-center gap-2 rounded-full border border-white/40 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition-colors">
                    <Plus size={16} />
                    <span>Add add-ons</span>
                  </a>
                </div>
                <Link to="/register?plan=pro" className="block text-center bg-[#6366f1] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-[#4f46e5] transition-colors">
                  {t('price.choose')}
                </Link>
            </motion.div>

            {/* Enterprise */}
            <motion.div
              className="rounded-2xl border border-[#d2d2d7] p-8 flex flex-col h-full"
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-3%' }}
              transition={{ duration: 0.7, ease: EASE_EXPO, delay: 0.2 }}
            >
                <h3 className="text-xl font-semibold mb-1">Enterprise</h3>
                <p className="text-[#86868b] text-sm mb-6">{t('price.enterprise.sub')}</p>
                <div className="mb-1">
                  <span className="text-4xl font-semibold tracking-tight">$2,497</span>
                  <span className="text-[#86868b]">/mo</span>
                </div>
                <p className="text-sm text-emerald-600 font-medium mb-1">✓ {t('price.firstFree')}</p>
                <p className="text-xs text-blue-500 font-medium mb-4">{t('price.noSetup')}</p>
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
                  <Link to="/register?plan=enterprise&bundle=true" className="flex items-center justify-between rounded-full border border-[#6366f1] px-4 py-3 text-[#6366f1] hover:bg-[#6366f1] hover:text-white transition-colors">
                    <span className="flex items-center gap-2 text-sm font-medium"><Plus size={16} /> Add Agent Bundle</span>
                    <span className="text-sm font-semibold">+$597/mo</span>
                  </Link>
                  <a href="#addons" className="flex items-center justify-center gap-2 rounded-full border border-[#6366f1] px-4 py-3 text-sm font-medium text-[#6366f1] hover:bg-[#6366f1] hover:text-white transition-colors">
                    <Plus size={16} />
                    <span>Add add-ons</span>
                  </a>
                </div>
              <Link to="/register?plan=enterprise" className="block text-center bg-[#6366f1] text-white text-sm font-medium px-6 py-3 rounded-full hover:bg-[#4f46e5] transition-colors">
                {t('price.choose')}
              </Link>
            </motion.div>
          </div>

          {/* ── Qwillio Agent Add-ons ── */}
          <motion.div
            id="addons"
            className="mt-20 text-center mb-12 scroll-mt-24"
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-5%' }}
            transition={{ duration: 0.75, ease: EASE_EXPO }}
          >
            <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('agent.label')}</p>
            <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">{t('agent.title')}</h3>
            <p className="text-[#86868b] mt-3 max-w-lg mx-auto">{t('agent.subtitle')}</p>
          </motion.div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { name: 'Email AI', icon: Mail, price: 197, desc: t('agent.email'), features: [t('agent.email.1'), t('agent.email.2'), t('agent.email.3'), t('agent.email.4'), t('agent.email.5')] },
              { name: 'Payments AI', icon: CreditCard, price: 97, desc: t('agent.payments'), features: [t('agent.payments.1'), t('agent.payments.2'), t('agent.payments.3'), t('agent.payments.4'), t('agent.payments.5')] },
              { name: 'Accounting AI', icon: Calculator, price: 297, desc: t('agent.accounting'), features: [t('agent.accounting.1'), t('agent.accounting.2'), t('agent.accounting.3'), t('agent.accounting.4'), t('agent.accounting.5')] },
              { name: 'Inventory AI', icon: Package, price: 197, desc: t('agent.inventory'), features: [t('agent.inventory.1'), t('agent.inventory.2'), t('agent.inventory.3'), t('agent.inventory.4'), t('agent.inventory.5')] },
            ].map((mod, i) => (
              <motion.div
                key={i}
                className="rounded-2xl border border-[#d2d2d7] p-8 hover:border-[#6366f1]/40 transition-colors h-full flex flex-col"
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-3%' }}
                transition={{ duration: 0.65, ease: EASE_EXPO, delay: i * 0.1 }}
              >
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
              </motion.div>
            ))}
          </div>

          {/* ── Integrations ── */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-5%' }}
            transition={{ duration: 0.7, ease: EASE_EXPO }}
          >
            <div className="mt-20 text-center">
              <p className="text-sm font-medium text-[#6366f1] tracking-wide uppercase mb-3">{t('integrations.label')}</p>
              <h3 className="text-2xl font-semibold tracking-tight mb-8">{t('integrations.title')}</h3>
              <div className="flex flex-wrap justify-center gap-6 text-[#86868b] text-sm font-medium">
                {['HubSpot', 'Salesforce', 'Pipedrive', 'Zoho CRM', 'GoHighLevel', 'Google Sheets', 'Notion', 'QuickBooks', 'Stripe', 'Google Calendar', 'Zapier'].map((name) => (
                  <span key={name} className="px-4 py-2 rounded-full bg-[#f5f5f7] border border-[#d2d2d7]/60">{name}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="py-24 md:py-32 px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 32 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-5%' }}
          transition={{ duration: 0.8, ease: EASE_EXPO }}
        >
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
        </motion.div>
      </section>

      {/* ── FOOTER ── */}
      <PublicFooter />
    </div>
  );
}
