# Qwillio Design System

Version 1.0 · Révision du 14 novembre 2026 · Direction : **Papier & Signal**.

Un système commun à la marque, au site et au produit : une expression éditoriale ample pour présenter, une interface précise pour travailler. La qualité recherchée est celle d’un produit établi : cohérence, détail, lisibilité, qualité des états et fiabilité des interactions. Le niveau de richesse visuelle se choisit selon l’usage ; professionnaliser ne signifie pas appauvrir.

[Ouvrir le catalogue visuel](docs/design-system/index.html) · [Composants et états](docs/design-system/COMPOSANTS.md) · [Référence générée du code](docs/REFERENCE-GENEREE.md) · [État fonctionnel](docs/FONCTIONNALITES.md)

## Statut et sources

| Référence | Rôle |
| --- | --- |
| Ce document | Charte commune, usages et valeurs par défaut pour concevoir et implémenter |
| [tokens.json](frontend/src/design-system/tokens.json) | Valeurs partagées de marque, espacement, arrondis, type, layout et motion ; consommées par Tailwind et la couche produit |
| [v2.css](frontend/src/styles/v2.css) | Thèmes et styles effectivement appliqués au site V2, dont les couleurs claires/sombres |
| [admin-theme.ts](frontend/src/styles/admin-theme.ts) et [design-system.ts](frontend/src/styles/design-system.ts) | Tokens et styles sémantiques du portail et de l’administration |
| [App.tsx](frontend/src/App.tsx) | Écrans réellement montés ; la présence d’un fichier de page ne suffit pas |
| [Catalogue](docs/design-system/index.html) | Spécimen interactif des fondations et des patterns ; ses exemples ne sont pas des données clients |

Le socle partagé est intégré aux tokens Tailwind, aux surfaces du portail et au bouton produit. Les anciens écrans n’ont pas tous été migrés ; ne pas présenter ce travail comme une refonte exhaustive. Les écarts connus et la portée de la migration sont décrits dans [le suivi](docs/design-system/MIGRATION.md).

Les valeurs sont précises pour permettre la réutilisation, et révisables pour permettre les nouvelles idées. Une évolution motivée peut enrichir le système : mettre à jour le token, le composant, son exemple et la documentation dans la même proposition. Aucune ancienne interdiction esthétique ne vaut veto automatique. Voir [EVOLUTION.md](docs/EVOLUTION.md).

## 1. Identité et références

**Qwillio** : une présence attentive et un outil de travail précis. La marque rapproche le téléphone, la conversation et la continuité de l’activité. Deux cercles Q/W, une famille mauve reconnaissable, des neutres structurants, une typographie calme.

- **Codex** : référence d’organisation d’un espace de travail, de hiérarchie des actions et de lisibilité des informations techniques.
- **ElevenLabs** : référence de présentation du produit vocal, de rythme éditorial, d’ampleur typographique et de mise en scène du son.
- Ces références sont interprétées pour Qwillio. Leurs logos, polices propriétaires ou valeurs supposées ne deviennent pas des tokens Qwillio. [Sources et interprétation](DA/references/codex-elevenlabs.md).

Préserver l’identité existante sans figer les compositions : une grille de données, une illustration riche ou une nouvelle interaction sont possibles si elles servent l’objectif et s’intègrent au système.

## 2. Logo et marque

Source : [qwillio-logo-512.svg](frontend/public/qwillio-logo-512.svg), variantes dans [DA/logo.md](DA/logo.md). Garder les proportions, une zone libre d’au moins un demi-rayon de lobe et un fond qui préserve le contraste. Utiliser les fichiers fournis pour les icônes ; ne pas redessiner le monogramme dans chaque composant.

| Nom | Valeur | Usage |
| --- | --- | --- |
| Indigo Q | `#7a5fff` | Identité voix et réceptionniste, contour ou mise en avant de marque |
| Mauve profond | `#7349fe` | Ancrage, accent produit, encre de marque sur clair si le contraste convient |
| Violet W | `#cd6bfb` | Expression secondaire, modules et éléments de communication |
| Lift | `#b9a8ff` | Accent lisible sur fond sombre |
| Encre de commande sombre | `#8a6fff` | Texte et contour des actions du portail |
| Blanc de marque | `#fdfdff` | Variantes et réserve du logo ; ne remplace pas tous les fonds clairs |

Le dégradé du logo appartient au logo ; il n’impose pas un dégradé sur chaque bouton ou titre. Les couleurs de statut gardent leur sens : succès vert, avertissement ambre, erreur rouge, information bleue. Ne pas coder une information uniquement par la couleur.

## 3. Surfaces et thèmes

### Site public et authentification V2

Deux thèmes et un choix système. Les couleurs sémantiques passent par `--q2-*` ; les canaux RVB sont conservés pour les modificateurs d’opacité de Tailwind.

