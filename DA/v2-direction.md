# Qwillio — application de Papier & Signal au site V2

Révisé le 14 novembre 2026. La direction est conservée et uniformisée dans [DESIGN.md](../DESIGN.md), avec un rythme éditorial inspiré d’ElevenLabs et une précision d’interface inspirée de Codex.

## Ce qui pilote le site

- Routes montées : `frontend/src/App.tsx`.
- Tokens clairs/sombres et typographie : `frontend/src/styles/v2.css`.
- Classes de marque et fondations partagées : `frontend/tailwind.config.js`, `frontend/src/design-system/tokens.json`.
- Mise en page : `components/v2/Primitives.tsx` (`Container`, `Section`, `Display`, `H2`).
- Actions : `components/v2/Button.tsx` (`PillButton`, `PillLink`).
- Cartes : `components/v2/CardV2.tsx`.

Les références de couleur, spacing, radius et motion ne sont pas recopiées ici : lire la [charte](../DESIGN.md) et la [référence générée](../docs/REFERENCE-GENEREE.md).

## Ne pas confondre les surfaces

`pages/v2/app/` et `components/v2/app/` sont un prototype non monté par le routeur actuel. Ils ne constituent pas la référence du portail client. Celui-ci utilise `pages/client/` sous `ClientLayout` / `DashboardShell` ; lire [le guide d’intégration produit](../frontend/DESIGN_SYSTEM.md).

Les anciens textes sur CTA mauve plein, noir teinté ou ancien portail V2 sont archivés. Ils n’imposent pas une régression aux choix actuels. Une nouvelle idée de composition reste possible si elle est cohérente, utile et documentée.
