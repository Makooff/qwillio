import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import { Phone, Bot, ArrowRight, Play, Clock, Mic, Calendar, MessageSquare } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import Reveal from '../components/ui/Reveal';
import Card3D from '../components/ui/Card3D';

/* ── Decorative call ticker — live cycling rows + animated waveform ─────────── */
const POOL_FR = [
  { id: 'a', name: 'Sarah · Bright Dental',      detail: 'Rendez-vous lundi 14h confirmé',     tag: 'BOOKED'   },
  { id: 'b', name: 'Marc · Rivera HVAC',          detail: 'Devis chauffage envoyé par email',   tag: 'LEAD'     },
  { id: 'c', name: 'Inconnu · 06 12 34 56 78',   detail: 'Transféré à Sophie (urgence)',        tag: 'TRANSFER' },
  { id: 'd', name: 'Larsson Law',                 detail: 'Demande de rappel mardi',             tag: 'CALLBACK' },
  { id: 'e', name: 'Leroy · Plomberie Express',   detail: 'Urgence fuite — technicien envoyé',  tag: 'TRANSFER' },
  { id: 'f', name: 'Cabinet Morel',               detail: 'Consultation vendredi 10h réservée', tag: 'BOOKED'   },
  { id: 'g', name: 'Mme. Nguyen · Optique',       detail: 'Intéressée — devis demandé',         tag: 'LEAD'     },
];
const POOL_EN = [
  { id: 'a', name: 'Sarah · Bright Dental',      detail: 'Monday 2pm appointment confirmed',   tag: 'BOOKED'   },
  { id: 'b', name: 'Marc · Rivera HVAC',          detail: 'Heating quote emailed',              tag: 'LEAD'     },
  { id: 'c', name: 'Unknown · +1 555 0102',       detail: 'Transferred to Sophie (urgent)',     tag: 'TRANSFER' },
  { id: 'd', name: 'Larsson Law',                 detail: 'Tuesday callback requested',         tag: 'CALLBACK' },
  { id: 'e', name: 'Plumbing Express',            detail: 'Urgent leak — tech dispatched',      tag: 'TRANSFER' },
  { id: 'f', name: 'Morel & Associates',          detail: 'Friday 10am consultation booked',    tag: 'BOOKED'   },
  { id: 'g', name: 'Nguyen Optical',              detail: 'Quote requested — warm lead',        tag: 'LEAD'     },
];

const TAG_STYLE: Record<string, { bg: string; fg: string }> = {
  BOOKED:   { bg: 'rgba(99,102,241,0.18)',  fg: '#a5b4fc' },
  LEAD:     { bg: 'rgba(168,85,247,0.18)',  fg: '#d8b4fe' },
  TRANSFER: { bg: 'rgba(245,158,11,0.18)',  fg: '#fcd34d' },
  CALLBACK: { bg: 'rgba(255,255,255,0.12)', fg: '#ffffff' },
};

const WAVE_HEIGHTS = Array.from({ length: 32 }, (_, i) =>
  Math.max(4, 8 + Math.abs(Math.sin(i * 0.7) * 16) + (i % 3) * 4)
);

