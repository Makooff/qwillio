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
import TryVoiceButton from '../../components/v2/TryVoiceButton';
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
   Verticalement le HAUT et le BAS se dissolvent (demande utilisateur), pas
   seulement le bas: le décor passe sous la barre de nav, et une arête franche
   s'y verrait. Horizontalement les DEUX flancs, le gauche plus long que le
   droit parce que la colonne de texte vit à gauche et que le contraste y a été
   mesuré à 1,0:1 quand l'image y montait. */
/* Les rampes portent BEAUCOUP de paliers, et c'est tout le correctif.
   Un dégradé CSS à trois paliers s'interpole linéairement entre eux: l'oeil ne
   voit pas la rampe, il voit les CASSURES de pente à chaque palier, et c'est
   exactement ce qui se lisait comme « les dégradés sur les côtés sont trop
   forts » (retour utilisateur). Les paliers ci-dessous suivent une courbe en S,
   si bien que la pente ne change jamais d'un coup: le fondu devient long et
   diffus au lieu d'être franc et court. Les valeurs de fin sont aussi plus
   douces, le décor s'éteint plus tôt et plus lentement. */
const HERO_MASK_V =
  'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.06) 6%, rgba(0,0,0,0.24) 13%, rgba(0,0,0,0.52) 21%, rgba(0,0,0,0.78) 29%, rgba(0,0,0,0.92) 36%, rgba(0,0,0,0.92) 54%, rgba(0,0,0,0.80) 65%, rgba(0,0,0,0.56) 75%, rgba(0,0,0,0.30) 85%, rgba(0,0,0,0.10) 93%, transparent 100%)';
/* Le flanc DROIT s'éteint sur un quart de la largeur au lieu d'un huitième, et
   ne monte plus jamais à l'opacité pleine près du bord: c'est la pente, et non
   la longueur, qui trahissait le dégradé (retour utilisateur: « ils se voient
   trop sur les côtés »). */
const HERO_MASK_H =
  'linear-gradient(to right, transparent 0%, transparent 38%, rgba(0,0,0,0.05) 48%, rgba(0,0,0,0.16) 56%, rgba(0,0,0,0.34) 64%, rgba(0,0,0,0.56) 72%, rgba(0,0,0,0.74) 79%, rgba(0,0,0,0.86) 85%, rgba(0,0,0,0.78) 90%, rgba(0,0,0,0.56) 94%, rgba(0,0,0,0.28) 97%, rgba(0,0,0,0.08) 99%, transparent 100%)';
/* LA LENTILLE (demande utilisateur): net au centre, éteint dans les quatre
   coins. Une ellipse tient les coins tout seuls — c'est sa géométrie qui les
   atteint en dernier, il n'y a aucun réglage par coin à écrire. */
const HERO_MASK_LENS =
  'radial-gradient(118% 96% at 50% 40%, #000 0%, #000 42%, rgba(0,0,0,0.92) 58%, rgba(0,0,0,0.70) 72%, rgba(0,0,0,0.40) 84%, rgba(0,0,0,0.14) 93%, transparent 100%)';
/* Le FLOU va SOUS le dégradé (demande utilisateur), donc son masque est
   l'inverse de la lentille: rien au centre, plein aux bords. Le fondu ne tombe
   plus sur une image nette, il tombe sur une image déjà diffuse, et c'est ce qui
   enlève l'arête. */
/* La couronne commence plus loin du centre qu'avant (48 % au lieu de 34 %):
   le cadre s'étant resserré autour du média, une couronne large mangeait une
   part bien plus grande de ce que l'on voit, et le rush passait pour flou. */
const HERO_MASK_LENS_INVERSE =
  'radial-gradient(118% 96% at 50% 40%, transparent 0%, transparent 48%, rgba(0,0,0,0.18) 62%, rgba(0,0,0,0.46) 74%, rgba(0,0,0,0.76) 86%, #000 100%)';

