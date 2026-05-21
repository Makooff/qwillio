# Qwillio — Claude Code Project Guide

## Project

**Qwillio** — Voice AI B2B platform. AI receptionist + agent. Inbound call handling, lead qualification, appointment booking. French + English.

**Stack**: React 19, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts, React Router v7, Zustand, Lucide icons.  
**Backend**: Node.js/Express on Render. Vercel for frontend.  
**Brand**: Indigo `oklch(56% 0.22 264)` + Violet `oklch(67% 0.26 299)`. Outfit font. Dark product, cream/white marketing.

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
