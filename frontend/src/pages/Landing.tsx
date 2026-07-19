import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';
import {
  Phone, Mic, Calendar, MessageSquare, ArrowRight, Play, Check,
  Shield, Bot, Headphones, Zap, Languages,
} from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import { useLang } from '../stores/langStore';
import Reveal from '../components/ui/Reveal';
import Card3D from '../components/ui/Card3D';
import PhoneCallVisual from '../components/landing/PhoneCallVisual';
import VoiceCard, { type VoiceData } from '../components/landing/VoiceCard';

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function Landing() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const voiceName = isFr ? 'Marie' : 'Ashley';

  useSEO({
    title: isFr ? 'Réceptionniste IA en français, Belgique et France' : 'AI Receptionist',
    description: isFr
      ? "Le meilleur réceptionniste IA francophone pour la Belgique et la France : répond à chaque appel en moins d'une seconde, prend les rendez-vous et qualifie vos leads 24h/24. Hébergement UE, RGPD."
      : 'The Qwillio AI receptionist answers every call in under a second, books appointments, and qualifies leads, around the clock.',
    canonical: 'https://qwillio.com/receptionist',
  });

  const voices: VoiceData[] = [
    {
      name: 'Ashley',
      accent: isFr ? 'Anglais · États-Unis' : 'English · United States',
      vibe: isFr
        ? 'Chaleureuse, naturelle. Ventes sortantes et accueil entrant.'
        : 'Warm, natural. Built for outbound sales and inbound reception.',
      swatch: '#6366f1',
      ring: 'rgba(99,102,241,0.45)',
      initials: 'AS',
      lang: 'en-US',
      sample: "Hey, Bright Dental, this is Ashley. How can I help you today?",
    },
    {
      name: 'Marie',
      accent: isFr ? 'Français · France & Québec' : 'French · France & Quebec',
      vibe: isFr
        ? 'Chaleureuse, conversationnelle. Conçue pour le marché francophone.'
        : 'Warm, conversational. Built for French and Quebec markets.',
      swatch: '#a855f7',
      ring: 'rgba(168,85,247,0.45)',
      initials: 'MA',
      lang: 'fr-FR',
      sample: "Bonjour, cabinet Bright Dental, c'est Marie. Comment puis-je vous aider ?",
    },
  ];

  const tiers = isFr
    ? [
        {
          name: 'Solo',
          price: '297',
          desc: 'Pour les indépendants et les petites équipes qui démarrent.',
          highlights: ['Jusqu\'à 200 appels / mois', '1 numéro dédié', 'Voix française naturelle', 'Calendrier Google ou Outlook'],
          cta: 'Démarrer',
        },
        {
          name: 'Cabinet',
          price: '497',
          desc: 'Le forfait le plus choisi par les cabinets et les agences.',
          highlights: [
            '600 appels / mois',
            'CRM intégré + SMS de suivi',
            'Transferts urgences',
            'Multilingue (FR, EN, ES, IT)',
            'Support 7j/7 prioritaire',
          ],
          cta: 'Premier mois offert',
          highlighted: true,
        },
        {
          name: 'Volume',
          price: '997',
          desc: "Pour les multi-sites, franchises et opérations à grand volume.",
          highlights: ['Appels illimités', 'API complète + webhooks', 'White-label'],
          cta: 'Nous contacter',
        },
      ]
    : [
        {
          name: 'Solo',
          price: '297',
          desc: 'For independents and small teams getting started.',
          highlights: ['Up to 200 calls / month', '1 dedicated number', 'Natural English voice', 'Google or Outlook calendar'],
          cta: 'Get started',
        },
        {
          name: 'Practice',
          price: '497',
          desc: 'The most chosen plan by practices and agencies.',
          highlights: [
            '600 calls / month',
            'Built-in CRM + SMS follow-up',
            'Urgency transfers',
            'Multilingual (EN, FR, ES, IT)',
            'Priority support, 7 days a week',
          ],
          cta: 'First month free',
          highlighted: true,
        },
        {
          name: 'Volume',
          price: '997',
          desc: 'For multi-site, franchises, and high-volume operations.',
          highlights: ['Unlimited calls', 'Full API + webhooks', 'White-label'],
          cta: 'Contact us',
        },
      ];

  const founderNote = isFr
    ? {
        quote: "Qwillio vient de démarrer, construit et opéré par un développeur solo à Bruxelles. Chaque premier client est onboardé personnellement.",
        sub: "On préfère être honnête plutôt qu'afficher de faux avis clients.",
      }
    : {
        quote: 'Qwillio just launched, built and run by a solo developer in Brussels. Every first customer is onboarded personally.',
        sub: "We'd rather be upfront than show fake customer reviews.",
      };

  return (
    <div className="bg-white text-[#1d1d1f] min-h-screen">
      <PublicNavbar />

      <main>
        {/* ════════════════════════════════════════════════════════════════
            HERO — asymmetric editorial split (60/40)
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="hero-heading"
          className="relative pt-28 md:pt-36 pb-16 md:pb-28 px-6"
        >
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-20 items-center">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase text-[#6366f1] mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1] animate-pulse" />
                  {isFr ? 'Réceptionniste IA · Live 24/7' : 'AI Receptionist · Live 24/7'}
                </span>
              </Reveal>

              <Reveal delay={0.08}>
                <h1
                  id="hero-heading"
                  className="text-[clamp(2.6rem,6.5vw,5.6rem)] font-semibold tracking-[-0.04em] leading-[0.95] mb-6"
                >
                  {isFr ? (
                    <>
                      Elle décroche<br />
                      <span className="italic font-serif text-[#6366f1]">avant la deuxième</span><br />
                      sonnerie.<br />
                      <span className="italic font-serif text-[#6366f1]">Toujours.</span>
                    </>
                  ) : (
                    <>
                      She picks up<br />
                      <span className="italic font-serif text-[#6366f1]">before the second</span><br />
                      ring.<br />
                      <span className="italic font-serif text-[#6366f1]">Every time.</span>
                    </>
                  )}
                </h1>
              </Reveal>

              <Reveal delay={0.16}>
                <p className="text-lg md:text-xl text-[#424245] max-w-[480px] mb-9 leading-[1.55]">
                  {isFr
                    ? "Un réceptionniste IA qui parle naturellement, prend les rendez-vous dans votre calendrier, et ne demande jamais de pause café."
                    : 'An AI receptionist that speaks naturally, books appointments in your calendar, and never asks for a coffee break.'}
                </p>
              </Reveal>

              <Reveal delay={0.24}>
                <div className="flex flex-wrap items-center gap-3 mb-10">
                  <a
                    href="/demo.html"
                    className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[15px] font-medium pl-5 pr-6 py-3.5 rounded-full hover:bg-[#6366f1] transition-colors duration-300"
                  >
                    <Play size={14} fill="currentColor" aria-hidden="true" />
                    {isFr ? `Écouter ${voiceName} parler` : `Hear ${voiceName} speak`}
                  </a>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-1.5 text-[15px] font-medium text-[#1d1d1f] px-2 py-2 underline decoration-[#6366f1]/30 decoration-2 underline-offset-8 hover:decoration-[#6366f1] transition-colors"
                  >
                    {isFr ? 'Essayer gratuitement' : 'Try free'}
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </Reveal>

              <Reveal delay={0.32}>
                <dl className="flex flex-wrap gap-x-9 gap-y-3 text-sm text-[#86868b] border-t border-[#1d1d1f]/10 pt-6 max-w-[540px]">
                  <div className="flex items-baseline gap-2">
                    <dt className="sr-only">{isFr ? 'Temps de décrochage' : 'Pickup time'}</dt>
                    <dd className="text-2xl font-semibold text-[#1d1d1f] tabular-nums">&lt;1s</dd>
                    <span>{isFr ? 'décrochage' : 'pickup'}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="sr-only">{isFr ? 'Langues' : 'Languages'}</dt>
                    <dd className="text-2xl font-semibold text-[#1d1d1f] tabular-nums">11</dd>
                    <span>{isFr ? 'langues' : 'languages'}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="sr-only">{isFr ? 'Voix' : 'Voices'}</dt>
                    <dd className="text-2xl font-semibold text-[#1d1d1f] tabular-nums">40+</dd>
                    <span>{isFr ? 'voix' : 'voices'}</span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <dt className="sr-only">{isFr ? 'Disponibilité' : 'Uptime'}</dt>
                    <dd className="text-2xl font-semibold text-[#1d1d1f] tabular-nums">24/7</dd>
                    <span>{isFr ? 'jamais fermé' : 'always on'}</span>
                  </div>
                </dl>
              </Reveal>
            </div>

            <Reveal delay={0.12}>
              <PhoneCallVisual isFr={isFr} />
            </Reveal>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            CAPABILITIES — asymmetric editorial layout
            Sticky-left intro + 2x2 staggered feature blocks on right
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="capabilities-heading"
          className="py-24 md:py-36 px-6 border-t border-[#1d1d1f]/8"
        >
          <div className="max-w-[1240px] mx-auto">
            <div className="grid lg:grid-cols-[1fr_1.6fr] gap-10 md:gap-16 lg:gap-24 items-start">
              <div className="lg:sticky lg:top-28">
                <Reveal>
                  <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#6366f1] block mb-3">
                    {isFr ? 'Ce qu\'elle fait' : 'What she does'}
                  </span>
                  <h2
                    id="capabilities-heading"
                    className="text-[clamp(1.9rem,4vw,3.2rem)] font-semibold tracking-[-0.035em] leading-[1.05] mb-5"
                  >
                    {isFr ? (
                      <>Pas un menu vocal.<br /><span className="font-serif italic text-[#6366f1]">Une vraie conversation.</span></>
                    ) : (
                      <>Not a phone menu.<br /><span className="font-serif italic text-[#6366f1]">A real conversation.</span></>
                    )}
                  </h2>
                  <p className="text-[#525257] text-[15px] leading-relaxed max-w-[360px] mb-8">
                    {isFr
                      ? `${voiceName} écoute, comprend le contexte, et agit. Elle prend les rendez-vous dans votre vrai calendrier, envoie les confirmations, et reconnaît une urgence quand elle en entend une.`
                      : `${voiceName} listens, understands context, and acts. She books appointments in your real calendar, sends confirmations, and recognizes an emergency when she hears one.`}
                  </p>
                  <Link
                    to="/pricing"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6366f1] underline decoration-[#6366f1]/30 decoration-2 underline-offset-8 hover:decoration-[#6366f1] transition-colors"
                  >
                    {isFr ? 'Voir les tarifs' : 'See pricing'}
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </Reveal>
              </div>

              <ul className="grid sm:grid-cols-2 gap-5" role="list">
                {[
                  {
                    icon: Mic,
                    title: isFr ? 'Conversations naturelles' : 'Natural conversation',
                    body: isFr
                      ? `Pas de scripts robotiques. ${voiceName} adapte le ton, gère les interruptions et reformule quand c'est flou.`
                      : `No robotic scripts. ${voiceName} adapts tone, handles interruptions, and rephrases when something is unclear.`,
                    tall: true,
                    bg: '#1d1d1f',
                    fg: 'white',
                    accent: '#a5b4fc',
                  },
                  {
                    icon: Calendar,
                    title: isFr ? 'Rendez-vous dans votre agenda' : 'Books in your calendar',
                    body: isFr
                      ? `Google, Outlook, Calendly. ${voiceName} vérifie les créneaux libres et réserve directement.`
                      : `Google, Outlook, Calendly. ${voiceName} checks availability and books straight in.`,
                    bg: '#fafaf8',
                    fg: '#1d1d1f',
                    accent: '#6366f1',
                  },
                  {
                    icon: MessageSquare,
                    title: isFr ? 'SMS et email de suivi' : 'SMS and email follow-up',
                    body: isFr
                      ? "Confirmations envoyées dans la minute. Rappels la veille. Réponses aux questions courantes."
                      : 'Confirmations sent within a minute. Reminders the day before. Answers to common questions.',
                    bg: '#fafaf8',
                    fg: '#1d1d1f',
                    accent: '#a855f7',
                  },
                  {
                    icon: Headphones,
                    title: isFr ? 'Transferts intelligents' : 'Smart transfers',
                    body: isFr
                      ? `Quand un appel devient urgent, ${voiceName} identifie qui doit décrocher et transfère sans faire patienter.`
                      : `When a call turns urgent, ${voiceName} identifies who should take it and transfers without making the caller wait.`,
                    tall: true,
                    bg: '#6366f1',
                    fg: 'white',
                    accent: 'rgba(255,255,255,0.6)',
                  },
                ].map((feat, i) => (
                  <Reveal key={feat.title} delay={i * 0.08} as="li" className={feat.tall ? 'sm:row-span-2' : ''}>
                    <article
                      className="rounded-3xl p-7 md:p-8 h-full flex flex-col justify-between"
                      style={{ background: feat.bg, color: feat.fg, minHeight: feat.tall ? 280 : 220 }}
                    >
                      <div>
                        <span
                          className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
                          style={{ background: feat.fg === 'white' ? 'rgba(255,255,255,0.10)' : 'rgba(99,102,241,0.10)' }}
                        >
                          <feat.icon size={18} style={{ color: feat.accent }} aria-hidden="true" />
                        </span>
                        <h3 className="text-[1.25rem] font-semibold tracking-[-0.015em] mb-2.5 leading-snug">
                          {feat.title}
                        </h3>
                        <p
                          className="text-[14.5px] leading-relaxed"
                          style={{ color: feat.fg === 'white' ? 'rgba(255,255,255,0.7)' : '#525257' }}
                        >
                          {feat.body}
                        </p>
                      </div>
                    </article>
                  </Reveal>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            VOICES — showcase, NOT a checklist
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="voices-heading"
          className="py-20 md:py-28 px-6 bg-[#fafaf8] border-y border-[#1d1d1f]/8"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
              <div className="flex items-end justify-between gap-8 mb-12 md:mb-16 flex-wrap">
                <div>
                  <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#6366f1] block mb-3">
                    {isFr ? 'Voix et langues' : 'Voices and languages'}
                  </span>
                  <h2
                    id="voices-heading"
                    className="text-[clamp(1.9rem,4vw,3.2rem)] font-semibold tracking-[-0.035em] leading-[1.05] max-w-[680px]"
                  >
                    {isFr ? (
                      <>Choisissez la voix <span className="font-serif italic text-[#6366f1]">qui sonne comme votre marque.</span></>
                    ) : (
                      <>Pick the voice <span className="font-serif italic text-[#6366f1]">that sounds like your brand.</span></>
                    )}
                  </h2>
                </div>
                <p className="text-[#525257] text-sm max-w-[300px] leading-relaxed">
                  {isFr
                    ? '40+ voix humaines en 11 langues. Accents régionaux, intonations naturelles, sans coupures.'
                    : '40+ human voices across 11 languages. Regional accents, natural intonation, no cut-offs.'}
                </p>
              </div>
            </Reveal>

            <div className="grid md:grid-cols-2 gap-5 mb-10">
              <Reveal delay={0}>
                <VoiceCard v={voices[0]} large />
              </Reveal>
              <Reveal delay={0.08}>
                <VoiceCard v={voices[1]} large />
              </Reveal>
            </div>

            {/* Language pills (chip cloud, not grid) */}
            <Reveal delay={0.2}>
              <div className="flex items-center gap-5 flex-wrap">
                <span className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase text-[#86868b]">
                  <Languages size={13} aria-hidden="true" />
                  {isFr ? 'Disponible en' : 'Available in'}
                </span>
                <ul className="flex flex-wrap gap-2" role="list">
                  {[
                    isFr ? 'Français' : 'French',
                    'English',
                    isFr ? 'Espagnol' : 'Spanish',
                    isFr ? 'Italien' : 'Italian',
                    isFr ? 'Allemand' : 'German',
                    isFr ? 'Portugais' : 'Portuguese',
                    isFr ? 'Néerlandais' : 'Dutch',
                    isFr ? 'Arabe' : 'Arabic',
                    isFr ? 'Mandarin' : 'Mandarin',
                    isFr ? 'Japonais' : 'Japanese',
                    isFr ? 'Coréen' : 'Korean',
                  ].map((lng) => (
                    <li key={lng}>
                      <span className="inline-flex items-center text-xs px-3.5 py-2 rounded-full bg-white border border-[#1d1d1f]/10 text-[#1d1d1f] font-medium hover:border-[#6366f1] hover:text-[#6366f1] transition-colors cursor-default">
                        {lng}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            HOW IT WORKS — editorial top-numbered
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="how-heading"
          className="py-20 md:py-28 px-6"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
              <h2
                id="how-heading"
                className="text-[clamp(1.7rem,3.2vw,2.6rem)] font-semibold tracking-[-0.025em] mb-12 max-w-[760px]"
              >
                {isFr
                  ? <>Mise en route en 12 minutes. <span className="text-[#86868b] font-normal">Premier appel traité ce soir.</span></>
                  : <>Live in 12 minutes. <span className="text-[#86868b] font-normal">First call handled tonight.</span></>}
              </h2>
            </Reveal>

            <ol className="grid md:grid-cols-3 gap-8 md:gap-12" role="list">
              {[
                {
                  num: '01',
                  title: isFr ? 'Choisissez votre voix' : 'Pick your voice',
                  desc: isFr
                    ? 'Sélectionnez parmi 40+ voix. Écoutez chaque option. Personnalisez le nom, la salutation, le ton.'
                    : 'Pick from 40+ voices. Audition each option. Customize the name, greeting, and tone.',
                },
                {
                  num: '02',
                  title: isFr ? 'Connectez votre agenda' : 'Connect your calendar',
                  desc: isFr
                    ? `Google, Outlook, Calendly, Cal.com. ${voiceName} voit vos créneaux libres et réserve directement.`
                    : `Google, Outlook, Calendly, Cal.com. ${voiceName} sees your open slots and books straight in.`,
                },
                {
                  num: '03',
                  title: isFr ? 'Transférez votre numéro' : 'Forward your number',
                  desc: isFr
                    ? `Gardez votre numéro existant. Activez le renvoi d'appel. ${voiceName} prend le relais immédiatement.`
                    : `Keep your existing number. Activate call forwarding. ${voiceName} takes over immediately.`,
                },
              ].map((step, i) => (
                <Reveal key={step.num} delay={i * 0.1} as="li">
                  <div className="border-t-2 border-[#1d1d1f] pt-5">
                    <p className="text-[11px] font-bold tracking-[0.2em] text-[#6366f1] mb-3">{step.num}</p>
                    <h3 className="text-xl font-semibold mb-2 tracking-[-0.015em]">{step.title}</h3>
                    <p className="text-[#525257] leading-relaxed text-[15px]">{step.desc}</p>
                  </div>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            BIG QUOTE — drenched indigo editorial break
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-label={isFr ? 'Note du fondateur' : 'Founder note'}
          className="px-6 py-8"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
              <div
                className="rounded-[2rem] px-8 md:px-16 py-16 md:py-24 relative overflow-hidden"
                style={{ background: '#6366f1' }}
              >
                <div
                  aria-hidden="true"
                  className="absolute -right-32 -top-32 w-[440px] h-[440px] rounded-full opacity-30 blur-3xl"
                  style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }}
                />
                <p className="relative text-white/70 text-xs font-medium tracking-[0.14em] uppercase mb-6">
                  {isFr ? 'Lancement' : 'Launch'}
                </p>
                <blockquote
                  className="relative text-white text-[clamp(1.6rem,3.5vw,2.6rem)] font-semibold tracking-[-0.025em] leading-[1.18] max-w-[920px]"
                >
                  {founderNote.quote}
                </blockquote>
                <p className="relative mt-6 text-white/70 text-[15px] max-w-[640px]">
                  {founderNote.sub}
                </p>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            PRICING — bento ratio 1fr / 1.35fr / 1fr (middle dominant)
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="pricing-heading"
          className="py-24 md:py-36 px-6"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
              <div className="flex items-end justify-between gap-8 mb-12 md:mb-16 flex-wrap">
                <div>
                  <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#6366f1] block mb-3">
                    {isFr ? 'Tarifs' : 'Pricing'}
                  </span>
                  <h2
                    id="pricing-heading"
                    className="text-[clamp(1.9rem,4vw,3.2rem)] font-semibold tracking-[-0.035em] leading-[1.05] max-w-[640px]"
                  >
                    {isFr ? (
                      <>Trois forfaits. <span className="font-serif italic text-[#6366f1]">Premier mois offert.</span></>
                    ) : (
                      <>Three plans. <span className="font-serif italic text-[#6366f1]">First month free.</span></>
                    )}
                  </h2>
                </div>
                <p className="text-[#525257] text-sm max-w-[300px] leading-relaxed">
                  {isFr
                    ? 'Sans engagement. Annulation en un clic. Pas de carte requise pour démarrer.'
                    : 'No commitment. Cancel in one click. No card required to get started.'}
                </p>
              </div>
            </Reveal>

            <div className="grid lg:grid-cols-[1fr_1.35fr_1fr] gap-5 items-start">
              {tiers.map((tier, i) => {
                const isHi = !!tier.highlighted;
                return (
                  <Reveal key={tier.name} delay={i * 0.09}>
                  <Card3D intensity={3}>
                    <article
                      aria-current={isHi ? 'true' : undefined}
                      className={`relative rounded-[2rem] p-7 md:p-9 h-full flex flex-col ${
                        isHi
                          ? 'text-white'
                          : 'bg-white border border-[#1d1d1f]/10 text-[#1d1d1f]'
                      }`}
                      style={
                        isHi
                          ? {
                              background:
                                'linear-gradient(160deg, #1d1d1f 0%, #2d2d40 55%, #6366f1 115%)',
                              minHeight: 560,
                            }
                          : { minHeight: 480 }
                      }
                    >
                      {isHi && (
                        <span className="absolute top-5 right-5 text-[10px] font-bold tracking-[0.2em] uppercase text-[#a5b4fc]">
                          {isFr ? 'Le plus choisi' : 'Most chosen'}
                        </span>
                      )}

                      <div className="flex-1">
                        <h3
                          className={`font-semibold tracking-[-0.02em] mb-2 ${
                            isHi ? 'text-2xl' : 'text-xl'
                          }`}
                        >
                          {tier.name}
                        </h3>
                        <p
                          className={`text-[13.5px] leading-relaxed mb-7 max-w-[280px] ${
                            isHi ? 'text-white/65' : 'text-[#525257]'
                          }`}
                        >
                          {tier.desc}
                        </p>

                        <div className="flex items-baseline gap-1 mb-1">
                          <span
                            className={`text-[clamp(2.6rem,4.5vw,3.6rem)] font-semibold tracking-[-0.04em] leading-none ${
                              isHi ? 'text-white' : 'text-[#1d1d1f]'
                            }`}
                          >
                            ${tier.price}
                          </span>
                          <span className={`text-sm ${isHi ? 'text-white/60' : 'text-[#86868b]'}`}>
                            /{isFr ? 'mois' : 'mo'}
                          </span>
                        </div>
                        <p className={`text-xs mb-8 ${isHi ? 'text-[#a5b4fc]' : 'text-[#6366f1]'}`}>
                          {isFr ? 'Premier mois offert' : 'First month free'}
                        </p>

                        <ul className="space-y-2.5 mb-8" role="list">
                          {tier.highlights.map((h) => (
                            <li
                              key={h}
                              className={`flex items-start gap-2.5 text-[14px] leading-snug ${
                                isHi ? 'text-white/85' : 'text-[#1d1d1f]'
                              }`}
                            >
                              <Check
                                size={14}
                                className="mt-1 flex-shrink-0"
                                style={{ color: isHi ? '#a5b4fc' : '#6366f1' }}
                                aria-hidden="true"
                              />
                              <span>{h}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <Link
                        to="/register"
                        className={`inline-flex items-center justify-center gap-2 text-[15px] font-medium px-6 py-3.5 rounded-full transition-colors ${
                          isHi
                            ? 'bg-white text-[#1d1d1f] hover:bg-[#a5b4fc] hover:text-white'
                            : 'bg-[#1d1d1f] text-white hover:bg-[#6366f1]'
                        }`}
                      >
                        {tier.cta}
                        <ArrowRight size={15} aria-hidden="true" />
                      </Link>
                    </article>
                  </Card3D>
                  </Reveal>
                );
              })}
            </div>

            <Reveal delay={0.3}>
              <p className="mt-10 inline-flex items-center gap-2 text-sm text-[#86868b]">
                <Shield size={14} aria-hidden="true" />
                {isFr
                  ? 'Conforme RGPD. Données hébergées en Europe. Annulation en un clic.'
                  : 'GDPR compliant. Data hosted in the EU. Cancel in one click.'}
              </p>
            </Reveal>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            FAQ-LIGHT / OBJECTION RELIEF — asymmetric 3 short blocks
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-labelledby="trust-heading"
          className="py-20 md:py-28 px-6 bg-[#fafaf8] border-y border-[#1d1d1f]/8"
        >
          <div className="max-w-[1240px] mx-auto grid lg:grid-cols-[1fr_1.8fr] gap-10 md:gap-16 items-start">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#6366f1] block mb-3">
                  {isFr ? 'Les questions courantes' : 'Common questions'}
                </span>
                <h2
                  id="trust-heading"
                  className="text-[clamp(1.6rem,3vw,2.4rem)] font-semibold tracking-[-0.03em] leading-[1.08] mb-5"
                >
                  {isFr ? (
                    <>Trois objections. <span className="font-serif italic text-[#6366f1]">Trois réponses honnêtes.</span></>
                  ) : (
                    <>Three concerns. <span className="font-serif italic text-[#6366f1]">Three honest answers.</span></>
                  )}
                </h2>
              </div>
            </Reveal>

            <ul className="space-y-6" role="list">
              {[
                {
                  icon: Bot,
                  q: isFr ? '"Mes clients vont sentir que c\'est une IA."' : '"My customers will know it\'s AI."',
                  a: isFr
                    ? `${voiceName} utilise les voix les plus avancées du marché, avec respirations, hésitations courtes et intonations naturelles. La plupart des appelants ne s'en rendent pas compte. Et nous indiquons clairement quand un appel doit être annoncé comme automatisé.`
                    : `${voiceName} runs on the most advanced voice models, with breath, short pauses, and natural intonation. Most callers do not notice. And we make it clear when a call must be disclosed as automated.`,
                },
                {
                  icon: Shield,
                  q: isFr ? '"Et la confidentialité ?"' : '"What about privacy?"',
                  a: isFr
                    ? "Conformité RGPD intégrale. Données hébergées en Europe. Enregistrements chiffrés, accessibles uniquement par vous. Audit logs complets. Aucune donnée vendue ou utilisée pour l'entraînement."
                    : 'Full GDPR compliance. Data hosted in the EU. Recordings encrypted, only accessible by you. Complete audit logs. No data sold or used for training.',
                },
                {
                  icon: Zap,
                  q: isFr ? '"Et si elle ne sait pas répondre ?"' : '"What if she does not know the answer?"',
                  a: isFr
                    ? `${voiceName} transfère vers vous, prend un message détaillé, ou propose un rappel. Vous pouvez aussi définir des règles précises : urgence médicale, demande VIP, plainte. Elle apprend de chaque appel.`
                    : `${voiceName} transfers to you, takes a detailed message, or schedules a callback. You can set specific rules: medical urgency, VIP request, complaint. She learns from every call.`,
                },
              ].map((item, i) => (
                <Reveal key={item.q} delay={i * 0.1} as="li">
                  <article className="bg-white rounded-3xl p-7 md:p-8 border border-[#1d1d1f]/8">
                    <div className="flex items-start gap-4">
                      <span className="w-11 h-11 rounded-2xl bg-[#6366f1]/10 flex items-center justify-center flex-shrink-0">
                        <item.icon size={18} className="text-[#6366f1]" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-[1.05rem] font-semibold tracking-[-0.015em] mb-2 text-[#1d1d1f]">
                          {item.q}
                        </h3>
                        <p className="text-[14.5px] text-[#525257] leading-relaxed">
                          {item.a}
                        </p>
                      </div>
                    </div>
                  </article>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            FINAL CTA — editorial split with top border
            ════════════════════════════════════════════════════════════════ */}
        <section
          aria-label={isFr ? 'Démarrer avec Qwillio' : 'Get started with Qwillio'}
          className="py-24 md:py-36 px-6"
        >
          <div className="max-w-[1240px] mx-auto">
            <Reveal>
              <div className="grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end border-t-2 border-[#1d1d1f] pt-12 md:pt-16">
                <h2 className="text-[clamp(2.2rem,5vw,4.4rem)] font-semibold tracking-[-0.035em] leading-[0.98]">
                  {isFr ? (
                    <>
                      Le prochain appel<br />
                      arrive dans une heure.<br />
                      <span className="font-serif italic text-[#6366f1]">Soyez prêt.</span>
                    </>
                  ) : (
                    <>
                      The next call<br />
                      lands in an hour.<br />
                      <span className="font-serif italic text-[#6366f1]">Be ready.</span>
                    </>
                  )}
                </h2>
                <div className="flex flex-col items-start gap-4 lg:items-end lg:text-right pb-4">
                  <p className="text-[#525257] text-[15px] leading-relaxed max-w-[320px] lg:ml-auto">
                    {isFr
                      ? 'Sans engagement. Sans carte bancaire. Premier mois offert.'
                      : 'No commitment. No credit card. First month free.'}
                  </p>
                  <div className="flex flex-wrap gap-3 lg:justify-end">
                    <Link
                      to="/register"
                      className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-base font-medium pl-6 pr-7 py-4 rounded-full hover:bg-[#6366f1] transition-colors"
                    >
                      {isFr ? 'Créer un compte' : 'Create account'}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                    <a
                      href="/demo.html"
                      className="inline-flex items-center gap-2 text-base font-medium text-[#1d1d1f] pl-5 pr-2 py-4 underline decoration-[#6366f1]/30 decoration-2 underline-offset-8 hover:decoration-[#6366f1] transition-colors"
                    >
                      <Phone size={14} aria-hidden="true" />
                      {isFr ? 'Appeler la démo' : 'Call the demo'}
                    </a>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
