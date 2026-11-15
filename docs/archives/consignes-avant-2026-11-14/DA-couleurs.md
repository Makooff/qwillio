# Couleurs

## Les quatre couleurs du logo

Extraites de `frontend/public/qwillio-logo-512.svg`. Ce sont les seules couleurs de marque. Toute autre valeur est une erreur ou un état système (succès, alerte, erreur).

| Rôle | Hex | Usage |
|---|---|---|
| Blanc de marque | `#FDFDFF` | Fond des surfaces claires, lettrage dans les lobes, plaque de l'icône |
| Mauve profond | `#7349FE` | Recouvrement des deux lobes, ancrage, états pressés |
| Mauve primaire | `#7A5FFF` | **Couleur porteuse.** Cercle Q. Contexte voix, appel entrant, réceptionniste |
| Mauve clair | `#CD6BFB` | Accent secondaire. Cercle W. Contexte agent, modules, sortant |

La sémantique compte : **indigo pour ce qui décroche, violet pour ce qui part**. Elle vaut des deux côtés, site et dashboard.

### Attention à une faute qui traîne

Le code utilise `#cd6afb` à plus de 250 endroits alors que le logo dit `#CD6BFB`. Un chiffre d'écart, invisible à l'œil mais faux. À corriger lors du prochain passage sur ces fichiers, en alignant sur le logo.

## Équivalents OKLCH

Les tokens du produit sont en OKLCH dans `frontend/src/styles/globals.css`, parce que l'espace perceptuel garde les écarts de clarté cohérents entre teintes.

```css
--q-accent:  oklch(56% 0.22 264)   /* mauve primaire */
--q-violet:  oklch(67% 0.26 299)   /* mauve clair */
```

Les fichiers `CLAUDE.md`, `DESIGN.md` et `PRODUCT.md` ont longtemps documenté `#6366f1` et `#a855f7`. Ces valeurs sont périmées, elles ne correspondent pas au logo livré. C'est ce fichier qui fait foi.

## Surfaces produit

```css
--q-bg:      oklch(8% 0.009 265)    /* fond d'application */
--q-bg2:     oklch(11% 0.013 265)   /* carte, panneau */
--q-bg3:     oklch(15% 0.017 265)   /* survol, élévation */
--q-text:    oklch(95% 0.004 265)
--q-text-2:  oklch(65% 0.007 265)
--q-text-3:  oklch(42% 0.006 265)
```

Le noir n'est jamais pur : il est teinté vers l'indigo (chroma 0.009 sur la teinte 265). C'est ce qui empêche le dashboard de paraître gris et mort.

## États système

Ces couleurs ne sont pas de la marque, elles sont du signal. Elles ne se substituent jamais au mauve pour décorer.

```css
--q-ok:    oklch(72% 0.18 145)
--q-warn:  oklch(78% 0.18 75)
--q-bad:   oklch(65% 0.22 25)
```

## Répartition

**Registre marque, stratégie engagée.** Le mauve porte 30 à 60 % d'une surface donnée. Un hero, une citation, un bloc d'appel à l'action sont saturés de couleur, pas saupoudrés. Alterner indigo et violet dans le rythme de la page plutôt que de tout traiter en indigo.

**Registre produit, stratégie retenue.** L'accent occupe 10 % des pixels au maximum. Le reste est neutre teinté. Dans une interface qu'on regarde huit heures, la couleur sert à trouver, pas à décorer.

## Contraste

Tout texte doit passer AA (4,5:1 pour le corps, 3:1 pour les grandes tailles).

Le mauve primaire sur blanc passe pour du texte large et des éléments d'interface, mais **pas pour du corps de texte en petite taille**. Pour un paragraphe sur fond clair, utiliser `#1d1d1f`, et garder le mauve pour ce qui est cliquable ou mis en avant.

Sur fond sombre, `#b9a8ff` est la version éclaircie du mauve primaire, utilisée quand `#7A5FFF` manque de contraste.

## Pourquoi ce mauve échappe au cliché « IA violette »

Le reproche habituel vise le violet décoratif des SaaS IA : dégradé sur le titre, halo lumineux, taches floues en fond. Ici le mauve vient du logo, il a une raison d'être (les deux cercles Q et W), et il est employé **sans dégradé sur le texte, sans halo, sans blob**. C'est une identité, pas un effet.
