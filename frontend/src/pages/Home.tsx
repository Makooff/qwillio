import { useRef, useCallback } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import {
  Phone, Bot, ArrowRight, Play, Clock, Mic, Calendar, MessageSquare,
  Users, Mail, Receipt, Package, Wallet, CreditCard, Gift, FileText, Headphones,
  type LucideIcon,
} from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import Reveal from '../components/ui/Reveal';
import Card3D from '../components/ui/Card3D';
import HeroPhone3D from '../components/ui/HeroPhone3D';

const EASE = [0.16, 1, 0.3, 1] as const;

// Motion-enabled react-router Link so an animated chip can also be a navigation link.
const MotionLink = motion(Link);

// Home niches → best-fit destination, aligned by index with the `industries`
// arrays below (same order in FR and EN). A vertical sector page beats a blog
// article for conversion; null = no dedicated page yet (chip stays non-clickable).
const INDUSTRY_HREFS: (string | null)[] = [
  '/dentiste',                 // Santé / Healthcare
  '/avocat',                   // Juridique / Legal
  '/immobilier',               // Immobilier / Real Estate
  '/plombier',                 // Services à domicile / Home Services
  '/restaurant',               // Restauration / Restaurants
  null,                        // Éducation / Education
  '/garagiste',                // Automobile / Automotive
  null,                        // Fitness
  '/coiffeur',                 // Beauté / Beauty
  '/fiduciaire',               // Finance
  null,                        // Commerce / Retail
  null,                        // Startups
];


/* ══════════════════════════════════════════════════════════════════════════
   POUR QUI ? — scroll-drawn brand stroke with industries appearing around it
   ══════════════════════════════════════════════════════════════════════════ */

/* Industry chips: side-anchored (left OR right offset) so a chip can never
   overflow the viewport edge, with breathing room between neighbours.
   `at` = scroll progress when they pop, in sync with the band being drawn. */
const SECTOR_SPOTS: Array<{ at: number; side: 'left' | 'right'; off: string; y: string }> = [
  { at: 0.06, side: 'left',  off: '30%', y: '8%'  },
  { at: 0.10, side: 'right', off: '26%', y: '14%' },
  { at: 0.15, side: 'left',  off: '22%', y: '22%' },
  { at: 0.20, side: 'right', off: '24%', y: '27%' },
  { at: 0.25, side: 'left',  off: '12%', y: '33%' },
  { at: 0.30, side: 'right', off: '16%', y: '38%' },
  { at: 0.35, side: 'left',  off: '18%', y: '63%' },
  { at: 0.40, side: 'right', off: '12%', y: '68%' },
  { at: 0.44, side: 'left',  off: '26%', y: '75%' },
  { at: 0.48, side: 'right', off: '20%', y: '80%' },
  { at: 0.52, side: 'left',  off: '10%', y: '86%' },
  { at: 0.56, side: 'right', off: '28%', y: '91%' },
];

function SectorChip({ name, href, spot, progress }: {
  name: string;
  href?: string | null;
  spot: (typeof SECTOR_SPOTS)[number];
  progress: MotionValue<number>;
}) {
  const opacity = useTransform(progress, [spot.at, spot.at + 0.05], [0, 1]);
  const scale = useTransform(progress, [spot.at, spot.at + 0.07], [0.6, 1]);
  const y = useTransform(progress, [spot.at, spot.at + 0.07], [26, 0]);
  const baseClass =
    'absolute whitespace-nowrap rounded-full bg-white px-4 py-2 text-[13px] font-medium text-[#1d1d1f] shadow-[0_10px_30px_-12px_rgba(20,16,50,0.25)]';
  const style = {
    [spot.side]: spot.off,
    top: spot.y,
    opacity,
    scale,
    y,
    border: '1px solid rgba(29,29,31,0.12)',
  } as const;

  if (href) {
    return (
      <MotionLink
        to={href}
        className={`${baseClass} transition-colors hover:border-[#7a5fff] hover:text-[#7a5fff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a5fff] active:scale-[0.97]`}
        style={style}
      >
        {name}
      </MotionLink>
    );
  }

  return (
    <motion.span className={baseClass} style={style}>
      {name}
    </motion.span>
  );
}

