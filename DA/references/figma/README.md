# Enregistrés Figma de l'utilisateur — mockups et matières pour la V2

Liens éditeur fournis le 2026-08-05 (fichiers communautaires dupliqués). Lisibles
par le MCP Figma : `get_metadata` pour la structure, `get_design_context` pour les
cotes et les couleurs exactes.

**Contrainte de la session** : la politique réseau interdit figma.com au proxy
(`CONNECT tunnel failed, 403`). Les rendus et les SVG exportés ne peuvent donc pas
être téléchargés sur le disque. Conséquence :
- ce qui est de l'INTERFACE (chrome de navigateur, notification iOS, carte, verre)
  est relevé au pixel via `get_design_context` puis **redessiné en code** avec les
  tokens q2 : plus net, responsive, thématisable, et fidèle aux cotes du fichier ;
- ce qui est du RENDU 3D matriciel (téléphones 3D, formes 3D Airnauts) ne peut pas
  être récupéré ; il faut soit que l'utilisateur exporte les PNG et les envoie,
  soit garder les équivalents déjà codés (HeroPhone3D).

| # | Fichier | fileKey | Usage | État |
|---|---|---|---|---|
| 1 | macOS Browser UI Kit (Big Sur) | 2s5xTDITPM0oycK3mkJNr7 | fenêtre navigateur du hero | **FAIT** — cotes du nœud « Browser / Google Chrome - Light » (957:434) relevées et portées dans `frontend/src/components/v2/ui/browser-frame.tsx` |
| 2 | iPhone 15 Pro Free Mockups | cCvBnUCrnceDHeC5SIBGQx | section app mobile | à faire (interface : portable en code) |
| 3 | iPhone 15 Pro 3D Mockups | TpyX6egHT1IV1T5nEkZWsq | variante 3D | bloqué : rendu matriciel, non téléchargeable |
| 4 | Free MacBook Pro 16 Mockups | ocncObBURPxoF1i6HQSUJE | poste de travail | à arbitrer |
| 5 | Glass Effect | hFNml2IwtLD8oVbOobXibx | matière verre (nav, cartes) | à faire (valeurs de flou/teinte relevables) |
| 6 | 10 Geometric Shapes (BRIX) | dZvzfl1xim1A49yeYDSPkL | décor | à faire (vecteurs : portables en SVG inline) |
| 7 | 20 Free Shapes 3D (Airnauts) | xfFHqMMw7ZU2pzW25XHyLu | décor 3D | bloqué : rendus matriciels |
| 8 | coolicons Free Iconset | KCSHfaXbLueAawDr8IngHe | iconographie | à faire — le paquet est libre sur npm (`registry.npmjs.org` est autorisé), donc récupérable par là plutôt que par Figma |

## Cotes relevées — Chrome Light (fichier 1, nœud 957:434, fenêtre de 1280)

    barre d'onglets  37px, fond #DFE1E5
    pastilles        3 x 12px, à 13px du bord gauche, 16px du haut
    onglet           256 x 34, à 70px, coins hauts arrondis, fond blanc
    favicon 18px à 89px · titre 12px #3D4043 à 114px · croix 7.93px
    barre d'outils   42px, fond blanc, filet bas #B6B6B6
    actions          13px de haut, à 15.5px
    barre d'adresse  28px, fond #F1F3F4, rayon 14px, de 108px à -44px
    cadenas 8 x 10.5 à 122px · URL 14px, #767676 puis #202124
    menu             3 x 13, à droite, 20.5px
