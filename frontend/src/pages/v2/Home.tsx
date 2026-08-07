import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight, Play, CalendarCheck, MessageSquare, PhoneForwarded,
  Camera, Mic2, ShieldCheck, Smartphone, Sparkles, Users, Clock, Headphones,
} from '../../components/icons';
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
import PixelBlushBackdrop from '../../components/v2/motion/PixelBlushBackdrop';
import ShapeDrift from '../../components/v2/motion/ShapeDrift';
import { prefersReducedMotion } from '../../components/v2/motion/reducedMotion';

gsap.registerPlugin(ScrollTrigger);

/* Intensité d'un halo décoratif (.q2-halo, v2.css), en variable CSS */
const halo = (opacity: number) => ({ '--q2-halo-o': String(opacity) }) as CSSProperties;

/* Cadre du hero : le PNG livré par l'utilisateur (export Figma du kit « macOS
   Browser UI Kit — Big Sur »), posé tel quel, ombre portée comprise. Les cotes
   ci-dessous sont MESURÉES dans le fichier, pas estimées :
     image      2760 x 1768 (100 px d'ombre à gauche/droite, 80 en haut, 120 en bas)
     fenêtre    x 100..2659, y 80..1647, soit 2560 x 1568, coins de 19 px
     barre      106 px, donc le corps commence à y = 186 et mesure 2560 x 1462
   D'où les pourcentages : ils tiennent à n'importe quelle taille d'affichage.
   Changer de mockup (MacBook, autre navigateur) = remplacer ces six valeurs. */
const MOCKUP = {
  src: '/mockups/safari-big-sur-dark.png',
  width: 2760,
  height: 1768,
  screen: {
    left: '3.6232%',
    top: '10.5204%',
    width: '92.7536%',
    height: '82.6923%',
    borderBottomLeftRadius: '0.742% 1.3%',
    borderBottomRightRadius: '0.742% 1.3%',
  },
} as const;

/* Fond vidéo du hero : la boucle de marque, PAS le film publicitaire
   (`qwillio-ad.mp4`), qui n'a rien à faire ici. Tant que `/hero-loop.mp4`
   n'existe pas, le composant s'efface de lui-même (onError) et le hero garde
   son dégradé et ses blobs : aucune zone vide, aucun cadre cassé.
   `playsInline` + `muted` sont indispensables pour qu'iOS accepte la lecture
   automatique ; `preload="metadata"` évite de tirer le fichier avant que la
   page soit utilisable. Deux voiles la calment ensuite. */
function HeroVideoBackdrop() {
  const [reduced] = useState(prefersReducedMotion);
  const [failed, setFailed] = useState(false);
  if (reduced || failed) return null;
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <video
        src="/hero-loop.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ opacity: 0.5 }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgb(var(--q2-canvas) / 0.62) 0%, rgb(var(--q2-band) / 0.72) 55%, rgb(var(--q2-canvas)) 100%)',
        }}
      />
    </div>
  );
}

/* Masques de la vignette du hero.
   Cotes mesurées dans le PNG: « Déconnexion » à 91 %, arête basse de la
   fenêtre à 93,2 %. Le fondu vertical démarre un centimètre plus haut (mesure
   demandée, laissée en `cm` pour rester lisible) et se termine à 93,5 %, si
   bien que l'arête et son ombre disparaissent. Le fondu horizontal est bien
   plus court: assez pour décoller les flancs du bord, trop peu pour rogner le
   contenu du dashboard. */