function HeroBackdrop() {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  /* Une boucle qui tourne sans fin est exactement ce que `prefers-reduced-motion`
     demande d'éteindre, et les règles CSS du projet ne coupent que les
     animations et les transitions: la vidéo continuerait de jouer dessous.
     Sans elle, la photo reste, et le hero garde son décor. */
  const [reduced] = useState(prefersReducedMotion);

  return (
    <div
      /* Le décor est INSÉRÉ, pas collé aux bords: c'est ce qui laisse voir des
         angles arrondis (demande utilisateur). Collé à `inset-0`, un rayon de
         bordure tomberait hors de l'écran et ne se verrait jamais.
         Sa HAUTEUR EST BORNÉE, et c'est le correctif du cadrage sur iPhone.
         Il couvrait toute la hauteur du hero, soit plus de 1200 px sur un
         téléphone, pour un rush en 3:2: en `object-contain` l'image se réduisait
         à un bandeau de 244 px collé en haut, lequel tombait tout entier dans la
         rampe d'entrée du fondu vertical ET dans la couronne de flou. On ne
         voyait donc qu'une tache floue en haut à droite (retour utilisateur:
         « très mauvaise qualité, très mal cadrée »). Le cadre suit désormais une
         fraction de la fenêtre, proche du 3:2 du fichier à toutes les tailles.
         La largeur est PLAFONNÉE, et c'est le second correctif, celui de la
         définition. Le rush d'origine mesure 1440x1080, dont 122 px de bande
         noire, soit 1440x958 utiles, encodés en 1280x852. Étalé sur toute la
         largeur d'un grand écran, il est agrandi deux fois, et un agrandissement
         de deux ne se rattrape pas: c'est lui que l'on lit comme « très mauvaise
         qualité ». Le plafond ci-dessous garde le facteur sous 1,2 en CSS.
         Au-delà, il faut un export du montage en 1920 ou 2560 de large: aucun
         réglage ici n'invente les pixels manquants. */
      className="absolute top-0 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] sm:w-[calc(100%-3rem)] lg:w-[calc(100%-5rem)] max-w-[1180px] h-[46vh] sm:h-[56vh] lg:h-[64vh] max-h-[720px] rounded-[28px] sm:rounded-[40px] overflow-hidden pointer-events-none"
      aria-hidden="true"
      /* VIGNETTE, en MASQUE et non en couche peinte par-dessus.
         Peindre la couleur du canvas au-dessus du décor, c'est poser un aplat
         qui doit tomber PILE sur le fond de la page: au moindre écart le
         raccord se voit, et il faudrait deux aplats, un par thème. Le masque ne
         peint rien: il rend le décor TRANSPARENT sur ses bords, donc c'est la
         page qui reparaît, exactement de sa couleur. Blanc en clair, noir en
         sombre, sans qu'aucune couleur ne soit écrite ici, et surtout aucune
         couleur de marque (demande utilisateur: « pas couleur Qwillio »).
         Ce premier masque est le FONDU DU BAS, celui qui fait disparaître le
         bord inférieur de la vidéo dans le dégradé de la page. Il est porté par
         un conteneur distinct du masque de lentille: deux masques sur un seul
         élément demanderaient `mask-composite`, mal soutenu par Safari. */
      style={{
        WebkitMaskImage: HERO_MASK_V,
        maskImage: HERO_MASK_V,
      }}
    >
      {/* FONDU DE GAUCHE, et c'est le plus important des trois.
          Mesure faite sur le rendu: sous le paragraphe du hero, le rapport de
          contraste tombait à 1,0:1 — le texte disparaissait dans la forêt. Et
          aucune opacité ne le sauvait: même à 30 % le pire cas plafonnait à
          2,6:1, sous les 4,5:1 exigés. Ce n'est pas un réglage d'intensité,
          c'est une question de PLACE: le décor doit s'effacer là où le texte
          vit, et rester entier là où il n'y a rien. La colonne de texte occupe
          la gauche, le décor commence donc à droite.
          Le masque est PLEINEMENT transparent jusqu'à 50 %, un peu au-delà du
          paragraphe: un simple affaiblissement ne suffisait pas, il restait
          assez d'image pour retenir le contraste sous les 4,5:1. Réserve
          connue: `q2-body` sur `q2-canvas` plafonne de toute façon à 4,54:1,
          donc la marge est mince et toute décoration ajoutée ici la reprendra. */}
      <div
        className="absolute inset-0"
        style={{ WebkitMaskImage: HERO_MASK_H, maskImage: HERO_MASK_H }}
      >
      {/* LA LENTILLE. Elle porte le média, et elle seule: le voile de flou est
          son frère, pas son enfant, sinon la lentille l'effacerait précisément
          là où il doit agir. */}
      <div
        className="absolute inset-0"
        style={{ WebkitMaskImage: HERO_MASK_LENS, maskImage: HERO_MASK_LENS }}
      >
        {/* Le plancher. Retiré seulement si l'IMAGE échoue: le retirer parce que
            la vidéo joue enlèverait le seul décor du cas où la vidéo s'arrête. */}
        {!photoFailed && (
          <img
            src="/hero-backdrop.webp"
            alt=""
            aria-hidden="true"
            onError={() => setPhotoFailed(true)}
            className="absolute inset-0 w-full h-full object-cover object-top select-none transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ opacity: playing ? 0 : 'var(--q2-hero-media)' }}
          />
        )}

        {!reduced && (
        <video
          /* `cover`, et ce n'est PAS un retour en arrière sur « ne rogne pas
             dedans ». Ce qui grossissait l'image, ce n'était pas `cover`, c'était
             le cadre: haut de plus de 1200 px pour un rush en 3:2, il forçait un
             agrandissement de 40 % pour être rempli. Le cadre est maintenant
             proche du 3:2 du fichier, donc `cover` ne fait quasiment plus que
             rogner quelques pour cent sur un bord, sans agrandir. Et `contain`
             ne convient plus: dans un cadre qui n'est jamais exactement au ratio
             du fichier, il laisserait deux bandes vides à l'intérieur du cadre
             arrondi. */
          className="absolute inset-0 w-full h-full object-cover object-top select-none transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
          /* `muted` et `playsInline` ne sont pas décoratifs: sans les deux, iOS
             refuse la lecture automatique et le décor resterait figé. */
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          onPlaying={() => setPlaying(true)}
          style={{ opacity: playing ? 'var(--q2-hero-media)' : 0 }}
        >
          <source src="/hero-lake.webm" type="video/webm" />
          <source src="/hero-lake.mp4" type="video/mp4" />
        </video>
        )}
      </div>

        {/* LE FLOU DES BORDS, posé PAR-DESSUS le média et SOUS le fondu.
            `backdrop-filter` plutôt qu'une seconde copie floutée du média: la
            copie ferait décoder la vidéo deux fois pour un voile que l'on ne
            regarde pas. Là où le navigateur refuse le filtre, il ne reste que
            les fondus, c'est-à-dire l'état précédent: aucune régression. */}
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage: HERO_MASK_LENS_INVERSE,
            maskImage: HERO_MASK_LENS_INVERSE,
            WebkitBackdropFilter: 'blur(14px)',
            backdropFilter: 'blur(14px)',
          }}
        />
      </div>
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

