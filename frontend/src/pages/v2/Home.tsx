import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import type { CSSProperties } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight, Play, CalendarCheck, MessageSquare, PhoneForwarded,
  Camera, Mic2, ShieldCheck, Smartphone, Sparkles, Users, Clock, Headphones,
} from '../../components/icons';
import { useSEO } from '../../hooks/useSEO';
import { useLang } from '../../stores/langStore';
import PublicShell from '../../components/v2/PublicShell';
import HeroBackdrop from '../../components/v2/HeroBackdrop';
import Atmosphere from '../../components/v2/AtmosphereFocus';
import { Container, Section, Eyebrow, Display, H2, Lead, SerifWord } from '../../components/v2/Primitives';
import { PillLink } from '../../components/v2/Button';
import RevealV2 from '../../components/v2/RevealV2';
import TryVoiceButton from '../../components/v2/TryVoiceButton';
import CardV2 from '../../components/v2/CardV2';
import HeroPhone3D from '../../components/ui/HeroPhone3D';
import CircularReceptionists from '../../components/v2/CircularReceptionists';
import FeatureCards from '../../components/v2/FeatureCards';
import IntegrationsOrbit from '../../components/v2/IntegrationsOrbit';
import ImpactStats from '../../components/v2/ImpactStats';
import TextReveal from '../../components/v2/motion/TextReveal';
import PinnedScene from '../../components/v2/motion/PinnedScene';
import { SqueezeCarousel, type SqueezeSlide } from '../../components/ui/carousel-squeeze';
import { prefersReducedMotion } from '../../components/v2/motion/reducedMotion';

gsap.registerPlugin(ScrollTrigger);


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
  /* La marge transparente du fichier, de chaque côté de la fenêtre. Même
     valeur que `screen.left` parce que c'est la même arête: le bord gauche du
     PNG au bord gauche du chrome Safari. */
  bleed: '3.6232%',
  screen: {
    left: '3.6232%',
    top: '10.5204%',
    width: '92.7536%',
    height: '82.6923%',
    borderBottomLeftRadius: '0.742% 1.3%',
    borderBottomRightRadius: '0.742% 1.3%',
  },
} as const;

/**
 * Le décor du hero: une boucle vidéo en ALLER-RETOUR, posée sur une photo.
 *
 * La photo reste le PLANCHER: elle est là au premier rendu, sans lecture à
 * démarrer ni codec à négocier. La vidéo se fond par-dessus quand elle joue
 * vraiment (`onPlaying`), si bien qu'un appareil qui refuse de la lire garde le
 * décor au lieu d'un trou.
 *
 * L'ALLER-RETOUR est dans le FICHIER, pas dans le code: le montage est suivi de
 * son propre reflet, donc un `loop` ordinaire suffit à repartir en arrière puis
 * en avant, indéfiniment. Le faire en JavaScript demanderait un `playbackRate`
 * négatif, que les navigateurs ne savent pas lire.
 *
 * La bande noire du bas du rush est COUPÉE au montage (recadrage 1440x958):
 * la laisser aurait demandé de la masquer à l'écran, ce qui revient à corriger
 * dans le navigateur un défaut qui appartient au fichier.
 *
 * Le fondu des bords est un MASQUE, jamais une couche peinte: voir le
 * commentaire dans le composant.
 */
/* Les fondus du décor du hero, en MASQUE.
   Un masque ne peint rien: il rend le décor TRANSPARENT sur ses bords, donc
   c'est la page qui reparaît, exactement de sa couleur. Noir en sombre, blanc
   en clair, sans qu'aucune couleur ne soit écrite ici et sans un aplat par
   thème à faire tomber pile sur le fond.
   Les paliers suivent une courbe en S. Un dégradé à trois paliers s'interpole
   linéairement entre eux: l'oeil ne voit pas la rampe, il voit les CASSURES de
   pente à chaque palier, et c'est ce qui se lisait comme un dégradé « trop
   fort ». */
