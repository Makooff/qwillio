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

## Adaptation Qwillio (dans le bloc, pas ici)
- Registre clair Home (canvas q2) : remplacer zinc-800/900 et white/xx par tokens q2.
- Interdits DA : PAS de `transition-all` (les dots du source en ont : passer à
  transition-[width,background-color] ou équivalent) ; poids display capé 500 ;
  reduced-motion = rendu statique (rangée simple existante en repli).
- 10 personnages réels du catalogue (marie..julien) + « votre voix » ; avatars
  /characters/<id>.webp.