| Rôle | Clair, observé dans le code | Sombre, observé dans le code |
| --- | --- | --- |
| Canvas | `#fdfcfc` | `#0a0a0a` |
| Bande | `#d0d0d0` | `#111111` |
| Plate | `#c6c6c6` | `#1a1a1a` |
| Texte principal | `#1d1d1f` | `#f5f4f2` |
| Texte secondaire fort | `#44403b` | `#c9c6c1` |
| Corps | `#777169` | `#98948e` |
| Texte discret | `#a59f97` | `#6b6862` |

Les sections sombres restent sombres dans les deux thèmes : canvas `#0a0a0a`, surface `#111111`, survol `#1a1a1a`. Le texte qui y figure doit être adapté au fond de la section, pas au thème global. Les anciennes valeurs taupe/bleu-noir sont archivées ; ne pas les réintroduire en lisant une ancienne référence.

Les textes discrets et les couleurs de marque ne sont pas interchangeables avec une couleur de corps accessible : vérifier leur contraste sur le fond exact, en particulier dans les bandes claires. Cette palette n’est pas une certification AA de chaque combinaison existante.

### Portail et administration

Canvas et panneau `#0a0a0a`, sidebar/inset `#111111`, survol `#1a1a1a`. `t.text`, `t.textSec`, `t.textTer` portent la hiérarchie. Le portail est actuellement sombre ; le choix du thème public ne le rend pas clair.

Les boutons d’action actuels privilégient **fond neutre ou transparent et contour mauve**, sans remplissage mauve au survol. Les boutons publics primaires encre/clair et les actions destructrices rouges sont des variantes distinctes, pas des erreurs de marque. Les bordures et ombres sémantiques sont répertoriées dans [la référence générée](docs/REFERENCE-GENEREE.md).

## 4. Espacement

Unité principale **4 px**, échelle dans `tokens.space`. Les clés suivent les unités Tailwind : `4` = 16 px, `6` = 24 px. Demi-paliers 2, 6 et 10 px servent aux ajustements optiques et contrôles compacts.

| Usage | Valeurs par défaut | Expression |
| --- | --- | --- |
| Icône et libellé | 8 px | `gap-2` |
| Label et champ | 8 px | `mb-2` |
| Champs d’un formulaire | 16 à 24 px | `gap-4` / `gap-6` |
| Contenu d’une carte produit | 16 à 24 px | `p-4` / `p-6` |
| Carte éditoriale | 24 px mobile, 32 px dès sm | `p-6 sm:p-8` |
| Gouttière de page produit, pour les nouveaux écrans | 16 px mobile, 24 px desktop | `px-4 md:px-6` |
| Sections du site, composant Section existant | 56 / 80 / 112 / 128 px | `py-14 sm:py-20 md:py-28 lg:py-32` |
| Gouttières Container existant | 20 / 24 / 40 px | `px-5 sm:px-6 lg:px-10` |
| Largeur du Container public | 1200 px maximum | `max-w-[1200px]` |

Choisir un rythme selon la densité du contenu ; ne pas ajouter de marges arbitraires pour réparer un problème de structure. La variante compacte peut réduire un espacement, sans réduire la lisibilité ni les zones d’interaction.

## 5. Arrondis

| Rôle sémantique | Rayon | Source / classe partagée |
| --- | --- | --- |
| Petit détail | 6 px | `rounded-qw-detail` |
| Puits et élément interne | 10 px | `t.rSm`, `rounded-qw-inset` |
| Champ standard et carte sombre éditoriale | 12 px | `rounded-qw-input` ; champ texte distinct d’une commande pilule |
| Carte produit | 14 px | `t.r`, `ds.surface`, `rounded-qw-surface` |
| Dialogue, menu flottant | 16 px | `ds.surfaceFloat`, `rounded-qw-overlay` |
| Carte éditoriale standard | 20 px | `rounded-qw-editorial` |
| Grande carte éditoriale | 24 px mobile, 28 px dès sm | `rounded-qw-editorialMobile sm:rounded-qw-editorialLarge` |
| Bouton, chip, déclencheur de sélection | 9999 px | `t.rFull`, `rounded-full` ou `rounded-qw-pill` |

Ne pas rendre une grande carte ou un dialogue ovale parce que les boutons sont en pilule. Dans le dashboard, la règle existante `[data-dashboard]` applique la pilule aux boutons, selects et recherches ; `data-radius="keep"` est réservé aux exceptions structurelles justifiées. Les champs texte, cases à cocher et surfaces ont leur propre rôle.

## 6. Typographie

Famille **Outfit**, repli système. Les nombres qui changent utilisent `tabular-nums`. Une famille mono système peut aider pour un identifiant ou un exemple de code ; ne pas transformer tous les labels en jargon technique.

