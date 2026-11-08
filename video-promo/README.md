# Qwillio en vidéo

Deux compositions Remotion vivent ici :

- **`QwillioPub`** : la pub verticale 9:16, « Le coup de feu » (30 s). C'est la version en cours.
- **`QwillioFilm`** : le film 16:9 en éléments du portail (variante non retenue).

## La pub verticale v3 : « Samedi, 20 h 12 » (`QwillioPub3`)

La version en cours. `npm run build:pub3` produit `out/qwillio-pub-v3.mp4`.

- **Un seul tournage.** Tous les plans de cuisine viennent de la même série
  Mixkit (42464 à 42487 : même plan de travail, même four, même tablier), pour
  que la pub se lise comme un petit film d'une seule soirée et non comme des
  rushs assemblés. Licence « Mixkit Stock Video Free License », vérifiée plan par
  plan ; aucun plan « Restricted ». Ce sont des images d'illustration, pas un client.
- **Fond clair, vidéos dans des cadres arrondis**, comme les visuels du site. Le
  téléphone est posé à cheval sur le coin du cadre.
- **Le téléphone vient du kit Figma « iOS 16 UI Kit »** (écran verrouillé
  36:7378, notification 1259:11286, appel entrant 34:147) : cotes, rayons, flous
  et icônes SVG du kit (`public/ios/`). Seule la police diffère, SF Pro n'étant
  licenciée que sur les plateformes Apple.
- **Aucune sonnerie Apple** : le téléphone vibre (son de synthèse `buzz`). Un pop
  discret à chaque phrase, un pop Mixkit aux notifications.
- **Musique** : « Discover » (Mixkit, Mixkit Music Free License), prise à 16,4 s
  pour que sa montée tombe sur l'ouverture de l'app, retirée sous les voix.
- **Fond d'écran** : celui du kit (iPhone 14 Midnight), qui est une image Apple ;
  à remplacer avant une diffusion payante si le doute juridique pèse.
- **Pendant l'appel**, plusieurs plans du même tournage se suivent
  (`CALL_SHOTS`), chacun plus court que son rush : l'image ne fige jamais, quelle
  que soit la durée de l'appel réel.
- **L'appel** vient de `src/pub/call.ts`. Aujourd'hui des voix de synthèse ;
  avec l'enregistrement réel d'un appel à la réceptionniste :

  ```bash
  NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt \
    node scripts/transcribe-call.mjs ~/appel.m4a --from=3 --to=28
  npm run build:pub3
  ```

  Le script découpe l'extrait, le transcrit (ElevenLabs Scribe, mots horodatés et
  diarisation), coupe une piste par réplique et réécrit `call.ts`. La frise de la
  v3 garde les vrais silences de la conversation et se recale seule. Vérifier
  dans la sortie que « AGENT » est bien la réceptionniste, sinon relancer avec
  `--agent=speaker_1`. La réponse brute est gardée (et ignorée par git) dans
  `scripts/transcript-raw.json` : recouper autrement ne repaie pas la transcription.

## La pub verticale : « Le coup de feu »

Construite comme une pub d'opérateur : une situation, le problème, puis la même situation
rejouée avec Qwillio. Vendredi 20 h, le coup de feu ; le téléphone vibre, personne ne
décroche, les appels manqués s'empilent ; Camille raccroche et réserve en face. « Un appel
manqué, c'est une table vide. » Puis l'ouverture de l'app, et « Cette fois… » : elle décroche,
elle réserve (tap sur 19:30), elle reconnaît Camille, vous lisez la note.

- **Le motion** reprend la référence fournie : fond clair qui respire, texte mot à mot qui sort
  du flou, objets qui s'empilent, une idée par plan.
- **La DA** est celle de Qwillio : Outfit 300, un mot en italique serif par phrase, les mauves
  du logo dans le fond pastel.
- **Les illustrations sont celles du site** : `ProductIllustration`
  (`frontend/src/components/v2/ProductIllustration.tsx`) est importée telle quelle, avec sa
  feuille et `styles/v2.css`, rendue à largeur mobile pour qu'elle s'empile en hauteur.
  `src/site-illustrations.css` ne fait que repointer ses photos vers le dossier servi par
  Remotion.
- **Le logo** est l'animation d'ouverture de l'app (`liquidJourney`), recalculée en 1080×1920.
- **Le son** : 20 sons, un par événement (vibration du téléphone, notifications, tap, logo…),
  déclarés dans `src/pub/timeline.ts`, que l'image lit aussi.

```bash
npm install
npm run build:pub
```

---

## Le film 16:9 (variante)

42 secondes, 1920×1080, 60 images par seconde, rendu avec **Remotion**. Pas de musique : un son par événement.

## Ce que montre le film : des éléments du produit, pas des captures

Pas d'enregistrement d'écran ni de page entière : le film sort chaque ÉLÉMENT du portail
client et le met en scène seul, en grand, sur fond sombre.

1. la carte « En cours » d'un appel (`LiveCalls`), où la conversation s'écrit en direct, puis
   la puce « Rendez-vous créé » qui en sort ;
2. la grille de l'agenda (`ClientBookings`) : la case du samedi passe de 1 à 2, et la carte du
   rendez-vous s'envole de la case jusqu'à la colonne « À venir » ;
3. la fiche d'appel, reconstruite pièce par pièce : appelant, durée, date, résultat, sentiment,
   puces, score de lead, puis le résumé IA qui s'écrit ;
4. le mois (`ClientOverview`) : indicateurs, courbe des appels, jauge.

Chaque élément est redessiné seul (`src/elements.tsx`), avec ce qui vient du portail :

- **les valeurs** : fonds, bordures, rayons et tailles, relevés sur le portail rendu avec des
  données de démonstration (styles calculés) ;
- **les icônes** : la façade du portail, `frontend/src/components/icons.tsx`, importée telle
  quelle (`remotion.config.ts` lui donne le même React que le film) ;
- **la grille de l'agenda** : `monthGrid` de `frontend/src/utils/month-grid.ts` ;
- **le logo** : les trajectoires de l'animation d'ouverture de l'app, calculées par
  `liquidJourney` (`frontend/src/components/blobPath.ts`, le code de `SplashScreen.tsx`).

Aucun bouton du site n'y figure.

## Le son

`src/timeline.ts` est le seul endroit qui dit QUAND : les scènes le lisent, et
`scripts/sfx.mjs` en tire la liste des sons. 27 sons, dans 11 familles (sonnerie, notification
en verre, pastille qui rebondit, carte qui se pose, barre qui se remplit, logo…).
Chaque occurrence a sa graine, qui fait varier sa hauteur, sa durée et sa place en stéréo :
aucun son n'est rejoué à l'identique.

## Ce que le film affirme

Rien d'invérifiable (`DA/voix.md`). Les noms, numéros et rendez-vous sont fictifs et les
numéros de l'ouverture sont masqués. Ce qui est montré existe dans le portail : appel en
direct, agenda, fiche d'appel avec résumé IA et score de lead, vue d'ensemble du mois.

## Régénérer

Prérequis : Node 22.6 ou plus, Python 3 avec numpy, un Chromium (variable `REMOTION_CHROME`
ou option `--browser-executable`).

```bash
npm install
npm run build
```

`npm run studio` ouvre Remotion Studio pour régler une scène image par image. La version
livrée est `frontend/public/qwillio-promo.mp4`, avec son affiche `qwillio-promo-poster.jpg`.
