# Qwillio — Claude Code Project Guide

## Project

**Qwillio** — Voice AI B2B platform. AI receptionist + agent. Inbound call handling, lead qualification, appointment booking. French + English.

**Stack**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, GSAP (ScrollTrigger, DrawSVG), Recharts, React Router v7, Zustand.  
**Icons**: `components/icons.tsx`, a façade over **coolicons**. Import from there, never from `lucide-react` directly: the façade is what lets the whole icon set be swapped in one file.  
**Backend**: Node.js/Express on Render. Vercel for frontend. Prisma + Neon.  
**Brand**: Indigo `#7A5FFF` + Violet `#CD6BFB`. Outfit font.

---

## READ THIS FIRST — the site runs on the V2 design system

The marketing site and the client portal were rebuilt as **« Papier & Signal » (V2)**. The `--q-*` tokens further down this file are the **V1 product** palette: they are still used by admin and closer, and by nothing else. **Anything you touch on the site or the client dashboard uses the `q2` tokens.**

- Authority: **`DA/v2-direction.md`**, plus `DA/references/{elevenlabs,linear,calendly}.md` which are where each token's value comes from.
- Marketing pages: `frontend/src/pages/v2/*`, chrome in `components/v2/` (`PublicShell` → `NavV2` + `FooterV2`).
- Client portal: `pages/client/*` under `components/layout/ClientLayout` (V1 pages kept on purpose, the owner prefers them). `pages/v2/app/*` exists but is **not routed**.
- Auth: `pages/v2/auth/*` on `AuthShell`, which mounts the full site nav plus a « Retour » link.

### q2 tokens (`frontend/src/styles/v2.css` + `tailwind.config.js`)

The **seven surface/text tokens are CSS variables written as RGB channels**, so the site can switch to dark from one place while keeping Tailwind opacity modifiers (`border-q2-plate/70`):

| Token | Light | Dark |
|---|---|---|
| `q2-canvas` | `#FDFCFC` | `#0E0F11` |
| `q2-band` | `#F5F3F1` | `#131417` |
| `q2-plate` | `#EBE8E4` | `#232529` |
| `q2-ink` | `#1D1D1F` | `#F5F4F2` |
| `q2-graphite` | `#44403B` | `#C9C6C1` |
| `q2-body` | `#777169` | `#98948E` |
| `q2-faint` | `#A59F97` | `#6B6862` |

**Do NOT flip with the theme** (same value in both): the brand mauve (`q2-indigo`, `q2-violet`, `q2-deep`, `q2-lift`) and the drenched register (`q2-void #08090A`, `q2-carbon`, `q2-obsidian`). Drenched sections are dark in *both* themes: that is their job in the narrative.

Two traps the dark theme sets, both already fixed once:
- **`bg-q2-ink text-white` becomes white on white.** Ink is light in dark mode. Use `text-q2-canvas`, which is correct both ways.
- **A literal cream (`#fdfcfc`) in a gradient repaints the page light** over the switched canvas. Any veil or section gradient must use `rgb(var(--q2-canvas))`.

Theme state: `stores/themeStore.ts`, three values (`light` / `dark` / `system`, default system). In system mode the `data-theme` attribute is *removed* and the media query decides, so a live OS switch follows. `bootTheme()` runs in `main.tsx` before first render to avoid a white flash.

### Motion, V2

`components/v2/motion/`. Everything scroll-driven reads **one** rule, `sceneProgress.ts`, so the counter and the travelling frame can never disagree:
- `PinnedScene` — pinned title left, steps right; the current step is `data-active` on its `<li>`, styled by the page via `group-data-[active=true]:`.
- `StepFrame` + `frameJourney` — the rounded frame that shrinks through its leading corner and grows into the next card. Catmull-Rom written as beziers, same principle as the blob loader. **The frame's `scope` ref belongs to the parent, and React attaches it *after* the child's layout effect**: measure on the next frame or it renders `null` forever.
- `IntegrationsOrbit` — a repeating dash pattern whose period divides `pathLength=100`, so the current never stops and the loop is invisible.

### Bans that still hold in V2
No gradient text, no `transition-all`, no identical card grids, no glassmorphism except the two documented exceptions (nav chrome, OS illustration), no em dashes, Outfit only.

---

## Skill Routing — Auto-Invoke Rules

### Design tasks (UI, pages, components, redesign)
ALWAYS invoke ALL THREE design skills before doing any design work:
```
Skill(impeccable)
Skill(taste-skill)  
Skill(emil-design-eng)
```
Triggers: "design", "page", "composant", "component", "UI", "landing", "dashboard", "redesign", "style", "layout", "couleur", "animation"

### Code review
Use `Skill(code-review)` (plugin). Do NOT use `requesting-code-review` or `plankton-code-quality`.  
Trigger: after writing/modifying any code, before commits.

### Testing / TDD
Use `Skill(tdd-workflow)`. Do NOT use `test-driven-development` or `test` (duplicates).  
Trigger: new feature, bug fix, "test", "tdd".

