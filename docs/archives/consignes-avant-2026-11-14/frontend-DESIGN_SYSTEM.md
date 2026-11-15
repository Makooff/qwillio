# Qwillio Design System — Portail client (routed)

Canonical usage guide for the **real routed client portal** (`src/pages/client/*`,
`DashboardShell`, settings aesthetic). It is a thin **semantic layer over the
existing tokens** — not a new theme, not a separate library.

## Decisions utilisateur (2026-10) — ARRONDI et MARQUE

Deux demandes explicites de l'utilisateur, applicables au **site public V2 et
au vrai portail** (pas de variante mobile seulement):

1. **« Tout les bouton et menu deroulant etc: le meme arrondi que le bouton se
   connecter sur home »** — la référence est la pilule `rounded-full` (9999px)
   du bouton Connexion du menu mobile (NavV2) et des `PillLink` publics.
   - Toute **commande** (bouton, select/déclencheur de menu déroulant, champ
     de recherche) prend la gélule, dans les deux registres.
   - Les **surfaces** (cartes, panneaux de menu déroulant ouverts, dialogues)
     gardent un arrondi plafonné (`t.r` 14px, `ds.surfaceFloat` 16px): on ne
     transforme pas un grand panneau en ellipse.
   - Point d'application: `t.rFull` (token), la règle `[data-dashboard]`
     (globals.css), `cx.btnPrimary/btnGhost/btnIcon` (admin-theme),
     `ds.btnBase` (design-system), `.btn-*` (globals.css), `v2/Button.tsx`
     (`rounded-full` déjà), et les boutons locaux des pages migrés en
     `rounded-full`. `data-radius="keep"` reste la porte de sortie pour les
     lignes pleine largeur qui ne doivent pas devenir des pilules de 800px.
   - Ne pas arrondir en gélule: checkbox/radio/switch (déjà corrects),
     icônes circulaires déjà rondes, surfaces.

2. **« J'aime pas les fonds de couleur mauves… juste contour en mauve »** —
   plus de **remplissage mauve** sur les boutons d'action, états actifs et
   options sélectionnées. Règle: **fond neutre/transparent + contour mauve**,
   y compris au survol (aucun remplissage mauve en hover).
   - `ds.btnPrimary`: `background: transparent`, `border: 1px solid t.brandHi`,
     `color: t.brandHi`. Le hover (`ds.btnPrimaryHover`) est un lavage neutre
     (`hoverWash`), jamais du mauve.
   - Contraste mesuré: `#8a6fff` (brandHi) ≈ 5,4:1 sur `#0a0a0a` (AA 13px);
     `#7349fe` (brand) ≈ 3,9:1 — sous le seuil, donc brandHi pour le texte.
   - Site public: variante `chromatic` de `v2/Button.tsx` passée en outline
     (`border-q2-indigo`, texte `q2-ink`), hover neutre `bg-q2-band`.
     `TryVoiceButton` chromatic suit (surface canvas + bord mauve).
   - États sélectionnés: toggle mensuel/annuel de `ClientBilling` (lavage
     neutre + contour interne mauve, `aria-pressed` conservé), puces de
     filtre et tuiles catégorie de `ClientSupport` (outline + `aria-pressed`
     ajoutés), boutons d'upgrade des cartes plans (outline, hover CSS pur —
     l'état JS `hoveredPlan` a été supprimé).
   - **Inchangés**: danger rouge (`btnDanger` plein), succès vert, pastille
     ACTUEL verte, badges de statut (`badgeStyle`, lavés 12% = langue des
     statuts), illustrations/images mauves, liserés/glows (`.q2-pill-lit`,
     `q2-lit` — halos, pas des fonds).
   - Reste à migrer (fonds mauves): pages V1 hors scope
     (`pages/Login`, `Register`, `Onboarding`, `ConfirmEmail`, le portail
     jeton `/portal` et ses pages à thème clair autonome), les écrans
     `pages/client/Agent{Email,Inventory,Accounting,Payments}` legacy non
     routés (le CRM agent routé est `AgentCrm`). Audit secondaire routé
     effectué (2026-10): les contrôles des pages admin routées
     (`admin/{Calls,Leads,Billing,Settings,VoiceLab,Lignes,Agents,Agency,
     agents/*}`) et du portail secondaire (`ClientReceptionist`,
     `ClientIntegrations`, `ClientAnalytics`, `CrmDeals`, `CrmActivities`,
     `CrmContactDetail`) sont passés en contour mauve + fond neutre, avec
     `aria-pressed` sur les toggles. Garde régressive:
     `src/pages/client/PortalControlStyling.audit.test.ts`.

- Token source of truth: `src/styles/admin-theme.ts` (`t`, "Signal Dark v3",
  indigo `#7349fe` on `#0a0a0a`).
- Semantic layer: `src/styles/design-system.ts` (`ds` + named exports).
- Reusable primitives: `src/components/ui/Button.tsx` (+ existing
  `components/settings/SettingsUI.tsx` for forms).

## Principles (matches overview sidebar + settings look)

1. **Flat, restrained.** No gradients, no glow, no ambient decoration. Depth
   comes from hairline borders (`t.border` / `t.borderHi`) and the two subtle
   shadows (`t.shadow`, `t.shadowFloat`).
2. **Indigo means action.** Brand `#7349fe` only on the primary button and the
   active nav item. Never as background wash, never for destructive actions.
3. **Danger is red** (`t.danger`), confirm-primary when the dialog is
   destructive. One `primary` button per view.