function IndustriesStroke({ isFr, industries }: { isFr: boolean; industries: string[] }) {
  const container = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: container, offset: ['start start', 'end end'] });

  const pathLength = useTransform(scrollYProgress, [0.02, 0.85], [0, 1]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.10, 0.88, 0.98], [0, 1, 1, 0]);
  const textScale = useTransform(scrollYProgress, [0, 0.14], [0.92, 1]);

  return (
    <section
      ref={container}
      aria-labelledby="industries-heading"
      className="relative h-[280vh] bg-[#fafaf8] border-y border-[#1d1d1f]/8"
    >
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden">
        {/* Brand band, drawn by scroll */}
        <svg
          width="1500"
          height="2300"
          viewBox="0 0 1500 2300"
          fill="none"
          overflow="visible"
          className="pointer-events-none absolute select-none"
          style={{ top: '-14%', left: '50%', transform: 'translateX(-50%)', opacity: 0.92 }}
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="qw-stroke-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#7a5fff" />
              <stop offset="55%" stopColor="#7349fe" />
              <stop offset="100%" stopColor="#cd6afb" />
            </linearGradient>
          </defs>
          <motion.path
            d="
              M 750 0
              C 1180 240, 260 420, 560 700
              C 860 980, 1320 1080, 780 1330
              C 240 1580, 300 1760, 700 1930
              C 1000 2060, 820 2200, 750 2300
            "
            stroke="url(#qw-stroke-grad)"
            strokeWidth="76"
            strokeLinecap="round"
            fill="none"
            style={{ pathLength }}
          />
        </svg>

        {/* Sectors pop in around the band as it draws. Each chip that maps to
            a sector/partner page is a real navigation link (not aria-hidden). */}
        <nav className="absolute inset-0 z-20" aria-label={isFr ? 'Secteurs' : 'Industries'}>
          {industries.map((name, i) => (
            <SectorChip
              key={name}
              name={name}
              href={INDUSTRY_HREFS[i]}
              spot={SECTOR_SPOTS[i % SECTOR_SPOTS.length]}
              progress={scrollYProgress}
            />
          ))}
        </nav>

        {/* Centre title — just the question */}
        <motion.h2
          id="industries-heading"
          className="relative z-10 px-6 text-center font-semibold tracking-[-0.04em] leading-none text-[#1d1d1f]"
          style={{ fontSize: 'clamp(3rem, 9vw, 7.5rem)', opacity: textOpacity, scale: textScale }}
        >
          {isFr ? 'Pour qui ?' : 'For whom?'}
        </motion.h2>
      </div>
    </section>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   TROIS ÉTAPES — stacking cards (sticky, scale-under) à la Nova Method
   ══════════════════════════════════════════════════════════════════════════ */

interface StepCard {
  num: string;
  title: string;
  desc: string;
  points: { icon: LucideIcon; label: string }[];
  accent: string;
}

function StackStep({ step, index, total }: { step: StepCard; index: number; total: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 120px', 'end 120px'] });
  const scale = useTransform(scrollYProgress, [0, 1], [1, index < total - 1 ? 0.94 : 1]);

  return (
    <div ref={ref} className="sticky" style={{ top: `${92 + index * 22}px` }}>
      {/* Paper cards — deliberately the opposite register of the dark product cards */}
      <motion.article
        className="overflow-hidden rounded-[28px] bg-white p-8 text-[#1d1d1f] md:p-14"
        style={{ scale, border: '1px solid rgba(29,29,31,0.10)', boxShadow: '0 30px 80px rgba(20,16,50,0.14)' }}
      >
        <div className="flex min-h-[380px] flex-col justify-between md:min-h-[420px]">
          <div>
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em]" style={{ color: step.accent }}>
              {step.num}
            </p>
            <h3 className="max-w-[560px] text-[clamp(1.7rem,4vw,3rem)] font-semibold leading-[1.04] tracking-[-0.03em]">
              {step.title}
            </h3>
          </div>

          <div>
            <p className="mb-8 max-w-[480px] text-base leading-relaxed text-[#525257] md:text-lg">
              {step.desc}
            </p>
            <ul className="grid gap-2.5 sm:grid-cols-3" role="list">
              {step.points.map((p) => (
                <li
                  key={p.label}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#1d1d1f]"
                  style={{ background: 'rgba(29,29,31,0.04)', border: '1px solid rgba(29,29,31,0.10)' }}
                >
                  <p.icon size={14} className="flex-shrink-0" style={{ color: step.accent }} aria-hidden="true" />
                  {p.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.article>
    </div>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function Home() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: isFr
      ? 'Meilleur réceptionniste IA en Belgique et en France'
      : 'AI Receptionist for Businesses',
    description: isFr
      ? 'Qwillio, le réceptionniste IA francophone n°1 pour la Belgique et la France : répond à chaque appel 24/7, prend les rendez-vous, hébergement UE et conforme RGPD. Sans engagement, 7 jours d’essai gratuit.'
      : 'Qwillio is your AI receptionist that answers every call 24/7, books appointments, and never sleeps. Bilingual French / English, EU-hosted, GDPR-friendly.',
    canonical: 'https://qwillio.com/',
  });

  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const phoneParallax = useTransform(heroProgress, [0, 1], [0, 100]);
  const heroTextParallax = useTransform(heroProgress, [0, 1], [0, 40]);
  const handleHeroMouseMove = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const el = heroRef.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${((e.clientX - left) / width) * 100}%`);
    el.style.setProperty('--my', `${((e.clientY - top) / height) * 100}%`);
  }, []);

  const industries = isFr
    ? ['Santé', 'Juridique', 'Immobilier', 'Services à domicile', 'Restauration', 'Éducation', 'Automobile', 'Fitness', 'Beauté', 'Finance', 'Commerce', 'Startups']
    : ['Healthcare', 'Legal', 'Real Estate', 'Home Services', 'Restaurants', 'Education', 'Automotive', 'Fitness', 'Beauty', 'Finance', 'Retail', 'Startups'];

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main id="main">
        {/* ════════════════════════════════════════════════════════════════
            HERO — asymmetric editorial split. Q-indigo + W-violet accents.
            ════════════════════════════════════════════════════════════════ */}
        <section
          ref={heroRef}
          aria-labelledby="hero-heading"
          className="relative pt-24 sm:pt-28 md:pt-36 pb-16 md:pb-28 px-5 sm:px-6 overflow-hidden"
          onMouseMove={handleHeroMouseMove}
          style={{
            background: 'radial-gradient(700px circle at var(--mx,50%) var(--my,30%), rgba(122,95,255,0.07), transparent 65%)',
          }}
        >
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-20 items-center">
            {/* Editorial column — drifts slower than the scroll */}
            <motion.div style={{ y: heroTextParallax }}>
            <Reveal delay={0.05}>
            <div>

              <h1
                id="hero-heading"
                className="text-[clamp(2.6rem,6.5vw,5.6rem)] font-semibold tracking-[-0.04em] leading-[0.95] mb-6"
              >
                {/* The headline names the loss, not the feature. A prospect who
                    misses calls does not recognise himself in "every call
                    answered"; he recognises himself in the customer who hung up
                    and called the next number. */}
                {isFr ? (
                  <>
                    L'appel que<br />
                    vous ratez part<br />
                    <span className="italic font-serif" style={{ color: '#7a5fff' }}>chez le voisin.</span>
                  </>
                ) : (
                  <>
                    The call you<br />
                    miss goes to<br />
                    <span className="italic font-serif" style={{ color: '#7a5fff' }}>the next name.</span>
                  </>
                )}
              </h1>

              <p className="text-lg md:text-xl text-[#424245] max-w-[480px] mb-9 leading-[1.55]">
                {isFr
                  ? 'Qwillio décroche à votre place, en moins d’une seconde, prend le rendez-vous dans votre agenda et vous envoie le résumé. Français et anglais sur le même appel. À partir de 99 € par mois, soit moins qu’une matinée de secrétariat.'
                  : 'Qwillio picks up for you in under a second, books the appointment in your calendar and sends you the summary. French and English on the same call. From €99 a month, less than a morning of reception cover.'}
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-10">
                <a
                  href="/demo.html"
                  className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[15px] font-medium pl-5 pr-6 py-3.5 rounded-full hover:bg-[#7a5fff] transition-colors"
                >
                  <Play size={14} fill="currentColor" aria-hidden="true" />
                  {isFr ? 'Écouter une démo' : 'Hear the demo'}
                </a>
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-1.5 text-[15px] font-medium text-[#1d1d1f] px-2 py-2 underline decoration-[#7a5fff]/30 decoration-2 underline-offset-8 hover:decoration-[#7a5fff] transition-colors"
                >
                  {isFr ? 'Voir les tarifs' : 'See pricing'}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>

              {/* Inline credibility strip, not the centered hero-metric template.
                  Every figure here has to be a property of the product that can
                  be checked, not a performance number: with no customers yet,
                  an answer-rate percentage would be invented. */}
              <dl className="flex flex-nowrap items-baseline justify-between gap-x-1 sm:justify-start sm:gap-x-9 text-sm text-[#86868b] border-t border-[#1d1d1f]/10 pt-6 max-w-[520px]">
                <div className="flex items-baseline gap-1 sm:gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Langues' : 'Languages'}</dt>
                  <dd className="text-2xl font-semibold text-[#1d1d1f]">FR/EN</dd>
                  <span>{isFr ? 'bilingue' : 'bilingual'}</span>
                </div>
                <div className="flex items-baseline gap-1 sm:gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Temps de réponse' : 'Response time'}</dt>
                  <dd className="text-2xl font-semibold text-[#1d1d1f] tabular-nums">&lt;1s</dd>
                  <span>{isFr ? 'réponse' : 'response'}</span>
                </div>
                <div className="flex items-baseline gap-1 sm:gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Disponibilité' : 'Uptime'}</dt>
                  <dd className="text-2xl font-semibold text-[#1d1d1f] tabular-nums">24/7</dd>
                  <span className="hidden sm:inline">{isFr ? 'jamais fermé' : 'always on'}</span>
                </div>
              </dl>
            </div>
            </Reveal>
            </motion.div>

            {/* Live 3D device demo — parallax drift on scroll */}
            <motion.div style={{ y: phoneParallax }}>
              <Reveal delay={0.15}>
                <HeroPhone3D isFr={isFr} />
              </Reveal>
            </motion.div>
          </div>
        </section>
        {/* ════════════════════════════════════════════════════════════════
            PRODUCTS — bento. Receptionist=indigo, Agent=violet
            ════════════════════════════════════════════════════════════════ */}
        <section aria-labelledby="products-heading" className="py-16 sm:py-20 md:py-32 px-6">
          <div className="max-w-[1240px] mx-auto">
            <Reveal className="mb-12 md:mb-16">
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase block mb-3" style={{ color: '#1d1d1f' }}>
                {isFr ? 'Produits' : 'Products'}
              </span>
              <h2
                id="products-heading"
                className="text-[clamp(2rem,4.5vw,3.6rem)] font-semibold tracking-[-0.035em] leading-[1.08] max-w-[700px]"
              >
                {isFr ? 'Deux modules.' : 'Two modules.'}
                <span className="block font-normal text-[#86868b]">
                  {isFr ? 'Un cerveau.' : 'One brain.'}
                </span>
              </h2>
              <p className="text-[#86868b] text-base max-w-[520px] leading-relaxed mt-4">
                {isFr
                  ? 'Conçus pour fonctionner ensemble. Adoptez ce dont vous avez besoin, quand vous en avez besoin.'
                  : 'Built to work together. Adopt what you need, when you need it.'}
              </p>
            </Reveal>

            <div className="grid lg:grid-cols-[1.7fr_1fr] gap-5">
              {/* PRIMARY — Receptionist (indigo) */}
              <motion.div
                initial={{ opacity: 0, y: 70, rotate: -1.2 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true, margin: '-12%' }}
                transition={{ duration: 0.85, ease: EASE }}
              >
              <Card3D intensity={3}>
              <Link
                to="/receptionist"
                className="group relative rounded-[2rem] overflow-hidden block p-8 md:p-12 min-h-[460px] h-full text-white"
                style={{ background: 'linear-gradient(155deg, #1d1d1f 0%, #2a2356 55%, #7a5fff 110%)' }}
              >
                <div
                  aria-hidden="true"
                  className="absolute -right-32 -top-32 w-[440px] h-[440px] rounded-full opacity-30 blur-3xl"
                  style={{ background: 'radial-gradient(circle, #7a5fff 0%, transparent 70%)' }}
                />

                <div className="relative flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <span
                        className="w-11 h-11 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.12)' }}
                      >
                        <Phone size={20} aria-hidden="true" />
                      </span>
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/55">
                        {isFr ? 'Le best-seller' : 'Best-seller'}
                      </span>
                    </div>
                    <h3 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-semibold tracking-[-0.03em] leading-[1.05] mb-4 max-w-[520px]">
                      {isFr ? 'Réceptionniste IA' : 'AI Receptionist'}
                    </h3>
                    <p className="text-white/70 text-base md:text-lg leading-relaxed max-w-[440px]">
                      {isFr
                        ? 'Décroche en moins d\'une seconde. Prend les rendez-vous. Qualifie le lead. Transfère l\'urgence.'
                        : 'Picks up in under a second. Books the appointment. Qualifies the lead. Transfers the urgency.'}
                    </p>
                  </div>

                  <ul className="mt-10 grid grid-cols-2 gap-2.5" role="list">
                    {[
                      { icon: Mic,           label: isFr ? 'Voix française naturelle' : 'Natural voice' },
                      { icon: Calendar,      label: isFr ? 'Calendrier auto' : 'Auto-calendar' },
                      { icon: Users,         label: isFr ? 'CRM intégré' : 'CRM sync' },
                      { icon: MessageSquare, label: isFr ? 'SMS de suivi' : 'SMS follow-up' },
                    ].map((f) => (
                      <li
                        key={f.label}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <f.icon size={14} className="flex-shrink-0" style={{ color: '#b9a8ff' }} aria-hidden="true" />
                        <span className="text-xs font-medium text-white">{f.label}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-10 flex items-baseline justify-between gap-4 flex-wrap">
                    <p className="text-white/55 text-sm">
                      {isFr ? 'À partir de ' : 'From '}
                      <span className="text-white font-semibold">99&nbsp;€<span className="text-white/55">/{isFr ? 'mois' : 'mo'}</span></span>
                      <span className="ml-2 text-xs font-medium" style={{ color: '#b9a8ff' }}>
                        · {isFr ? 'Essai gratuit' : 'Free trial'}
                      </span>
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
                      {isFr ? 'Découvrir' : 'Explore'}
                      <ArrowRight size={15} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </Link>
              </Card3D>
              </motion.div>

              {/* SECONDARY — Agent (violet) */}
              <motion.div
                initial={{ opacity: 0, y: 70, rotate: 1.2 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true, margin: '-12%' }}
                transition={{ duration: 0.85, delay: 0.12, ease: EASE }}
              >
              <Card3D intensity={3}>
              <div
                aria-disabled="true"
                className="group relative rounded-[2rem] block p-8 md:p-10 min-h-[460px] h-full overflow-hidden text-white cursor-default select-none"
                style={{ background: 'linear-gradient(155deg, #1d1d1f 0%, #3a1f4a 55%, #cd6afb 115%)' }}
              >
                <div
                  aria-hidden="true"
                  className="absolute -right-24 -top-24 w-[340px] h-[340px] rounded-full opacity-30 blur-3xl"
                  style={{ background: 'radial-gradient(circle, #cd6afb 0%, transparent 70%)' }}
                />
                <div className="relative flex flex-col h-full justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span
                        className="w-11 h-11 rounded-2xl text-white flex items-center justify-center"
                        style={{ background: 'rgba(255,255,255,0.12)' }}
                      >
                        <Bot size={20} aria-hidden="true" />
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] rounded-full px-3 py-1.5" style={{ background: 'rgba(255,255,255,0.14)', color: '#f3ddff' }}>
                        {isFr ? 'Bientôt' : 'Coming soon'}
                      </span>
                    </div>
                    <h3 className="text-[clamp(1.5rem,2.8vw,2rem)] font-semibold tracking-[-0.025em] leading-[1.1] mb-3">
                      Qwillio Agent
                    </h3>
                    <p className="text-white/65 text-[15px] leading-relaxed">
                      {isFr
                        ? 'Modules IA additionnels : Email, Facturation, Inventaire, Paiements. Greffés à votre réceptionniste.'
                        : 'Add-on AI modules: Email, Billing, Inventory, Payments. Bolted onto your receptionist.'}
                    </p>
                  </div>

                  <ul className="mt-10 grid grid-cols-2 gap-2.5" role="list">
                    {[
                      { icon: Mail,    label: 'Email' },
                      { icon: Receipt, label: isFr ? 'Facturation' : 'Billing' },
                      { icon: Package, label: isFr ? 'Inventaire' : 'Inventory' },
                      { icon: Wallet,  label: isFr ? 'Paiements' : 'Payments' },
                    ].map((m) => (
                      <li
                        key={m.label}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <m.icon size={14} className="flex-shrink-0" style={{ color: '#e7bafd' }} aria-hidden="true" />
                        <span className="text-xs font-medium text-white">{m.label}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 flex items-center justify-between">
                    <p className="text-white/55 text-sm">
                      <span className="text-white font-semibold">+197 €</span>
                      <span className="text-white/55">/mois · {isFr ? 'par module' : 'per module'}</span>
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: '#e7bafd' }}>
                      {isFr ? 'Bientôt disponible' : 'Coming soon'}
                    </span>
                  </div>
                </div>
              </div>
              </Card3D>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            HOW IT WORKS — stacking scroll cards (sticky, scale-under)
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="how-heading"
          className="py-14 sm:py-18 md:py-28 px-5 sm:px-6 border-t border-[#1d1d1f]/8"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
              <h2
                id="how-heading"
                className="text-[clamp(1.6rem,3vw,2.4rem)] font-semibold tracking-[-0.025em] mb-3 max-w-[720px]"
              >
                {isFr ? 'Trois étapes.' : 'Three steps.'}
              </h2>
              <p className="text-[#86868b] text-base mb-12 max-w-[480px]">
                {isFr ? 'Premiers appels traités le jour même.' : 'First calls handled the same day.'}
              </p>
            </Reveal>

            <div className="space-y-8 pb-10" role="list">
              {([
                {
                  num: isFr ? '01 / Inscription' : '01 / Sign up',
                  title: isFr ? 'Inscrivez-vous' : 'Sign up',
                  desc: isFr
                    ? 'Créez votre compte en 2 minutes. 7 jours d’essai gratuit.'
                    : 'Create your account in 2 minutes. 7-day free trial.',
                  points: [
                    { icon: Clock,      label: '2 minutes' },
                    { icon: CreditCard, label: isFr ? 'Annulable à tout moment' : 'Cancel anytime' },
                    { icon: Gift,       label: isFr ? '7 jours d’essai' : '7-day trial' },
                  ],
                  accent: '#7a5fff',
                },
                {
                  num: isFr ? '02 / Configuration' : '02 / Configure',
                  title: isFr ? 'Configurez' : 'Configure',
                  desc: isFr
                    ? 'Voix, scripts, horaires, intégrations calendrier. Tout se règle dans le dashboard.'
                    : 'Voice, scripts, hours, calendar integrations. Everything from the dashboard.',
                  points: [
                    { icon: Mic,      label: isFr ? 'Voix naturelle' : 'Natural voice' },
                    { icon: FileText, label: isFr ? 'Scripts par métier' : 'Industry scripts' },
                    { icon: Calendar, label: isFr ? 'Calendrier connecté' : 'Calendar sync' },
                  ],
                  accent: '#cd6afb',
                },
                {
                  num: isFr ? '03 / En ligne' : '03 / Go live',
                  title: isFr ? 'Allumez la ligne' : 'Go live',
                  desc: isFr
                    ? 'Transférez votre numéro existant. L\'IA prend le relais. Support FR 7j/7.'
                    : 'Forward your existing number. The AI takes over. Support 7 days a week.',
                  points: [
                    { icon: Phone,      label: isFr ? 'Numéro conservé' : 'Keep your number' },
                    { icon: Bot,        label: isFr ? 'IA en relais 24/7' : 'AI on 24/7' },
                    { icon: Headphones, label: isFr ? 'Support 7j/7' : 'Support 7 days' },
                  ],
                  accent: '#7349fe',
                },
              ] as StepCard[]).map((step, i, arr) => (
                <StackStep key={step.num} step={step} index={i} total={arr.length} />
              ))}
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            POUR QUI ? — scroll-drawn brand stroke, sectors pop around it
            ════════════════════════════════════════════════════════════════ */}
        <IndustriesStroke isFr={isFr} industries={industries} />

        {/* ════════════════════════════════════════════════════════════════
            FOUNDER NOTE — honest early-stage positioning, no fabricated
            testimonials (pre-revenue). Replace with real ScrollReelTestimonials
            once genuine client quotes exist.
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-label={isFr ? 'Note du fondateur' : 'Founder note'}
          className="px-5 sm:px-6 py-14 sm:py-18 md:py-24"
        >
          <Reveal className="max-w-[1240px] mx-auto">
            <div className="rounded-[2rem] px-8 md:px-16 py-16 md:py-20 relative overflow-hidden" style={{ background: '#7a5fff' }}>
              <div
                aria-hidden="true"
                className="absolute -right-32 -top-32 w-[440px] h-[440px] rounded-full opacity-30 blur-3xl"
                style={{ background: 'radial-gradient(circle, #cd6afb 0%, transparent 70%)' }}
              />
              <p className="relative text-white/70 text-xs font-medium tracking-[0.14em] uppercase mb-6">
                {isFr ? 'Lancement' : 'Launch'}
              </p>
              <blockquote className="relative text-white text-[clamp(1.5rem,3.2vw,2.3rem)] font-semibold tracking-[-0.025em] leading-[1.22] max-w-[820px]">
                {isFr
                  ? "Qwillio vient de démarrer, construit et opéré par un développeur solo à Bruxelles. Chaque premier client est onboardé personnellement, pas de ticket support impersonnel."
                  : 'Qwillio just launched, built and run by a solo developer in Brussels. Every first customer is onboarded personally, no impersonal support ticket.'}
              </blockquote>
              <p className="relative mt-6 text-white/70 text-[15px] max-w-[640px]">
                {isFr
                  ? "On préfère être honnête plutôt qu'afficher de faux avis clients. Devenez l'un des premiers."
                  : "We'd rather be upfront than show fake customer reviews. Become one of the first."}
              </p>
            </div>
          </Reveal>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            CTA — editorial split with both brand colors in headline
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-label={isFr ? 'Démarrer avec Qwillio' : 'Get started with Qwillio'}
          className="py-16 sm:py-20 md:py-32 px-6"
        >
          <Reveal className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end border-t-2 border-[#1d1d1f] pt-12 md:pt-16">
            <h2 className="text-[clamp(2.2rem,5vw,4.4rem)] font-semibold tracking-[-0.035em] leading-[0.98]">
              {isFr ? (
                <>
                  Arrêtez de perdre<br />
                  des appels.<br />
                  <span className="font-serif italic" style={{ color: '#7a5fff' }}>Commencez aujourd'hui.</span>
                </>
              ) : (
                <>
                  Stop losing<br />
                  calls.<br />
                  <span className="font-serif italic" style={{ color: '#7a5fff' }}>Start today.</span>
                </>
              )}
            </h2>
            <div className="flex flex-col items-start gap-4 lg:items-end lg:text-right pb-4">
              <p className="text-[#525257] text-[15px] leading-relaxed max-w-[320px] lg:ml-auto">
                {isFr
                  ? 'Sans engagement. Annulez en un clic.'
                  : 'No commitment. No credit card. Cancel anytime.'}
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-base font-medium pl-6 pr-7 py-4 rounded-full hover:bg-[#7a5fff] transition-colors"
              >
                {isFr ? 'Créer un compte' : 'Create account'}
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
