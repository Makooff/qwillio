# MacBook sélectionné par Mathieu

## Source et licence

- Auteur : **Mr.Mockup**.
- Ressource publique : https://www.figma.com/community/file/1176558805861554548/macbook-pro-mockups
- Copie sélectionnée : https://www.figma.com/design/fqSzKvFCs3nfZm3NEXotxx/MacBook-Pro-Mockups--Community-?node-id=4-2
- La page `4:2` est la couverture. Le vrai mockup est sur la page `0:1`, frame `1:2` (« MacBook », 6000 × 4000), écran vectoriel `2:13`.
- Licence affichée sur la page publique Figma et vérifiée dans le navigateur : **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/ . Attribution et lien vers la licence visibles sous le visuel.

## Adaptation effectuée

`macbook-figma-safari.webp` conserve les calques photographiques du mockup Figma : mur, sol, lumière, MacBook et masque d'écran. Il ne s'agit pas d'un MacBook redessiné en CSS ni de la vignette de couverture réutilisée.

Le contenu original rose est remplacé par une capture de l'interface du vrai portail, page `/dashboard/receptionist`, base de connaissances ouverte. Backend mocké avec les données de démonstration de `frontend/capture-screens.mjs`, aucun accès à un compte client réel.

Une barre Safari illustrative originale (commandes macOS, navigation, barre d'adresse qwillio.com, partage et onglets) est ajoutée en haut de la capture. Safari remplit tout l'écran du MacBook, sans bureau ni fenêtre flottante. C'est une mise en scène visuelle, pas une affirmation qu'une recette WebKit/Safari a été exécutée.

La perspective est calculée depuis les coordonnées exactes du vecteur Figma `2:13`, pas estimée à l'œil. Dans la frame 6000 × 4000 : haut-gauche (1367.5, 1348), haut-droite (2951, 588), bas-droite (3200, 1845.5), bas-gauche (1724, 2739). Une homographie inverse place une surface Safari 2880 × 1800 dans ce quadrilatère, puis le masque original est réappliqué. Export WebP final : 2400 × 1600.

Les URL temporaires d'assets MCP ne figurent dans aucun chemin de rendu de la page. Pour régénérer, réexporter les calques de la frame originale, recapturer le portail local avec les mêmes mocks, puis remplacer uniquement le contenu de l'écran.