| Rôle | Taille | Graisse | Interligne / tracking |
| --- | --- | --- | --- |
| Display public | `clamp(2.35rem, 6.5vw, 5.8rem)` | 300 | 1,08 / −0,02 em |
| H2 public | `clamp(1.75rem, 4.5vw, 3.4rem)` | 300 | 1,13 / −0,02 em |
| H3 public | `clamp(1.3rem, 3.4vw, 1.5rem)` | 400 | 1,33 / −0,012 em |
| Introduction | `clamp(1.0625rem, 3.4vw, 1.25rem)` | 400 | 1,35 |
| Corps éditorial | 16 px | 400 | 1,5 |
| Interface produit | 13 px, ajustable selon le contexte | 400 | 1,5 |
| Label compact | 12 px | 500 | 1,4 |
| Eyebrow public | 13 px | 500 | 1,4, casse de phrase |

Les valeurs publiques correspondent à `v2.css`. Les rôles compacts servent de base aux nouveaux composants ; toutes les pages historiques n’utilisent pas encore une échelle unique. Un titre suit la hiérarchie sémantique h1/h2/h3 et peut prendre une taille différente selon son contexte.

## 7. Composants et états

Réutiliser les primitives correspondant à la surface, sans mélanger les familles au hasard :

- Site : `Container`, `Section`, `Display`, `H2` dans `components/v2/Primitives.tsx`, `PillButton` / `PillLink`, `CardV2`.
- Produit : `components/ui/Button.tsx`, `ds.surface`, `ds.inputCls`, `ds.selectCls`, `badgeStyle` ; consulter les composants existants pour dialogues, panneaux, tableaux, pagination, recherche et notifications.
- Icônes : passer par `components/icons.tsx` ; une icône décorative ne remplace pas le nom accessible d’une action.

Un composant documenté précise ses variantes, tailles, états et limites d’utilisation. Pour chaque parcours, traiter selon le besoin : repos, hover, focus, pressé/sélectionné, désactivé, chargement, vide, erreur, succès et absence de permission. [Catalogue détaillé](docs/design-system/COMPOSANTS.md).

## 8. Interaction, accessibilité et responsive

- Bouton public : hauteur minimum existante 44 px ; produit : sm 30 px / md 36 px, à compléter par une cible tactile confortable sur mobile. Les 44 px recommandés ne sont pas prétendus déjà appliqués à tous les contrôles.
- Focus clavier visible, ordre logique, nom accessible pour les icônes seules. Les menus et dialogues gèrent ouverture, fermeture, retour de focus et navigation clavier adaptés.
- Objectifs de contraste : 4,5:1 pour texte courant, 3:1 pour grand texte et éléments non textuels pertinents. Mesurer les combinaisons utilisées ; une couleur « de marque » ne dispense pas du contrôle.
- Vérifier le zoom à 200 %, les libellés longs et les textes traduits. Le tableau peut défiler dans son conteneur sans faire déborder toute la page.
- Breakpoints : sm 640, md 768, lg 1024, xl 1280, 2xl 1536 px. Le contenu dicte les adaptations, pas seulement la taille de l’écran.
- Motion : retour 100–150 ms, transition 220 ms, entrée autour de 450 ms, press 0,97 ; préférer transform/opacité lorsque possible. `prefers-reduced-motion` doit fournir un état utilisable sans déplacement animé.
- Hiérarchie de couches proposée pour les nouveaux composants : sticky 20, navigation 30, popover 40, dialogue 50, toast 60, tooltip 70. Auditer le contexte d’empilement avant de migrer un écran existant.

## 9. Branding éditorial et visuels

Écrire en français clair, avec accents. Décrire le résultat utile et les limites connues. Les copies anglaises et néerlandaises sont des contenus à vérifier séparément, pas un effet automatique de l’i18n.

Les ondes, conversations, interfaces produit et illustrations de métier peuvent apporter de la richesse. Les exemples doivent être identifiés comme démonstrations ; ne pas inventer de clients, statistiques, revenus, disponibilité garantie ou fonctionnalités actives. Garder les crédits et droits des médias. [Ton de voix](DA/voix.md).

## 10. Faire évoluer le système

Une nouvelle idée peut être explorée dans le catalogue ou un écran ciblé. Expliquer le problème, le bénéfice et la portée ; préciser si elle devient un nouveau standard ou reste une exception. Mettre à jour les tokens et leurs consommateurs concernés, les exemples et cette charte. Tester l’impact réel ; ne pas exiger un plugin, une autorisation supplémentaire ou un rituel sans rapport avec le changement.

Après une modification des sources de référence : `npm run sync:reference`, puis relire l’état fonctionnel et les exemples. `npm run check:reference` signale un inventaire périmé ; il n’interdit aucune nouvelle fonction, couleur ou architecture.
