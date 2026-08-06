# Circular Carousel — @nexus-ui (référence exacte de l'utilisateur)

- Code brut : `source.tsx` (composant) + `demo.tsx` (usage), collés par l'utilisateur le 2026-08-04.
- URL : https://21st.dev/@nexus-ui/components/circular-carousel

## Mécanique clé à reproduire fidèlement
- Arc elliptique : `getItemPosition` — angle = (offset ajusté / VISIBLE_COUNT) * PI,
  x = sin(angle) * RADIUS_X (220), y = -cos(angle) * RADIUS_Y (100) ; wrap circulaire
  par ajustement de l'offset au-delà de half.
- Décroissance : scale 1 -> -0.3 par distance, opacity 1 -> 0.3, zIndex décroissant.
- Transition signature : 0.65 s, cubic-bezier(0.22, 1, 0.36, 1), AnimatePresence
  popLayout + layout sur chaque item.
- Autoplay 4 s, PAUSÉ au hover ET au focus ; flèches clavier sur le conteneur
  (tabIndex 0, role region) ; clic sur un item = goTo.
- Contrôles : chevrons ronds 40px whileHover 1.08 / whileTap 0.95 + dots
  (actif = pilule w-6).
- Compteur central « 0X of NN » re-animé à chaque changement (fade + y 8).

## Exigences utilisateur déjà actées (phase 6/7)
- L'item ACTIF au centre NETTEMENT plus grand que les autres (~160 px vs plus petits).
- Items = BULLES rondes avatar (pas des cartes texte), nom au-dessus/voix dessous.
- Carte de personnalité complète du perso actif (nom, personnalité, description).
- Bouton play par personnage (aperçu speechSynthesis côté marketing, pas d'appel backend).

## Port réel (2026-08-05) : `frontend/src/components/v2/ui/circular-carousel.tsx`

Copie du `source.tsx`. `getItemPosition` (ellipse sin/cos, RADIUS 220/100, wrap,
formules scale/opacité/zIndex), AnimatePresence popLayout + layout, transition
0.65 s [0.22,1,0.36,1], autoplay 4 s pausé survol/focus, flèches clavier,
chevrons whileHover/whileTap, dots, compteur : conservés tels quels.

Écarts, tous nécessaires pour passer de 6 items (la démo) à nos 10 :
1. `VISIBLE_COUNT` 5 → 11. C'est le paramètre de calibrage du fichier (pas
   angulaire 180/VISIBLE_COUNT, fenêtre |adj| <= half*2). À 5, nos items
   lointains passent SOUS l'ellipse et deux d'entre eux retombent au même x
   (angles symétriques autour de 90 degrés) : ils se chevauchent et masquent le
   compteur. À 11 (items + 1), pas de 16.4 degrés, écart max 82 degrés, arc
   supérieur uniquement, aucune collision.
2. Cadre : piste `max-w-2xl`, hauteur 220, ancre `top-[160px]` (au lieu de
   `max-w-lg` / `h-[280px]` / `top-1/2`), calés sur l'empan réel de l'arc
   (-156..+42 autour de l'ancre) : plus rien de découpé, pas de vide.
3. Marges négatives (-56/-56) sur la carte : les classes `-translate-x/y-1/2`
   du fichier sont écrasées par le transform que framer écrit pour x/y, donc
   chaque carte pendait en bas à droite de son point d'orbite. Les marges
   rétablissent le centrage voulu par l'auteur, sans toucher aux valeurs animées.
4. Mise à l'échelle du cadre (ResizeObserver -> `scale(k)` sur l'anneau) : les
   rayons du fichier sont en pixels fixes et débordaient sur mobile. Le math est
   intact, c'est le cadre entier qui rétrécit.
5. Carte 112x112 (avatar rond + nom + tag) au lieu de 192x128 : à 10 items
   l'écart entre voisins est de 62 px, une carte large cachait entièrement ses
   deux voisins immédiats.
6. Actif 2x : `scale` de la formule pour l'actif, formule x 0.55 pour les autres.
7. Tokens q2 + Outfit à la place de zinc/white ; dots sans `transition-all`
   (ban DA) ; « of 10 » -> « / 10 » (site FR et EN) ; `pauseSignal` pour ne pas
   avancer pendant l'écoute d'une voix.

## Adaptation Qwillio (dans le bloc, pas ici)
- Registre clair Home (canvas q2) : remplacer zinc-800/900 et white/xx par tokens q2.
- Interdits DA : PAS de `transition-all` (les dots du source en ont : passer à
  transition-[width,background-color] ou équivalent) ; poids display capé 500 ;
  reduced-motion = rendu statique (rangée simple existante en repli).
- 10 personnages réels du catalogue (marie..julien) + « votre voix » ; avatars
  /characters/<id>.webp.
