# UI

## Rayons

| Élément | Rayon |
|---|---|
| Grande carte de marque | 28 à 32 px (`rounded-[2rem]`) |
| Carte produit, panneau | 16 px (`rounded-2xl`) |
| Champ, bouton compact | 12 px (`rounded-xl`) |
| Petit bloc, pastille | 8 px (`rounded-lg`) |
| Bouton pilule, chip | plein (`rounded-full`) |
| Bulle de conversation | 18 px, avec une queue sur le dernier message d'une série |

Une seule échelle des deux côtés. Le site utilise le haut de l'échelle parce que ses blocs sont grands, le produit le bas parce qu'il est dense. Ce n'est pas deux systèmes, c'est un système à deux amplitudes.

## Ombres

Sur fond clair, l'ombre est large, très diffuse et teintée vers le mauve, jamais du noir pur :

```css
box-shadow: 0 30px 80px rgba(20, 16, 50, 0.14);
```

Sur fond sombre, **pas d'ombre**. La profondeur se fait par la surface (`--q-bg2` sur `--q-bg`) et par une bordure à faible opacité. Une ombre noire sur du noir ne se voit pas et alourdit le rendu.

## Bordures

Toujours à faible opacité, jamais une ligne pleine :

- clair : `rgba(29, 29, 31, 0.10)`
- sombre : `rgba(255, 255, 255, 0.06)` au repos, `0.10` en survol

## Motion

```css
--ease-out:      cubic-bezier(0.23, 1, 0.32, 1)
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)
--ease-in-out:   cubic-bezier(0.77, 0, 0.175, 1)
--ease-drawer:   cubic-bezier(0.32, 0.72, 0, 1)
```

Règles :

- **Retour au clic** : `scale(0.97)` sur `:active`. Sur tout ce qui se clique, partout.
- **Cascade** : 30 à 80 ms entre éléments d'une liste. Au-delà, on attend.
- **Durées** : 200 ms pour un état, 400 à 600 ms pour une entrée, 900 ms au maximum pour une séquence.
- **Jamais partir de `scale(0)`.** Une entrée part de 0.94 ou 0.96, pas de rien.
- **Les ressorts sont décoratifs.** Sur une pastille, un badge, une icône. Jamais sur une mise en page qui décale du contenu.
- `prefers-reduced-motion` est respecté partout : l'état final s'affiche, sans trajet.

## Les interdits absolus

Ils ne se discutent pas :

1. **Pas de dégradé sur le texte** (`background-clip: text`)
2. **Pas de bande latérale colorée** comme accent (`border-left` de plus de 1 px)
3. **Pas de gabarit hero-métriques** : grand chiffre, petite étiquette, en grille
4. **Pas de grille de cartes identiques** : même taille, même icône, même titre, même paragraphe
5. **Pas de glassmorphism par défaut**
6. **Pas de modale comme première solution**
7. **Pas de `transition-all`** : nommer la propriété (`transition-colors`, `transition-opacity`)
8. **Pas d'Inter**, pas d'emojis, pas de tirets cadratins

Sur le point 3 : la bande de crédibilité de la home affiche des chiffres, mais chacun est une **propriété vérifiable du produit** (FR/EN, moins d'une seconde, 24/7), pas une métrique de performance inventée. La différence est là.

## Composants

Le vocabulaire du dashboard est dans `frontend/src/components/dashboard/OverviewBlocks.tsx` : `KpiSplit`, `HeroTrendPanel`, `RadialGauge`, `TallyMeter`, `DetailCard`, `AttentionList`, `SegmentBar`, `InsightCard`. On y puise avant d'en écrire un nouveau.

Le vocabulaire des réglages est dans `frontend/src/pages/client/ClientAccount.tsx` : `Card`, `SectionHead`, `Row` (hauteur 58 px, icône 32 px, libellé + indice, chevron), `Toggle`, `inputCls`. C'est le modèle de toute page de réglages.

## Accessibilité

- Navigation complète au clavier, ordre du document respecté
- `aria-label` sur tout bouton sans texte
- Contraste AA sur tout texte
- Pas de modale à l'ouverture d'une page : une carte en ligne, refermable, se lit dans l'ordre et ne piège pas le focus
- Les états d'erreur s'affichent. Un échec silencieux se lit comme un produit cassé.

## Iconographie (2026-08-05)

Le site et le produit utilisent **coolicons** (paquet `react-coolicons`, 442 icônes,
licence MIT), à la demande de l'utilisateur, partout : marketing, tableau de bord,
navigation, administration.

L'accès passe par une façade unique, `frontend/src/components/icons.tsx` :
- elle garde les NOMS et l'API de lucide (`size`, `className`, `strokeWidth`,
  `color`), donc aucun appel n'a changé, seul le chemin d'import a bougé ;
- elle documente, pour chaque icône, le glyphe coolicons retenu. Là où lucide
  avait un glyphe absent du set (éclair, cerveau, fiole, robot, micro), le choix
  s'est fait par le SENS de l'usage dans le produit, pas par le nom.

Le logo Qwillio n'est pas concerné : il reste `QwillioLogo` /
`public/qwillio-logo-512.svg`, avec les trois mauves de `DA/couleurs.md`.

Pour changer une correspondance : éditer `icons.tsx`, rien d'autre.
