# Typographie

## La fonte

**Outfit**, graisses 300 à 800, chargée depuis Google Fonts dans `frontend/index.html` et déclarée dans `frontend/src/styles/globals.css`.

```css
font-family: 'Outfit', system-ui, -apple-system, sans-serif;
```

**Inter est banni.** C'est la fonte par défaut de tout le SaaS ; l'utiliser revient à ne pas choisir. Outfit a des formes plus géométriques et un peu plus de caractère aux grandes tailles, ce qui tient les titres éditoriaux du registre marque.

Une seule exception : le **serif italique du système**, utilisé pour mettre en valeur **un seul mot** dans un titre, en couleur pleine. Jamais deux mots dans la même phrase, jamais sur un paragraphe.

## Échelle

Les titres du registre marque sont fluides, pour tenir du téléphone au grand écran sans palier visible.

| Rôle | Taille | Graisse | Tracking |
|---|---|---|---|
| Hero (H1) | `clamp(2.6rem, 6.5vw, 5.6rem)` | 600 | `-0.04em` |
| Titre de section (H2) | `clamp(2rem, 4.5vw, 3.6rem)` | 600 | `-0.035em` |
| Titre de carte (H3) | `clamp(1.7rem, 4vw, 3rem)` | 600 | `-0.03em` |
| Prix | `clamp(2.2rem, 3.2vw, 3rem)` | 600 | `-0.04em`, `tabular-nums` |
| Corps large | 18 à 20 px | 400 | normal |
| Corps | 15 à 16 px | 400 | normal |
| Étiquette | 11 px | 600 | `0.18em`, majuscules |

Registre produit, plus resserré : titre de page 17 px, titre de section 13 px, corps 13 px, méta 11,5 px. La densité est volontaire, on lit des données.

## Règles

**Le tracking négatif sur les titres n'est pas optionnel.** Outfit à 5 rem sans `-0.04em` paraît lâche. Plus le titre est grand, plus le tracking se resserre.

**L'interligne des titres descend sous 1.** `leading-[0.95]` sur un hero, `leading-[1.08]` sur un H2. Le corps reste à 1.5 ou plus.

**Les chiffres alignés partout où ils changent.** `tabular-nums` sur les prix, les compteurs, les quotas, les durées. Sans ça, une valeur qui se met à jour fait sauter la mise en page.

**Une largeur de ligne lisible.** 60 à 75 caractères pour un paragraphe, ce qui donne `max-w-[460px]` à `max-w-[560px]` selon la taille. Un paragraphe pleine largeur sur un écran large ne se lit pas.

## Accents

Le français s'écrit avec ses accents, y compris sur les majuscules et dans les fichiers de documentation : é, è, à, ç, ô, É. Un texte français sans accents se lit comme une faute, et sur une page de vente ça coûte de la crédibilité.

## Ponctuation

**Pas de tiret cadratin.** Virgule, deux-points ou parenthèses selon le cas. Cette règle vaut aussi dans les commentaires de code.

Espaces insécables devant les deux-points, points-virgules, points d'interrogation et d'exclamation en français, et entre un nombre et son unité (`99 €`, `250 min`).
