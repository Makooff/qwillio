import { useMemo, useRef } from 'react';


import { Link, useNavigate } from 'react-router-dom';


import {
  ArrowRight, Play, CalendarCheck, MessageSquare,
  Camera, Mic2, Sparkles, Users, Clock, Headphones,
} from '../../components/icons';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import HeroBackdrop from '../../components/v2/HospitalityBackdrop';
import ProductIllustration from '../../components/v2/ProductIllustration';
import Atmosphere from '../../components/v2/AtmosphereFocus';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import TryVoiceButton from '../../components/v2/TryVoiceButton';

import CircularReceptionists from '../../components/v2/CircularReceptionists';
import { BenefitsGrid, LaunchSteps, EcosystemMosaic } from '../../components/v2/MarketingSections';
import TextReveal from '../../components/v2/motion/TextReveal';
import PinnedScene from '../../components/v2/motion/PinnedScene';
import { SqueezeCarousel, type SqueezeSlide } from '../../components/ui/carousel-squeeze';








/* Photos de contexte, pas les bureaux, l'équipe ou les partenaires Qwillio. */
const EXPLORE_PHOTOS = [
  { src: '/marketing/explore-about.webp', fr: 'Espace de travail, photographie d’illustration', en: 'Workspace, illustrative photograph' },
  { src: '/marketing/explore-blog.webp', fr: 'Carnet et stylo, photographie d’illustration', en: 'Notebook and pen, illustrative photograph' },
  { src: '/marketing/explore-contact.webp', fr: 'Rédaction sur ordinateur, photographie d’illustration', en: 'Writing on a laptop, illustrative photograph' },
  { src: '/marketing/explore-affiliate.webp', fr: 'Collaboration professionnelle, photographie d’illustration', en: 'Professional collaboration, illustrative photograph' },
];

/* Home phase 2, récit neuf sourcé du réceptionniste next-gen (PR #67).
   Zéro copie V1. Chaque affirmation est couverte par le code
   (DA/v2-direction.md, piliers + interdits de vente). */

