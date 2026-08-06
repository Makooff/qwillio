# Section With Mockup — @aghasisahakyan1 (référence utilisateur)

- Code brut : `source.tsx` (récupéré tel quel via MCP 21st, 2026-08-04). Demo id 1913.
- Preview : https://cdn.21st.dev/user_2wRb2ACTQ44hvI4zlLmE3zYQQZU/section-with-mockup/default/preview.1746632628368.png

## Ce que l'utilisateur aime
Rangée alternée texte / GRAND mockup produit : le mockup principal dans une carte
arrondie 32px translucide, doublé d'une carte décor floutée décalée derrière
(débordement -20% hors du cadre), les deux glissant en parallax inverse au scroll.

## Mécanique clé à reproduire fidèlement
- Deux couches : carte décor `bg-[#090909] rounded-[32px] blur(2px)` décalée
  (top 10% / left -20%, inversés en reverseLayout) qui monte de -30px au scroll ;
  carte principale `bg-[#ffffff0a] rounded-[32px] backdrop-blur-[15px]` qui descend
  de +30px — le cisaillement des deux crée la profondeur.
- Entrées framer-motion : container staggerChildren 0.2, items opacity 0 / y 50
  -> 0.7s easeOut, viewport once amount 0.2.
- `reverseLayout` : grid-flow-col-dense + col-start pour alterner les rangées.
- Filet bas : gradient radial blanc 24% -> transparent, 1px.

## Adaptation Qwillio (à faire dans les blocs, pas ici)
- Sur section drenched q2 (void/carbon), texte white/mist, PAS de #090909 ni bg-black bruts.
- Images = vraies captures dashboard (/screens/*), ratio adapté aux crops.
- Le backdrop-blur de la carte principale = exception glassmorphism documentée
  (illustration produit, pas chrome UI).
