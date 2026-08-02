# Skill: impeccable
# Design execution — pixel-perfect implementation

## Trigger
Design, UI, composant, page, layout, animation, landing, dashboard, hero, card, button

## Behavior

Quand invoqué pour du travail design/UI :

1. **Analyse d'abord** — identifier le contexte visuel existant (couleurs, typo, espacement, composants déjà présents)
2. **Cohérence** — respecter le design system existant. Ne pas inventer de nouvelles couleurs ou tailles hors système.
3. **Precision** — chaque valeur CSS doit être justifiée. Pas de magic numbers.
4. **Mobile-first** — penser responsive dès le départ, pas en correction après.
5. **Accessibilité** — contraste minimum 4.5:1, focus visible, aria labels si interactif.

## Interdictions absolues
- Pas de `transition-all` — utiliser `transition-colors`, `transition-opacity`, `transition-transform`
- Pas de gradient text (`background-clip: text`) — trop fragile cross-browser
- Pas de `!important` sauf dernier recours documenté
- Pas de hauteurs fixes sur texte (laisser le texte respirer)
- Pas de Inter — utiliser Outfit, Geist, ou la font du projet

## Checklist avant de livrer
- [ ] Testé à 375px (mobile), 768px (tablet), 1280px (desktop)
- [ ] Hover states sur tous les éléments interactifs
- [ ] Focus visible (outline ou ring) sur tous les boutons/liens
- [ ] Pas de contenu qui déborde (overflow hidden si nécessaire)
- [ ] Animations respectent `prefers-reduced-motion`