/* LE FONDU DU HAUT ET DU BAS, sur un seul axe (demande utilisateur: « aucune
   marge, juste un dégradé, en haut et en bas, pas sur les côtés »).
   Un `linear-gradient(to bottom, …)` ne varie QUE selon la verticale: chacune
   de ses lignes est uniforme d'un flanc à l'autre. Les côtés ne peuvent donc
   pas s'éteindre, quel que soit le réglage des paliers: c'est la géométrie du
   dégradé qui l'interdit, pas une valeur qu'on aurait choisie et qu'un
   changement futur pourrait défaire.
   C'est un MASQUE: il ne peint rien, il rend l'image TRANSPARENTE à ses deux
   extrémités, donc c'est la page qui reparaît dessous, exactement de sa
   couleur (blanche en clair, noire en sombre, sans qu'aucune couleur ne soit
   écrite ici). C'est ce qui remplace la marge: le bord n'est plus une bande de
   page laissée vide, c'est l'image elle-même qui s'y dissout.
   Le haut se ferme vite (8 %) pour dégager la barre de nav; le bas prend le
   dernier quart, l'image y descend dans la suite de la page au lieu de
   s'arrêter net au-dessus de la capture du tableau de bord. Les deux atteignent
   zéro AVANT le bord même, sinon il reste assez d'opacité pour relire une arête
   pâle. Les paliers suivent une courbe en S: un dégradé à trois paliers
   s'interpole linéairement, et l'oeil voit alors les CASSURES de pente plutôt
   que la rampe. */

/* PLUS AUCUNE TEINTE DE MARQUE SUR LA VIDÉO (demande utilisateur: « enlève
   les effets de couleurs sur la vidéo, garde l'effet lens vignette »).
   Il y avait ici deux couches PEINTES, indigo en haut et violet en bas, qui
   coloraient la dissolution du décor. Elles partent toutes les deux; ce qui
   reste est le CADRE ARRONDI et son fondu du bas: ils ne peignent rien, ils
   ne peint rien, il rend le décor transparent sur ses bords, si bien que c'est
   la page qui reparaît, exactement de sa couleur, blanche en clair et noire en
   sombre. Le flou sous la nav reste aussi: il brouille, il ne colore pas.
   Ce que cela coûte, et c'est mesuré: la teinte du haut portait le contraste du
   titre, qui commence dans cette bande. Sans elle, le texte se lit sur la vidéo
   nue, plus claire. Les valeurs relevées après ce changement sont dans le
   message de commit; si l'une d'elles devient intenable, la réponse est une
   bande NEUTRE derrière le texte, pas le retour des teintes de marque. */
/* Le fondu de flou du HAUT: plein sous la nav, éteint plus bas. Comme le voile
   des bords, il ne peint rien, il ne fait que brouiller ce qui passe dessous:
   la vidéo reste visible derrière le menu, en diffus, au lieu d'être remplacée
   par un aplat. */


/* Les quatre panneaux du carrousel du bas. Aucune photographie: les photos
   aériennes (montagnes, routes, rivières) ne disaient rien des pages qu'elles
   ouvraient (retour utilisateur: « reprendre le bon contenu pour chaque »).
   Chaque panneau porte donc un MOTIF DESSINÉ qui évoque sa page, posé en
   couche SVG au-dessus d'un fond du registre drenched:
     À propos    — les deux cercles du logo (Q et W), qui se rejoignent
     Blog        — des lignes d'article
     Contact     — des arcs concentriques, un signal qui part du coin
     Affiliation — une progression qui monte (la commission récurrente)
   Quatre géométries, pas quatre teintes: des dégradés identiques feraient la
   grille de cartes jumelles que la charte interdit. Ils ne basculent pas avec
   le thème, comme tout le registre drenched.
   MAUVE SOMBRE (retour utilisateur: « pas de rose ni de mauve clair »): la
   lumière de chaque panneau reste mauve mais profonde (#453486 / #4E2E7E,
   jamais le #CD6BFB rosé), sur une base #161718 qui reste AU-DESSUS du fond
   de la bande en thème sombre (#111111) — en quasi-noir, les trois panneaux
   repliés se lisaient comme des trous plutôt que comme des cartes. */
const svgLayer = (svg: string, position: string, size: string) =>
  `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${position} / ${size} no-repeat`;

