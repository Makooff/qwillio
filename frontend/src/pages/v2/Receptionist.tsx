import type { ReactNode } from 'react';
import {
  Phone, Mic, Calendar, MessageSquare, ArrowRight, Play, Check,
  Shield, Headphones, Languages, Lock, Server, FileText,
  type LucideIcon,
} from 'lucide-react';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import CardV2 from '../../components/v2/CardV2';
import FaqAccordion, { type FaqEntry } from '../../components/v2/FaqAccordion';
import HeroPhone3D from '../../components/ui/HeroPhone3D';
import VoiceCard, { type VoiceData } from '../../components/landing/VoiceCard';

/* Réceptionniste V2 « Papier & Signal » (DA/v2-direction.md).
   Sémantique indigo: ce qui décroche. Copie FR/EN portée de la V1 (pages/Landing.tsx),
   aucune métrique ajoutée. HeroPhone3D et VoiceCard sont réutilisés tels quels. */

interface Capability {
  icon: LucideIcon;
  num: string;
  title: string;
  body: string;
  panel: ReactNode;
}

interface Tier {
  name: string;
  price: string;
  included: string;
  desc: string;
}

function PanelLabel({ children }: { children: ReactNode }) {
  return <p className="q2-eyebrow text-q2-faint mb-6">{children}</p>;
}