4. **Surfaces**: app bg `#0a0a0a`, panel `#0a0a0a`, sidebar/elevated `#111`,
   hover `#1a1a1a`. Text: `t.text` / `t.textSec` / `t.textTer`.

## When to use what

| Need | Use |
|---|---|
| Content card | `ds.surface` |
| Raised/popover | `ds.surfaceRaised` |
| Input well | `ds.surfaceInset` |
| Dialog/menu | `ds.surfaceFloat` |
| Primary action | `<Button>` (default) or `ds.btnPrimary` |
| Destructive confirm | `<Button variant="danger">` / `ds.btnDanger` |
| Secondary/cancel | `<Button variant="ghost">` / `ds.btnGhost` |
| Toolbar action | `<Button variant="subtle" size="sm">` |
| Text/select field | `ds.inputCls` / `ds.selectCls` + `ds.labelCls` |
| Status pill | `badgeStyle(tone)` from `design-system` |
| Focus ring | `ds.focusRing` |

```tsx
import Button from '../components/ui/Button';
import { ds } from '../styles/design-system';
import { badgeStyle } from '../styles/design-system';

<Button onClick={save} loading={saving}>Sauvegarder</Button>
<Button variant="ghost" onClick={close}>Annuler</Button>
<Button variant="danger" onClick={remove}>Supprimer</Button>

<span style={badgeStyle('success')}>Actif</span>
<div style={ds.surface}>…</div>
```

## Tones

`brand` (indigo — active/new/in-progress), `violet` (contacted/qualified),
`success`, `warning`, `danger`, `info`, `neutral` (fallback: grey wash, not
colored). See `statusTones` in `components/client-dashboard/StatusBadge.tsx`.

## Migrated components (this pass)

- `components/ui/Button.tsx` — new canonical button (variants, sizes, loading).
- `components/client-dashboard/EmptyState.tsx` — tokens + Button; consumers:
  ClientCalls, ClientLeads, CrmActivities.
- `components/client-dashboard/ConfirmDialog.tsx` — token-styled actions
  (portal version, a11y behavior preserved); consumer: ClientBookings.
- `components/ui/ConfirmDialog.tsx` — same token buttons; consumers:
  AdminSettings, Campaigns.
- `components/client-dashboard/StatusBadge.tsx` — semantic tones via
  `badgeStyle` (no current consumers, kept coherent).
- `components/client-dashboard/KpiCard.tsx` — migrated off light-theme hex
  leftovers to dark tokens (no current consumers).
- `pages/client/ClientBilling.tsx` — buttons, status pills and surfaces now
  derive from `Button` / `badgeStyle` / `t` (`admin-theme`). The plan-card
  outline-brand action keeps its page-specific hover (transparent → indigo)
  expressed with tokens rather than a canonical variant, which has no
  outline. `pages/client/ClientAccount.tsx` (the routed settings screen)
  keeps its own internally consistent local theme — deliberately not
  rewritten.

## Accessibilité des composants partagés (audit 2026-10)

Garanties vérifiées par tests (jsdom) sur les composants partagés — ne pas
les régresser sans mettre à jour les tests :

- **Boutons (`ui/Button`)** — gélule (pill) partout, fond neutre + contour
  mauve (`btnPrimary`), anneau de focus `:focus-visible` (`ds.focusRing`),
  plancher de cible `minHeight` 36 px (md) / 30 px (sm), icône décorative
  `aria-hidden`, `aria-busy` + `disabled` pendant `loading`, libellés longs
  autorisés à refluer (`flex-wrap` + `max-width: 100%` dans `btnBase`).
- **Dialogues (`ui/ConfirmDialog`, `client-dashboard/ConfirmDialog`)** —
  `role="dialog" aria-modal`, titre + description reliés, focus initial sur
  l'action non destructive, boucle Tab, Échap = annuler, focus restitué au
  déclencheur, verrouillage du défilement préservé. En chargement le nom du
  bouton confirm reste son libellé (`aria-busy`, `aria-label` épingle le nom) —
  ne jamais le remplacer par « ... ». Anneaux de focus visibles sur toutes
  les actions, y compris la croix « Fermer ».
- **`client-dashboard/SlideOver`** — mêmes garanties clavier ; la croix du
  panneau porte `focus-visible:ring-2`.
- **Contrôles de formulaire partagés** — `ds.inputCls` / `ds.selectCls`
  ajoutent un anneau `focus-visible` à la bordure de focus existante ;
  `SettingsUI` (TagInput ×/Ajouter, ConfigSection) et `LangToggle` (cibles
  ≥ 28 px, `aria-pressed`) suivent le même réflexe anneau de focus.
- **Reflux 200 %** — les deux dialogues plafonnent à `100dvh - 32px` avec
  défilement interne, boutons en `flex-wrap` ; SlideOver est `w-full
  max-w-md`.

## Tests

```
npx vitest run src/components/ui/Button.test.tsx \
  src/components/client-dashboard/EmptyState.test.tsx \
  src/components/client-dashboard/StatusBadge.test.tsx \
  src/components/client-dashboard/ConfirmDialog.test.tsx \
  src/pages/client/ClientBilling.test.tsx
npx tsc -p tsconfig.json --noEmit
```

## Not covered (deliberate)

- Pages are not rewritten wholesale; migrate them incrementally as they are
  touched. `components/settings/SettingsUI.tsx` predates `ds` and still works —
  new form fields should prefer `ds.inputCls` (identical styling, single source).
- `src/styles/pro-theme.ts` and the v2 marketing site have their own tokens;
  this system targets the dark portal only.
- Do not re-introduce gradient/glow tokens (`accentGlow`, `violetGlow`) in
  portal UI — they belong to the marketing theme.