const MASK_V = 'linear-gradient(to bottom, #000 0%, #000 calc(91% - 1cm), rgba(0,0,0,0) 93.5%)';
const MASK_H =
  'linear-gradient(to right, rgba(0,0,0,0) 0%, #000 5%, #000 95%, rgba(0,0,0,0) 100%)';

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
    <div ref={wrapRef} className="relative mt-10 sm:mt-14 md:mt-20" style={{ perspective: '1800px' }}>
      {/* Une seule nappe, large et froide, qui décolle la capture du fond. La
          lueur mauve qui traînait sous le bord bas a sauté (retour
          utilisateur). Aucune ombre portée: la profondeur vient de la lueur. */}
      <div
        aria-hidden="true"
        className="q2-halo -inset-x-4 sm:-inset-x-16 -top-10 bottom-0 rounded-[64px]"
        style={halo(0.2)}
      />
      <div
        ref={frameRef}
        className="relative"
        /* Surface sombre : la nav doit passer en verre noir quand elle la
           survole, sinon on lit du texte foncé sur la capture du dashboard. */
        data-nav-dark=""
        style={{
          transformOrigin: 'center top',
          willChange: 'transform',
          /* Le bas de la fenêtre s'EFFACE, il n'est plus recouvert.
             Un voile peint en couleur de page était un aplat, alors que la
             section derrière est un dégradé: le raccord se voyait comme une
             bande. En masquant l'image, c'est le dégradé de la page qui passe
             au travers, donc il n'y a plus rien à raccorder — et ça reste vrai
             dans les deux thèmes, sans aucune couleur écrite ici.

             Cotes mesurées dans le PNG: « Déconnexion » à 91 %, arête basse de
             la fenêtre à 93,2 %. Le fondu démarre un centimètre plus haut
             (mesure demandée, laissée en `cm` pour rester lisible) et il est
             fini à 93,5 %, si bien que l'arête et son ombre disparaissent. */
          /* VIGNETTE: le fondu ne descend plus seulement, il fait le tour.
             Deux masques composés en `intersect` — le vertical efface le bas,
             l'horizontal adoucit les deux flancs — si bien que la fenêtre est
             posée dans la page au lieu d'y être découpée. Le haut reste net:
             c'est là que se lisent la barre d'adresse et les pastilles, les
             effacer donnerait un mockup abîmé, pas une vignette. */
          WebkitMaskImage: `${MASK_V}, ${MASK_H}`,
          maskImage: `${MASK_V}, ${MASK_H}`,
          WebkitMaskComposite: 'source-in',
          maskComposite: 'intersect',
        }}
      >
        <img
          src={MOCKUP.src}
          alt=""
          aria-hidden="true"
          width={MOCKUP.width}
          height={MOCKUP.height}
          className="block w-full h-auto select-none pointer-events-none"
        />
        <img
          src="/screens/hero-dashboard.webp"
          alt={
            isFr
              ? 'Dashboard Qwillio : les appels du jour, leur issue et leur transcript'
              : 'Qwillio dashboard: the day’s calls, their outcome and their transcript'
          }
          width={1600}
          height={914}
          className="absolute block object-cover"
          style={MOCKUP.screen}
        />
        {/* Le kit livre sa barre d'adresse remplie (« figma.com »). On la
            repeint dans le repère du PNG : le champ occupe x 866..1893,
            y 104..159, aplat #0C0F12. En SVG, donc net à toutes les tailles. */}
        <svg
          viewBox={`0 0 ${MOCKUP.width} ${MOCKUP.height}`}
          aria-hidden="true"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          <rect x="900" y="105" width="960" height="54" fill="#0C0F12" />
          <g stroke="#9EA2A6" strokeWidth="3" fill="none">
            <rect x="1231" y="126" width="18" height="14" rx="3" fill="#9EA2A6" stroke="none" />
            <path d="M1235 126v-5a5 5 0 0 1 10 0v5" />
          </g>
          <text
            x="1261"
            y="133"
            fill="#E8E9EA"
            fontSize="26"
            dominantBaseline="central"
            fontFamily="-apple-system, 'SF Pro Text', system-ui, sans-serif"
          >
            qwillio.com/dashboard
          </text>
        </svg>
      </div>
    </div>
  );
}

/* Home phase 2, récit neuf sourcé du réceptionniste next-gen (PR #67).
   Zéro copie V1. Chaque affirmation est couverte par le code
   (DA/v2-direction.md, piliers + interdits de vente). */