const EXPLORE_MOTIFS = [
  /* À propos: les deux cercles du logo, à droite. */
  svgLayer(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><circle cx="80" cy="100" r="60" fill="none" stroke="#9d86ff" stroke-opacity=".8" stroke-width="1.25"/><circle cx="122" cy="100" r="60" fill="none" stroke="#e3a9fd" stroke-opacity=".8" stroke-width="1.25"/></svg>`,
    'right 8% center', '62% auto',
  ),
  /* Blog: quatre lignes d'article, à gauche. */
  svgLayer(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g stroke="#ffffff" stroke-opacity=".28" stroke-width="4" stroke-linecap="round"><line x1="28" y1="66" x2="172" y2="66"/><line x1="28" y1="90" x2="148" y2="90"/><line x1="28" y1="114" x2="166" y2="114"/><line x1="28" y1="138" x2="118" y2="138"/></g></svg>`,
    'left 8% center', '58% auto',
  ),
  /* Contact: un signal qui part du coin bas-gauche. */
  svgLayer(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g fill="none" stroke="#ffffff" stroke-width="1.25"><circle cx="0" cy="200" r="64" stroke-opacity=".30"/><circle cx="0" cy="200" r="108" stroke-opacity=".22"/><circle cx="0" cy="200" r="152" stroke-opacity=".15"/></g><circle cx="0" cy="200" r="6" fill="#e3a9fd"/></svg>`,
    'left bottom', '82% auto',
  ),
  /* Affiliation: la progression, au bas à droite. */
  svgLayer(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><g><rect x="46" y="128" width="20" height="44" rx="5" fill="#ffffff" fill-opacity=".22"/><rect x="78" y="102" width="20" height="70" rx="5" fill="#ffffff" fill-opacity=".30"/><rect x="110" y="76" width="20" height="96" rx="5" fill="#ffffff" fill-opacity=".38"/><rect x="142" y="50" width="20" height="122" rx="5" fill="#e3a9fd" fill-opacity=".85"/></g></svg>`,
    'right 10% bottom', '56% auto',
  ),
];

const EXPLORE_BACKS = [
  'radial-gradient(125% 145% at 18% 118%, #453486 0%, #221845 42%, #161718 82%)',
  'linear-gradient(112deg, #161718 0%, #221645 52%, #453486 108%)',
  'radial-gradient(115% 135% at 86% -12%, #4E2E7E 0%, #2C1D52 46%, #161718 84%)',
  'radial-gradient(80% 100% at 4% 4%, #453486 0%, rgba(69,52,134,0) 60%), radial-gradient(80% 100% at 96% 96%, #4E2E7E 0%, rgba(78,46,126,0) 60%), #221845',
];



/* Masques de la vignette du hero.
   Cotes mesurées dans le PNG: « Déconnexion » à 91 %, arête basse de la
   fenêtre à 93,2 %. Le fondu vertical démarre un centimètre plus haut (mesure
   demandée, laissée en `cm` pour rester lisible) et se termine à 93,5 %, si
   bien que l'arête et son ombre disparaissent. Le fondu horizontal est bien
   plus court: assez pour décoller les flancs du bord, trop peu pour rogner le
   contenu du dashboard. */
const MASK_V = 'linear-gradient(to bottom, #000 0%, #000 calc(91% - 1cm), rgba(0,0,0,0) 93.5%)';