function HeroDashboardShot({ isFr }: { isFr: boolean }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const frame = frameRef.current;
    if (!wrap || !frame || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from(frame, { y: 46, opacity: 0, duration: 0.9, ease: 'expo.out', delay: 0.2 });

      /* Le redressement, et le PARALLAXE (demande utilisateur).
       *
       * Trois changements, tous sur la même timeline pour qu'ils partagent une
       * seule lecture du scroll — trois `scrollTrigger` séparés se
       * recalculeraient chacun de leur côté et se décaleraient d'une image.
       *
       * `scrub: 1` plutôt que `0.6`: le scrub EST le lissage. Il dit en
       * combien de secondes l'animation rattrape la position du scroll, et
       * c'est ce délai qui donne le glissé au lieu du collé-au-doigt. Au
       * dessus de ~1,5 s on décroche du geste et ça flotte.
       *
       * La fenêtre remonte plus lentement que la page (`yPercent: -6`): c'est
       * tout le parallaxe. Il reste petit à dessein — le hero n'a pas de
       * profondeur à raconter, il a juste à ne pas être plat. */
      gsap.timeline({
        scrollTrigger: { trigger: wrap, start: 'top 92%', end: 'bottom 30%', scrub: 1 },
      })
        .fromTo(frame, { rotateX: 4 }, { rotateX: 0, ease: 'none' }, 0)
        .fromTo(frame, { yPercent: 0 }, { yPercent: -6, ease: 'none' }, 0);
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
         noir (#0F1011) et le fond de la page (#0E0F11) ne sont séparés que par
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
        <HeroBackdrop />
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
                  {/* Plus de page a visiter: la carte d'essai nait de ce
                      bouton. Un formulaire avant d'entendre la voix etait un
                      peage que personne ne franchit pour une demonstration. */}
                  <TryVoiceButton variant="outline">
                    <Play size={13} fill="currentColor" aria-hidden="true" />
                    {isFr ? 'L’entendre décrocher' : 'Hear her answer'}
                  </TryVoiceButton>
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
          shapes={[{ kind: 'column', x: '-7%', y: '16%', size: 175, drift: -95, opacity: 0.34 }]}
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
          shapes={[{ kind: 'quarters', x: '86%', y: '14%', size: 235, drift: 90, opacity: 0.28 },
            { kind: 'core', x: '-8%', y: '58%', size: 200, drift: -70, opacity: 0.2 }]}
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
          shapes={[{ kind: 'disc', x: '-12%', y: '32%', size: 300, drift: 85, opacity: 0.26 }]}
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

          {/* `items-start`, et c'est LUI le correctif.
              Par défaut une grille ÉTIRE ses blocs à la hauteur de la rangée:
              deux voisins finissent donc toujours à la même ligne, quoi que
              contienne chacun. En `items-start` chaque bloc garde la sienne, et
              la colonne de droite descend d'un cran (`sm:mt-12`) pour que les
              arêtes hautes ne s'alignent pas non plus.
              La disposition voulue plus tôt tient toujours: à gauche le noir
              puis un blanc, à droite un blanc puis le violet. */}
          <ul className="grid sm:grid-cols-2 gap-4 sm:gap-5 items-start" role="list">
            {naturally.map((feat, i) => (
              <RevealV2
                key={feat.title}
                index={i}
                className={`${feat.edge} ${i % 2 === 1 ? 'sm:mt-12' : ''}`}
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
        </Container>
      </Section>

      {/* ── CONFIGUREZ-LA EN LUI PARLANT ── */}
      <Section aria-labelledby="setup-heading" className="relative">
        <ShapeDrift
          className="hidden md:block"
          shapes={[{ kind: 'twinMirror', x: '83%', y: '30%', size: 225, drift: -85, opacity: 0.26 },
            { kind: 'pair', x: '-6%', y: '8%', size: 155, drift: 70, opacity: 0.2 }]}
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
          shapes={[{ kind: 'columnAlt', x: '46%', y: '10%', size: 150, drift: 95, opacity: 0.2 }]}
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
          shapes={[{ kind: 'twin', x: '-9%', y: '38%', size: 240, drift: -80, opacity: 0.26 },
            { kind: 'discCut', x: '84%', y: '8%', size: 185, drift: 85, opacity: 0.2 }]}
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
        <ShapeDrift
          className="hidden lg:block"
          shapes={[{ kind: 'quartersMirror', x: '85%', y: '20%', size: 225, drift: 80, opacity: 0.24 }]}
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