export default function Home() {
  const { lang } = useLang();
  /* Repère du cadre qui passe d'une étape à l'autre dans « Pendant l'appel ». */
  const duringRef = useRef<HTMLDivElement>(null);
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

  /* Bento « Au naturel », repris de la présentation d'origine (Landing V1,
     section « Pas un menu vocal ») que l'utilisateur voulait retrouver: colonne
     de gauche collante, quatre blocs décalés à droite dont deux hauts. Le
     contenu, lui, est celui du réceptionniste nouvelle génération: barge-in,
     backchannels, relance sur silence, adaptation au ton. Chaque ligne est un
     comportement du runtime, pas une promesse (conversational-repair.ts,
     intent-router.ts, caller-mood.ts). */
  const naturally = [
    {
      icon: Mic2,
      title: isFr ? 'Coupez-la, elle s’arrête net' : 'Cut her off, she stops dead',
      body: isFr
        ? 'En pleine phrase, elle se tait. Une toux ne la déstabilise pas.'
        : 'Mid-sentence, she goes quiet. A cough will not throw her off.',
      /* Marge resserrée (retour utilisateur: « il y a beaucoup de marge dans
         celle noire »). Le noir avale déjà l'espace, il n'a pas besoin d'en
         réserver autant que les autres pour respirer. */
      pad: 'p-6 md:p-7',
      bg: '#0F1011',
      fg: 'white',
      accent: '#B9A8FF',
    },
    {
      icon: MessageSquare,
      title: isFr ? 'Elle acquiesce sans s’engager' : 'She agrees without committing you',
      body: isFr
        ? 'Elle glisse des « mhm » pendant que vous parlez, jamais un « oui » qui vaudrait engagement.'
        : 'She slips in a “mm-hmm” while you talk, never a “yes” that would commit you.',
      pad: 'p-6 md:p-8',
      bg: '#F5F3F1',
      fg: '#1D1D1F',
      accent: '#7A5FFF',
    },
    {
      icon: Clock,
      title: isFr ? 'Un blanc ne la fait pas raccrocher' : 'Silence does not make her hang up',
      body: isFr
        ? 'Après quelques secondes sans réponse, elle relance « vous êtes toujours là ? ».'
        : 'After a few seconds of nothing, she asks “are you still there?”.',
      pad: 'p-6 md:p-8',
      bg: '#F5F3F1',
      fg: '#1D1D1F',
      accent: '#CD6BFB',
    },
    {
      icon: Headphones,
      title: isFr ? 'Un appelant agacé change son ton' : 'An annoyed caller changes her tone',
      body: isFr
        ? 'Phrases courtes, zéro discours commercial, un humain proposé plus tôt.'
        : 'Short sentences, no sales talk, a human offered sooner.',
      /* En bas à droite: marge généreuse, volontairement DIFFÉRENTE de celle
         du noir. C'est l'asymétrie demandée — les quatre blocs ne respirent
         pas pareil, c'est ce qui empêche la grille de ressembler à un tableau. */
      pad: 'p-8 md:p-11',
      bg: '#7A5FFF',
      fg: 'white',
      accent: 'rgba(255,255,255,0.62)',
    },
  ];

  /* Trois étapes, et surtout trois hauteurs.
   *
   * C'étaient trois lignes de même gabarit empilées, ce que la charte range
   * parmi les grilles de cartes identiques. Chacune porte donc son propre
   * rythme: la respiration s'allonge en descendant, le retrait se creuse, et la
   * mesure du texte se resserre. Ce n'est pas de l'irrégularité décorative,
   * c'est la durée de chaque étape: la première est une phrase, la dernière est
   * un appel. */
  const setup = [
    {
      icon: MessageSquare,
      label: isFr ? '« Ouvre le samedi de 9 h à 13 h »' : '“Open Saturdays from 9 to 1”',
      desc: isFr ? 'Dites-le dans le chat, c’est réglé.' : 'Say it in the chat, it is done.',
      pad: 'py-5 sm:py-6',
      indent: '',
      measure: 'max-w-[34ch]',
    },
    {
      icon: Camera,
      label: isFr ? 'Photographiez votre carte' : 'Photograph your price list',
      desc: isFr
        ? 'Elle en extrait vos tarifs, vous confirmez, rien n’est stocké.'
        : 'She extracts your prices, you confirm, nothing is stored.',
      pad: 'py-8 sm:py-11',
      indent: 'sm:pl-8',
      measure: 'max-w-[42ch]',
    },
    {
      icon: Mic2,
      label: isFr ? 'Appelez-la pour l’essayer' : 'Call her to try her out',
      desc: isFr
        ? 'Un vrai appel test dans le navigateur, avec sa vraie voix et votre vraie config.'
        : 'A real test call in the browser, with her real voice and your real setup.',
      pad: 'py-11 sm:py-16',
      indent: 'sm:pl-16',
      measure: 'max-w-[38ch]',
    },
  ];

  return (
    <PublicShell>
      {/* ── HERO, un réceptionniste qui agit, pas qui note ── */}
      {/* Le hero remonte sous la nav fixe (-mt-16 annule la bande réservée par
          PublicShell, le padding la rend au contenu) : le fond pixel-blush vit
          jusqu'au bord haut de la page et le voile flou de la nav fond dedans,
          sans carré blanc. */}
      <Section aria-labelledby="hero-heading" className="relative -mt-16 !pt-32 md:!pt-40 overflow-hidden">
        {/* Voile lilas du hero: fini le blanc plat, le fond respire vers le canvas.
            Il démarre sur le canvas exact, puis s'ouvre: la barre de nav
            transparente n'a plus d'arête visible sous elle. */}
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(180deg, rgb(var(--q2-canvas)) 0%, rgb(var(--q2-band)) 14%, rgb(var(--q2-band)) 58%, rgb(var(--q2-canvas)) 100%)',
          }}
        />
        {/* Vidéo de fond (demande utilisateur). Muette, en boucle, sans
            contrôles : c'est une texture, pas un média. Elle passe sous un
            voile crème pour que le titre garde son contraste, et disparaît en
            reduced-motion, où le dégradé ci-dessus suffit. */}
        <HeroVideoBackdrop />
        {/* Les blobs pixel blush dérivent par-dessus le voile, sous le texte */}
        <PixelBlushBackdrop />
        <Container className="relative [&>*]:min-w-0">
          <RevealV2>
            <div className="max-w-[860px]">
              <Eyebrow tone="indigo" className="mb-4 sm:mb-6">
                {isFr ? 'Réceptionniste IA nouvelle génération' : 'Next-generation AI receptionist'}
              </Eyebrow>
              <Display className="mb-5 sm:mb-7" id="hero-heading">
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
              <Lead className="max-w-[500px] mb-7 sm:mb-10 q2-body-text">
                {isFr
                  ? 'Elle décroche 24/7, vérifie votre agenda pendant l’appel et confirme le rendez-vous par SMS. Dès 99 € par mois.'
                  : 'She answers 24/7, checks your calendar during the call and confirms the booking by SMS. From €99 a month.'}
              </Lead>

              <div className="flex flex-wrap items-center gap-3 mb-2 sm:mb-4">
                <Magnetic>
                  <PillLink to="/register" variant="primary" size="lg" className="q2-pill-lit">
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
            </div>
          </RevealV2>

          {/* La vraie capture du dashboard referme le hero, pleine largeur */}
          <HeroDashboardShot isFr={isFr} />
        </Container>
      </Section>

      {/* ── PENDANT L'APPEL, scène au scroll: titre épinglé, actes qui s'allument ── */}
      {/* Une seule forme par section, éparpillées sur toute la page plutôt
          qu'entassées à deux endroits (retour utilisateur). Toutes sous la
          fenêtre du hero, jamais dedans. */}
      <Section variant="band" hairline aria-labelledby="during-heading" className="relative">
        <ShapeDrift
          className="hidden md:block"
          shapes={[{ kind: 'column', x: '-7%', y: '18%', size: 260, drift: -170, opacity: 0.42 }]}
        />
        {/* Le cadre voyage dans CE repère: il est posé en absolu sur le
            conteneur et mesure les étapes qui s'y trouvent. */}
        <Container>
          {/* Un div porteur plutôt qu'une ref sur Container: la primitive est
              partagée par toute la V2, lui ajouter forwardRef pour un seul
              appelant la complique pour tous les autres. */}
          <div ref={duringRef} className="relative">
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
                data-step-frame
                /* `min-h` en vh sur grand écran: sans ça les quatre étapes
                   tiennent ensemble dans une fenêtre de 900 px et franchissent
                   la ligne de lecture d'un bloc — le compteur passait de 01 à
                   04 sans s'arrêter. Chaque étape a maintenant sa propre
                   distance de défilement. */
                className="relative grid md:grid-cols-[56px_1fr] gap-4 md:gap-8 py-6 sm:py-8 md:py-9 items-start lg:min-h-[32vh] lg:content-center"
              >
                {/* L'étape courante ne se contente pas d'être moins pâle: sa
                    pastille se remplit et son numéro passe à l'indigo. Une
                    différence d'opacité seule se lit mal quand quatre étapes
                    tiennent à l'écran en même temps. */}
                <div className="flex md:flex-col items-center md:items-start gap-3">
                  <span className="w-11 h-11 rounded-full bg-q2-canvas border border-q2-plate flex items-center justify-center transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[active=true]:bg-q2-indigo group-data-[active=true]:border-q2-indigo">
                    <item.icon
                      size={17}
                      className="text-q2-indigo transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[active=true]:text-white"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="q2-eyebrow text-q2-faint tabular-nums transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[active=true]:text-q2-indigo">
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
          </div>
        </Container>
      </Section>

      {/* ── VOS RÉCEPTIONNISTES, galerie de presets ── */}
      <Section aria-labelledby="team-heading" className="relative">
        <ShapeDrift
          className="hidden lg:block"
          shapes={[{ kind: 'twin', x: '84%', y: '-10%', size: 380, rotate: 10, drift: 180, opacity: 0.3 }]}
        />
        <Container>
          <RevealV2 className="mb-8 sm:mb-12 max-w-[640px]">
            <Eyebrow tone="indigo" className="mb-3 sm:mb-4">
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
      </Section>

      {/* ── AU NATUREL, bento: colonne collante + quatre blocs décalés ── */}
      {/* Pas d'`overflow-hidden` ici: il fait d'une section un conteneur de
          défilement, et `position: sticky` cesse alors de tenir la colonne de
          gauche. Les formes se découpent toutes seules, leur calque est déjà
          en `absolute inset-0 overflow-hidden`. */}
      <Section aria-labelledby="conv-heading" hairline className="relative">
        <ShapeDrift
          className="hidden lg:block"
          shapes={[{ kind: 'quarters', x: '-8%', y: '52%', size: 320, rotate: -8, drift: 150, opacity: 0.34 }]}
        />
        <Container className="relative grid lg:grid-cols-[1fr_1.6fr] gap-10 md:gap-16 lg:gap-24 items-start">
          {/* La colonne reste au regard pendant que les blocs défilent: c'est
              ce qui fait tenir la comparaison entre le titre et les quatre
              comportements. */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <RevealV2>
              <Eyebrow tone="indigo" className="mb-3 sm:mb-4">
                {isFr ? 'Au naturel' : 'Naturally'}
              </Eyebrow>
              <H2 id="conv-heading">
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
              <p className="text-q2-body text-base leading-relaxed mt-4 max-w-[380px] q2-body-text">
                {isFr
                  ? 'Pas de « tapez 1 ». Elle écoute, elle se fait couper, elle relance. Ce sont ces détails qui font qu’un appelant ne demande pas à parler à quelqu’un.'
                  : 'No “press 1”. She listens, gets interrupted, picks the thread back up. Those details are why callers stop asking for a human.'}
              </p>
              <Link
                to="/receptionist"
                className="inline-flex items-center gap-1.5 mt-7 text-sm font-semibold text-q2-indigo underline decoration-q2-indigo/30 decoration-2 underline-offset-8 hover:decoration-q2-indigo transition-colors duration-150"
              >
                {isFr ? 'Comment elle tient un appel' : 'How she holds a call'}
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            </RevealV2>
          </div>

          <ul className="grid sm:grid-cols-2 gap-4 sm:gap-5" role="list">
            {naturally.map((feat, i) => (
              <RevealV2 key={feat.title} index={i}>
                <li className="h-full list-none">
                  {/* Deux colonnes, deux rangées, aucun bloc à cheval: à
                      gauche le noir puis un blanc, à droite un blanc puis le
                      violet (demande utilisateur). Les hauteurs doubles
                      d'avant poussaient les deux blancs côte à côte dans la
                      même colonne. */}
                  <article
                    className={`rounded-3xl h-full flex flex-col ${feat.pad}`}
                    style={{
                      background: feat.bg,
                      color: feat.fg,
                      minHeight: 240,
                    }}
                  >
                    <span
                      className="w-11 h-11 rounded-2xl flex items-center justify-center mb-5"
                      style={{
                        background: feat.fg === 'white' ? 'rgba(255,255,255,0.10)' : 'rgba(122,95,255,0.10)',
                      }}
                    >
                      <feat.icon size={18} style={{ color: feat.accent }} aria-hidden="true" />
                    </span>
                    <h3 className="text-[1.2rem] font-semibold tracking-[-0.015em] mb-2.5 leading-snug">
                      {feat.title}
                    </h3>
                    <p
                      className="text-[14.5px] leading-relaxed q2-body-text"
                      style={{ color: feat.fg === 'white' ? 'rgba(255,255,255,0.72)' : '#525257' }}
                    >
                      {feat.body}
                    </p>
                  </article>
                </li>
              </RevealV2>
            ))}
          </ul>
        </Container>
      </Section>

      {/* ── CONFIGUREZ-LA EN LUI PARLANT ── */}
      <Section aria-labelledby="setup-heading" className="relative">
        <ShapeDrift
          className="hidden md:block"
          shapes={[{ kind: 'twinMirror', x: '80%', y: '58%', size: 300, rotate: 14, drift: -160, opacity: 0.32 }]}
        />
        <Container className="relative grid lg:grid-cols-[1fr_1.4fr] gap-9 sm:gap-12 items-start">
          <RevealV2>
            <Eyebrow tone="violet" className="mb-3 sm:mb-4">
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
              {setup.map((s, i) => (
                <GlowCard
                  key={s.label}
                  className={`border-b border-q2-plate grid sm:grid-cols-[44px_1fr] gap-3.5 sm:gap-4 items-start ${s.pad} ${s.indent}`}
                >
                  <span className="relative w-10 h-10 rounded-full bg-q2-band flex items-center justify-center">
                    <s.icon size={16} className="text-q2-violet" aria-hidden="true" />
                    {/* Le rang, en petit, contre la pastille: c'est lui qui
                        explique le décalage de chaque ligne. Sans repère, un
                        retrait qui augmente passe pour un défaut. */}
                    <span
                      aria-hidden="true"
                      className="absolute -left-1 -top-1 text-[10px] font-medium tabular-nums text-q2-faint"
                    >
                      {i + 1}
                    </span>
                  </span>
                  <div>
                    <p className="text-[17px] font-medium text-q2-ink mb-1">{s.label}</p>
                    <p className={`text-q2-body text-sm leading-relaxed q2-body-text ${s.measure}`}>{s.desc}</p>
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
        <ShapeDrift
          className="hidden lg:block"
          shapes={[{ kind: 'column', x: '46%', y: '-24%', size: 220, rotate: 6, drift: 200, opacity: 0.26 }]}
        />
        <Container className="grid lg:grid-cols-[1fr_1fr] gap-8 sm:gap-14 lg:gap-20 items-center [&>*]:min-w-0">
          <RevealV2>
            <Eyebrow tone="indigo" className="mb-3 sm:mb-4">
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
        <ShapeDrift
          className="hidden lg:block"
          shapes={[{ kind: 'twin', x: '-9%', y: '64%', size: 300, rotate: -12, drift: -150, opacity: 0.3 }]}
        />
        <Container>
          <RevealV2 className="mb-8 sm:mb-12 max-w-[640px]">
            <Eyebrow tone="neutral" className="mb-3 sm:mb-4">
              {isFr ? 'Et après' : 'And after'}
            </Eyebrow>
            <H2 id="after-heading">
              <TextReveal>{isFr ? 'Rien ne se perd.' : 'Nothing gets lost.'}</TextReveal>
            </H2>
          </RevealV2>
          {/* Deux rangées pleine largeur, illustration alternée gauche/droite */}
          <FeatureCards isFr={isFr} />

          <RevealV2 className="mt-9 sm:mt-12">
            <p className="text-[15px] text-q2-graphite leading-relaxed q2-body-text border-t border-q2-plate pt-5 max-w-[640px]">
              <ShieldCheck size={14} className="inline mr-1.5 -mt-0.5 text-q2-indigo" aria-hidden="true" />
              {isFr
                ? 'Hébergement UE, annonce d’enregistrement conforme RGPD, et le spam est filtré sans entamer votre quota.'
                : 'EU hosting, GDPR-compliant recording notice, and spam is filtered without touching your quota.'}
            </p>
          </RevealV2>

          <RevealV2 index={3} className="mt-10 sm:mt-14">
            <CardV2 variant="canvas" glow className="q2-lit flex flex-wrap items-center justify-between gap-5 sm:gap-6">
              <p className="text-q2-graphite text-[15px] q2-body-text max-w-[520px]">
                {isFr ? (
                  <>
                    {/* Aucun lien: Qwillio Agent n'est pas ouvert, et « Découvrir »
                        menait à une page qui décrivait un produit non achetable. */}
                    Et bientôt, Qwillio Agent : Email, Facturation, Inventaire et Paiements greffés à votre réceptionniste.
                  </>
                ) : (
                  <>
                    And soon, Qwillio Agent: Email, Billing, Inventory and Payments bolted onto your receptionist.
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
        <ShapeDrift
          className="hidden lg:block"
          shapes={[{ kind: 'quarters', x: '86%', y: '-16%', size: 260, rotate: 16, drift: 170, opacity: 0.28 }]}
        />
        <Container className="grid lg:grid-cols-[1fr_1.1fr] gap-9 sm:gap-14 items-center [&>*]:min-w-0">
          <RevealV2 className="max-w-[440px]">
            <Eyebrow tone="violet" className="mb-3 sm:mb-4">
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
      </Section>

      {/* ── NOTE HONNÊTE + CTA FINAL, drenched violet ── */}
      <Section
        variant="drenched-violet"
        aria-label={isFr ? 'Commencer avec Qwillio' : 'Get started with Qwillio'}
        className="relative overflow-hidden"
      >
        <div aria-hidden="true" className="q2-hairline-lit absolute inset-x-0 top-0" />
        {/* Lueur d'assise sous la clôture: la page se termine sur une lumière,
            pas sur un aplat qui s'éteint */}
        <div
          aria-hidden="true"
          className="q2-halo q2-halo-violet absolute left-1/2 -translate-x-1/2 -bottom-40 w-[760px] h-[320px]"
          style={halo(0.3)}
        />
        <Container className="relative">
          <RevealV2 className="max-w-[720px] mb-10 sm:mb-16">
            <Eyebrow tone="violet" className="mb-4 sm:mb-6">
              {isFr ? 'Sans détour' : 'Straight up'}
            </Eyebrow>
            <p className="text-q2-mist text-lg leading-relaxed q2-body-text">
              {isFr
                ? 'Qwillio est jeune, construit à Bruxelles, et chaque premier client est accompagné personnellement. Vous ne trouverez ici ni faux avis ni chiffres gonflés : essayez-la, c’est elle qui vous convaincra.'
                : 'Qwillio is young, built in Brussels, and every first customer is onboarded personally. You will find no fake reviews or inflated numbers here: try her, she will do the convincing.'}
            </p>
          </RevealV2>
          <Container className="!px-0 grid lg:grid-cols-[1.5fr_1fr] gap-8 sm:gap-10 items-end">
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
                <PillLink to="/register" variant="chromatic" size="lg" className="q2-pill-lit">
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
