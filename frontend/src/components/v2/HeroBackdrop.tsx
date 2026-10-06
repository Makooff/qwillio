import { useState } from 'react';
import { prefersReducedMotion } from './motion/reducedMotion';

const HERO_MASK_BAS =
  'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.18) 1.5%, rgba(0,0,0,0.44) 3%, rgba(0,0,0,0.72) 4.5%, rgba(0,0,0,0.92) 6%, #000 8%, #000 74%, rgba(0,0,0,0.92) 81%, rgba(0,0,0,0.72) 87%, rgba(0,0,0,0.44) 92%, rgba(0,0,0,0.18) 96%, transparent 99%)';
const HERO_TOP_HAZE =
  'linear-gradient(to bottom, #000 0%, #000 34%, rgba(0,0,0,0.82) 52%, rgba(0,0,0,0.52) 70%, rgba(0,0,0,0.22) 86%, transparent 100%)';

export default function HeroBackdrop() {
  const [photoFailed, setPhotoFailed] = useState(false);
  const [playing, setPlaying] = useState(false);
  /* Une boucle qui tourne sans fin est exactement ce que `prefers-reduced-motion`
     demande d'éteindre, et les règles CSS du projet ne coupent que les
     animations et les transitions: la vidéo continuerait de jouer dessous.
     Sans elle, la photo reste, et le hero garde son décor. */
  const [reduced] = useState(prefersReducedMotion);

  return (
    <div
      /* PLEIN ÉCRAN en largeur (demande utilisateur: « je n'aime pas l'écart
         sur les côtés »). Le décor était inséré de quelques rem et plafonné à
         1560 px, ce qui laissait deux bandes de page nue à gauche et à droite.
         Les angles arrondis partent avec: un rayon n'a de sens que sur une
         forme qui a des bords, et de bord il n'y en a plus que deux, en haut et
         en bas, tous deux traités par le fondu et par le voile de flou.
         LA HAUTEUR N'EST PLUS CHOISIE, ELLE EST DÉDUITE (demande utilisateur:
         « ne rogne pas du tout la vidéo »). Le cadre porte exactement le rapport
         du fichier, 3528x2348, donc la largeur pleine détermine la hauteur et
         il ne reste plus rien à rogner: aucun bord ne sort du cadre, aucune
         bande vide ne se forme dedans. C'était le dernier endroit où un recadrage
         pouvait naître: une hauteur en `vh` ne tombe au rapport du fichier que
         pour une fenêtre, et `object-cover` mangeait la différence partout
         ailleurs.
         Le fondu du bas commence à 56 % de cette hauteur, la moitié de l'image
         (demande utilisateur: « le dégradé du bas cache trop la vidéo »).
         Le décor est servi en 1280, 1920, 2560 ou en 3528, sa définition
         native (voir les `<source media>` plus bas): à sa largeur d'écran, chacun
         reçoit donc au moins autant de pixels qu'il en affiche, y compris un
         écran retina, et l'image n'est jamais agrandie. */
      /* À BORD PERDU, ET LE DÉGRADÉ TIENT LIEU DE MARGE (demande utilisateur:
         « aucune marge, juste un dégradé »).
         L'étape précédente avait posé un cadre inséré et arrondi: la marge était
         alors du vide, donc de la couleur de la page. Elle disparaît ici, et le
         rôle qu'elle tenait passe au masque: le bord haut et le bord bas
         s'éteignent en fondu jusqu'à la transparence, si bien que la page
         reparaît dessous, blanche en clair et noire en sombre, exactement comme
         le faisait la marge, mais sans arête, et sans un pixel de largeur perdu.
         Les angles arrondis partent avec le cadre: un rayon n'a de sens que sur
         une forme qui a des bords, et il n'en reste plus. */
      className="absolute inset-x-0 top-0 aspect-[3528/2348] overflow-hidden pointer-events-none"
      /* PAS de `data-nav-dark` ici, et c'est un choix, pas un oubli.
         Le marqueur y a été posé un temps: il basculait la barre en version
         sombre (texte blanc) au-dessus de la vidéo. La direction retenue est
         l'inverse (demande utilisateur: « mets un dégradé blanc et l'écriture
         en noir »): la barre reste en version claire, et c'est le voile blanc
         de l'entête qui porte la lisibilité du texte noir.
         La maquette du tableau de bord, elle, garde le marqueur: elle est
         beaucoup plus sombre que la vidéo, et aucun voile blanc raisonnable
         n'y ferait tenir du texte noir. */
      aria-hidden="true"
      /* LE FONDU, en MASQUE et non en couche peinte par-dessus.
         Peindre la couleur du canvas au-dessus du décor, c'est poser un aplat
         qui doit tomber PILE sur le fond de la page: au moindre écart le
         raccord se voit, et il faudrait deux aplats, un par thème. Le masque ne
         peint rien: il rend le décor TRANSPARENT sur ses bords, donc c'est la
         page qui reparaît, exactement de sa couleur. Blanc en clair, noir en
         sombre, sans qu'aucune couleur ne soit écrite ici, et surtout aucune
         couleur de marque (demande utilisateur: « pas couleur Qwillio »).
         Plus de VIGNETTE, et c'est la différence qui compte. Une vignette est un
         dégradé RADIAL: elle éteint tout le pourtour, flancs compris, et c'est
         ce halo latéral qui se lisait comme un contour blanc en thème clair. Le
         masque posé ici est linéaire et vertical: il ne peut, par construction,
         toucher que le haut et le bas. */
      style={{
        WebkitMaskImage: HERO_MASK_BAS,
        maskImage: HERO_MASK_BAS,
      }}
    >
      {/* PLUS DE FONDU LATÉRAL NI DE LENTILLE (demande utilisateur: garder le
          haut et le bas seulement). Il y en avait un de chaque, et ils
          coûtaient cher: le fondu de gauche effaçait le décor sur toute la
          moitié gauche, la lentille éteignait les quatre coins, et la vidéo ne
          se voyait plus que dans un quart de son cadre.
          Réserve connue et surveillée: c'est ce fondu de gauche qui protégeait
          le contraste du titre et du paragraphe, mesuré une fois à 1,0:1 quand
          l'image montait dessous. Le décor est donc descendu en opacité pour
          compenser, et les quatre contrastes sont remesurés à chaque
          changement. Si l'un repasse sous le seuil, c'est l'opacité qu'il faut
          reprendre, pas le fondu. */}
      <div className="absolute inset-0">
        {/* Le plancher. Retiré seulement si l'IMAGE échoue: le retirer parce que
            la vidéo joue enlèverait le seul décor du cas où la vidéo s'arrête. */}
        {!photoFailed && (
          <img
            src="/hero-backdrop.webp"
            alt=""
            aria-hidden="true"
            onError={() => setPhotoFailed(true)}
            className="absolute inset-0 w-full h-full object-contain object-top select-none transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ opacity: playing ? 0 : 1 }}
          />
        )}

        {!reduced && (
        <video
          /* `contain`, et c'est la garantie du « ne rogne pas du tout »: le
             cadre porte déjà le rapport du fichier, donc `contain` le remplit
             sans laisser de bande, et si un arrondi de calcul faisait
             différer les deux d'un pixel, c'est une ligne transparente qui
             apparaîtrait, pas une tranche d'image coupée. `cover` prenait le
             pari inverse, et c'est le mauvais quand la consigne est de tout
             montrer.
             OPACITÉ PLEINE: la vidéo est brute (demande utilisateur: « le
             milieu doit être sans effet »). Elle passait auparavant sous
             `--q2-hero-media`, un voile de 0,26 qui la rendait fantomatique.
             Ce que ce voile protégeait, c'était le contraste du texte du hero;
             ce rôle revient maintenant au montage teinté du haut, qui couvre la
             bande où le texte commence. */
          className="absolute inset-0 w-full h-full object-contain object-top select-none transition-opacity duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
          /* `muted` et `playsInline` ne sont pas décoratifs: sans les deux, iOS
             refuse la lecture automatique et le décor resterait figé. */
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          onPlaying={() => setPlaying(true)}
          /* La photo REVIENT si la lecture s'arrête. `onPlaying` seul ne se
             défait jamais: une vidéo qui cale ou qui échoue après avoir
             démarré laissait le décor entièrement transparent, c'est-à-dire un
             hero sans image. */
          onPause={() => setPlaying(false)}
          onError={() => setPlaying(false)}
          onStalled={() => setPlaying(false)}
          style={{ opacity: playing ? 1 : 0 }}
        >
          {/* TROIS DÉFINITIONS, et chaque écran ne télécharge QUE la sienne.
              L'attribut `media` d'une `<source>` est évalué une fois, au
              chargement: un téléphone ne tire donc jamais le fichier de 2560, et
              un grand écran n'hérite plus d'un rush trop petit qu'il faudrait
              agrandir. C'est ce compromis, et lui seul, qui permet d'avoir de la
              définition sur un 27 pouces sans plomber la 4G.
              L'ordre compte deux fois: `media` du plus grand au plus petit, car
              le navigateur prend la PREMIÈRE source qui correspond; et WebM
              avant MP4, car il pèse un tiers de moins là où il est lu. Safari,
              qui ignore le VP9 ici, tombe sur le MP4 juste en dessous.
              Les cotes sont celles du fichier livré: master 3528x2348 en 24 i/s,
              aller-retour de 30 s, sans son.
              LA DÉFINITION NATIVE EST SERVIE (demande utilisateur: « n'impacte
              pas la qualité, garde la max qualité »), et sa condition compte la
              DENSITÉ autant que la largeur: un portable retina de 1200 px
              affiche 2400 pixels réels, donc il reçoit le fichier natif alors
              qu'un moniteur de 1600 px non retina se contente du 1920. Sans le
              `min-resolution`, c'est précisément l'écran le plus fin qui aurait
              hérité de l'image la plus grossière. */}
          {/* `-webkit-min-device-pixel-ratio` EN PLUS de `min-resolution`, et
              c'est ce qui manquait (retour utilisateur: « la vidéo semble
              toujours en low res », capture prise sous Safari).
              `min-resolution` n'est comprise qu'à partir de Safari 16; avant,
              la condition est simplement FAUSSE, jamais une erreur. Un Mac
              retina de 1440 px ne remplissait donc ni « 2000 px de large » ni
              « 1100 px et 2dppx »: il tombait sur la ligne suivante et
              recevait le fichier de 1920 pour un cadre de 2880 pixels réels,
              soit un agrandissement d'un tiers. C'est exactement l'aspect
              « basse définition » constaté, et il ne se voyait pas sous
              Chromium, qui comprend `min-resolution`.
              La forme préfixée dit la même chose et Safari la comprend depuis
              toujours. Les deux cohabitent: le navigateur ignore ce qu'il ne
              connaît pas, et il suffit qu'UNE des conditions de la liste soit
              vraie. */}
          <source
            media="(min-width: 2000px), (min-width: 1100px) and (min-resolution: 2dppx), (min-width: 1100px) and (-webkit-min-device-pixel-ratio: 2)"
            src="/hero-lake-3528.webm"
            type="video/webm"
          />
          <source
            media="(min-width: 2000px), (min-width: 1100px) and (min-resolution: 2dppx), (min-width: 1100px) and (-webkit-min-device-pixel-ratio: 2)"
            src="/hero-lake-3528.mp4"
            type="video/mp4"
          />
          <source media="(min-width: 1600px)" src="/hero-lake-2560.webm" type="video/webm" />
          <source media="(min-width: 1600px)" src="/hero-lake-2560.mp4" type="video/mp4" />
          <source
            media="(min-width: 900px), (min-width: 450px) and (min-resolution: 2dppx), (min-width: 450px) and (-webkit-min-device-pixel-ratio: 2)"
            src="/hero-lake-1920.webm"
            type="video/webm"
          />
          <source
            media="(min-width: 900px), (min-width: 450px) and (min-resolution: 2dppx), (min-width: 450px) and (-webkit-min-device-pixel-ratio: 2)"
            src="/hero-lake-1920.mp4"
            type="video/mp4"
          />
          <source src="/hero-lake-1280.webm" type="video/webm" />
          <source src="/hero-lake-1280.mp4" type="video/mp4" />
        </video>
        )}
      </div>

        {/* La couronne de flou des bords est retirée avec la lentille dont elle
            était l'inverse: elle brouillait aussi les flancs, qui n'ont plus de
            fondu à adoucir. Seul reste le voile du haut, sous la nav. */}

        {/* LE FONDU DE FLOU SOUS LA NAV (demande utilisateur).
            Il remplace la bande de couleur qu'il y avait là: le décor n'est plus
            effacé sous le menu, il est brouillé, et le flou s'éteint en
            descendant. La hauteur suit la barre de nav (64 px) plus de quoi
            laisser la transition respirer. Même découpage en deux éléments, pour
            la même raison. */}
        <div
          className="absolute inset-x-0 top-0 h-[168px] sm:h-[196px]"
          style={{ WebkitMaskImage: HERO_TOP_HAZE, maskImage: HERO_TOP_HAZE }}
        >
          <div
            className="absolute inset-0"
            style={{
              WebkitBackdropFilter: 'blur(22px)',
              backdropFilter: 'blur(22px)',
              transform: 'translateZ(0)',
            }}
          />
          {/* La teinte indigo qui se posait ici est retirée: sous la nav, il ne
              reste que le FLOU, qui brouille sans colorer. */}
        </div>

        {/* La teinte violette du bas est retirée elle aussi. La disparition du
            bord inférieur est entièrement l'affaire du masque du conteneur:
            c'est lui la vignette, et il rend transparent au lieu de peindre. */}
    </div>
  );
}
