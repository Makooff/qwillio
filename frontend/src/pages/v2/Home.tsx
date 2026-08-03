import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Play, CalendarCheck, MessageSquare, PhoneForwarded,
  Camera, Mic2, ShieldCheck, Sparkles, Users,
} from 'lucide-react';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import CardV2 from '../../components/v2/CardV2';
import HeroPhone3D from '../../components/ui/HeroPhone3D';
import ReceptionistGallery from '../../components/v2/ReceptionistGallery';
import ScreenParade from '../../components/v2/ScreenParade';
import TextReveal from '../../components/v2/motion/TextReveal';
import Magnetic from '../../components/v2/motion/Magnetic';
import Counter from '../../components/v2/motion/Counter';
import GlowCard from '../../components/v2/motion/GlowCard';
import PinnedScene from '../../components/v2/motion/PinnedScene';
import ScrollVeil from '../../components/v2/motion/ScrollVeil';
import ParallaxGroup from '../../components/v2/motion/ParallaxGroup';

/* Le Player Remotion vit dans son propre chunk: la section drenched le
   charge en lazy, le reste de la page ne paie rien. */
const LiveTranscriptPlayer = lazy(() => import('../../components/v2/LiveTranscriptPlayer'));

/* Home phase 2, récit neuf sourcé du réceptionniste next-gen (PR #67).
   Zéro copie V1. Chaque affirmation est couverte par le code
   (DA/v2-direction.md, piliers + interdits de vente). */

