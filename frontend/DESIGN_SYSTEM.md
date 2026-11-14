# Qwillio — intégrer le design system dans le frontend

[Charte commune](../DESIGN.md) · [Fondations](src/design-system/tokens.json) · [Catalogue](../docs/design-system/index.html) · [Composants et états](../docs/design-system/COMPOSANTS.md)

## Choisir la surface réelle

| Surface | Composants et styles à réutiliser |
| --- | --- |
| Site V2 | `components/v2/Primitives.tsx`, `Button.tsx`, `CardV2.tsx`, `styles/v2.css` |
| Portail client monté | `pages/client/`, `components/layout/ClientLayout.tsx`, `DashboardShell.tsx`, `styles/admin-theme.ts`, `styles/design-system.ts` |
| Administration | Routeur `/admin`, composants existants et thèmes de la page ; éviter une nouvelle palette locale |
| Prototype client V2 | `pages/v2/app/`, non monté ; n’en déduire ni les fonctionnalités accessibles ni le design produit actuel |

`tokens.json` alimente Tailwind et les helpers TypeScript dans `src/design-system/tokens.ts`. Les styles publics spécifiques restent dans `v2.css`. Le portail utilise `t` et `ds` ; leurs rayons, couleurs de fond et espacements de commandes partagés dérivent désormais des fondations.

```tsx
import Button from '../components/ui/Button';
import { ds } from '../styles/design-system';
import { tokens, radiusPx } from '../design-system/tokens';

<div style={{ ...ds.surface, padding: tokens.space['6'] }}>
  <Button>Enregistrer</Button>
  <div style={{ borderRadius: radiusPx('overlay') }}>…</div>
</div>
```

Pour une classe Tailwind : `gap-4`, `p-6`, `rounded-qw-surface`, `rounded-qw-overlay`, `rounded-qw-pill`. Les anciennes classes standard compatibles peuvent rester en place ; migrer un écran avec son contrôle visuel, pas par remplacement global aveugle.

## Points d’attention

- Les commandes du dashboard sont en pilule ; les champs texte et les surfaces ont des rayons distincts. Respecter la portée de `[data-dashboard]` et ses exceptions structurelles.
- Le primaire produit est un contour mauve avec fond neutre ; le primaire public et les actions danger ont leurs propres variantes.
- `PillButton` et `ui/Button` ont des contrats différents. Ne pas mélanger les props ou prétendre qu’ils sont déjà fusionnés.
- Les contrôles produits existants sont compacts (30/36 px). Les cibles tactiles confortables doivent être vérifiées sur les écrans concernés ; la charte ne les applique pas rétroactivement.
- État sélectionné, nom accessible, focus, erreur, chargement, traduction et responsive font partie du composant.

## Maintenir la cohérence

Après une modification des tokens ou des routes : `npm run sync:reference` à la racine, puis relire les documents concernés. Vérifier avec `npm run check:reference`, le build frontend et les tests pertinents. Les nouveautés restent autorisées : étendre le token/composant avec sa justification et ses exemples.

[Écarts et migration progressive](../docs/design-system/MIGRATION.md)
