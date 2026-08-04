# Features 7 — @meschacirung (référence utilisateur)

- Code brut : `source.tsx` (récupéré tel quel via MCP 21st, 2026-08-04). Demo id 1905.
- Preview : https://cdn.21st.dev/user_2tUYFzCDCVfrMrVC3TfB9DUBAyx/features-7/default/preview.1746632578863.png

## Ce que l'utilisateur aime
Le patron de section features : grand titre + lead à gauche, GRANDE illustration produit
en perspective au centre (skew/rotateX léger), puis rangée de 4 mini-features
(icône 16px + titre 14px + description 14px muted) SANS cartes, juste de l'espace.

## Mécanique clé à reproduire fidèlement
- Illustration : `[perspective:800px]` > `[transform:skewY(-2deg)skewX(-2deg)rotateX(6deg)]`,
  ratio `aspect-[88/36]`, débordement horizontal `-mx-4 md:-mx-12`, voile radial
  au-dessus qui fond l'image vers le fond de page.
- Grille finale : `grid-cols-2 lg:grid-cols-4`, gap-x-3/gap-y-6, icônes `size-4` inline
  avec le titre (flex items-center gap-2).

## Adaptation Qwillio (à faire dans les blocs, pas ici)
- Tokens q2 (canvas/band/ink/body), Outfit, poids display ≤500 (pas de font-semibold 600 en display).
- Illustration = vraie capture dashboard (/screens/*), pas les PNG tailark.
- Icônes lucide conservées (déjà dans le projet).
