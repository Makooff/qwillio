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

## Chantiers ouverts (dernière mise à jour : 2026-08-19)

À reprendre en priorité. Chaque point porte son diagnostic pour ne pas le refaire.
Les points réglés restent écrits, avec ce qui les a réglés : c'est ce qui évite
de les rediagnostiquer, et deux d'entre eux avaient déjà coûté ce détour.

### 1. Micro et audio (iOS)
- **L'autorisation micro : réglée le 19/08, et il faut savoir comment.** La
  sonde ne vit plus dans l'en-tête mais dans `VapiLiveCall`, parce que c'est ce
  composant qui possède le clic : sur Safari iOS, une demande de micro qui
  arrive après la fin du geste est refusée **en silence**, et il ne reste qu'un
  bouton qui tourne 25 secondes. Elle est donc la première chose attendue de
  `start()` (tout ce qui la précède est synchrone) et le flux est **tenu** pour
  la durée de l'appel, relâché dans `settle()` et au démontage. Les deux
  variantes ont été essayées : « laisser le SDK demander seul » ne tient pas sur
  iPhone, c'est la régression du 19/08.
- **Le diagramme d'aperçu : la note précédente décrivait l'inverse du code.**
  Ce n'est pas `playDecoded` qui est le chemin normal, c'est `playElement` : le
  chemin décodé n'est que le repli quand l'élément est bloqué. `observeElement`
  route donc déjà l'élément dans l'analyseur, sous deux gardes (contexte
  `running`, lecture confirmée à l'horloge). Reste une **course** : la reprise
  du contexte est lancée au clic sans être attendue (l'attendre ferait sortir la
  lecture du geste), et un seul essai à 700 ms la perdait sur un téléphone qui
  sort de veille. Trois essais espacés couvrent maintenant la fenêtre. Aucune
  sortie console d'iPhone n'est nécessaire, contrairement à ce qui était écrit.

### 2. Déplacer des champs vers Paramètres — FAIT, ne pas refaire
Langue, nom et type d'entreprise et les coordonnées vivent dans
`pages/client/ClientAccount.tsx`, et le payload de `ClientReceptionist` ne les
porte plus (voir le commentaire de son `autoSave`). Les trois étapes
indissociables ont bien été jouées dans l'ordre. Le piège reste vrai pour tout
champ qu'on déplacerait à l'avenir : le PUT backend est **partiel**
(`if (body.x !== undefined)`), donc une page qui poste encore sa copie périmée
écrase silencieusement ce que l'autre vient d'enregistrer. Retirer les clés du
payload **en même temps** que les inputs, jamais après.

### 3. Facturation : corrigé (ne pas re-diagnostiquer)
Cette entrée décrivait un aperçu de facturation vide. **Ce n'est plus vrai** : la
route renvoie un aperçu réel. Ce qui restait, et qui est corrigé le 11/08 : le lien
« PDF » de l'historique visait `/api/invoices/:id/pdf`, une route inexistante ; il
passe désormais par la facture hébergée chez Stripe.

### 4. Personnalisation, base de connaissances et FAQ
Aujourd'hui une zone de texte libre et des listes à plat : tout le travail retombe sur le client. Attendu : champs nommés, sous-catégories, et présets par niche. Les présets **existent déjà côté backend** sous une autre forme (prompts spécialisés par métier, scripts par verticale) : s'y brancher plutôt que créer une seconde liste de niches qui divergera.

### 5. Interruption : un arbitrage, pas un réglage définitif
`stopSpeakingPlan.numWords` valait 0, donc la seule activité vocale coupait la
réceptionniste : une porte ou une radio la faisaient taire (« elle arrête de
parler dès qu'elle entend un peu de bruit », 19/08). Elle attend maintenant
**deux mots transcrits**, ce qui trie le bruit de la parole au prix de 200 à
300 ms sur l'interruption volontaire. `VOICE_BARGE_IN_WORDS` règle le curseur
sans déploiement : 1 pour l'intermédiaire, 0 pour l'ancien comportement.

### 6. Divers
- Renommage de l'agent en ligne sur le carrousel : **fait** (icône crayon,
  `CharacterCarousel.tsx`).
- Géométrie de l'arc du carrousel en 390 px : le compteur ne domine plus, mais l'anneau entier n'a pas été vu à cette largeur.
- Le flou de la nav sur iOS est corrigé mais **ne peut être validé que sur un vrai iPhone**.
- Vidéo de fond du hero (`/hero-loop.mp4`) : absente, le hero s'en passe proprement.
- Région Render : Oregon. Le site ne promet plus d'hébergement UE ; soit basculer la région et rétablir la promesse, soit ne pas la réécrire.
- CRM : **corrigé**, les appels remplissent bien les contacts, et les pages sont reliées au menu. Seul le **pipeline** reste alimenté à la main (« Nouvelle affaire ») : rien ne crée d'affaire automatiquement, et c'est assumé tant qu'on ne sait pas à quelle condition un lead en mérite une.
- **RLS Postgres : toujours absente.** L'isolation entre clients est applicative,
  75 `req.clientId` posés à la main dans les WHERE. C'est le point qui tombe au
  premier questionnaire de sécurité d'un client entreprise.

### 7. Ce qui bloque la mesure, et donc trois décisions
`fleetMetrics` affiche toujours `calls: 0` : aucun appel entrant réel n'a été
passé. Tant que c'est le cas, la latence, le coût par minute et le prix de
l'option temps réel (`VOICE_REALTIME_SURCHARGE_EUR`, à 0) restent inconnus tous
les trois. La marche à suivre est écrite dans `docs/PROTOCOLE-TEST-MOTEURS.md`.

## Audit « prêt à vendre » du 11/08/2026

Trois lots livrés (PR #118). Ce qu'il faut en retenir pour ne pas défaire le travail :

- **Un numéro entrant appartient à UN client.** `services/voice/phone-allocation.service.ts`
  est le seul endroit qui attribue une ligne. Recopier `VAPI_PHONE_NUMBER` dans une
  fiche client rendrait de nouveau les deux clients injoignables.
- **`VAPI_WEBHOOK_SECRET` et `RESEND_API_KEY` refusent le démarrage en production.**
  Soupape : `ALLOW_DEGRADED_BOOT=1`.
- **Tout lien public écrit par le backend passe par `utils/urls.ts`.** `FRONTEND_URL`
  est une liste séparée par des virgules, et `/client-portal/:id` n'existe pas.
- **Plus aucune donnée inventée dans le portail.** La courbe de l'aperçu trace
  `dailyCalls`, et affiche un état vide plutôt qu'une progression écrite en dur.
- **Le site ne promet plus d'hébergement UE** (Render est en Oregon). Basculer la
  région rendrait la promesse ; d'ici là, ne pas la réécrire.
- **Compte de démonstration** : `npm run db:seed:demo` (refuse de tourner en
  production). C'est ce qui donne un tableau de bord peuplé pour une démonstration.

Toujours à faire, et qui ne dépend pas du code : publier l'app Google en Production,
acheter le numéro belge, passer deux appels de test (`realtime` et `classic`),
et cliquer une première fois sur le portail Stripe.