### Verification / QA
Use `Skill(verify)`. Do NOT use `verification-before-completion` or `verification-loop` (duplicates).  
Trigger: "verif", "check", "qa", before deploy.

### Debugging
Use `Skill(systematic-debugging)`. Supplements with `Skill(fix)` for quick fixes.  
Trigger: error, crash, bug, "debug".

### Security
Use `Skill(security)`.  
Trigger: auth, token, password, API key, user input, payments.

### Memory / codebase knowledge
Use `Skill(claude-mem:mem-search)` to recall prior context.  
Use `Skill(claude-mem:learn-codebase)` when onboarding a new session.

### Planning
Use `Skill(writing-plans)` → then `Skill(executing-plans)`.  
Trigger: "plan", "architecture", "feature", complex multi-file work.

### Deduplication — NEVER use these (replaced by better alternatives)
| Deprecated skill | Use instead |
|---|---|
| `test-driven-development` | `tdd-workflow` |
| `test` | `tdd-workflow` |
| `verification-before-completion` | `verify` |
| `verification-loop` | `verify` |
| `ui-styling` | `impeccable` + `taste-skill` |
| `ui-ux-pro-max` | `impeccable` + `taste-skill` |
| `design` | `impeccable` |
| `design-system` | `impeccable` |
| `brand` | See PRODUCT.md + DESIGN.md |
| `frontend-design` | `impeccable` + `taste-skill` |
| `plankton-code-quality` | `code-review` |
| `requesting-code-review` | `code-review` |
| `continuous-learning` | `continuous-learning-v2` |

## Design System — Quick Reference

### Color tokens (globals.css)
```css
--q-bg:         oklch(8% 0.009 265)   /* app background */
--q-bg2:        oklch(11% 0.013 265)
--q-bg3:        oklch(15% 0.017 265)
--q-panel:      oklch(11% 0.013 265)
--q-accent:     oklch(56% 0.22 264)   /* indigo primary */
--q-accent-hi:  oklch(63% 0.21 264)
--q-violet:     oklch(67% 0.26 299)   /* violet secondary */
--q-text:       oklch(95% 0.004 265)
--q-text-2:     oklch(65% 0.007 265)
--q-text-3:     oklch(42% 0.006 265)
--q-ok:         oklch(72% 0.18 145)
--q-warn:       oklch(78% 0.18 75)
--q-bad:        oklch(65% 0.22 25)
```

### Motion (emil-design-eng)
```css
--ease-out:      cubic-bezier(0.23, 1, 0.32, 1)
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)
--ease-in-out:   cubic-bezier(0.77, 0, 0.175, 1)
--ease-drawer:   cubic-bezier(0.32, 0.72, 0, 1)
```
Press feedback: `scale(0.97)` on `:active`. Stagger: 30–80ms.

### Absolute bans (impeccable)
- No gradient text (`background-clip: text`)
- No side-stripe borders (`border-left` > 1px as accent)
- No hero-metric template (big number, small label grid)
- No identical card grids (same size, same icon+heading+text)
- No glassmorphism as default
- No modal as first solution
- No `transition-all` (use `transition-colors`, `transition-opacity`, etc.)
- No Inter font (use Outfit)
- No em dashes (use comma, colon, parentheses)

### Registers
- **Brand** (marketing pages: Home, Landing, Pricing, Agent, About, Blog, Contact, Affiliate): cream/white + drenched accents, Committed color strategy
- **Product** (dashboard, admin, client pages): dark indigo-tinted, Restrained color strategy

## File Structure

```
frontend/src/
├── pages/           # Route pages
│   ├── admin/       # Admin panel pages
│   ├── client/      # Client portal pages
│   ├── closer/      # Closer session
│   └── legal/       # Legal pages
├── components/
│   ├── ui/          # Reusable UI primitives
│   ├── layout/      # Shell layouts
│   ├── client/      # Client-specific components
│   └── pro/         # ProBlocks design system
├── styles/
│   ├── globals.css  # Tokens + utilities
│   ├── admin-theme.ts
│   └── pro-theme.ts
└── lib/             # Utilities
```

## Memoire Obsidian — Regles obligatoires