function HeroDashboardShot({ isFr }: { isFr: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);

  /* UNE PARALLAXE, ET RIEN D'AUTRE (demande utilisateur: « enlève l'effet sur
   * la fenêtre Safari, mets un simple effet parallaxe au scroll »).
   *
   * Ce qui part: le redressement 3D de `useContainerScrollMotion`, vingt degrés
   * de `rotateX` accompagnés d'une mise à l'échelle. Il donnait à la maquette
   * une perspective qui se corrigeait au défilement.
   *
   * Ce qui reste: la fenêtre descend de 90 px pendant que la page en parcourt
   * la hauteur, donc elle défile plus LENTEMENT que ce qui l'entoure. C'est
   * tout ce que fait une parallaxe, et c'est le seul mouvement qui ne demande
   * ni perspective ni transformation du plan.
   *
   * `['start end', 'end start']`: la course couvre toute la traversée de la
   * fenêtre du navigateur, du moment où le cadre entre par le bas à celui où
   * il sort par le haut. Le réglage précédent partait d'une plage étroite
   * parce qu'un redressement doit finir avant qu'on ne l'ait dépassé; une
   * parallaxe, elle, n'a pas de fin à atteindre.
   *
   * `prefers-reduced-motion` annule la course plutôt que le rendu: la maquette
   * reste à sa place, le composant garde ses hooks. */
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ['start end', 'end start'],
  });
  const parallax = useTransform(scrollYProgress, [0, 1], prefersReducedMotion() ? [0, 0] : [0, 90]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(wrap, { opacity: 0, duration: 0.9, ease: 'expo.out', delay: 0.2 });
    }, wrap);
    return () => ctx.revert();
  }, []);

  return (
    // Plus de `perspective` sur ce conteneur: elle n'existait que pour le
    // `rotateX` du redressement, et une parallaxe se joue dans le plan.
    <div ref={wrapRef} className="relative mt-10 sm:mt-14 md:mt-20">
      {/* Plus de nappe indigo derrière la capture (demande utilisateur: « la
          lueur du hero aussi », puis « enlève le mauve »). C'est elle qui
          déposait la frange mauve visible sous le bord bas de la maquette.
          Elle servait à décoller la capture du fond: ce rôle revient au cadre
          de la maquette elle-même, qui porte sa propre bordure. */}
      <motion.div
        className="relative"
        /* Surface sombre : la nav doit passer en verre noir quand elle la
           survole, sinon on lit du texte foncé sur la capture du dashboard. */
        data-nav-dark=""
        style={{
          /* La parallaxe. Elle vit dans le MÊME objet `style` que le reste:
             deux attributs `style` sur un même élément, et le second efface
             le premier. */
          y: parallax,
          /* Le PNG porte sa propre marge transparente autour de la fenêtre —
             3,62 %, la même cote que `screen.left`, c'est la même arête. Sans
             la compenser, la fenêtre visible tombe 40 px à droite du titre
             alors que les deux vivent dans le même conteneur: l'alignement
             était juste, c'est le fichier qui mentait sur sa largeur.
             Le débordement est posé sur le CADRE et non sur l'image: tout ce
             qu'il contient est positionné en pourcentage de lui (la capture,
             le patch de barre d'adresse), donc élargir l'image seule les
             décalait — la barre affichait « figma.com » à côté de la nôtre. */
          width: `calc(100% + 2 * ${MOCKUP.bleed})`,
          marginLeft: `-${MOCKUP.bleed}`,
          maxWidth: 'none',
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
          /* Le fondu descend, il ne fait plus le tour (demande utilisateur).
             Un second masque adoucissait les deux flancs sur 5 % de la
             largeur. Il coûtait deux choses: la fenêtre paraissait plus
             étroite qu'elle n'est, et surtout son arête gauche ne tombait plus
             sur celle du titre — les deux vivent pourtant dans le MÊME
             conteneur, donc l'alignement était déjà juste et c'est le fondu
             qui le cachait. Il ne reste que le fondu du bas, qui a un autre
             rôle: raccorder la fenêtre au dégradé de la page sans y peindre
             une bande de couleur. */
          WebkitMaskImage: MASK_V,
          maskImage: MASK_V,
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
          width={2560}
          height={1462}
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
      </motion.div>

      {/* Le bas de la fenêtre: dégradé ET flou (demande utilisateur).
          Le masque seul effaçait déjà l'arête, mais il laissait une image
          NETTE jusqu'au dernier pixel visible, si bien qu'on lisait encore la
          fin d'une ligne de dashboard juste avant qu'elle disparaisse. Le flou
          dissout ce qui reste, et il n'y a plus de délimitation du tout.

          DEUX éléments, jamais un seul: sur WebKit, un `-webkit-backdrop-filter`
          posé sur un élément qui porte aussi un `-webkit-mask-image` n'est pas
          rendu. Le masque reste donc au parent, le filtre descend à l'enfant.
          Même correction que le voile de la nav. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[22%] overflow-hidden"
        style={{
          maskImage: 'linear-gradient(to bottom, transparent 0%, #000 62%, #000 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 62%, #000 100%)',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            /* Promotion par transform: Safari ne lit pas
               `will-change: backdrop-filter`, et la couche resterait figée. */
            transform: 'translateZ(0)',
          }}
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
      /* Le motif de la page en couche DEVANT le dégradé drenched: deux couches
         d'un même `background`, le composant n'a plus d'image à charger. */
      background: `${EXPLORE_MOTIFS[i]}, ${EXPLORE_BACKS[i]}`,
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
      ? 'Qwillio décroche 24/7, vérifie votre agenda Google ou Outlook pendant l’appel, inscrit le rendez-vous et vous briefe avant chaque transfert. Français et anglais. À partir de 99 € par mois, 7 jours d’essai.'
      : 'Qwillio answers 24/7, checks your Google or Outlook calendar during the call, books the appointment and briefs you before every transfer. French and English. From €99 a month, 7-day trial.',
    canonical: 'https://qwillio.com/',
  });

  /* Ce qu'elle accomplit pendant un appel: chaque ligne est un outil réel du
     runtime (checkAvailability, bookAppointment, SMS, warm transfer). */
  const during = [
    {
      icon: CalendarCheck,
      title: isFr ? 'Elle vérifie le créneau' : 'She checks the slot',
      desc: isFr
        ? 'Agenda Google ou Outlook connecté, elle lit vos disponibilités pendant que votre client parle. Deux appels en même temps ne peuvent pas réserver la même heure.'
        : 'With your Google or Outlook calendar connected, she reads your availability while your customer is talking. Two simultaneous calls can never book the same hour.',
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
      title: isFr ? 'Elle acquiesce sans s’engager' : 'She agrees without committing you',
      body: isFr
        ? 'Elle glisse des « mhm » pendant que vous parlez, jamais un « oui » qui vaudrait engagement.'
        : 'She slips in a “mm-hmm” while you talk, never a “yes” that would commit you.',
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
        {new URLSearchParams(window.location.search).get('design') === 'atmosphere' ? <Atmosphere /> : <HeroBackdrop />}
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
                  ? 'Elle décroche 24/7, vérifie votre agenda pendant l’appel et confirme le rendez-vous par SMS. Dès 99 € par mois.'
                  : 'She answers 24/7, checks your calendar during the call and confirms the booking by SMS. From €99 a month.'}
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
          <HeroDashboardShot isFr={isFr} />
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
                          style={{ color: feat.fg === 'white' ? 'rgba(255,255,255,0.72)' : '#525257' }}
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
          <PinnedScene
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
                    ? 'Pas de formulaire interminable. Vous discutez, elle se règle. Des voix avec de vrais aperçus audio, ou la vôtre, clonée en 90 secondes d’enregistrement.'
                    : 'No endless forms. You chat, she adjusts. Voices with real audio previews, or your own, cloned from 90 seconds of recording.'}
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
      <ImpactStats isFr={isFr} />

      {/* ── L'APP DANS VOTRE POCHE, le téléphone quitte le hero ── */}
      {/* `overflow-hidden` reste après le retrait du halo de HeroPhone3D: la
          maquette du téléphone est inclinée en 3D, et ses angles dépassent
          encore la colonne sur un écran de 390 px. */}
      <Section aria-labelledby="pocket-heading" className="relative overflow-hidden">
        <Container className="relative z-10 grid lg:grid-cols-[1fr_1fr] gap-8 sm:gap-14 lg:gap-20 items-center [&>*]:min-w-0">
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

      {/* ── APRÈS L'APPEL + CONFIANCE ──
          Sur le FOND DE PAGE, plus sur la bande. La bande vaut #111111 en thème
          sombre et les plates des rangées produit #1a1a1a: neuf valeurs d'écart,
          c'est-à-dire rien à l'oeil, et les cartes ne se lisaient plus comme des
          cartes (retour utilisateur: « le fond de la section ne doit pas être de
          la couleur de la carte »). Sur le fond de page à #0a0a0a, l'écart passe
          à seize valeurs et elles se détachent.
          Le filet du haut (`hairline`) reste, et c'est lui qui porte désormais la
          séparation d'avec la section précédente: sans la bande, deux sections
          canvas voisines se toucheraient sans rien entre elles. */}
      <Section hairline aria-labelledby="after-heading" className="relative">
        <Container className="relative z-10">
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
                ? 'Annonce d’enregistrement conforme RGPD, sous-traitants encadrés par des clauses contractuelles types, et le spam est filtré sans entamer votre quota.'
                : 'GDPR-compliant recording notice, sub-processors covered by standard contractual clauses, and spam is filtered without touching your quota.'}
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
        <Container className="relative z-10 grid lg:grid-cols-[1fr_1.1fr] gap-9 sm:gap-14 items-center [&>*]:min-w-0">
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
        <div aria-hidden="true" className="q2-hairline-lit absolute inset-x-0 top-0" />
        {/* Plus de lueur d'assise (demande utilisateur: « enlève la lueur mauve
            en bas de la page »). Elle voulait finir la page sur une lumière;
            vue en plein écran, c'était une tache mauve sous le dernier bouton.
            Le filet lumineux du haut de section reste: il sépare, il n'éclaire
            pas. */}
        <Container className="relative z-10">
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
                  ? '7 jours d’essai. En mensuel, sans engagement — résiliez en un clic.'
                  : '7-day trial. No commitment on monthly — cancel in one click.'}
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
