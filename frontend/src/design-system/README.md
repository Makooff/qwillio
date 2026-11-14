# Fondations Qwillio

[Charte](../../../DESIGN.md) · [Catalogue](../../../docs/design-system/index.html) · [Intégration frontend](../../DESIGN_SYSTEM.md)

- `tokens.json` : valeurs partagées lisibles par Tailwind et TypeScript.
- `tokens.ts` : accès typé `tokens` et helper `radiusPx`.
- Les thèmes clairs/sombres du site restent dans `../styles/v2.css`. Le portail utilise `admin-theme.ts` et la couche sémantique `design-system.ts`.

```tsx
import { tokens, radiusPx } from './tokens';

const style = {
  padding: tokens.space['6'], // 24 px ; les clés suivent les unités Tailwind
  borderRadius: radiusPx('surface'), // carte produit, 14 px
};
```

Les familles de valeurs ont des rôles distincts : identité, signaux, surfaces, espace, rayon, typographie, layout, contrôles, motion et couches. La charte distingue les valeurs observées, les conventions des nouveaux écrans et les parties qui restent à migrer.

Après une évolution : `npm run sync:reference` et `npm run sync:design` à la racine, puis relire les documents affectés et vérifier l’interface concernée. Les commandes `check:reference` et `check:design` contrôlent la synchronisation ; elles n’interdisent aucune nouvelle idée.