Le vault Obsidian (`C:\Users\matpo\Documents\Spram\Spram\Qwillio\`) est LA source de verite pour la memoire du projet.

### Quand ecrire dans Obsidian

Apres chaque action significative, ecrire via:
```powershell
node --no-warnings "C:/Users/matpo/.claude/scripts/obsidian.js" append "Qwillio/Sessions/YYYY-MM-DD.md" "## HH:MM — [action]\n[details]"
```

**Actions qui declenchent une ecriture obligatoire:**
- Nouveau fichier cree ou refactoring majeur → `Sessions/`
- Decision architecturale ou de design → `04 - Decisions.md`
- Tache completee → cocher dans `Taches.md` (PUT complet)
- Bug important corrige → `Sessions/` + description
- Nouvelle page ou composant → `03 - Pages.md`

### Commandes disponibles
```powershell
# Lire une note
node --no-warnings "C:/Users/matpo/.claude/scripts/obsidian.js" read "Qwillio/Taches.md"

# Ajouter a une note (append)
node --no-warnings "C:/Users/matpo/.claude/scripts/obsidian.js" append "Qwillio/Sessions/2026-05-18.md" "## 14:30 — Fix bug auth\nDescription"

# Ecrire une note complete (overwrite)
node --no-warnings "C:/Users/matpo/.claire/scripts/obsidian.js" write "Qwillio/Taches.md" "# Taches\n..."

# Lister un dossier
node --no-warnings "C:/Users/matpo/.claude/scripts/obsidian.js" list "Qwillio/"
```

### Contexte auto-injecte
Au debut de chaque session, Claude recoit automatiquement:
- Les taches ouvertes de `Taches.md`
- Les notes de la session du jour (ou les dernieres decisions)
→ Claude connait exactement l'etat du projet sans que l'utilisateur reexplique.

## Commit Convention
```
feat: description
fix: description
refactor: description
```
No Co-Authored-By attribution (disabled globally).

## Key URLs
- Production: https://qwillio.com
- API: https://qwillio.onrender.com/api
- Vercel project: qwillio.v2

---

## Chantiers ouverts (dernière mise à jour : 2026-08-06)

À reprendre en priorité. Chaque point porte son diagnostic pour ne pas le refaire.

### 1. Micro et audio (iOS) — le plus gênant
- **L'autorisation micro ne persiste pas.** `VapiLiveCall.tsx` demande le micro puis coupe aussitôt les pistes (`getTracks().forEach(t => t.stop())`). Le commentaire affirme que l'autorisation survit à la page : vrai sur Chrome, **faux sur iOS Safari**, qui la relâche avec la piste. D'où une invite à chaque fois, et l'erreur « Micro indisponible » quand la sonde et le SDK se disputent le périphérique. Correctif : garder le flux ouvert pour la session, ou supprimer la sonde et laisser le SDK demander.
- **Le diagramme ne réagit pas à l'audio.** `useVoicePreview` a deux chemins : `playDecoded` (Web Audio, avec analyseur) et `playElement` (un `<audio>` nu, **sans** analyseur), ce dernier servant de repli quand Web Audio échoue. Instrumenter le repli reviendrait à faire repasser un son qui marche par le sous-système qui vient de tomber. La vraie cause est l'échec du chemin Web Audio ; il faut la sortie console d'un aperçu depuis un iPhone.
- Même racine probable pour les aperçus de voix qui « ne fonctionnent pas » sur Réceptionniste et Home.

### 2. Déplacer des champs vers Paramètres — trois étapes INDISSOCIABLES
Langue, nom et type d'entreprise, et la section Coordonnées doivent quitter Réceptionniste pour Paramètres.
Le PUT backend est **partiel** (`if (body.x !== undefined)`), donc Paramètres peut n'envoyer que ses champs. Mais :
1. poser d'abord les champs dans Paramètres (sinon ils deviennent inéditables) ;
2. retirer les clés correspondantes du payload de Réceptionniste **en même temps** que ses inputs, sinon son autosave réécrit par-dessus avec sa copie périmée ;
3. ne jamais faire 2 sans 1 : le symptôme n'est pas visuel, c'est une perte de données silencieuse.

### 3. Facturation : des valeurs de repli affichées comme réelles
`ClientBilling` alimente `overview` avec `api.get('/my-dashboard/billing')`, mais cette route renvoie **un tableau de paiements**, pas un aperçu. Donc `overview.plan`, `overview.minutesUsed`, `overview.isTrial` sont `undefined` de longue date : le plan et la jauge de minutes affichés ne reflètent pas le client. La page tient grâce à ses valeurs par défaut.

### 4. Personnalisation, base de connaissances et FAQ
Aujourd'hui une zone de texte libre et des listes à plat : tout le travail retombe sur le client. Attendu : champs nommés, sous-catégories, et présets par niche. Les présets **existent déjà côté backend** sous une autre forme (prompts spécialisés par métier, scripts par verticale) : s'y brancher plutôt que créer une seconde liste de niches qui divergera.

### 5. Divers
- Renommage du nom de l'agent en ligne sur le carrousel (icône crayon à côté du nom).
- Géométrie de l'arc du carrousel en 390 px : le compteur ne domine plus, mais l'anneau entier n'a pas été vu à cette largeur.
- Le flou de la nav sur iOS est corrigé mais **ne peut être validé que sur un vrai iPhone**.
- Vidéo de fond du hero (`/hero-loop.mp4`) : absente, le hero s'en passe proprement.
- Région Render : Oregon. Soit la basculer en UE, soit retirer la mention « Hébergement UE » du site.
- CRM et pipeline : backend réel et cloisonné par client, mais **aucun lien dans le menu** et **rien ne les remplit** (aucun appel ni lead ne crée de contact). Les redessiner ne sert à rien avant de les relier.
