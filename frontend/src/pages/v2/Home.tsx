import { lazy, Suspense, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight, Play, CalendarCheck, MessageSquare, PhoneForwarded,
  Camera, Mic2, ShieldCheck, Smartphone, Sparkles, Users,
} from 'lucide-react';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import CardV2 from '../../components/v2/CardV2';
import HeroPhone3D from '../../components/ui/HeroPhone3D';
import CircularReceptionists from '../../components/v2/CircularReceptionists';
import FeatureCards from '../../components/v2/FeatureCards';
import IntegrationsOrbit from '../../components/v2/IntegrationsOrbit';
import ImpactStats from '../../components/v2/ImpactStats';
import TextReveal from '../../components/v2/motion/TextReveal';
import Magnetic from '../../components/v2/motion/Magnetic';
import GlowCard from '../../components/v2/motion/GlowCard';
import PinnedScene from '../../components/v2/motion/PinnedScene';
import ScrollVeil from '../../components/v2/motion/ScrollVeil';
import PixelBlushBackdrop from '../../components/v2/motion/PixelBlushBackdrop';
import { prefersReducedMotion } from '../../components/v2/motion/reducedMotion';

gsap.registerPlugin(ScrollTrigger);

/* Le Player Remotion vit dans son propre chunk: la section drenched le
   charge en lazy, le reste de la page ne paie rien. */
const LiveTranscriptPlayer = lazy(() => import('../../components/v2/LiveTranscriptPlayer'));

/* La capture réelle du dashboard qui referme le hero: cadre hairline, coins
   16px, halo doux derrière, et une perspective très légère (rotateX 4deg) qui
   s'aplatit au scroll. Le ratio est réservé par les attributs width/height de
   l'image: aucun décalage de mise en page pendant le chargement. */