function CallTicker({ isFr }: { isFr: boolean }) {
  const pool = isFr ? POOL_FR : POOL_EN;
  const agoNew  = isFr ? 'À l\'instant' : 'Just now';
  const ago     = isFr
    ? ['À l\'instant', 'il y a 3 min', 'il y a 7 min', 'il y a 11 min']
    : ['Just now', '3 min ago', '7 min ago', '11 min ago'];

  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 3800);
    return () => clearInterval(id);
  }, []);

  const visible = useMemo(() =>
    Array.from({ length: 4 }, (_, i) => {
      const idx = ((tick - i) % pool.length + pool.length) % pool.length;
      return { ...pool[idx], instanceId: `${pool[idx].id}-${tick - i}`, ago: ago[i] };
    }),
    [tick, pool, ago]
  );

  return (
    <div
      className="relative rounded-3xl p-4 sm:p-6 overflow-hidden"
      style={{
        background: 'linear-gradient(155deg, #1d1d1f 0%, #2a234a 60%, #5b2f7a 110%)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full status-pulse"
            style={{ background: '#6366f1', boxShadow: '0 0 10px #6366f1' }}
            aria-hidden="true"
          />
          <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.18em] uppercase text-white/55">
            {isFr ? 'IA en ligne' : 'AI live'}
          </span>
        </div>
        <span className="text-[10px] sm:text-[11px] text-white/35 tabular-nums">qwillio.ai</span>
      </div>

      {/* Cycling rows */}
      <ul
        className="space-y-3 overflow-hidden"
        role="list"
        aria-label={isFr ? 'Appels traités en direct' : 'Live handled calls'}
        style={{ minHeight: 212 }}
      >
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((row) => {
            const tag = TAG_STYLE[row.tag];
            const iconColor = row.tag === 'LEAD' ? '#a855f7' : '#6366f1';
            return (
              <motion.li
                key={row.instanceId}
                layout
                initial={{ opacity: 0, y: -20, scale: 0.97 }}
                animate={{ opacity: 1, y: 0,   scale: 1    }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  duration: 0.38,
                  ease: [0.16, 1, 0.3, 1],
                  layout: { duration: 0.38, ease: [0.16, 1, 0.3, 1] },
                }}
                className="flex items-start gap-3 rounded-xl bg-white/[0.04] p-3.5 border border-white/[0.05]"
              >
                <div
                  className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center flex-shrink-0"
                  aria-hidden="true"
                >
                  <Phone size={14} style={{ color: iconColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-2 mb-0.5">
                    <p className="text-[13px] font-semibold text-white truncate">{row.name}</p>
                    <span className="text-[10px] text-white/35 flex-shrink-0">{row.ago}</span>
                  </div>
                  <p className="text-[12px] text-white/55 truncate">{row.detail}</p>
                </div>
                <span
                  className="text-[9.5px] font-bold tracking-wider px-2 py-1 rounded-md flex-shrink-0"
                  style={{ background: tag.bg, color: tag.fg }}
                >
                  {row.tag}
                </span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>

      {/* Animated waveform */}
      <div className="mt-4 sm:mt-5 flex items-end gap-[2px] h-10" aria-hidden="true">
        {WAVE_HEIGHTS.map((h, i) => (
          <span
            key={i}
            className="wave-bar flex-1 rounded-full"
            style={{
              height: `${h}px`,
              background: i % 2 === 0 ? 'rgba(99,102,241,0.6)' : 'rgba(168,85,247,0.5)',
              animationDuration: `${0.75 + (i % 5) * 0.17}s`,
              animationDelay: `-${(i * 0.13) % 1.4}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}


/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function Home() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: 'Qwillio',
    description: isFr
      ? 'Qwillio est votre réceptionniste IA qui répond à chaque appel, prend les rendez-vous et ne dort jamais.'
      : 'Qwillio is your AI receptionist that answers every call, books appointments, and never sleeps.',
    canonical: 'https://qwillio.com/',
  });

  const heroRef = useRef<HTMLElement>(null);
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

  const testimonial = isFr
    ? {
        quote: 'Qwillio a transformé notre cabinet. On ne manque plus un seul appel et les rendez-vous se prennent tout seuls.',
        name: 'Dr. Sarah Chen',
        role: 'Directrice de clinique, Bright Dental',
      }
    : {
        quote: 'Qwillio transformed our practice. We never miss a call and appointments book themselves.',
        name: 'Dr. Sarah Chen',
        role: 'Clinic Director, Bright Dental',
      };

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
            background: 'radial-gradient(700px circle at var(--mx,50%) var(--my,30%), rgba(99,102,241,0.07), transparent 65%)',
          }}
        >
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-20 items-center">
            {/* Editorial column */}
            <Reveal delay={0.05}>
            <div>

              <h1
                id="hero-heading"
                className="text-[clamp(2.6rem,6.5vw,5.6rem)] font-semibold tracking-[-0.04em] leading-[0.95] mb-6"
              >
                {isFr ? (
                  <>
                    Chaque appel<br />
                    <span className="italic font-serif" style={{ color: '#6366f1' }}>répondu.</span><br />
                    Chaque lead<br />
                    <span className="italic font-serif" style={{ color: '#a855f7' }}>capturé.</span>
                  </>
                ) : (
                  <>
                    Every call<br />
                    <span className="italic font-serif" style={{ color: '#6366f1' }}>answered.</span><br />
                    Every lead<br />
                    <span className="italic font-serif" style={{ color: '#a855f7' }}>captured.</span>
                  </>
                )}
              </h1>

              <p className="text-lg md:text-xl text-[#424245] max-w-[460px] mb-9 leading-[1.55]">
                {isFr
                  ? 'Réceptionniste IA, CRM, facturation. Une seule plateforme qui prend vos rendez-vous, qualifie vos leads et travaille 24h sur 24.'
                  : 'AI receptionist, CRM, billing. One platform that books your appointments, qualifies your leads, and works around the clock.'}
              </p>

              <div className="flex flex-wrap items-center gap-3 mb-10">
                <a
                  href="/demo.html"
                  className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[15px] font-medium pl-5 pr-6 py-3.5 rounded-full hover:bg-[#6366f1] transition-colors"
                >
                  <Play size={14} fill="currentColor" aria-hidden="true" />
                  {isFr ? 'Écouter une démo' : 'Hear the demo'}
                </a>
                <Link
                  to="/pricing"
                  className="inline-flex items-center gap-1.5 text-[15px] font-medium text-[#1d1d1f] px-2 py-2 underline decoration-[#6366f1]/30 decoration-2 underline-offset-8 hover:decoration-[#6366f1] transition-colors"
                >
                  {isFr ? 'Voir les tarifs' : 'See pricing'}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>

              {/* Inline credibility strip — not centered hero-metric template */}
              <dl className="flex flex-wrap gap-x-9 gap-y-3 text-sm text-[#86868b] border-t border-[#1d1d1f]/10 pt-6 max-w-[520px]">
                <div className="flex items-baseline gap-2">
                  <dt className="sr-only">{isFr ? 'Taux de réponse' : 'Answer rate'}</dt>
                  <dd className="text-2xl font-semibold text-[#1d1d1f] tabular-nums">98%</dd>
                  <span>{isFr ? 'décrochage' : 'pickup'}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="sr-only">{isFr ? 'Temps de réponse' : 'Response time'}</dt>
                  <dd className="text-2xl font-semibold text-[#1d1d1f] tabular-nums">&lt;1s</dd>
                  <span>{isFr ? 'temps réponse' : 'response'}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <dt className="sr-only">{isFr ? 'Disponibilité' : 'Uptime'}</dt>
                  <dd className="text-2xl font-semibold text-[#1d1d1f] tabular-nums">24/7</dd>
                  <span>{isFr ? 'jamais fermé' : 'always on'}</span>
                </div>
              </dl>
            </div>
            </Reveal>

            {/* Live ticker */}
            <Reveal delay={0.15}>
              <CallTicker isFr={isFr} />
            </Reveal>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            BIG QUOTE — drenched indigo (Receptionist brand)
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-label={isFr ? 'Témoignage client' : 'Customer quote'}
          className="px-6"
        >
          <div className="max-w-[1240px] mx-auto">
            <figure
              className="rounded-[2rem] px-8 md:px-16 py-12 sm:py-16 md:py-24"
              style={{ background: '#6366f1' }}
            >
              <blockquote className="text-white text-[clamp(1.6rem,3.5vw,2.6rem)] font-semibold tracking-[-0.025em] leading-[1.18] max-w-[920px]">
                <span
                  className="font-serif italic text-white/40 text-[1.8em] leading-none mr-2 align-[-0.18em]"
                  aria-hidden="true"
                >
                  "
                </span>
                {testimonial.quote}
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-3 text-white/80 text-sm">
                <span
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white"
                  style={{ background: 'rgba(255,255,255,0.15)' }}
                >
                  SC
                </span>
                <span>
                  <span className="font-semibold text-white">{testimonial.name}</span>
                  <span className="text-white/60"> — {testimonial.role}</span>
                </span>
              </figcaption>
            </figure>
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
                className="text-[clamp(2rem,4.5vw,3.6rem)] font-semibold tracking-[-0.035em] leading-[1.02] max-w-[700px]"
              >
                {isFr ? (
                  <>
                    Deux modules.{' '}
                    <span className="font-serif italic" style={{ color: '#6366f1' }}>Un cerveau.</span>
                  </>
                ) : (
                  <>
                    Two modules.{' '}
                    <span className="font-serif italic" style={{ color: '#6366f1' }}>One brain.</span>
                  </>
                )}
              </h2>
              <p className="text-[#86868b] text-base max-w-[520px] leading-relaxed mt-4">
                {isFr
                  ? 'Conçus pour fonctionner ensemble. Adoptez ce dont vous avez besoin, quand vous en avez besoin.'
                  : 'Built to work together. Adopt what you need, when you need it.'}
              </p>
            </Reveal>

            <div className="grid lg:grid-cols-[1.7fr_1fr] gap-5">
              {/* PRIMARY — Receptionist (indigo) */}
              <Card3D intensity={3}>
              <Link
                to="/receptionist"
                className="group relative rounded-[2rem] overflow-hidden block p-8 md:p-12 min-h-[460px] h-full text-white"
                style={{ background: 'linear-gradient(155deg, #1d1d1f 0%, #2a2356 55%, #6366f1 110%)' }}
              >
                <div
                  aria-hidden="true"
                  className="absolute -right-32 -top-32 w-[440px] h-[440px] rounded-full opacity-30 blur-3xl"
                  style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }}
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

                  <div className="mt-10 flex flex-wrap gap-2">
                    {(isFr
                      ? ['Voix française naturelle', 'Calendrier auto', 'CRM intégré', 'SMS de suivi']
                      : ['Natural voice', 'Auto-calendar', 'CRM sync', 'SMS follow-up']
                    ).map((f) => (
                      <span
                        key={f}
                        className="text-xs px-3 py-1.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.15)' }}
                      >
                        {f}
                      </span>
                    ))}
                  </div>

                  <div className="mt-10 flex items-baseline justify-between gap-4 flex-wrap">
                    <p className="text-white/55 text-sm">
                      {isFr ? 'À partir de ' : 'From '}
                      <span className="text-white font-semibold">$497<span className="text-white/55">/mois</span></span>
                      <span className="ml-2 text-xs font-medium" style={{ color: '#a5b4fc' }}>
                        · {isFr ? '1er mois offert' : '1st month free'}
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

              {/* SECONDARY — Agent (violet) */}
              <Card3D intensity={3}>
              <Link
                to="/agent"
                className="group relative rounded-[2rem] block p-8 md:p-10 min-h-[460px] h-full overflow-hidden text-white"
                style={{ background: 'linear-gradient(155deg, #1d1d1f 0%, #3a1f4a 55%, #a855f7 115%)' }}
              >
                <div
                  aria-hidden="true"
                  className="absolute -right-24 -top-24 w-[340px] h-[340px] rounded-full opacity-30 blur-3xl"
                  style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }}
                />
                <div className="relative flex flex-col h-full justify-between">
                  <div>
                    <span
                      className="w-11 h-11 rounded-2xl text-white flex items-center justify-center mb-6"
                      style={{ background: 'rgba(255,255,255,0.12)' }}
                    >
                      <Bot size={20} aria-hidden="true" />
                    </span>
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
                      { icon: MessageSquare, label: 'Email' },
                      { icon: Calendar,      label: isFr ? 'Facturation' : 'Billing' },
                      { icon: Mic,           label: isFr ? 'Inventaire' : 'Inventory' },
                      { icon: Clock,         label: isFr ? 'Paiements' : 'Payments' },
                    ].map((m) => (
                      <li
                        key={m.label}
                        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.10)' }}
                      >
                        <m.icon size={14} style={{ color: '#d8b4fe' }} aria-hidden="true" />
                        <span className="text-xs font-medium text-white">{m.label}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 flex items-center justify-between">
                    <p className="text-white/55 text-sm">
                      <span className="text-white font-semibold">+$197</span>
                      <span className="text-white/55">/mois · {isFr ? 'par module' : 'per module'}</span>
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium" style={{ color: '#d8b4fe' }}>
                      {isFr ? 'Voir' : 'View'}
                      <ArrowRight size={15} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
                    </span>
                  </div>
                </div>
              </Link>
              </Card3D>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            HOW IT WORKS — numbered editorial. Alternating accent colors.
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="how-heading"
          className="py-14 sm:py-18 md:py-28 px-6 border-t border-[#1d1d1f]/8"
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

            <ol className="grid md:grid-cols-3 gap-8 md:gap-12" role="list">
              {[
                {
                  num: '01',
                  accent: '#6366f1',
                  title: isFr ? 'Inscrivez-vous' : 'Sign up',
                  desc: isFr
                    ? 'Créez votre compte en 2 minutes. Sans carte. Premier mois offert.'
                    : 'Create your account in 2 minutes. No card. First month free.',
                },
                {
                  num: '02',
                  accent: '#a855f7',
                  title: isFr ? 'Configurez' : 'Configure',
                  desc: isFr
                    ? 'Voix, scripts, horaires, intégrations calendrier. Tout se règle dans le dashboard.'
                    : 'Voice, scripts, hours, calendar integrations. Everything from the dashboard.',
                },
                {
                  num: '03',
                  accent: '#6366f1',
                  title: isFr ? 'Allumez la ligne' : 'Go live',
                  desc: isFr
                    ? 'Transférez votre numéro existant. L\'IA prend le relais. Support FR 7j/7.'
                    : 'Forward your existing number. The AI takes over. Support 7 days a week.',
                },
              ].map((step) => (
                <li key={step.num} className="border-t-2 pt-5" style={{ borderColor: step.accent }}>
                  <p className="text-[11px] font-bold tracking-[0.2em] mb-3" style={{ color: step.accent }}>
                    {step.num}
                  </p>
                  <h3 className="text-xl font-semibold mb-2 tracking-[-0.015em]">{step.title}</h3>
                  <p className="text-[#525257] leading-relaxed text-[15px]">{step.desc}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            INDUSTRIES — asymmetric chip-cloud with brand-color hover
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="industries-heading"
          className="py-14 sm:py-18 md:py-28 px-6 bg-[#fafaf8] border-y border-[#1d1d1f]/8"
        >
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1fr_1.8fr] gap-10 md:gap-16 items-start">
            <Reveal className="lg:sticky lg:top-28">
              <span className="text-[11px] font-semibold tracking-[0.18em] uppercase block mb-3 text-[#86868b]">
                {isFr ? 'Pour qui' : 'For whom'}
              </span>
              <h2
                id="industries-heading"
                className="text-[clamp(1.7rem,3.5vw,2.8rem)] font-semibold tracking-[-0.03em] leading-[1.08] mb-5"
              >
                {isFr
                  ? <>Toute entreprise <span className="font-serif italic" style={{ color: '#6366f1' }}>qui répond au téléphone.</span></>
                  : <>Any business <span className="font-serif italic" style={{ color: '#6366f1' }}>that answers the phone.</span></>}
              </h2>
              <p className="text-[#525257] text-[15px] leading-relaxed max-w-[360px]">
                {isFr
                  ? 'Si vous perdez un seul appel par jour, Qwillio se rentabilise dès la première semaine.'
                  : 'If you miss one call a day, Qwillio pays for itself within the first week.'}
              </p>
            </Reveal>

            <ul className="flex flex-wrap gap-2" role="list">
              {industries.map((name, i) => (
                <motion.li
                  key={name}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: i * 0.04 }}
                  whileHover={{ y: -2 }}
                >
                  <span className="inline-block px-4 py-2 rounded text-[13px] font-medium text-[#1d1d1f] bg-white border border-[#1d1d1f]/12 hover:text-[#6366f1] hover:border-[#6366f1]/40 hover:bg-[#6366f1]/5 transition-colors duration-150 cursor-default select-none">
                    {name}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
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
                  <span className="font-serif italic" style={{ color: '#6366f1' }}>Commencez aujourd'hui.</span>
                </>
              ) : (
                <>
                  Stop losing<br />
                  calls.<br />
                  <span className="font-serif italic" style={{ color: '#6366f1' }}>Start today.</span>
                </>
              )}
            </h2>
            <div className="flex flex-col items-start gap-4 lg:items-end lg:text-right pb-4">
              <p className="text-[#525257] text-[15px] leading-relaxed max-w-[320px] lg:ml-auto">
                {isFr
                  ? 'Sans engagement. Sans carte bancaire. Annulez en un clic.'
                  : 'No commitment. No credit card. Cancel anytime.'}
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-base font-medium pl-6 pr-7 py-4 rounded-full hover:bg-[#6366f1] transition-colors"
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