export default function Home() {
  const { lang } = useLang();
  /* Repère du cadre qui passe d'une étape à l'autre dans « Pendant l'appel ». */
  const duringRef = useRef<HTMLDivElement>(null);
  const isFr = lang === 'fr';
  /* Le carrousel du bas mène à quatre pages du site. `href` reste posé pour que
     le lien s'ouvre dans un onglet, se copie et se lise comme un lien; la
     navigation, elle, passe par le routeur, sinon un clic rechargerait toute
     l'application pour changer de page. */
  const navigate = useNavigate();
  const exploreSlides = useMemo<SqueezeSlide[]>(() => {
    const rows = isFr
      ? [
          { to: '/about', name: 'À propos', title: 'À propos.', desc: 'Qui construit Qwillio, et depuis où.', action: 'Faire connaissance' },
          { to: '/blog', name: 'Blog', title: 'Blog.', desc: 'Ce qu’on apprend en faisant décrocher une IA.', action: 'Lire le blog' },
          { to: '/contact', name: 'Contact', title: 'Contact.', desc: 'Une question, une démo, un devis.', action: 'Nous écrire' },
          { to: '/affiliate', name: 'Affiliation', title: 'Affiliation.', desc: 'Recommandez Qwillio, touchez une commission récurrente.', action: 'Devenir affilié' },
        ]
      : [
          { to: '/about', name: 'About', title: 'About.', desc: 'Who builds Qwillio, and from where.', action: 'Get acquainted' },
          { to: '/blog', name: 'Blog', title: 'Blog.', desc: 'What we learn making an AI pick up the phone.', action: 'Read the blog' },
          { to: '/contact', name: 'Contact', title: 'Contact.', desc: 'A question, a demo, a quote.', action: 'Write to us' },
          { to: '/affiliate', name: 'Affiliate', title: 'Affiliate.', desc: 'Recommend Qwillio, earn a recurring commission.', action: 'Become an affiliate' },
        ];

    return rows.map((row, i) => ({
      id: row.to,
      title: row.title,
      description: row.desc,
      image: EXPLORE_PHOTOS[i].src,
      imageAlt: isFr ? EXPLORE_PHOTOS[i].fr : EXPLORE_PHOTOS[i].en,
      overlay: (
        <span className="text-sm font-medium tracking-tight text-white">{row.name}</span>
      ),
      action: row.action,
      href: row.to,
      onAction: (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        navigate(row.to);
      },
    }));
  }, [isFr, navigate]);

  useSEO({
    title: isFr
      ? 'Qwillio, réceptionniste IA pour les PME belges et françaises'
      : 'Qwillio, AI receptionist for Belgian and French businesses',
    description: isFr
      ? 'Qwillio répond aux appels, réserve dans votre agenda Google ou Outlook connecté et transmet le contexte à votre équipe. Français et anglais. À partir de 99 € par mois, 7 jours d’essai.'
      : 'Qwillio answers calls, books into your connected Google or Outlook calendar and passes the context to your team. French and English. From €99 a month, 7-day trial.',
    canonical: 'https://qwillio.com/',
  });

  /* Ce qu'elle accomplit pendant un appel: chaque ligne est un outil réel du
     runtime (checkAvailability, bookAppointment, SMS, warm transfer). */
  const during = [
    {
      icon: CalendarCheck,
      title: isFr ? 'Elle vérifie le créneau' : 'She checks the slot',
      desc: isFr
        ? 'Avec votre agenda Google ou Outlook connecté, elle vérifie les disponibilités avant de confirmer. Vos clients peuvent aussi déplacer ou annuler un rendez-vous pendant l’appel.'
        : 'With your Google or Outlook calendar connected, she checks availability before confirming. Your customers can also reschedule or cancel an appointment during the call.',
    },
    {
      icon: Sparkles,
      title: isFr ? 'Elle inscrit le rendez-vous' : 'She books the appointment',
      desc: isFr
        ? 'La réservation est créée avant de raccrocher, pas dans un message à rappeler.'
        : 'The booking is created before hanging up, not left in a message to call back.',
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
      title: isFr ? 'Reprenez la parole, elle vous écoute' : 'Cut in, she makes room for you',
      body: isFr
        ? 'Vous pouvez l’interrompre pour préciser votre demande, sans reprendre toute la conversation.'
        : 'You can interrupt to clarify your request without starting the conversation again.',
      /* Gris du site, adapté au thème, sans noir bleuté hors palette. */
      pad: 'p-6 md:p-7',
      bg: 'rgb(var(--q2-plate))',
      fg: 'rgb(var(--q2-ink))',
      bodyFg: 'rgb(var(--q2-graphite))',
      accent: 'var(--q2-indigo)',
      /* Hauteur PROPRE à chaque bloc, et retrait propre à chaque bloc.
         Les quatre partageaient `minHeight: 240` et `h-full`: sur un téléphone,
         où la grille retombe sur une colonne, cela donnait quatre rectangles
         rigoureusement identiques empilés — la grille de cartes identiques que
         la charte interdit, et le retour utilisateur. La hauteur suit désormais
         la longueur du texte, et le retrait latéral décale les bords pour que
         la pile ne soit pas une colonne au cordeau. */
      minH: 208,
      edge: 'mr-5 sm:mr-0',
      /* Le seul bloc à porter un filet, et il lui faut: en thème sombre son
         noir (#111111) et le fond de la page (#0A0A0A) ne sont séparés que par
         un point de luminance, donc sans arête il n'existe plus. Les trois
         autres se détachent tout seuls. */
      ring: 'ring-1 ring-white/[0.07]',
    },
    {
      icon: MessageSquare,
      title: isFr ? 'Elle suit le fil de l’échange' : 'She follows the conversation',
      body: isFr
        ? 'Le motif de l’appel, vos précisions et le créneau discuté restent dans le contexte de la conversation.'
        : 'The reason for the call, your clarifications and the time discussed stay in the conversation context.',
      pad: 'p-6 md:p-8',
      bg: '#F5F3F1',
      fg: '#1D1D1F',
      accent: '#7A5FFF',
      minH: 286,
      edge: 'ml-4 sm:ml-0',
      ring: '',
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
      minH: 240,
      edge: 'mr-8 sm:mr-0',
      ring: '',
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
      minH: 324,
      edge: '',
      ring: '',
    },
  ];

  /* Trois étapes, et surtout trois hauteurs.
   *
   * C'étaient trois lignes de même gabarit empilées, ce que la charte range
   * parmi les grilles de cartes identiques. Chacune porte donc son propre
   * rythme: la respiration s'allonge en descendant, le retrait se creuse, et la
   * Les trois lignes avaient chacune leur propre respiration et leur propre
   * retrait: c'est la SCÈNE qui règle cela maintenant, comme dans « Tout se
   * passe en ligne », donc les clés de mise en forme sont parties avec la
   * liste qu'elles habillaient. */
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
        {new URLSearchParams(window.location.search).get('design') === 'atmosphere' ? <Atmosphere /> : <HeroBackdrop dark />}
        {/* Les blobs « pixel blush » ne dérivent plus par-dessus le décor
            (retour utilisateur: « enlève les dégradés de mauve »). C'était la
            seule couleur de marque posée en filtre sur la vidéo, et elle
            teintait une image que l'on veut voir telle quelle. */}

        {/* Plus de vignette PEINTE ici (retour utilisateur: « les dégradés
            sont trop visibles »). Elle posait la couleur du canvas par-dessus
            le décor, et cet aplat devait tomber pile sur le fond de la page:
            au moindre écart, sa bordure se voyait, sur les flancs comme dans
            la marge.
            Le fondu est désormais un MASQUE porté par la couche du décor
            (voir `HeroBackdrop`): la photo devient transparente sur ses
            bords, donc c'est la page qui reparaît, exactement de sa couleur.
            Aucun raccord à réussir, et rien à redéfinir par thème. */}

        {/* LE VOILE NEUTRE DU TEXTE (demande utilisateur, après mesure).
            Les teintes de marque retirées, le titre tombait à 1,50:1 et le
            paragraphe à 1,54:1 sur la nouvelle séquence, très en dessous des
            4,5:1 exigés: la brume claire passe juste derrière eux.
            Ce voile est NEUTRE et il ne couvre que la zone du texte: un noir
            translucide qui s'éteint vers la droite et vers le bas, donc la
            moitié droite de l'image reste intacte, et le centre aussi.
            En `rgba` noir plutôt qu'en jeton de thème: ce n'est pas une couleur
            de la marque ni du fond, c'est une OMBRE, et elle doit rester la
            même dans les deux thèmes puisque le texte, lui, ne change pas de
            couleur sur cette image.
            Sous le conteneur du texte (`z-0` contre `z-10`) et au-dessus du
            décor: il assombrit l'image, jamais le texte. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0"
          style={{
            background:
              /* Deux dégradés superposés, et chacun a son rôle: l'oblique
                 protège la colonne de texte et lâche la moitié droite de
                 l'image; le vertical rattrape le HAUT, où le ciel est le plus
                 clair et où se pose le surtitre — mesuré à 3,22:1 avec le seul
                 oblique, sous le seuil. */
              'linear-gradient(180deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.16) 30%, transparent 55%),' +
              'linear-gradient(105deg, rgba(0,0,0,0.62) 0%, rgba(0,0,0,0.52) 26%, rgba(0,0,0,0.28) 48%, rgba(0,0,0,0.06) 66%, transparent 80%)',
          }}
        />

        <Container className="relative z-10 [&>*]:min-w-0">
          <RevealV2>
            <div className="max-w-[1120px]">
              {/* `onDark`: le surtitre se lit maintenant sur le voile, pas sur
                  la page. L'indigo plein y tombait à 1,52:1; `q2-lift` est le
                  cran clair du même mauve, prévu pour exactement ce cas, et il
                  garde la couleur de marque au lieu de la remplacer par du
                  blanc. La primitive portait déjà la variante, il n'y avait
                  qu'à la demander. */}
              <Eyebrow tone="indigo" onDark className="mb-4 sm:mb-6">
                {/* « nouvelle génération » ne veut rien dire et vieillira: dans
                    six mois, il faudra ecrire « derniere generation », puis on
                    ne saura plus quoi dire. Le surtitre porte un fait que le
                    produit tient reellement (francais et anglais, 24 heures sur
                    24) et qui reste vrai. */}
                {isFr ? 'Réceptionniste IA, français et anglais' : 'AI receptionist, French and English'}
              </Eyebrow>
              {/* Taille BORNÉE pour ce titre, et pour lui seul (demande
                  utilisateur: « que ça tienne en deux lignes »). `q2-display`
                  sert sur toutes les pages de la V2, alors que la contrainte
                  vient d'une phrase précise: la version française fait 57
                  signes et tombait sur QUATRE lignes en 1440 px. La mesure du
                  bloc passe donc de 860 à 1120 px, et le corps plafonne plus
                  bas que le barème commun.
                  Le `!` n'est pas de la paresse: `.q2-display` est déclarée
                  dans v2.css, donc APRÈS les utilitaires Tailwind dans la
                  feuille finale. À spécificité égale, c'est elle qui gagnait, et
                  la taille écrite ici n'avait aucun effet. */}
              {/* BLANC FIXE, et non un jeton de thème. Le texte se lit sur le
                  voile neutre, qui est sombre dans les deux thèmes: un jeton
                  suivrait le thème et deviendrait sombre sur sombre en clair,
                  exactement le piège documenté dans CLAUDE.md. C'est le même
                  raisonnement que le registre « drenched », noir partout. */}
              <Display
                className="mb-5 sm:mb-7 !text-[clamp(2.2rem,4.6vw,4rem)] !text-white"
                id="hero-heading"
              >
                {/* UNE PHRASE PAR LIGNE, et la coupure est ÉCRITE, pas espérée
                    (demande utilisateur: « met « elle » et l'autre « elle » à
                    l'autre ligne »). Un `<br/>` ferait la même chose à cette
                    largeur et se romprait à la première autre: le titre garde
                    alors deux lignes ici et en fait trois ailleurs. Deux blocs
                    donnent DEUX LIGNES quoi qu'il arrive, chacun libre de se
                    replier sur un téléphone étroit sans mélanger les deux
                    phrases.

                    L'ESPACE ENTRE LES DEUX BLOCS. Deux elements de bloc sont
                    peints l'un sous l'autre, mais leurs textes se touchent dans
                    le DOM: le titre valait « messages.Elle » pour un lecteur
                    d'ecran comme pour l'indexation. Un espace en fin de premier
                    bloc retablit la phrase (« messages. Elle ») sans rien
                    changer au rendu, la fin de ligne etant invisible. */}
                {isFr ? (
                  <>
                    <span className="block">Elle ne prend pas de messages. </span>
                    <span className="block">
                      Elle prend des <SerifWord>rendez-vous.</SerifWord>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block">She doesn't take messages. </span>
                    <span className="block">
                      She books <SerifWord>appointments.</SerifWord>
                    </span>
                  </>
                )}
              </Display>
              {/* Blanc retenu à 88 %: assez pour rester sous le titre dans la
                  hiérarchie, assez pour tenir le seuil sur le voile. Fixe lui
                  aussi, et pour la même raison que le titre.
                  L'ancien réglage cherchait le contraste en FONÇANT le texte
                  (`q2-graphite`), ce qui marchait tant que le fond restait
                  clair. Le voile a inversé le problème: on ne fonce plus le
                  texte, on éclaircit, et c'est le voile qui fait le noir. */}
              <Lead className="max-w-[500px] mb-7 sm:mb-10 q2-body-text !text-white/[0.88]">
                {isFr
                  ? 'Elle prend les appels, réserve dans votre agenda connecté et vous transmet les demandes. Dès 99 € par mois.'
                  : 'She takes calls, books into your connected calendar and passes requests on to you. From €99 a month.'}
              </Lead>

              <div className="flex flex-wrap items-center gap-3 mb-2 sm:mb-4">
                <PillLink to="/register" variant="primary" size="lg">
                  {isFr ? 'Essayer 7 jours' : 'Try it for 7 days'}
                  <ArrowRight size={15} aria-hidden="true" />
                </PillLink>
                {/* Plus de page a visiter: la carte d'essai nait de ce
                    bouton. Un formulaire avant d'entendre la voix etait un
                    peage que personne ne franchit pour une demonstration. */}
                <TryVoiceButton variant="outline">
                  <Play size={13} fill="currentColor" aria-hidden="true" />
                  {isFr ? 'L’entendre décrocher' : 'Hear her answer'}
                </TryVoiceButton>
              </div>

            </div>
          </RevealV2>

          {/* La vraie capture du dashboard referme le hero, pleine largeur */}
          <div className="mt-12 sm:mt-16 max-w-[1080px] mx-auto"><ProductIllustration kind="overview" isFr={isFr} /></div>
        </Container>
      </Section>

      {/* ── PENDANT L'APPEL, scène au scroll: titre épinglé, actes qui s'allument ── */}
      {/* Une seule forme par section, éparpillées sur toute la page plutôt
          qu'entassées à deux endroits (retour utilisateur). Toutes sous la
          fenêtre du hero, jamais dedans. */}
      <Section variant="band" hairline aria-labelledby="during-heading" className="relative">
        {/* Le cadre voyage dans CE repère: il est posé en absolu sur le
            conteneur et mesure les étapes qui s'y trouvent. */}
        <Container className="relative z-10">
          {/* Un div porteur plutôt qu'une ref sur Container: la primitive est
              partagée par toute la V2, lui ajouter forwardRef pour un seul
              appelant la complique pour tous les autres. */}
          <div ref={duringRef} className="relative">
          <PinnedScene className="[&_[data-scene-act]]:!opacity-100"
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
        <Container className="relative z-10">
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
                ? 'Un ton chaleureux, posé ou plus direct : écoutez les voix et choisissez celle qui correspond à votre accueil.'
                : 'Warm, composed or more direct: hear the voices and choose the one that fits your welcome.'}
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
        <Container className="relative z-10 grid lg:grid-cols-[1fr_1.6fr] gap-10 md:gap-16 lg:gap-24 items-start">
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

          {/* UN SEUL ÉCART, 20 px, horizontal comme vertical (demande
              utilisateur). Le décalage d'une carte sur deux (`sm:mt-12`) est
              retiré: il valait 48 px, soit plus du double de l'écart de la
              grille, si bien que les cartes ne semblaient plus séparées par une
              gouttière mais par deux valeurs différentes selon le voisin
              regardé.
              `items-start` reste, et il compte toujours: sans lui la grille
              ÉTIRE ses blocs à la hauteur de la rangée, et deux voisins de
              contenu inégal se retrouvent forcés à la même hauteur. Chaque
              carte garde donc la sienne; ce sont les ÉCARTS qui sont réguliers,
              pas les hauteurs. */}
          {/* DEUX COLONNES INDÉPENDANTES, et c'est le seul moyen d'obtenir ce
              qui est demandé: le même écart entre les cartes de gauche
              qu'entre les autres, et la colonne de gauche plus haute que celle
              de droite.
              En grille à deux colonnes, une RANGÉE prend la hauteur de sa plus
              haute carte: la colonne aux cartes courtes hérite donc d'un trou
              (mesuré: 76 px à gauche contre 20 à droite), et aucun réglage
              d'écart ne le corrige, puisque le trou n'est pas un écart mais du
              vide sous une carte trop courte. Deux piles distinctes n'ont pas de
              rangée commune: chacune empile ses cartes à 20 px, point.
              Le décalage passe alors sur la COLONNE, pas sur une carte sur deux:
              la droite descend de 48 px, et la ligne d'horizon se brise sans que
              l'espacement bouge.
              Deux `<ul>` plutôt qu'un: une liste dont les éléments sont enfermés
              dans des `<div>` cesse d'être une liste pour un lecteur d'écran.
              Ici chaque colonne est une vraie liste, et l'ordre de lecture reste
              celui de l'écran. */}
          <div className="grid sm:grid-cols-2 gap-5 items-start">
            {[0, 1].map(col => (
              <ul
                key={col}
                role="list"
                className={`flex flex-col gap-5 ${col === 1 ? 'sm:mt-12' : ''}`}
              >
                {naturally.filter((_, i) => i % 2 === col).map((feat, j) => (
                  <RevealV2
                    key={feat.title}
                    index={j * 2 + col}
                    className={feat.edge}
                  >
                    <li className="list-none">
                      <article
                        className={`rounded-3xl flex flex-col ${feat.pad} ${feat.ring}`}
                        style={{
                          background: feat.bg,
                          color: feat.fg,
                          minHeight: feat.minH,
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
                          style={{ color: feat.bodyFg ?? (feat.fg === 'white' ? 'rgba(255,255,255,0.72)' : '#525257') }}
                        >
                          {feat.body}
                        </p>
                      </article>
                    </li>
                  </RevealV2>
                ))}
              </ul>
            ))}
          </div>
        </Container>
      </Section>

      <BenefitsGrid isFr={isFr} />

      {/* ── CONFIGUREZ-LA EN LUI PARLANT ── */}
      <Section aria-labelledby="setup-heading" className="relative">
        {/* MÊME SCÈNE AU SCROLL que « Tout se passe en ligne » (demande
            utilisateur): le titre reste épinglé à gauche pendant que les étapes
            défilent à droite, et l'étape courante s'allume.
            C'était ici une liste statique à filets, dont chaque ligne portait
            son propre `pad` et son propre `indent` — trois espacements
            différents entre trois cartes, et un retrait qui grandissait. Le
            réglage se fait maintenant par la SCÈNE, comme dans l'autre section,
            et il n'y a plus qu'une seule mécanique de défilement à entretenir
            sur la page. */}
        <Container className="relative z-10">
          <div className="relative">
          <PinnedScene className="[&_[data-scene-act]]:!opacity-100"
            aside={
              <RevealV2 className="max-w-[420px]">
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
                <p className="text-q2-body text-base leading-relaxed mt-4 q2-body-text">
                  {isFr
                    ? 'Pas de formulaire interminable. Vous discutez, elle se règle. Écoutez les voix avant de choisir. Le clonage de votre voix est aussi proposé sur les moteurs compatibles.'
                    : 'No endless forms. You chat, she adjusts. Listen to the voices before choosing. Voice cloning is also offered on compatible engines.'}
                </p>
              </RevealV2>
            }
          >
            {setup.map((item, i) => (
              <div
                key={item.label}
                data-step-frame
                /* Exactement la mise en forme de l'autre scène: même gabarit de
                   colonnes, même respiration, même hauteur minimale par étape.
                   C'est cette hauteur qui donne à chaque étape sa propre
                   distance de défilement; sans elle, trois étapes tiennent dans
                   une fenêtre et le compteur saute de 01 à 03. */
                className="relative grid md:grid-cols-[56px_1fr] gap-4 md:gap-8 py-6 sm:py-8 md:py-9 items-start lg:min-h-[32vh] lg:content-center"
              >
                <div className="flex md:flex-col items-center md:items-start gap-3">
                  <span className="w-11 h-11 rounded-full bg-q2-canvas border border-q2-plate flex items-center justify-center transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[active=true]:bg-q2-violet group-data-[active=true]:border-q2-violet">
                    <item.icon
                      size={17}
                      className="text-q2-violet transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[active=true]:text-white"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="q2-eyebrow text-q2-faint tabular-nums transition-colors duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[active=true]:text-q2-violet">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>
                <div>
                  <h3 className="q2-h3 text-q2-ink mb-2">{item.label}</h3>
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

      {/* ── QWILLIO EN CHIFFRES, bande taupe: quatre faits, rien d'autre ── */}
      <LaunchSteps isFr={isFr} />


      <EcosystemMosaic isFr={isFr} />

      {/* ── LE RESTE DU SITE, carrousel « squeeze » ──
          Placé AVANT l'appel à l'action final, pas après: ces quatre liens sont
          une sortie latérale, et les mettre en dernier reviendrait à enterrer le
          bouton d'essai sous eux. En bande pour se détacher de la section
          canvas qui précède. */}
      <Section variant="band" hairline aria-labelledby="explore-heading" className="relative">
        <Container className="relative z-10">
          <RevealV2 className="max-w-[520px] mb-8 sm:mb-12">
            <Eyebrow tone="violet" className="mb-3 sm:mb-4">
              {isFr ? 'Le reste' : 'The rest'}
            </Eyebrow>
            <H2 id="explore-heading">
              <TextReveal>
                {isFr ? (
                  <>
                    Il y a plus à voir <SerifWord>par ici.</SerifWord>
                  </>
                ) : (
                  <>
                    There is more to see <SerifWord>over here.</SerifWord>
                  </>
                )}
              </TextReveal>
            </H2>
          </RevealV2>
          <RevealV2 index={1}>
            <SqueezeCarousel
              slides={exploreSlides}
              label={isFr ? 'Le reste du site' : 'The rest of the site'}
              /* Les cotes de la référence: hauteur 190, écart 10, lattes de 8
                 espacées de 5, rayon 20. La hauteur seule est reprise en
                 PROPORTION plutôt qu'en pixels: 190 px dans un cadre de 890
                 font 21 cqi, et c'est ce rapport qui donne la rangée basse et
                 large de la référence. Figée à 190, elle ne l'aurait donné
                 qu'à cette largeur-là et se serait aplatie sur un grand écran,
                 où les quatre colonnes se partagent bien plus de place.
                 24 cqi et non les 21 du rapport d'origine: en dessous, la
                 carte OUVERTE devenait plus étroite que sa voisine (379 contre
                 402 px relevés), parce que la carte ouverte part d'un bloc 16:9
                 tandis que les trois autres se partagent tout le reste. Elle
                 doit dominer, sinon on ne voit plus laquelle est ouverte. */
              height="clamp(160px, 24cqi, 290px)"
              gap={10}
              slatGap={5}
              slatWidth={8}
              radius={20}
              accent="#7A5FFF"
              accentForeground="#FFFFFF"
            />
          </RevealV2>
        </Container>
      </Section>

      {/* ── NOTE HONNÊTE + CTA FINAL, drenched violet ── */}
      <Section
        variant="drenched-violet"
        aria-label={isFr ? 'Commencer avec Qwillio' : 'Get started with Qwillio'}
        className="relative overflow-hidden"
      >
        {/* Plus de lueur d'assise ni de filet lumineux mauve entre sections
            (demande utilisateur: « enlève les lignes mauves entre sections »).
            La lueur d'assise voulait finir la page sur une lumière; vue en
            plein écran, c'était une tache mauve sous le dernier bouton. */}
        <Container className="relative z-10">
          <RevealV2 className="max-w-[720px] mb-10 sm:mb-16">
            <Eyebrow tone="violet" className="mb-4 sm:mb-6">
              {isFr ? 'Sans détour' : 'Straight up'}
            </Eyebrow>
            <p className="text-q2-mist text-lg leading-relaxed q2-body-text">
              {isFr
                ? 'Testez la voix, vérifiez les réponses avec vos consignes et choisissez les appels à lui confier. Vous gardez votre numéro et la main sur les transferts.'
                : 'Test the voice, check the answers against your instructions and choose which calls to delegate. Keep your number and stay in control of transfers.'}
            </p>
          </RevealV2>
          <Container className="relative z-10 !px-0 grid lg:grid-cols-[1.5fr_1fr] gap-8 sm:gap-10 items-end">
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
                  ? '7 jours d’essai. En mensuel, sans engagement, résiliez en un clic.'
                  : '7-day trial. No commitment on monthly, cancel in one click.'}
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