function HeroDashboardShot({ isFr }: { isFr: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const frame = frameRef.current;
    if (!wrap || !frame || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(frame, { y: 46, opacity: 0, duration: 0.9, ease: 'expo.out', delay: 0.2 });
      gsap.fromTo(
        frame,
        { rotateX: 4 },
        {
          rotateX: 0,
          ease: 'none',
          scrollTrigger: { trigger: wrap, start: 'top 94%', end: 'top 44%', scrub: 0.6 },
        },
      );
    }, wrap);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={wrapRef} className="relative mt-16 md:mt-20" style={{ perspective: '1800px' }}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 -top-6 bottom-6 rounded-[40px]"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 40%, rgba(122, 95, 255, 0.16) 0%, rgba(122, 95, 255, 0) 70%)',
          filter: 'blur(28px)',
        }}
      />
      <div
        ref={frameRef}
        className="relative rounded-[16px] border border-q2-plate bg-q2-carbon overflow-hidden shadow-[var(--q2-shadow-hover)]"
        style={{ transformOrigin: 'center top', willChange: 'transform' }}
      >
        <img
          src="/screens/hero-dashboard.webp"
          alt={
            isFr
              ? 'Dashboard Qwillio : les appels du jour, leur issue et leur transcript'
              : 'Qwillio dashboard: the day’s calls, their outcome and their transcript'
          }
          width={1600}
          height={930}
          className="block w-full h-auto"
        />
      </div>
    </div>
  );
}

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
        {/* Voile lilas du hero: fini le blanc plat, le fond respire vers le canvas.
            Il démarre sur le canvas exact, puis s'ouvre: la barre de nav
            transparente n'a plus d'arête visible sous elle. */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(180deg, #fdfcfc 0%, #f5f2fb 14%, #f8f6fc 58%, #fdfcfc 100%)',
          }}
        />
        {/* Les blobs pixel blush dérivent par-dessus le voile, sous le texte */}
        <PixelBlushBackdrop />
        <Container className="relative [&>*]:min-w-0">
          <RevealV2>
            <div className="max-w-[860px]">
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
                  ? 'Elle décroche 24/7, vérifie votre agenda pendant l’appel et confirme le rendez-vous par SMS. Dès 99 € par mois.'
                  : 'She answers 24/7, checks your calendar during the call and confirms the booking by SMS. From €99 a month.'}
              </Lead>

              <div className="flex flex-wrap items-center gap-3 mb-12">
                <Magnetic>
                  <PillLink to="/register" variant="primary" size="lg">
                    {isFr ? 'Essayer 7 jours' : 'Try it for 7 days'}
                    <ArrowRight size={15} aria-hidden="true" />
                  </PillLink>
                </Magnetic>
                <Magnetic strength={4}>
                  <PillLink to="/demo.html" variant="outline" size="lg">
                    <Play size={13} fill="currentColor" aria-hidden="true" />
                    {isFr ? 'L’entendre décrocher' : 'Hear her answer'}
                  </PillLink>
                </Magnetic>
              </div>

              {/* Propriétés vérifiables uniquement, jamais des métriques
                  inventées. La rangée complète vit maintenant dans la bande
                  ImpactStats: ici on ne garde que la promesse de prix. */}
              <p className="text-sm text-q2-body border-t border-q2-plate pt-6 max-w-[520px] min-w-0 q2-body-text">
                {isFr
                  ? 'Français et anglais dans le même appel, 24/7, dès 99 € par mois. Sans engagement.'
                  : 'French and English inside the same call, 24/7, from €99 a month. No commitment.'}
              </p>
            </div>
          </RevealV2>

          {/* La vraie capture du dashboard referme le hero, pleine largeur */}
          <HeroDashboardShot isFr={isFr} />
        </Container>
      </Section>

      {/* ── PENDANT L'APPEL, scène au scroll: titre épinglé, actes qui s'allument ── */}
      <Section variant="band" hairline aria-labelledby="during-heading">
        <Container>
          <PinnedScene
            aside={
              <RevealV2 className="max-w-[420px]">
                <Eyebrow tone="indigo" className="mb-4">
                  {isFr ? 'Pendant l’appel' : 'During the call'}
                </Eyebrow>
                <H2 id="during-heading">
                  <TextReveal>
                    {isFr ? (
                      <>
                        Tout se passe <SerifWord>en ligne.</SerifWord>
                      </>
                    ) : (
                      <>
                        Everything happens <SerifWord>on the line.</SerifWord>
                      </>
                    )}
                  </TextReveal>
                </H2>
                <p className="text-q2-body text-base leading-relaxed mt-4 q2-body-text">
                  {isFr
                    ? 'Pas de « je transmets le message ». Pendant que votre client parle, elle agit.'
                    : 'No “I will pass on the message”. While your customer talks, she acts.'}
                </p>
              </RevealV2>
            }
          >
            {during.map((item, i) => (
              <div
                key={item.title}
                className="grid md:grid-cols-[56px_1fr] gap-5 md:gap-8 py-9 items-start"
              >
                <div className="flex md:flex-col items-center md:items-start gap-3">
                  <span className="w-11 h-11 rounded-full bg-q2-canvas border border-q2-plate flex items-center justify-center">
                    <item.icon size={17} className="text-q2-indigo" aria-hidden="true" />
                  </span>
                  <span className="q2-eyebrow text-q2-faint tabular-nums">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <h3 className="q2-h3 text-q2-ink mb-2">{item.title}</h3>
                  <p className="text-q2-body text-[15px] leading-relaxed max-w-[560px] q2-body-text">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </PinnedScene>
        </Container>
      </Section>

      {/* ── VOS RÉCEPTIONNISTES, galerie de presets ── */}
      <Section aria-labelledby="team-heading" className="relative">
        <Container>
          <RevealV2 className="mb-12 max-w-[640px]">
            <Eyebrow tone="indigo" className="mb-4">
              {isFr ? 'Vos réceptionnistes' : 'Your receptionists'}
            </Eyebrow>
            <H2 id="team-heading">
              <TextReveal>
                {isFr ? (
                  <>
                    Choisissez qui <SerifWord>décroche.</SerifWord>
                  </>
                ) : (
                  <>
                    Choose who <SerifWord>answers.</SerifWord>
                  </>
                )}
              </TextReveal>
            </H2>
            <p className="text-q2-body text-base leading-relaxed mt-4 q2-body-text">
              {isFr
                ? 'Chaque réceptionniste a un visage, une personnalité et sa façon de tenir un appel. Choisissez la vôtre, ou prêtez-lui votre propre voix.'
                : 'Each receptionist has a face, a personality and a way of holding a call. Pick yours, or lend her your own voice.'}
            </p>
          </RevealV2>
          <RevealV2 index={1}>
            {/* Carrousel circulaire: l'arc tourne, l'actif descend au centre-bas.
                ReceptionistGallery reste en place comme repli réutilisable. */}
            <CircularReceptionists isFr={isFr} />
          </RevealV2>
        </Container>
        {/* Fondu vers la section drenched qui suit, plutôt qu'une coupure nette */}
        <ScrollVeil />
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
              <TextReveal>
                {isFr ? (
                  <>
                    Parlez-lui comme à <SerifWord>quelqu'un.</SerifWord>
                  </>
                ) : (
                  <>
                    Talk to her like a <SerifWord>person.</SerifWord>
                  </>
                )}
              </TextReveal>
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
              <TextReveal>
                {isFr ? (
                  <>
                    Configurez-la en lui <SerifWord>parlant.</SerifWord>
                  </>
                ) : (
                  <>
                    Set her up by <SerifWord>talking.</SerifWord>
                  </>
                )}
              </TextReveal>
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
                <GlowCard
                  key={s.label}
                  className="border-b border-q2-plate py-7 grid sm:grid-cols-[44px_1fr] gap-4 items-start"
                >
                  <span className="w-10 h-10 rounded-full bg-q2-band flex items-center justify-center">
                    <s.icon size={16} className="text-q2-violet" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[17px] font-medium text-q2-ink mb-1">{s.label}</p>
                    <p className="text-q2-body text-sm leading-relaxed q2-body-text">{s.desc}</p>
                  </div>
                </GlowCard>
              ))}
            </div>
          </RevealV2>
        </Container>
      </Section>

      {/* ── QWILLIO EN CHIFFRES, bande taupe: quatre faits, rien d'autre ── */}
      <ImpactStats isFr={isFr} />

      {/* ── L'APP DANS VOTRE POCHE, le téléphone quitte le hero ── */}
      {/* overflow-hidden: le halo ambiant de HeroPhone3D fait 420px de large et
          dépasserait la colonne sur un écran de 390px */}
      <Section aria-labelledby="pocket-heading" className="relative overflow-hidden">
        <Container className="grid lg:grid-cols-[1fr_1fr] gap-14 lg:gap-20 items-center [&>*]:min-w-0">
          <RevealV2>
            <Eyebrow tone="indigo" className="mb-4">
              {isFr ? 'Sur mobile' : 'On mobile'}
            </Eyebrow>
            <H2 id="pocket-heading">
              <TextReveal>
                {isFr ? (
                  <>
                    L’app dans votre <SerifWord>poche.</SerifWord>
                  </>
                ) : (
                  <>
                    The app in your <SerifWord>pocket.</SerifWord>
                  </>
                )}
              </TextReveal>
            </H2>
            <p className="text-q2-body text-base leading-relaxed mt-4 max-w-[420px] q2-body-text">
              {isFr
                ? 'Une notification à chaque appel pris, le résumé lisible en trois secondes, et le rendez-vous déjà inscrit. Le dashboard complet tient dans le navigateur du téléphone.'
                : 'A notification for every call taken, a summary readable in three seconds, and the appointment already booked. The full dashboard fits in the phone browser.'}
            </p>
            <p className="flex items-center gap-2 mt-6 text-sm text-q2-body q2-body-text">
              <Smartphone size={15} className="text-q2-indigo shrink-0" aria-hidden="true" />
              {isFr
                ? 'Rien à installer : la même adresse, sur tous vos écrans.'
                : 'Nothing to install: the same address, on every screen you own.'}
            </p>
          </RevealV2>
          <RevealV2 index={2}>
            <HeroPhone3D isFr={isFr} />
          </RevealV2>
        </Container>
      </Section>

      {/* ── APRÈS L'APPEL + CONFIANCE, bande taupe ── */}
      <Section variant="band" hairline aria-labelledby="after-heading" className="relative">
        <Container>
          <RevealV2 className="mb-12 max-w-[640px]">
            <Eyebrow tone="neutral" className="mb-4">
              {isFr ? 'Et après' : 'And after'}
            </Eyebrow>
            <H2 id="after-heading">
              <TextReveal>{isFr ? 'Rien ne se perd.' : 'Nothing gets lost.'}</TextReveal>
            </H2>
          </RevealV2>
          {/* Les deux cartes portent les vraies captures, illustration en haut */}
          <FeatureCards isFr={isFr} />

          <RevealV2 className="mt-12">
            <p className="text-[15px] text-q2-graphite leading-relaxed q2-body-text border-t border-q2-plate pt-5 max-w-[640px]">
              <ShieldCheck size={14} className="inline mr-1.5 -mt-0.5 text-q2-indigo" aria-hidden="true" />
              {isFr
                ? 'Hébergement UE, annonce d’enregistrement conforme RGPD, et le spam est filtré sans entamer votre quota.'
                : 'EU hosting, GDPR-compliant recording notice, and spam is filtered without touching your quota.'}
            </p>
          </RevealV2>

          <RevealV2 index={3} className="mt-14">
            <CardV2 variant="canvas" glow className="flex flex-wrap items-center justify-between gap-6">
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

      {/* ── CE À QUOI ELLE EST BRANCHÉE, orbite d'intégrations ── */}
      <Section aria-labelledby="integrations-heading" className="relative">
        <Container className="grid lg:grid-cols-[1fr_1.1fr] gap-14 items-center [&>*]:min-w-0">
          <RevealV2 className="max-w-[440px]">
            <Eyebrow tone="violet" className="mb-4">
              {isFr ? 'Intégrations' : 'Integrations'}
            </Eyebrow>
            <H2 id="integrations-heading">
              <TextReveal>
                {isFr ? (
                  <>
                    Branchée à ce que vous <SerifWord>utilisez déjà.</SerifWord>
                  </>
                ) : (
                  <>
                    Wired into what you <SerifWord>already use.</SerifWord>
                  </>
                )}
              </TextReveal>
            </H2>
            <p className="text-q2-body text-base leading-relaxed mt-4 q2-body-text">
              {isFr
                ? 'Elle lit votre agenda, envoie les SMS, pousse le lead dans votre CRM. Ce qui n’est pas dans la liste passe par un webhook : Zapier, Make, n8n. D’autres arrivent.'
                : 'She reads your calendar, sends the texts, pushes the lead into your CRM. Whatever is not on the list goes through a webhook: Zapier, Make, n8n. More are coming.'}
            </p>
          </RevealV2>
          <RevealV2 index={1}>
            <IntegrationsOrbit isFr={isFr} />
          </RevealV2>
        </Container>
        {/* La section s'assombrit avant le drenched violet de clôture */}
        <ScrollVeil />
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
                <TextReveal>
                  {isFr ? (
                    <>
                      Votre prochaine cliente appelle <SerifWord>ce soir.</SerifWord>
                    </>
                  ) : (
                    <>
                      Your next customer calls <SerifWord>tonight.</SerifWord>
                    </>
                  )}
                </TextReveal>
              </Display>
            </RevealV2>
            <RevealV2 index={2} className="flex flex-col items-start gap-5 lg:items-end pb-2">
              <p className="text-q2-fog text-[15px] leading-relaxed max-w-[300px] lg:text-right q2-body-text">
                {isFr
                  ? '7 jours d’essai. Sans engagement, résiliable en un clic.'
                  : '7-day trial. No commitment, cancel in one click.'}
              </p>
              <Magnetic strength={7}>
                <PillLink to="/register" variant="chromatic" size="lg">
                  {isFr ? 'Mettre Qwillio en ligne' : 'Put Qwillio on the line'}
                  <ArrowRight size={16} aria-hidden="true" />
                </PillLink>
              </Magnetic>
            </RevealV2>
          </Container>
        </Container>
      </Section>
    </PublicShell>
  );
}