export default function Receptionist() {
  const { lang } = useLang();
  const isFr = lang === 'fr';
  const voiceName = isFr ? 'Marie' : 'Ashley';

  useSEO({
    title: isFr ? 'Réceptionniste IA en français, Belgique et France' : 'AI Receptionist',
    description: isFr
      ? "Le meilleur réceptionniste IA francophone pour la Belgique et la France : répond à chaque appel en moins d'une seconde, prend les rendez-vous et qualifie vos leads 24h/24. Hébergement UE, RGPD."
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
      swatch: '#7a5fff',
      ring: 'rgba(122,95,255,0.45)',
      initials: 'AS',
      lang: 'en-US',
      sample: 'Hey, Bright Dental, this is Ashley. How can I help you today?',
    },
    {
      name: 'Marie',
      accent: isFr ? 'Français · France & Québec' : 'French · France & Quebec',
      vibe: isFr
        ? 'Chaleureuse, conversationnelle. Conçue pour le marché francophone.'
        : 'Warm, conversational. Built for French and Quebec markets.',
      swatch: '#cd6bfb',
      ring: 'rgba(205,107,251,0.45)',
      initials: 'MA',
      lang: 'fr-FR',
      sample: "Bonjour, cabinet Bright Dental, c'est Marie. Comment puis-je vous aider ?",
    },
  ];

  const languages = [
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
  ];

  const capabilities: Capability[] = [
    {
      icon: Mic,
      num: '01',
      title: isFr ? 'Conversations naturelles' : 'Natural conversation',
      body: isFr
        ? `Pas de scripts robotiques. ${voiceName} adapte le ton, gère les interruptions et reformule quand c’est flou.`
        : `No robotic scripts. ${voiceName} adapts tone, handles interruptions, and rephrases when something is unclear.`,
      panel: (
        <CardV2 variant="band" large className="h-full">
          <PanelLabel>{isFr ? 'Salutation' : 'Greeting'}</PanelLabel>
          <ul className="space-y-5" role="list">
            {voices.map((v) => (
              <li key={v.name} className="border-b border-q2-plate pb-5 last:border-0 last:pb-0">
                <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-q2-faint mb-2">
                  {v.name} · {v.lang}
                </p>
                <p className="text-q2-graphite text-[15px] leading-relaxed q2-body-text">{v.sample}</p>
              </li>
            ))}
          </ul>
        </CardV2>
      ),
    },
    {
      icon: Calendar,
      num: '02',
      title: isFr ? 'Rendez-vous dans votre agenda' : 'Books in your calendar',
      body: isFr
        ? `Google, Outlook, Calendly. ${voiceName} vérifie les créneaux libres et réserve directement.`
        : `Google, Outlook, Calendly. ${voiceName} checks availability and books straight in.`,
      panel: (
        <CardV2 variant="band" large className="h-full">
          <PanelLabel>{isFr ? 'Agendas connectés' : 'Connected calendars'}</PanelLabel>
          <ul className="flex flex-wrap gap-2.5 mb-8" role="list">
            {['Google', 'Outlook', 'Calendly', 'Cal.com'].map((c) => (
              <li
                key={c}
                className="inline-flex items-center rounded-full bg-q2-canvas border border-q2-plate px-4 py-2 text-[13px] font-medium text-q2-graphite"
              >
                {c}
              </li>
            ))}
          </ul>
          <p className="text-q2-body text-sm leading-relaxed q2-body-text border-t border-q2-plate pt-5">
            {isFr
              ? 'Les créneaux libres sont vérifiés pendant l’appel, la réservation part dans votre vrai calendrier.'
              : 'Open slots are checked during the call, the booking lands in your real calendar.'}
          </p>
        </CardV2>
      ),
    },
    {
      icon: MessageSquare,
      num: '03',
      title: isFr ? 'SMS et email de suivi' : 'SMS and email follow-up',
      body: isFr
        ? 'Confirmations envoyées dans la minute. Rappels la veille. Réponses aux questions courantes.'
        : 'Confirmations sent within a minute. Reminders the day before. Answers to common questions.',
      panel: (
        <CardV2 variant="band" large className="h-full">
          <PanelLabel>{isFr ? 'Après l’appel' : 'After the call'}</PanelLabel>
          <ul className="divide-y divide-q2-plate" role="list">
            {[
              isFr ? 'Confirmation envoyée dans la minute' : 'Confirmation sent within a minute',
              isFr ? 'Rappel la veille du rendez-vous' : 'Reminder the day before the appointment',
              isFr ? 'Réponses aux questions courantes' : 'Answers to common questions',
            ].map((line) => (
              <li key={line} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                <Check size={15} className="mt-0.5 shrink-0 text-q2-indigo" aria-hidden="true" />
                <span className="text-q2-graphite text-[15px] leading-snug q2-body-text">{line}</span>
              </li>
            ))}
          </ul>
        </CardV2>
      ),
    },
    {
      icon: Headphones,
      num: '04',
      title: isFr ? 'Transferts intelligents' : 'Smart transfers',
      body: isFr
        ? `Quand un appel devient urgent, ${voiceName} identifie qui doit décrocher et transfère sans faire patienter.`
        : `When a call turns urgent, ${voiceName} identifies who should take it and transfers without making the caller wait.`,
      panel: (
        <CardV2 variant="band" large className="h-full">
          <PanelLabel>{isFr ? 'Règles que vous définissez' : 'Rules you define'}</PanelLabel>
          <ul className="flex flex-wrap gap-2.5 mb-8" role="list">
            {[
              isFr ? 'Urgence médicale' : 'Medical urgency',
              isFr ? 'Demande VIP' : 'VIP request',
              isFr ? 'Plainte' : 'Complaint',
            ].map((rule) => (
              <li
                key={rule}
                className="inline-flex items-center rounded-full bg-q2-canvas border border-q2-plate px-4 py-2 text-[13px] font-medium text-q2-graphite"
              >
                {rule}
              </li>
            ))}
          </ul>
          <ul className="divide-y divide-q2-plate" role="list">
            {[
              isFr ? 'Transfert vers vous' : 'Transfer to you',
              isFr ? 'Message détaillé' : 'Detailed message',
              isFr ? 'Rappel programmé' : 'Scheduled callback',
            ].map((out) => (
              <li key={out} className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
                <ArrowRight size={14} className="shrink-0 text-q2-indigo" aria-hidden="true" />
                <span className="text-q2-graphite text-[15px] q2-body-text">{out}</span>
              </li>
            ))}
          </ul>
        </CardV2>
      ),
    },
  ];

  const steps = [
    {
      num: '01',
      title: isFr ? 'Choisissez votre voix' : 'Pick your voice',
      desc: isFr
        ? 'Sélectionnez parmi 40+ voix. Écoutez chaque option. Personnalisez le nom, la salutation, le ton.'
        : 'Pick from 40+ voices. Audition each option. Customize the name, greeting, and tone.',
      icon: Mic,
    },
    {
      num: '02',
      title: isFr ? 'Connectez votre agenda' : 'Connect your calendar',
      desc: isFr
        ? `Google, Outlook, Calendly, Cal.com. ${voiceName} voit vos créneaux libres et réserve directement.`
        : `Google, Outlook, Calendly, Cal.com. ${voiceName} sees your open slots and books straight in.`,
      icon: Calendar,
    },
    {
      num: '03',
      title: isFr ? 'Transférez votre numéro' : 'Forward your number',
      desc: isFr
        ? `Gardez votre numéro existant. Activez le renvoi d’appel. ${voiceName} prend le relais immédiatement.`
        : `Keep your existing number. Activate call forwarding. ${voiceName} takes over immediately.`,
      icon: Phone,
    },
  ];

  const tiers: Tier[] = isFr
    ? [
        {
          name: 'Solo',
          price: '99',
          included: '250 minutes par mois',
          desc: 'Pour les indépendants et les petites équipes qui démarrent.',
        },
        {
          name: 'Cabinet',
          price: '249',
          included: '750 minutes par mois',
          desc: 'Le forfait le plus choisi par les cabinets et les agences.',
        },
        {
          name: 'Volume',
          price: '599',
          included: '2 000 minutes par mois',
          desc: 'Pour les multi-sites, franchises et opérations à grand volume.',
        },
      ]
    : [
        {
          name: 'Solo',
          price: '99',
          included: '250 minutes a month',
          desc: 'For independents and small teams getting started.',
        },
        {
          name: 'Practice',
          price: '249',
          included: '750 minutes a month',
          desc: 'The most chosen plan by practices and agencies.',
        },
        {
          name: 'Volume',
          price: '599',
          included: '2,000 minutes a month',
          desc: 'For multi-site, franchises, and high-volume operations.',
        },
      ];

  const trustFacts: { icon: LucideIcon; label: string }[] = [
    { icon: Shield, label: isFr ? 'Conformité RGPD intégrale' : 'Full GDPR compliance' },
    { icon: Server, label: isFr ? 'Données hébergées en Europe' : 'Data hosted in the EU' },
    {
      icon: Lock,
      label: isFr ? 'Enregistrements chiffrés, accessibles uniquement par vous' : 'Recordings encrypted, only accessible by you',
    },
    {
      icon: FileText,
      label: isFr
        ? 'Audit logs complets. Aucune donnée vendue ou utilisée pour l’entraînement.'
        : 'Complete audit logs. No data sold or used for training.',
    },
  ];

  const objections: FaqEntry[] = [
    {
      q: isFr ? '« Mes clients vont sentir que c’est une IA. »' : '"My customers will know it is AI."',
      a: isFr
        ? `${voiceName} utilise les voix les plus avancées du marché, avec respirations, hésitations courtes et intonations naturelles. La plupart des appelants ne s’en rendent pas compte. Et nous indiquons clairement quand un appel doit être annoncé comme automatisé.`
        : `${voiceName} runs on the most advanced voice models, with breath, short pauses, and natural intonation. Most callers do not notice. And we make it clear when a call must be disclosed as automated.`,
    },
    {
      q: isFr ? '« Et la confidentialité ? »' : '"What about privacy?"',
      a: isFr
        ? 'Conformité RGPD intégrale. Données hébergées en Europe. Enregistrements chiffrés, accessibles uniquement par vous. Audit logs complets. Aucune donnée vendue ou utilisée pour l’entraînement.'
        : 'Full GDPR compliance. Data hosted in the EU. Recordings encrypted, only accessible by you. Complete audit logs. No data sold or used for training.',
    },
    {
      q: isFr ? '« Et si elle ne sait pas répondre ? »' : '"What if she does not know the answer?"',
      a: isFr
        ? `${voiceName} transfère vers vous, prend un message détaillé, ou propose un rappel. Vous pouvez aussi définir des règles précises\u00A0: urgence médicale, demande VIP, plainte. Elle apprend de chaque appel.`
        : `${voiceName} transfers to you, takes a detailed message, or schedules a callback. You can set specific rules: medical urgency, VIP request, complaint. She learns from every call.`,
    },
  ];

  return (
    <PublicShell>
      {/* HERO, asymétrique: titre whisper à gauche, iPhone sombre à droite */}
      <Section
        aria-label={isFr ? 'Réceptionniste IA Qwillio' : 'Qwillio AI receptionist'}
        className="!pt-16 md:!pt-24 overflow-hidden"
      >
        <Container className="grid lg:grid-cols-[1.15fr_1fr] gap-14 lg:gap-20 items-center">
          <RevealV2>
            <div>
              <Eyebrow tone="indigo" className="mb-6">
                {isFr ? 'Réceptionniste IA' : 'AI Receptionist'}
              </Eyebrow>
              <Display className="mb-7">
                {isFr ? (
                  <>
                    Elle décroche <SerifWord>avant la deuxième sonnerie.</SerifWord>
                  </>
                ) : (
                  <>
                    She picks up <SerifWord>before the second ring.</SerifWord>
                  </>
                )}
              </Display>
              <Lead className="max-w-[480px] mb-10 q2-body-text">
                {isFr
                  ? 'Elle parle français et anglais sur le même appel, prend les rendez-vous dans votre agenda et vous envoie le résumé par SMS. À partir de 99 € par mois, contre 1 200 € pour une secrétaire à mi-temps.'
                  : 'She speaks French and English on the same call, books appointments in your calendar and texts you the summary. From €99 a month, against €1,200 for a part-time receptionist.'}
              </Lead>

              <div className="flex flex-wrap items-center gap-3 mb-12">
                <PillLink to="/demo.html" variant="primary" size="lg">
                  <Play size={13} fill="currentColor" aria-hidden="true" />
                  {isFr ? `Écouter ${voiceName} parler` : `Hear ${voiceName} speak`}
                </PillLink>
                <PillLink to="/register" variant="outline" size="lg">
                  {isFr ? 'Essayer gratuitement' : 'Try free'}
                  <ArrowRight size={15} aria-hidden="true" />
                </PillLink>
              </div>

              {/* Propriétés vérifiables du produit uniquement (DA/voix.md) */}
              <dl className="flex flex-wrap items-baseline gap-x-9 gap-y-3 text-sm text-q2-faint border-t border-q2-plate pt-6 max-w-[540px]">
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Temps de décrochage' : 'Pickup time'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink tabular-nums">&lt;1&nbsp;s</dd>
                  <span>{isFr ? 'décrochage' : 'pickup'}</span>
                </div>
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Langues' : 'Languages'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink tabular-nums">11</dd>
                  <span>{isFr ? 'langues' : 'languages'}</span>
                </div>
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Voix' : 'Voices'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink tabular-nums">40+</dd>
                  <span>{isFr ? 'voix' : 'voices'}</span>
                </div>
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Disponibilité' : 'Uptime'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink tabular-nums">24/7</dd>
                  <span>{isFr ? 'jamais fermé' : 'always on'}</span>
                </div>
              </dl>
            </div>
          </RevealV2>

          <RevealV2 index={2}>
            <HeroPhone3D isFr={isFr} />
          </RevealV2>
        </Container>
      </Section>

      {/* CAPACITÉS, blocs 2 colonnes alternés (jamais une grille de cards identiques) */}
      <Section hairline aria-labelledby="capabilities-heading">
        <Container>
          <RevealV2 className="mb-4 md:mb-10">
            <div className="grid lg:grid-cols-[1fr_1fr] gap-8 lg:gap-16 items-end">
              <div>
                <Eyebrow tone="indigo" className="mb-4">
                  {isFr ? 'Ce qu’elle fait' : 'What she does'}
                </Eyebrow>
                <H2 id="capabilities-heading" className="max-w-[560px]">
                  {isFr ? (
                    <>
                      Pas un menu vocal. <SerifWord>Une vraie conversation.</SerifWord>
                    </>
                  ) : (
                    <>
                      Not a phone menu. <SerifWord>A real conversation.</SerifWord>
                    </>
                  )}
                </H2>
              </div>
              <p className="text-q2-body text-base leading-relaxed max-w-[420px] q2-body-text lg:pb-2">
                {isFr
                  ? `${voiceName} écoute, comprend le contexte, et agit. Elle prend les rendez-vous dans votre vrai calendrier, envoie les confirmations, et reconnaît une urgence quand elle en entend une.`
                  : `${voiceName} listens, understands context, and acts. She books appointments in your real calendar, sends confirmations, and recognizes an emergency when she hears one.`}
              </p>
            </div>
          </RevealV2>

          <div className="border-t border-q2-plate">
            {capabilities.map((cap, i) => {
              const flip = i % 2 === 1;
              return (
                <RevealV2 key={cap.num} as="article" className="border-b border-q2-plate">
                  <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center py-12 md:py-20">
                    <div className={flip ? 'lg:order-2' : ''}>
                      <div className="flex items-center gap-3 mb-6">
                        <span className="w-11 h-11 rounded-full bg-q2-plate flex items-center justify-center">
                          <cap.icon size={18} className="text-q2-indigo" aria-hidden="true" />
                        </span>
                        <span className="q2-eyebrow text-q2-faint tabular-nums">{cap.num}</span>
                      </div>
                      <h3 className="q2-h3 text-q2-ink mb-3 max-w-[380px]">{cap.title}</h3>
                      <p className="text-q2-body text-[15px] leading-relaxed max-w-[420px] q2-body-text">{cap.body}</p>
                    </div>
                    <div className={flip ? 'lg:order-1' : ''}>{cap.panel}</div>
                  </div>
                </RevealV2>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* VOIX ET LANGUES, bande taupe: chips langues puis les deux voix */}
      <Section variant="band" hairline aria-labelledby="voices-heading">
        <Container>
          <RevealV2 className="mb-12 md:mb-16">
            <div className="flex items-end justify-between gap-8 flex-wrap">
              <div>
                <Eyebrow tone="indigo" className="mb-4">
                  {isFr ? 'Voix et langues' : 'Voices and languages'}
                </Eyebrow>
                <H2 id="voices-heading" className="max-w-[680px]">
                  {isFr ? (
                    <>
                      Choisissez la voix <SerifWord>qui sonne comme votre marque.</SerifWord>
                    </>
                  ) : (
                    <>
                      Pick the voice <SerifWord>that sounds like your brand.</SerifWord>
                    </>
                  )}
                </H2>
              </div>
              <p className="text-q2-body text-sm max-w-[300px] leading-relaxed q2-body-text">
                {isFr
                  ? '40+ voix humaines en 11 langues. Accents régionaux, intonations naturelles, sans coupures.'
                  : '40+ human voices across 11 languages. Regional accents, natural intonation, no cut-offs.'}
              </p>
            </div>
          </RevealV2>

          <RevealV2 className="mb-12">
            <div className="flex items-center gap-5 flex-wrap border-y border-q2-plate py-6">
              <span className="inline-flex items-center gap-2 q2-eyebrow text-q2-faint">
                <Languages size={13} aria-hidden="true" />
                {isFr ? 'Disponible en' : 'Available in'}
              </span>
              <ul className="flex flex-wrap gap-2" role="list">
                {languages.map((lng) => (
                  <li key={lng}>
                    <span className="inline-flex items-center text-xs px-3.5 py-2 rounded-full bg-q2-canvas border border-q2-plate text-q2-graphite font-medium">
                      {lng}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </RevealV2>

          <div className="grid md:grid-cols-2 gap-5">
            <RevealV2>
              <VoiceCard v={voices[0]} large />
            </RevealV2>
            <RevealV2 index={1}>
              <VoiceCard v={voices[1]} large />
            </RevealV2>
          </div>
        </Container>
      </Section>

      {/* MISE EN ROUTE, rangées hairline (aucune tuile) */}
      <Section aria-labelledby="how-heading">
        <Container>
          <RevealV2 className="mb-12 md:mb-14">
            <Eyebrow tone="neutral" className="mb-4">
              {isFr ? 'Mise en route' : 'Getting started'}
            </Eyebrow>
            <H2 id="how-heading" className="max-w-[760px]">
              {isFr ? 'Mise en route en 12 minutes. ' : 'Live in 12 minutes. '}
              <span className="text-q2-faint">
                {isFr ? 'Premier appel traité ce soir.' : 'First call handled tonight.'}
              </span>
            </H2>
          </RevealV2>

          <ol className="border-t border-q2-plate" role="list">
            {steps.map((step, i) => (
              <RevealV2 key={step.num} index={i} as="li" className="border-b border-q2-plate">
                <div className="grid md:grid-cols-[110px_1fr_1.3fr] gap-5 md:gap-10 py-10 md:py-12 items-start">
                  <p className="q2-price text-q2-plate select-none" aria-hidden="true">
                    {step.num}
                  </p>
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full bg-q2-band flex items-center justify-center shrink-0">
                      <step.icon size={16} className="text-q2-indigo" aria-hidden="true" />
                    </span>
                    <h3 className="q2-h3 text-q2-ink">{step.title}</h3>
                  </div>
                  <p className="text-q2-body text-[15px] leading-relaxed max-w-[460px] q2-body-text md:pt-1.5">
                    {step.desc}
                  </p>
                </div>
              </RevealV2>
            ))}
          </ol>
        </Container>
      </Section>

      {/* TARIFS, teaser drenched: une seule action chromatique vers /pricing */}
      <Section variant="drenched-indigo" aria-labelledby="pricing-heading">
        <Container>
          <RevealV2 className="mb-12 md:mb-16">
            <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8 lg:gap-16 items-end">
              <div>
                <Eyebrow tone="indigo" onDark className="mb-4">
                  {isFr ? 'Tarifs' : 'Pricing'}
                </Eyebrow>
                <H2 id="pricing-heading" onDark className="max-w-[640px]">
                  {isFr ? (
                    <>
                      Trois forfaits. <SerifWord>7 jours d’essai gratuit.</SerifWord>
                    </>
                  ) : (
                    <>
                      Three plans. <SerifWord>7-day free trial.</SerifWord>
                    </>
                  )}
                </H2>
              </div>
              <p className="text-q2-fog text-sm leading-relaxed max-w-[320px] q2-body-text lg:pb-2">
                {isFr
                  ? 'Sans engagement. Annulation en un clic. Carte requise, rien n’est débité pendant l’essai.'
                  : 'No commitment. Cancel in one click. Card required, nothing charged during the trial.'}
              </p>
            </div>
          </RevealV2>

          <ul className="border-t border-q2-graphite-d mb-12" role="list">
            {tiers.map((tier, i) => (
              <RevealV2 key={tier.name} index={i} as="li" className="border-b border-q2-graphite-d">
                <div className="grid md:grid-cols-[1fr_1fr_auto] gap-4 md:gap-10 py-8 md:py-9 items-baseline">
                  <div>
                    <h3 className="text-white text-lg font-normal tracking-[-0.012em]">{tier.name}</h3>
                    <p className="text-q2-fog text-sm mt-1.5 max-w-[280px] leading-relaxed q2-body-text">{tier.desc}</p>
                  </div>
                  <p className="text-q2-mist text-sm q2-body-text tabular-nums">{tier.included}</p>
                  <p className="text-white whitespace-nowrap md:text-right">
                    <span className="q2-price">{tier.price}&nbsp;€</span>
                    <span className="text-q2-fog text-sm ml-1.5">/{isFr ? 'mois' : 'mo'}</span>
                  </p>
                </div>
              </RevealV2>
            ))}
          </ul>

          <RevealV2 className="flex flex-wrap items-center gap-5">
            <PillLink to="/pricing" variant="chromatic" size="lg">
              {isFr ? 'Voir les tarifs en détail' : 'See full pricing'}
              <ArrowRight size={16} aria-hidden="true" />
            </PillLink>
            <p className="inline-flex items-center gap-2 text-sm text-q2-fog q2-body-text">
              <Shield size={14} aria-hidden="true" />
              {isFr
                ? 'Conforme RGPD. Données hébergées en Europe.'
                : 'GDPR compliant. Data hosted in the EU.'}
            </p>
          </RevealV2>
        </Container>
      </Section>

      {/* CONFIANCE, objections en accordéon et faits sécurité en colonne */}
      <Section variant="band" hairline aria-labelledby="trust-heading">
        <Container className="grid lg:grid-cols-[1fr_1.5fr] gap-12 lg:gap-20 items-start">
          <RevealV2>
            <Eyebrow tone="indigo" className="mb-4">
              {isFr ? 'Les questions courantes' : 'Common questions'}
            </Eyebrow>
            <H2 id="trust-heading" className="mb-8">
              {isFr ? (
                <>
                  Trois objections. <SerifWord>Trois réponses honnêtes.</SerifWord>
                </>
              ) : (
                <>
                  Three concerns. <SerifWord>Three honest answers.</SerifWord>
                </>
              )}
            </H2>
            <ul className="border-t border-q2-plate" role="list">
              {trustFacts.map((fact) => (
                <li key={fact.label} className="flex items-start gap-3 border-b border-q2-plate py-4">
                  <fact.icon size={15} className="mt-0.5 shrink-0 text-q2-indigo" aria-hidden="true" />
                  <span className="text-q2-graphite text-sm leading-relaxed q2-body-text">{fact.label}</span>
                </li>
              ))}
            </ul>
          </RevealV2>

          <RevealV2 index={1}>
            <FaqAccordion items={objections} />
          </RevealV2>
        </Container>
      </Section>

      {/* CTA FINAL, drenched: une seule action chromatique */}
      <Section
        variant="drenched-violet"
        aria-label={isFr ? 'Démarrer avec Qwillio' : 'Get started with Qwillio'}
      >
        <Container className="grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end">
          <RevealV2>
            <Display as="h2" onDark>
              {isFr ? (
                <>
                  Le prochain appel arrive dans une heure. <SerifWord>Soyez prêt.</SerifWord>
                </>
              ) : (
                <>
                  The next call lands in an hour. <SerifWord>Be ready.</SerifWord>
                </>
              )}
            </Display>
          </RevealV2>
          <RevealV2 index={1} className="flex flex-col items-start gap-5 lg:items-end pb-2">
            <p className="text-q2-fog text-[15px] leading-relaxed max-w-[320px] lg:text-right q2-body-text">
              {isFr ? 'Sans engagement. 7 jours d’essai gratuit.' : 'No commitment. 7-day free trial.'}
            </p>
            <div className="flex flex-wrap gap-3 lg:justify-end">
              <PillLink to="/register" variant="chromatic" size="lg">
                {isFr ? 'Créer un compte' : 'Create account'}
                <ArrowRight size={16} aria-hidden="true" />
              </PillLink>
              <PillLink to="/demo.html" variant="onDark" size="lg">
                <Phone size={14} aria-hidden="true" />
                {isFr ? 'Appeler la démo' : 'Call the demo'}
              </PillLink>
            </div>
          </RevealV2>
        </Container>
      </Section>
    </PublicShell>
  );
}