export default function Home() {
  const { lang } = useLang();
  const isFr = lang === 'fr';

  useSEO({
    title: isFr
      ? 'Réceptionniste IA qui prend les rendez-vous pendant l’appel'
      : 'AI Receptionist that books appointments during the call',
    description: isFr
      ? 'Qwillio décroche 24/7, vérifie votre agenda Google pendant l’appel, inscrit le rendez-vous et vous briefe avant chaque transfert. Français et anglais. À partir de 99 € par mois, 7 jours d’essai.'
      : 'Qwillio answers 24/7, checks your Google Calendar during the call, books the appointment and briefs you before every transfer. French and English. From €99 a month, 7-day trial.',
    canonical: 'https://qwillio.com/',
  });

  /* Ce qu'elle accomplit pendant un appel: chaque ligne est un outil réel du
     runtime (checkAvailability, bookAppointment, SMS, warm transfer). */
  const during = [
    {
      icon: CalendarCheck,
      title: isFr ? 'Elle vérifie le créneau' : 'She checks the slot',
      desc: isFr
        ? 'Agenda Google connecté, elle lit vos disponibilités pendant que votre client parle. Deux appels en même temps ne peuvent pas réserver la même heure.'
        : 'With Google Calendar connected, she reads your availability while your customer is talking. Two simultaneous calls can never book the same hour.',
    },
    {
      icon: Sparkles,
      title: isFr ? 'Elle inscrit le rendez-vous' : 'She books the appointment',
      desc: isFr
        ? 'La réservation est créée avant de raccrocher, pas dans un message à rappeler. Votre client reçoit la confirmation par SMS.'
        : 'The booking is created before hanging up, not left in a message to call back. Your customer gets an SMS confirmation.',
    },
    {
      icon: PhoneForwarded,
      title: isFr ? 'Elle vous briefe avant de transférer' : 'She briefs you before transferring',
      desc: isFr
        ? 'Quand un appel doit vous parvenir, elle vous dit d’abord qui appelle et pourquoi, à l’oral et par SMS. Vous décrochez en sachant.'
        : 'When a call needs you, she first tells you who is calling and why, out loud and by SMS. You pick up already knowing.',
    },
    {
      icon: Users,
      title: isFr ? 'Elle reconnaît vos habitués' : 'She recognises your regulars',
      desc: isFr
        ? 'Un client déjà venu est salué par son prénom. Elle se souvient des appels précédents et ne redemande pas ce qu’elle sait.'
        : 'A returning customer is greeted by name. She remembers previous calls and never asks twice for what she knows.',
    },
  ];

  const setup = [
    {
      icon: MessageSquare,
      label: isFr ? '« Ouvre le samedi de 9 h à 13 h »' : '“Open Saturdays from 9 to 1”',
      desc: isFr ? 'Dites-le dans le chat, c’est réglé.' : 'Say it in the chat, it is done.',
    },
    {
      icon: Camera,
      label: isFr ? 'Photographiez votre carte' : 'Photograph your price list',
      desc: isFr
        ? 'Elle en extrait vos tarifs, vous confirmez, rien n’est stocké.'
        : 'She extracts your prices, you confirm, nothing is stored.',
    },
    {
      icon: Mic2,
      label: isFr ? 'Appelez-la pour l’essayer' : 'Call her to try her out',
      desc: isFr
        ? 'Un vrai appel test dans le navigateur, avec sa vraie voix et votre vraie config.'
        : 'A real test call in the browser, with her real voice and your real setup.',
    },
  ];

  return (
    <PublicShell>
      {/* ── HERO, un réceptionniste qui agit, pas qui note ── */}
      <Section aria-labelledby="hero-heading" className="relative !pt-16 md:!pt-24 overflow-hidden">
        {/* Voile lilas du hero: fini le blanc plat, le fond respire vers le canvas */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(180deg, #f5f2fb 0%, #faf8fc 55%, #fdfcfc 100%)',
          }}
        />
        <Container className="relative grid lg:grid-cols-[1.2fr_1fr] gap-14 lg:gap-20 items-center">
          <RevealV2>
            <div>
              <Eyebrow tone="indigo" className="mb-6">
                {isFr ? 'Réceptionniste IA nouvelle génération' : 'Next-generation AI receptionist'}
              </Eyebrow>
              <Display className="mb-7" id="hero-heading">
                {isFr ? (
                  <>
                    Elle ne prend pas de messages. Elle prend des <SerifWord>rendez-vous.</SerifWord>
                  </>
                ) : (
                  <>
                    She doesn't take messages. She books <SerifWord>appointments.</SerifWord>
                  </>
                )}
              </Display>
              <Lead className="max-w-[500px] mb-10 q2-body-text">
                {isFr
                  ? 'Qwillio décroche 24/7, consulte votre agenda Google pendant l’appel, inscrit le rendez-vous et confirme par SMS. Et quand il faut un humain, elle vous passe l’appel en vous disant d’abord qui appelle et pourquoi. Français et anglais, à partir de 99 € par mois.'
                  : 'Qwillio answers 24/7, checks your Google Calendar during the call, books the appointment and confirms by SMS. And when a human is needed, she hands you the call after telling you who is calling and why. French and English, from €99 a month.'}
              </Lead>

              <div className="flex flex-wrap items-center gap-3 mb-12">
                <PillLink to="/register" variant="primary" size="lg">
                  {isFr ? 'Essayer 7 jours' : 'Try it for 7 days'}
                  <ArrowRight size={15} aria-hidden="true" />
                </PillLink>
                <PillLink to="/demo.html" variant="outline" size="lg">
                  <Play size={13} fill="currentColor" aria-hidden="true" />
                  {isFr ? 'L’entendre décrocher' : 'Hear her answer'}
                </PillLink>
              </div>

              {/* Propriétés vérifiables uniquement, jamais des métriques inventées */}
              <dl className="flex items-baseline gap-8 sm:gap-10 text-sm text-q2-body border-t border-q2-plate pt-6 max-w-[520px]">
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Langues' : 'Languages'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink">FR/EN</dd>
                  <span>{isFr ? 'même appel' : 'same call'}</span>
                </div>
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Disponibilité' : 'Availability'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink tabular-nums">24/7</dd>
                  <span>{isFr ? 'jamais fermé' : 'always on'}</span>
                </div>
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <dt className="sr-only">{isFr ? 'Clonage de voix' : 'Voice cloning'}</dt>
                  <dd className="text-2xl font-light tracking-tight text-q2-ink tabular-nums">90&nbsp;s</dd>
                  <span>{isFr ? 'pour cloner votre voix' : 'to clone your voice'}</span>
                </div>
              </dl>
            </div>
          </RevealV2>

          {/* Le téléphone V1 de l'utilisateur: grand, film produit 4 scènes,
              tilt souris pleine page, Dynamic Island animée */}
          <RevealV2 index={2}>
            <HeroPhone3D isFr={isFr} />
          </RevealV2>
        </Container>
      </Section>

      {/* ── PENDANT L'APPEL, le cœur du récit, 4 actes en rangées éditoriales ── */}
      <Section variant="band" hairline aria-labelledby="during-heading">
        <Container>
          <RevealV2 className="mb-14 max-w-[640px]">
            <Eyebrow tone="indigo" className="mb-4">
              {isFr ? 'Pendant l’appel' : 'During the call'}
            </Eyebrow>
            <H2 id="during-heading">
              {isFr ? (
                <>
                  Tout se passe <SerifWord>en ligne.</SerifWord>
                </>
              ) : (
                <>
                  Everything happens <SerifWord>on the line.</SerifWord>
                </>
              )}
            </H2>
            <p className="text-q2-body text-base leading-relaxed mt-4 q2-body-text">
              {isFr
                ? 'Pas de « je transmets le message ». Pendant que votre client parle, elle agit.'
                : 'No “I will pass on the message”. While your customer talks, she acts.'}
            </p>
          </RevealV2>

          <ol className="border-t border-q2-plate" role="list">
            {during.map((item, i) => (
              <RevealV2 key={item.title} index={i} as="li" className="border-b border-q2-plate">
                <div className="grid md:grid-cols-[56px_1fr_1.6fr] gap-5 md:gap-10 py-9 items-start">
                  <span className="w-11 h-11 rounded-full bg-q2-canvas border border-q2-plate flex items-center justify-center">
                    <item.icon size={17} className="text-q2-indigo" aria-hidden="true" />
                  </span>
                  <h3 className="q2-h3 text-q2-ink">{item.title}</h3>
                  <p className="text-q2-body text-[15px] leading-relaxed max-w-[520px] q2-body-text md:pt-1">{item.desc}</p>
                </div>
              </RevealV2>
            ))}
          </ol>
        </Container>
      </Section>

      {/* ── VOS RÉCEPTIONNISTES, galerie de presets ── */}
      <Section aria-labelledby="team-heading">
        <Container>
          <RevealV2 className="mb-12 max-w-[640px]">
            <Eyebrow tone="indigo" className="mb-4">
              {isFr ? 'Vos réceptionnistes' : 'Your receptionists'}
            </Eyebrow>
            <H2 id="team-heading">
              {isFr ? (
                <>
                  Choisissez qui <SerifWord>décroche.</SerifWord>
                </>
              ) : (
                <>
                  Choose who <SerifWord>answers.</SerifWord>
                </>
              )}
            </H2>
            <p className="text-q2-body text-base leading-relaxed mt-4 q2-body-text">
              {isFr
                ? 'Chaque réceptionniste a un visage, une personnalité et sa façon de tenir un appel. Choisissez la vôtre, ou prêtez-lui votre propre voix.'
                : 'Each receptionist has a face, a personality and a way of holding a call. Pick yours, or lend her your own voice.'}
            </p>
          </RevealV2>
          <RevealV2 index={1}>
            <ReceptionistGallery isFr={isFr} />
          </RevealV2>
        </Container>
      </Section>

      {/* ── UNE VRAIE CONVERSATION, drenched indigo + transcript vivant ── */}
      <Section variant="drenched-indigo" aria-labelledby="conv-heading">
        <Container className="grid lg:grid-cols-[1.1fr_1fr] gap-12 items-center">
          <RevealV2 index={1} className="order-2 lg:order-1">
            <Suspense fallback={<div className="min-h-[300px]" aria-hidden="true" />}>
              <LiveTranscriptPlayer isFr={isFr} className="max-w-[520px] mx-auto lg:mx-0" />
            </Suspense>
          </RevealV2>
          <div className="order-1 lg:order-2">
          <RevealV2>
            <Eyebrow tone="indigo" onDark className="mb-4">
              {isFr ? 'Au naturel' : 'Naturally'}
            </Eyebrow>
            <H2 id="conv-heading" onDark>
              {isFr ? (
                <>
                  Parlez-lui comme à <SerifWord>quelqu'un.</SerifWord>
                </>
              ) : (
                <>
                  Talk to her like a <SerifWord>person.</SerifWord>
                </>
              )}
            </H2>
          </RevealV2>
          <RevealV2 index={1}>
            <ul className="border-t border-q2-graphite-d mt-8" role="list">
              {(isFr
                ? [
                    'Coupez-la en pleine phrase : elle s’arrête net. Une toux ne la déstabilise pas.',
                    'Elle glisse des « mhm » pendant que vous parlez, jamais un « oui » qui vaudrait engagement.',
                    'Un blanc de quelques secondes ? Elle relance « vous êtes toujours là ? » au lieu de raccrocher.',
                    'Un appelant pressé ou agacé n’a pas droit au même ton : phrases courtes, zéro discours commercial, humain proposé plus tôt.',
                  ]
                : [
                    'Cut her mid-sentence: she stops instantly. A cough will not throw her off.',
                    'She slips in a “mm-hmm” while you talk, never a “yes” that would commit you.',
                    'A few seconds of silence? She asks “are you still there?” instead of hanging up.',
                    'A rushed or upset caller gets a different tone: short sentences, no sales talk, a human offered sooner.',
                  ]
              ).map((line) => (
                <li key={line} className="border-b border-q2-graphite-d py-5 text-[15px] text-q2-mist leading-relaxed q2-body-text max-w-[560px]">
                  {line}
                </li>
              ))}
            </ul>
          </RevealV2>
          </div>
        </Container>
      </Section>

      {/* ── CONFIGUREZ-LA EN LUI PARLANT ── */}
      <Section aria-labelledby="setup-heading">
        <Container className="grid lg:grid-cols-[1fr_1.4fr] gap-12 items-start">
          <RevealV2>
            <Eyebrow tone="violet" className="mb-4">
              {isFr ? 'Mise en route' : 'Setup'}
            </Eyebrow>
            <H2 id="setup-heading">
              {isFr ? (
                <>
                  Configurez-la en lui <SerifWord>parlant.</SerifWord>
                </>
              ) : (
                <>
                  Set her up by <SerifWord>talking.</SerifWord>
                </>
              )}
            </H2>
            <p className="text-q2-body text-base leading-relaxed mt-4 max-w-[380px] q2-body-text">
              {isFr
                ? 'Pas de formulaire interminable. Vous discutez, elle se règle. Des voix avec de vrais aperçus audio, ou la vôtre, clonée en 90 secondes d’enregistrement.'
                : 'No endless forms. You chat, she adjusts. Voices with real audio previews, or your own, cloned from 90 seconds of recording.'}
            </p>
          </RevealV2>
          <RevealV2 index={1}>
            <div className="border-t border-q2-plate">
              {setup.map((s) => (
                <div key={s.label} className="border-b border-q2-plate py-7 grid sm:grid-cols-[44px_1fr] gap-4 items-start">
                  <span className="w-10 h-10 rounded-full bg-q2-band flex items-center justify-center">
                    <s.icon size={16} className="text-q2-violet" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[17px] font-medium text-q2-ink mb-1">{s.label}</p>
                    <p className="text-q2-body text-sm leading-relaxed q2-body-text">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </RevealV2>
        </Container>

        {/* Les vrais écrans du produit, posés en perspective */}
        <Container className="mt-20">
          <RevealV2>
            <p className="q2-eyebrow text-q2-graphite mb-8">
              {isFr ? 'Et voici son poste de travail' : 'And this is her workstation'}
            </p>
          </RevealV2>
          <ScreenParade isFr={isFr} />
        </Container>
      </Section>

      {/* ── APRÈS L'APPEL + CONFIANCE, bande taupe ── */}
      <Section variant="band" hairline aria-labelledby="after-heading">
        <Container>
          <RevealV2 className="mb-12 max-w-[640px]">
            <Eyebrow tone="neutral" className="mb-4">
              {isFr ? 'Et après' : 'And after'}
            </Eyebrow>
            <H2 id="after-heading">
              {isFr ? 'Rien ne se perd.' : 'Nothing gets lost.'}
            </H2>
          </RevealV2>
          <div className="grid md:grid-cols-3 gap-x-10 gap-y-8">
            <RevealV2>
              <p className="text-[15px] text-q2-graphite leading-relaxed q2-body-text border-t border-q2-plate pt-5">
                {isFr
                  ? 'Chaque appel arrive dans votre dashboard : résumé, transcript, enregistrement, lead qualifié.'
                  : 'Every call lands in your dashboard: summary, transcript, recording, qualified lead.'}
              </p>
            </RevealV2>
            <RevealV2 index={1}>
              <p className="text-[15px] text-q2-graphite leading-relaxed q2-body-text border-t border-q2-plate pt-5">
                {isFr
                  ? 'Chaque semaine, elle vous dit ce qui cloche : réponses trop longues, agenda déconnecté, questions absentes de votre FAQ.'
                  : 'Every week she tells you what needs fixing: answers too long, calendar disconnected, questions missing from your FAQ.'}
              </p>
            </RevealV2>
            <RevealV2 index={2}>
              <p className="text-[15px] text-q2-graphite leading-relaxed q2-body-text border-t border-q2-plate pt-5">
                <ShieldCheck size={14} className="inline mr-1.5 -mt-0.5 text-q2-indigo" aria-hidden="true" />
                {isFr
                  ? 'Hébergement UE, annonce d’enregistrement conforme RGPD, et le spam est filtré sans entamer votre quota.'
                  : 'EU hosting, GDPR-compliant recording notice, and spam is filtered without touching your quota.'}
              </p>
            </RevealV2>
          </div>

          <RevealV2 index={3} className="mt-14">
            <CardV2 variant="canvas" className="flex flex-wrap items-center justify-between gap-6">
              <p className="text-q2-graphite text-[15px] q2-body-text max-w-[520px]">
                {isFr ? (
                  <>
                    Et bientôt, Qwillio Agent : Email, Facturation, Inventaire et Paiements greffés à votre réceptionniste.{' '}
                    <Link to="/agent" className="text-q2-ink underline decoration-q2-plate underline-offset-4 hover:decoration-q2-ink transition-colors duration-150">
                      {isFr ? 'Découvrir' : 'Explore'}
                    </Link>
                  </>
                ) : (
                  <>
                    And soon, Qwillio Agent: Email, Billing, Inventory and Payments bolted onto your receptionist.{' '}
                    <Link to="/agent" className="text-q2-ink underline decoration-q2-plate underline-offset-4 hover:decoration-q2-ink transition-colors duration-150">
                      Explore
                    </Link>
                  </>
                )}
              </p>
              <PillLink to="/pricing" variant="outline">
                {isFr ? 'Voir les tarifs' : 'See pricing'}
                <ArrowRight size={14} aria-hidden="true" />
              </PillLink>
            </CardV2>
          </RevealV2>
        </Container>
      </Section>

      {/* ── NOTE HONNÊTE + CTA FINAL, drenched violet ── */}
      <Section variant="drenched-violet" aria-label={isFr ? 'Commencer avec Qwillio' : 'Get started with Qwillio'}>
        <Container>
          <RevealV2 className="max-w-[720px] mb-16">
            <Eyebrow tone="violet" className="mb-6">
              {isFr ? 'Sans détour' : 'Straight up'}
            </Eyebrow>
            <p className="text-q2-mist text-lg leading-relaxed q2-body-text">
              {isFr
                ? 'Qwillio est jeune, construit à Bruxelles, et chaque premier client est accompagné personnellement. Vous ne trouverez ici ni faux avis ni chiffres gonflés : essayez-la, c’est elle qui vous convaincra.'
                : 'Qwillio is young, built in Brussels, and every first customer is onboarded personally. You will find no fake reviews or inflated numbers here: try her, she will do the convincing.'}
            </p>
          </RevealV2>
          <Container className="!px-0 grid lg:grid-cols-[1.5fr_1fr] gap-10 items-end">
            <RevealV2 index={1}>
              <Display as="h2" onDark>
                {isFr ? (
                  <>
                    Votre prochaine cliente appelle <SerifWord>ce soir.</SerifWord>
                  </>
                ) : (
                  <>
                    Your next customer calls <SerifWord>tonight.</SerifWord>
                  </>
                )}
              </Display>
            </RevealV2>
            <RevealV2 index={2} className="flex flex-col items-start gap-5 lg:items-end pb-2">
              <p className="text-q2-fog text-[15px] leading-relaxed max-w-[300px] lg:text-right q2-body-text">
                {isFr
                  ? '7 jours d’essai. Sans engagement, résiliable en un clic.'
                  : '7-day trial. No commitment, cancel in one click.'}
              </p>
              <PillLink to="/register" variant="chromatic" size="lg">
                {isFr ? 'Mettre Qwillio en ligne' : 'Put Qwillio on the line'}
                <ArrowRight size={16} aria-hidden="true" />
              </PillLink>
            </RevealV2>
          </Container>
        </Container>
      </Section>
    </PublicShell>
  );
}
