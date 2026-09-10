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

### 4. Personnalisation, base de connaissances et FAQ — FAIT, ne pas refaire
Cette entrée décrivait « une zone de texte libre et des listes à plat ». **Ce
n'est plus vrai.** `config/knowledge-presets.ts` porte, par `NicheId` : les
sous-catégories de la liste de services (`itemCategories`), les **champs
nommés** du métier (`fields`, avec libellé français et exemple rempli) et une
FAQ à ajouter en un geste. `ClientReceptionist.tsx` rend les trois, et les
identifiants de champ sont **partagés entre métiers** quand ils désignent la
même chose (`cancellationPolicy`, `parkingAccess`…), pour que les réponses
restent comparables d'un client à l'autre.

**Le piège, corrigé le 10/09, et qui vaut pour toute donnée client :** il y a
DEUX magasins de connaissance et DEUX constructeurs de prompt. Les champs
nommés vivent dans `vapiConfig.knowledge`, la FAQ ligne à ligne dans la table
`businessKnowledge`. Le prompt de l'assistant ENREGISTRÉ lisait les deux ; celui
du chemin temps réel / custom-LLM ne lisait que le second. Un client remplissait
« Mutuelles acceptées », l'écran disait enregistré, et l'agent répondait qu'il
ne savait pas — sur ce chemin-là seulement, sans rien pour le signaler.
`knowledgeFieldsBlock()` est désormais la seule source, appelée par les deux, et
`ClientVoiceProfile.knowledgeFields` est **obligatoire** : c'est ce qui a fait
sortir les trois autres constructeurs de profil au compilateur. Les champs
nommés passent **avant** la FAQ dans le bloc, parce que celui-ci est tronqué à
4 000 caractères et qu'une FAQ bavarde les pousserait dehors en silence.

### 5. Interruption : un arbitrage, pas un réglage définitif
`stopSpeakingPlan.numWords` valait 0, donc la seule activité vocale coupait la
réceptionniste : une porte ou une radio la faisaient taire (« elle arrête de
parler dès qu'elle entend un peu de bruit », 19/08). Elle attend maintenant
**deux mots transcrits**, ce qui trie le bruit de la parole au prix de 200 à
300 ms sur l'interruption volontaire. `VOICE_BARGE_IN_WORDS` règle le curseur
sans déploiement : 1 pour l'intermédiaire, 0 pour l'ancien comportement.

### 6bis. L'accueil pré-enregistré suit la voix de l'appel (09/09/2026)
Une ligne de `greeting_audio` porte la voix qui l'a dite (`provider`, `voice_id`,
`tts_model`), calculée par `buildVoice` — la même fonction que l'assistant. La
LECTURE compare et écarte ce qui ne correspond pas. C'est ce qui manquait : le
garde-fou d'avant était posé à la génération, donc la bascule vers Cartesia a
éteint l'enregistrement pour tout le monde **tout en continuant à servir** les
accueils dits par ElevenLabs, une voix accueillant et une autre répondant.
Conséquence pratique : après un changement de voix de flotte, lancer
`npm run voice:greetings` (simulation) puis `--confirm`, sinon l'optimisation
reste éteinte jusqu'à ce qu'un réglage client bouge.

### 6ter. Le numéro que l'appelant dicte (09/09/2026)
Trois fichiers, une seule chaîne : `utils/spoken-numbers.ts` lit « septante-cinq »
et « nonante-et-un » (0 à 100 testé dans les deux variantes), `utils/phone-spoken.ts`
valide avec **libphonenumber-js/max** (la métadonnée complète : la réduite valide
sur la longueur seule et accepte `045123456`), et `captureLead` porte enfin un
champ `phone`. Avant, aucun numéro dicté n'était capté nulle part.
Deux pièges qui reviendront : 60 et 80 absorbent une dizaine (« soixante-douze »),
70 et 90 non, sinon on fabrique un nombre que personne n'a dit ; et
`0475 12 34 56` est un mobile belge ET un fixe français du Sud-Est, tranché par
le pays de la ligne appelante, jamais par le numéro seul.

### 6septies. Le clavier est le seul canal sans erreur, et il s'arme d'avance (09/09/2026)
Au **deuxième** numéro dicté illisible, l'agent ne fait plus redicter : il demande
la saisie au clavier, terminée par dièse. Redemander une troisième dictée refait
ce qui vient de rater deux fois, la cause (accent, ligne, chiffres collés) ne
bougeant pas entre deux essais.
Deux choses à ne pas défaire. Le plan `keypadInputPlan` est armé sur **tous** les
appels et pas seulement après un échec : il se déclare à la construction de
l'assistant, et l'assistant ne se reconstruit pas en cours d'appel. Et
`delimiters` est un **tableau** (`['#']`), et c'est l'API vivante qui l'a dit, pas
la doc : la référence écrite donne `"#"` aux trois endroits où elle décrit le
plan, cette lecture a été suivie, et le premier POST réel a répondu
« keypadInputPlan.delimiters must be an array » sur les **six** variantes. Ne pas
le repasser en chaîne sur la foi de la documentation : relancer
`npm run voice:validate`, seule chose qui interroge l'API.
Ce que ça change à la réception : Vapi remonte les touches comme un message
utilisateur fait de chiffres propres, au lieu de laisser le STT transcrire les
tonalités en charabia. Elles apparaissent donc au transcript, proprement — ce
n'est pas « absent du transcript » comme l'écrivait REL-8, mais c'est le contraire
du bug visé.

### 6octies. `npm run voice:validate` avant tout déploiement qui touche l'assistant (09/09/2026)
Un champ inconnu ne dégrade pas un appel : il fait refuser l'assistant **entier**,
et tous les appels de la flotte tombent d'un coup. C'est arrivé deux fois
(`backchannelPlan`, `voice.chunkPlan.punctuationBoundaries`), et la seule trace
est un 400 de Vapi que personne ne lit, puisque le code a l'air correct.
`vapi-schema.test.ts` fige les leçons déjà payées ; il ne peut pas prédire la
prochaine, il ne parle pas à Vapi. Le script, si : il POSTe un assistant jetable
pour les **six** variantes (trois langues × deux moteurs, dont les plans
diffèrent) et le supprime. Un 400 ne crée rien, Vapi validant avant d'écrire.
Le premier passage réel, le 09/09 au soir, a refusé les six variantes pour
**deux** raisons, dont aucune n'était devinable en lisant le code :
`keypadInputPlan.delimiters` veut un tableau (voir 6septies), et **le nom d'un
assistant ne peut pas dépasser 40 caractères**. Le nom, justement, était le seul
champ que personne ne surveillait : la production le compose en
`Receptionist - <nom commercial>`, donc n'importe quelle entreprise au nom un peu
long (« Boulangerie Saint-Michel Uccle », 45 caractères avec le préfixe) n'aurait
jamais eu d'assistant du tout. `services/voice/vapi-limits.ts` coupe désormais
l'entreprise plutôt que l'agent, et `config/vapi.ts` repose la borne sur le
passage obligé, pour que le prochain appelant qui composera un nom ne retombe pas
dans le même mur.
Le second passage, une fois ces deux-là corrigés, a **accepté les six
variantes**. Les autres champs du 09/09 (`firstMessageInterruptionsEnabled`,
`customEndpointingRules`, `transferPlan.dialTimeout`, `keyterm`/`keywords`, et
`keypadInputPlan` sous sa forme corrigée) sont donc vus et acceptés par l'API
vivante, pas seulement par nos tests. Le premier passage ne le disait pas : Vapi
rend ses erreurs par lot, donc un champ tu n'est pas un champ accepté, et il
faut relancer le script jusqu'au vert avant de conclure quoi que ce soit.
**Piège Deepgram** : `keyterm` n'existe que sur Nova-3, `keywords` sur Nova-2 et
en dessous, et nos langues ne tournent pas sur le même modèle (fr/en en Nova-3,
nl en Nova-2). Le champ se choisit par modèle, jamais globalement.

### 6nonies. Un refus de Vapi ne doit plus être silencieux (09/09/2026)
`syncVapiAssistant` lève, et ses **deux** appelants attrapent pour écrire un
`logger.warn` avant de répondre `success: true`. Le client enregistre un réglage,
la base est à jour, l'interface dit que c'est fait, et l'assistant **distant**
garde son ancienne configuration pour toujours. Tous les appels suivants passent
par un agent périmé. C'est le mode d'échec des deux pannes de flotte, et il
n'avait jamais été rendu bruyant, seulement documenté après coup.
`reportAssistantSyncFailure` (`services/voice/vapi-error.ts`) alerte désormais sur
Discord avec **le corps de la réponse**, qui nomme le champ fautif : c'est la
seule chose que le code ne pouvait pas deviner.
La distinction porte tout : un **4xx** dit que la charge est invalide, or elle est
construite par le même code pour tout le monde, donc c'est un incident de FLOTTE
même s'il se voit sur un compte. Un **5xx / réseau / 429** ne dit rien sur la
charge et se retentera seul ; alerter dessus avec la même force apprendrait à
ignorer l'alerte. 429 est un 4xx qui ne compte PAS comme refus : c'est un débit,
pas une forme.

### 6decies. Une opposition n'est pas une donnée comme les autres (09/09/2026)
La purge de rétention faisait `deleteMany({ lastCallAt: { lt: cutoff } })` sur
`CallerMemory`, sans regarder `isBlocked`. Une opposition — « ne me rappelez
jamais » — vieille de plus de trois mois **disparaissait toute seule**, et
l'appelant redevenait rappelable : l'inverse exact de ce qu'il avait demandé.
Le RGPD demande justement de CONSERVER une liste d'opposition, pour pouvoir
l'honorer. La purge garde donc le strict nécessaire (le numéro et le drapeau) et
efface tout le reste : nom, courriel, portrait, préférences, dernier résumé.
Le **même** raisonnement vaut sur `eraseCaller`, la route d'effacement à la
demande (`DELETE /my-dashboard/callers/:number`) : elle supprimait aussi la ligne
entière. L'appelant aurait exercé un droit et récolté exactement ce qu'il
refusait. Un numéro sur une liste d'opposition ne peut pas lui nuire, il ne sert
qu'à ne pas l'appeler ; le supprimer, si.
Second défaut au même endroit : `block()` crée une ligne **sans** `lastCallAt`,
et en SQL un NULL ne matche aucune comparaison. Ces lignes n'étaient donc échues
à aucun moment, et leur personnel restait indéfiniment. Le filtre lit désormais
`createdAt` en repli. **Toute colonne de date nullable utilisée comme filtre de
purge porte ce piège** : il ne se voit pas, la requête réussit et ne supprime
simplement rien.

### 6duodecies. Le prix AFFICHÉ et le prix PRÉLEVÉ sont deux objets sans lien (09/09/2026)
La page annonçait 599 €/mois, la caisse Stripe ouverte depuis cette page disait
« Qwillio Pro, 1297,00 € par mois ». `config/plans.ts` décide de l'affichage, un
objet Price chez Stripe décide du prélèvement, et **`STRIPE_PRICE_<PLAN>_MONTHLY`
court-circuite même le tarif du code** sans rien vérifier : la variable pointait
un prix d'une tarification précédente (497 / 1297 / 2497).
Un client aurait signé pour 599 et payé 1297. Ce n'est pas un défaut d'affichage,
c'est le mauvais montant sur une vraie carte, invisible jusqu'au premier relevé.
La caisse **relit** désormais le prix et REFUSE de s'ouvrir en cas d'écart, sur le
montant, la devise ou la période — un prix annuel sur un plan mensuel prélèverait
douze mois d'un coup au bon montant unitaire, seul l'intervalle le trahit. Un prix
créé à l'instant depuis `plans.ts` n'est pas relu : il est juste par construction.
`npm run stripe:prices` pose la même question pour toute la grille, en lecture
seule.
**Ne jamais créer un produit à la main dans le tableau de bord Stripe** : c'est
exactement ce qui a produit le 1297. Le code crée ses prix depuis `plans.ts` et
les retrouve par clé de recherche (`qwillio_<plan>_<période>_eur`). Le geste de
réparation n'est donc pas « corriger le prix », c'est **retirer la variable**.

### 6terdecies. Un code promo Stripe ne contient QUE des lettres et des chiffres (09/09/2026)
`stripe/types/PromotionCodesResource.d.ts`, champ `code` : « Valid characters are
lower case letters (a-z), upper case letters (A-Z), and digits (0-9). » Ni point,
ni tiret, ni espace. L'exemple que le script donnait lui-même
(`QWILLIO-TEST-2026`) envoyait donc dans le mur, et Stripe répond en nommant le
champ sans nommer le caractère fautif. La vérification a lieu avant le moindre
appel réseau, et pour une seconde raison : la création se fait en DEUX temps,
coupon puis code, et échouer au second laissait un coupon à 100 % **orphelin**,
sans code, invisible dans le parcours mais applicable à la main depuis le tableau
de bord. Chaque tentative ratée en ajoutait un.
Le code se saisit **une seule fois**, au passage en caisse qui convertit l'essai :
avec `max_redemptions: 1`, le saisir à l'inscription l'épuiserait avant le moment
qui compte, et rien n'est prélevé pendant l'essai de toute façon.

### 6quaterdecies. Vérifier SUR QUEL COMPTE Stripe on travaille (09/09/2026)
Deux comptes existaient : « Pulse » (`acct_1SpyVdLn8Jp3Hstt`), qui portait
l'ancienne grille et servait la production, et « Qwillio »
(`acct_1TO2L5BFji4kf0Gb`), vide. La caisse affichait donc **« Pulse »** au client,
et l'ancienne grille avec. Un compte se change en cinq gestes, pas un :
la clé (`STRIPE_SECRET_KEY`), les quatre variables de prix à **supprimer**, un
nouveau point de terminaison webhook vers `/api/webhooks/stripe` avec ses six
événements et son secret (`STRIPE_WEBHOOK_SECRET`), le **nom public** du compte,
et les coupons à recréer — un coupon appartient à un compte.
Sans le webhook, un paiement réussit et ne crée RIEN : ni client, ni assistant,
ni numéro. C'est le geste qu'on oublie, parce que la caisse, elle, marche.

### 6undecies. Un changement d'offre REMPLACE l'essai, il ne s'y ajoute pas (09/09/2026)
Le bouton « Upgrader » du portail ouvre une caisse Stripe, et une caisse crée un
**nouvel** abonnement. L'essai, lui, restait ouvert : même client, même carte,
plan d'origine. À la fin de l'essai, Stripe facturait **les deux**, et Qwillio ne
pointait plus que le second : aucun chemin du produit n'aurait annulé le premier
ni signalé son existence, seule une lecture du tableau de bord Stripe l'aurait
montré, après le prélèvement.
`handlePlanUpgradeCheckout` annule donc l'ancien, et **l'ordre est la moitié du
correctif** : `customer.subscription.deleted` retrouve le client par son
`stripeSubscriptionId`, donc annuler AVANT la mise à jour ferait trouver ce
client-là, passerait son statut à `canceled` et **rendrait son numéro belge au
stock** quelques secondes après le lui avoir attribué. Annulé après, l'ancien
identifiant ne désigne plus personne et l'événement est ignoré, ce qui est
exactement ce qu'on veut.
C'est le chemin exact du compte de test gratuit (inscription, puis second
passage en caisse pour convertir) : le premier à rencontrer ce défaut aurait été
nous, sur notre propre carte.

### 6quinquies. Un glossaire de prompt ne contient AUCUN verbe d'action (09/09/2026)
Le bloc belgicismes a fait échouer `fr-discipline-agenda`, un scénario sans aucun
rapport avec la Belgique, **deux fois de suite** et pour la même raison de forme.
D'abord « en cas de doute sur un repas ou une heure, demande confirmation », puis,
après correction, la simple glose « quoi comme heure ? **demande** quelle heure »,
indicative dans l'intention mais impérative à la lecture. Dans les deux cas : à
« je voudrais un rendez-vous demain matin », l'agent répondait « le matin ou
l'après-midi ? » au lieu d'appeler `checkAvailability`. Décrire « une fois » comme
un tic de langage a de même suffi à le faire **adopter** par l'agent.
Deux règles qui en sortent, et qui valent pour tout bloc ajouté au prompt : il se
relit contre les scénarios **existants**, pas seulement contre les siens ; et un
glossaire s'écrit « X veut dire Y », sans une seule phrase qui puisse se lire
comme une consigne. Un test vérifie l'absence de verbe d'action dans le bloc.

### 6quater. Le vouvoiement se dit, il ne va pas de soi (09/09/2026)
Tout le prompt s'adresse au modèle en « tu », comme une consigne s'écrit, et le
modèle retournait ce registre à l'appelant : « c'est quoi ton nom ? », relevé sur
un scénario d'évaluation. Une règle explicite est posée dans les règles de parole
(français et néerlandais), au-dessus des consignes du client, qui peuvent toujours
demander l'inverse. Un scénario d'éval le vérifie sans coûter un tour de modèle de
plus, en s'accrochant à `fr-divulgation-ia`.

### 6sexies. `vapiConfig` se FUSIONNE, il ne se remplace pas (09/09/2026)
Le PUT du portail remplaçait le champ entier par ce que l'appel envoyait. Or tout
tient dedans : le moteur de synthèse du client, le chemin custom-LLM, la base de
connaissances, le mode sans enregistrement. Une omission les effaçait tous, en
silence, et rien ne le montrait avant le prochain appel entrant. C'est le même
piège que le PUT partiel du point 2, en pire, parce qu'ici un seul champ porte
tout. Il est fusionné (`mergeVapiConfig`), `null` retirant une clé explicitement,
et la fusion est SUPERFICIELLE : une fusion profonde rendrait impossible de
retirer une entrée d'une sous-liste.

### 6tervicies. Les DEUX assistants décrochent, selon la LIGNE (10/09/2026)
Précision qui corrige 6quindecies, et qui change à qui s'appliquent les cinq
correctifs de la journée. `attachAssistant` n'est appelé que par
`phone-stock.service.ts`, c'est-à-dire pour les clients qui reçoivent un numéro
belge DÉDIÉ. Sur la LIGNE PARTAGÉE — celle des essais — aucun assistant n'est
épinglé, donc `assistant-request` EST émis et `buildAssistantForCall` s'exécute
bel et bien.
Donc : ligne dédiée → assistant enregistré ; ligne partagée → assistant construit
à l'appel. Les deux chemins comptent, et il faut les tenir tous les deux.
**Le défaut que cette lecture a fait sortir** : `buildAssistantForCall` composait
`Receptionist - <nom commercial>` sans passer par `fitAssistantName`. C'est le
seul chemin qui échappe à `vapiClient`, où `fitAssistantLabel` est appliqué sur
create et update : cet assistant n'est pas créé par l'API, il est RENDU en
réponse au webhook. « Receptionist - » fait quinze caractères, donc toute
entreprise au nom de plus de vingt-cinq franchissait la limite de quarante — et
un nom trop long ne dégrade pas l'assistant, il le fait refuser en entier
(6octies). Le premier appel d'un client d'essai, refusé sur la longueur du nom
de son commerce.

### 6quindecies. Il y a DEUX assistants, et un seul décroche (10/09/2026)
`buildAssistantForCall` compose l'assistant complet — outils, base de
connaissances, mémoire de l'appelant, plan de clavier — et ne sert QUE à
répondre à `assistant-request`, l'événement que Vapi envoie quand le numéro
appelé ne désigne aucun assistant. Or `attachAssistant` épingle l'assistant
enregistré sur le numéro (`updatePhoneNumber(id, { assistantId })`) : cet
événement n'est donc **jamais émis**, et c'est l'assistant ENREGISTRÉ qui
décroche, avec la configuration figée à l'inscription.
Il naissait sans outils : la création n'en posait qu'un, `transferCall`, et
seulement `if (client.transferNumber)`, c'est-à-dire jamais — personne ne
connaît son numéro de transfert en s'inscrivant. Et `syncVapiAssistant` ne
rattrapait rien, le champ `tools` n'y figurait pas.
Quatre pannes pour une cause, vérifiées sur un appel entrant réel : l'agent ne
peut pas transférer (il propose de prendre un message, ce qui ressemble à un
choix), pas de `captureLead` donc `leadAlertService` sort sur `no_lead` et
**aucune alerte ne part**, pas de lecture de la base de connaissances, pas de
rendez-vous. Les deux chemins d'écriture passent désormais par
`buildAssistantTools`, qui appelle `buildVoiceTools` — le constructeur de
l'appel, jamais une copie. Le cache du profil est vidé **avant** la lecture,
sinon les outils sont bâtis sur la configuration d'avant l'enregistrement et le
client doit sauver deux fois.
`npm run voice:doctor` lit l'assistant DISTANT et dit ce qu'il porte vraiment.
C'est la seule chose qui répond à « pourquoi cet appel n'a rien laissé ».

### 6novodecies. Les outils vivent DANS `model`, pas à la racine (10/09/2026)
`{"message":["property tools should not exist"],"statusCode":400}`, sur les
**six** variantes. Rien dans le code ne le laissait deviner : la racine paraît
naturelle, l'objet est `any` donc le compilateur se tait, et la documentation ne
tranche pas. La bonne place est `model.tools`.
**Pourquoi ça a dormi** : la racine n'était renseignée que `if (tools.length > 0)`,
et les outils se réduisaient à `transferCall`, posé seulement si le client avait
déjà un numéro de transfert — jamais à l'inscription. Le champ fautif n'était donc
jamais envoyé. Le jour où les outils sont devenus systématiques (6quindecies), la
création d'assistant est tombée pour **tout le monde**. C'est 6octies en entier :
un champ refusé n'abîme pas un appel, il annule l'assistant.
Un test lit le SOURCE et interdit `assistantData.tools =` / `updatedConfig.tools =`.
Il ne remplace pas le script — lui seul parle à Vapi — il empêche la leçon de se
reperdre entre deux passages. Un test de la 209 figeait d'ailleurs le mauvais
emplacement, et il a fallu le corriger avec le code.

### 6vicies. Ce qui n'est pas passé à l'assistant ENREGISTRÉ n'existe pas (10/09/2026)
C'est 6quindecies une seconde fois, sur un autre champ. `buildRealtimePlans`
accepte un `vocabulaire` qui souffle au transcripteur le nom de l'entreprise,
celui de l'agent et les prestations. Il était construit, testé, et passé au seul
`buildAssistantForCall` — l'assistant qui ne décroche JAMAIS, puisque le numéro
entrant épingle l'assistant enregistré. Le mécanisme existait sans jamais
atteindre un appel, et aucun test ne pouvait le voir : chacun vérifiait sa
moitié.
**Le second défaut du même endroit est pire.** La synchronisation choisissait la
langue avec `isFrenchClient(client) ? 'fr' : 'en'`, quand la création connaissait
le néerlandais. Un client flamand naissait donc correct et repassait en ANGLAIS,
transcripteur ET voix, à la première sauvegarde de n'importe quel réglage. Le PUT
réussit, l'écran dit enregistré, et l'appelant suivant est transcrit en anglais.
Deux règles écrites à la main pour la même question ont divergé en moins d'un
mois ; la langue se lit désormais sur le PROFIL, la seule source que l'appel
utilise aussi.
La règle générale : **tout ce qui décrit comment l'agent ÉCOUTE ou PARLE doit
partir par les deux écritures de `onboarding.service.ts`**, pas seulement par le
constructeur d'appel. Un test interdit tout `buildRealtimePlans` sans options
dans ce fichier, pour qu'un troisième chemin d'écriture ne retombe pas dans le
trou en silence.
Piège de méthode rencontré en écrivant ce test : un test qui lit le SOURCE doit
d'abord retirer les commentaires. Le commentaire posé au-dessus d'un correctif
nomme forcément la forme fautive, donc le test tombe sur sa propre explication.

### 6unvicies. DEUX constructeurs de prompt, et c'est le mauvais qui décrochait (10/09/2026)
Le plus large des trois trous de la même famille. `buildSystemPrompt`
(`services/voice/system-prompt.ts`) porte le vouvoiement, le glossaire belge,
les champs nommés du métier, le repli clavier et la discipline de transfert ;
c'est lui que le harnais d'évals mesure, et il n'était appelé que par
`buildAssistantForCall` — l'assistant qui ne décroche JAMAIS. L'assistant
ENREGISTRÉ recevait `generateClientSystemPrompt`, un texte hérité, plus ancien,
qui ne porte rien de tout cela.
Conséquence : tout ce qui a été écrit dans le prompt depuis des semaines partait
dans le vide, et **les scénarios d'éval mesuraient un agent que personne
n'entendait**. Un `npm run evals` au vert ne disait donc rien des appels réels.
Ce qui n'était PAS touché, vérifié avant de conclure : l'annonce IA et la notice
d'enregistrement vivent dans `generateFirstMessage`, qui les porte bien dans les
trois langues. LEG-1 et LEG-2 tiennent.
`assistantPrompt()` appelle désormais le bon constructeur, avec les DEUX
magasins de connaissance dans le même ordre qu'à l'appel, et garde l'ancien en
repli quand le profil est illisible. Un test de source interdit de reposer le
constructeur hérité directement.
**La règle qui sort des trois** : ce qui décrit comment l'agent PENSE, ÉCOUTE ou
PARLE se pose sur l'assistant enregistré, par les deux écritures de
`onboarding.service.ts`. Un constructeur appelé seulement par
`buildAssistantForCall` n'atteint aucun appel entrant. `npm run voice:doctor`
lit l'assistant DISTANT et reste la seule réponse à « qu'est-ce qui tourne
vraiment ».

### 6duovicies. Le drapeau d'enregistrement ne suivait pas le réglage (10/09/2026)
Cinquième trou de la famille 6quindecies, et le seul qui touche la conformité.
DEUX drapeaux ont coexisté : `disableRecordingNotice`, l'historique, et
`recordCalls`, celui que le portail écrit. Le PROFIL honore les deux, et c'est
lui qui décide de la notice dans l'accueil. L'assistant ENREGISTRÉ ne lisait que
l'historique, et la synchronisation ne portait pas le champ **du tout**.
Conséquence exacte : un client coupe l'enregistrement dans le portail, la notice
disparaît de son accueil (l'accueil passe par le profil), et son assistant
distant continue d'enregistrer, pour toujours. **Un appel enregistré sans que
l'appelant en ait été informé**, c'est-à-dire l'inverse de ce que dit le
commentaire posé juste au-dessus de la ligne fautive.
Les deux écritures lisent désormais `shouldRecord(profile)`, la même fonction
que l'accueil, et le champ voyage à chaque synchronisation. Le repli, quand le
profil est illisible, penche vers l'enregistrement : l'accueil suivant la même
source, il annoncera la notice, donc le doute ne fabrique jamais d'enregistrement
caché.
**La règle** : deux drapeaux qui décrivent la même chose finissent toujours par
diverger. Quand un réglage acquiert une seconde forme, l'ancienne devient un
repli lu au même endroit que la nouvelle, jamais une seconde règle lue ailleurs.

### 6sexdecies. `voice:validate` ne validait pas la charge de production (10/09/2026)
Il couvrait les plans, pas `tools`, `serverUrl`, `forwardingPhoneNumber`,
`endCallFunctionEnabled`, `recordingEnabled` ni `backgroundSound` — exactement
la partie que personne ne relisait, alors qu'un seul champ refusé emporte
l'assistant entier (6octies). Les outils y entrent par `buildVoiceTools`, pas
par une copie écrite pour le test : une copie ne vieillirait pas avec
l'original, et c'est l'original qui part chez Vapi.
**Et il en restait la moitié, corrigée le soir même.** Le bloc `model` était
encore écrit à la main, `provider: 'openai'`, alors que le chemin d'appel passe
par `buildSpeech` et que la flotte entière tourne en custom-LLM
(`VOICE_CUSTOM_LLM_DEFAULT` absent vaut vrai). Le modèle réellement envoyé
n'avait donc JAMAIS été soumis à l'API vivante — précisément la situation que ce
script existe pour empêcher. Il passe désormais par `buildSpeech`, avec l'URL
custom-LLM sous sa forme de production, et le moteur IMPOSÉ par variante :
laisser `auto` décider ramènerait les six variantes au même moteur, donc trois
essais sur six ne testeraient rien.

### 6septdecies. L'agent demande ce qu'il ne sait pas (10/09/2026)
Une question sans réponse produit une ligne de `knowledge_gaps` :
`lookupKnowledge` quand il ne trouve rien, et l'analyse de fin d'appel
(`unansweredQuestions`) pour le client SANS base — celui à qui l'outil n'est
même pas attaché, et qui a le plus à apprendre. Le gérant répond une fois, dans
le portail ou dans le chat de configuration, et sa réponse devient une entrée
`businessKnowledge` portant **les mots-clés de l'appelant** : sans ce pont, la
réponse écrite dans les mots du gérant ne serait pas retrouvée par la question
même qui l'a fait naître.
Le regroupement est lexical (mots vides retirés, troncature à 6, tri) : il
réunit « ouverts » et « ouvert », pas « ouvrez » et « ouvert ». Supportable
parce que la boucle se referme seule — la variante suivante trouve la réponse
au lieu de créer une lacune. **Le seuil à deux mots signifiants est un piège**,
essayé et retiré : « vous avez un parking ? » n'en laisse qu'un et disparaissait
en silence. Ce sont les mots vides qui écartent un acquiescement, pas le compte.

### 6quaterdecies bis. L'étape du numéro de transfert se cochait seule (10/09/2026)
`OnboardingChecklist` acceptait `vapiPhoneNumber` comme preuve, or ce numéro est
attribué d'office à l'inscription : l'étape naissait verte pour tout le monde et
ne demandait donc jamais rien. Les deux numéros ne sont pas le même — celui de
Qwillio est celui qu'on COMPOSE, l'autre celui vers lequel on TRANSFÈRE.
« À traiter » est retiré de la vue d'ensemble : il vivait sous la fiche
Abonnement, sous la ligne de flottaison, et redisait ce que le bandeau
« Démarrer avec Qwillio » porte déjà en haut.

### 6octodecies. Les intégrations natives sans bouton (10/09/2026)
L'écran n'ouvrait un branchement que sur `setup === 'url'` : Google Agenda
(oauth) et HubSpot (apiKey) s'affichaient « disponible » sans rien à cliquer,
alors que leurs routes existent. Trois choses tenaient l'agenda fermé, et il
fallait les trois : le catalogue lisait l'état dans `crmIntegration` alors que
le jeton de l'agenda vit sur la fiche client (`googleCalendarRefreshToken`) ; le
gardien `requireCapability('crm')` fermait le catalogue ENTIER à un client Solo,
qui n'y gagnait qu'un « la liste n'a pas pu être chargée » ; et Google ne revient
que sur l'adresse déclarée dans sa console, qui est la réceptionniste, donc le
client partait d'« Intégrations » et revenait ailleurs. La page de départ est
retenue avant le saut (`gcalReturnTo`) plutôt que d'ajouter une seconde adresse
hors du dépôt.

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
  Depuis le 09/09, un test **lit le source** du contrôleur client et impose deux
  règles : une table ordinaire porte toujours un `clientId` dans le WHERE d'une
  écriture, et une **racine** de locataire (`client`, `user`) n'est jamais
  désignée par ce que l'appelant a envoyé (`req.params` / `body` / `query`) —
  seulement par le jeton. Les deux formes de régression ont été réintroduites une
  à une pour vérifier que le test tombe. Ça ne remplace pas la RLS : ça empêche la
  prochaine route écrite à la main de refaire les dix qui agissaient sur un
  enregistrement par son seul identifiant.

### 7. Ce qui bloque la mesure, et donc trois décisions
`fleetMetrics` affiche toujours `calls: 0` : aucun appel entrant réel n'a été
passé. Tant que c'est le cas, la latence, le coût par minute et le prix de
l'option temps réel (`VOICE_REALTIME_SURCHARGE_EUR`, à 0) restent inconnus tous
les trois. La marche à suivre est écrite dans `docs/PROTOCOLE-TEST-MOTEURS.md`.

## Audit « prêt à vendre » du 11/08/2026

Trois lots livrés (PR #118). Ce qu'il faut en retenir pour ne pas défaire le travail :

- **Un numéro entrant appartient à UN client.** Recopier `VAPI_PHONE_NUMBER` dans une
  fiche client rendrait de nouveau les deux clients injoignables. Deux endroits
  attribuent une ligne, et un seul répond au cas courant : `phone-stock.service.ts`
  pioche dans le lot de numéros belges achetés d'avance (voir ci-dessous), et
  `phone-allocation.service.ts` ne sert plus qu'à la ligne partagée des essais.
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
passer deux appels de test (`realtime` et `classic`), et cliquer une première fois
sur le portail Stripe.

## Le stock de numéros belges (07/09/2026)

- **C'est MOBILE qu'il faut acheter, pas local.** Twilio ne propose que `mobile` et
  `toll_free` en Belgique sur ce compte : `AvailablePhoneNumbers/BE/Local` répond
  404. Vérifié le 07/09, et vérifiable à tout moment — `npm run phone:buy` interroge
  Twilio et affiche les types réellement disponibles au lieu de les supposer.
  Les numéros mobiles belges (04xx) coûtent 1,25 $ par mois, portent la voix et le
  SMS, et sont facturés normalement à l'appelant. Le toll-free (0800) est à écarter :
  c'est NOUS qui paierions chaque minute entrante.
- **Un bundle est lié à UN type de numéro.** Une régulation Twilio est unique par
  pays + type de numéro + type d'utilisateur final. Le premier dossier a été
  approuvé en **Local**, donc inutilisable : `Bundle [...] does not have the correct
  regulation type to provision this number`. L'échec arrive AVANT l'achat, donc il
  ne coûte rien — mais il coûte les deux jours d'approbation du mauvais dossier.
- **Le dossier ne se refait jamais par client.** Il est ouvert une fois pour Qwillio
  et couvre tout le lot. Le client ne fournit aucune pièce : il reçoit une ligne
  déjà achetée. Trois rejets ont appris la règle : le nom saisi, le numéro de la
  pièce d'identité et le justificatif d'adresse doivent désigner **la même
  personne**, sinon rejet automatique. Et dans le formulaire : « Client direct »
  (jamais Revendeur/ISV, qui exigerait un profil par client final), sous-attribution
  **Non**, et « Particulier » comme répondant — « Entreprise » réclame une TVA belge
  que Qwillio n'a pas.
- **National, jamais.** Un numéro national belge (078) est surtaxé pour l'APPELANT,
  ce qui annule la raison même d'avoir un numéro belge.
- **Acheter une fournée** : `npm run phone:buy -- --type=mobile` (simulation) puis
  `--confirm` pour acheter réellement. `npm run phone:stock` dit ce qu'il reste.
- **Un numéro acheté chez Twilio mais non importé chez Vapi est facturé sans être
  joignable.** C'est la seule anomalie que le rapport de stock signale en majuscules,
  et le stock refuse d'attribuer une telle ligne plutôt que de la faire passer pour
  active.
- **Ne pas acheter depuis la console Twilio.** Sa checklist de conformité se termine
  par « Select and buy number », et cliquer là produit une ligne payée que la base
  ignore et que personne ne se verra jamais attribuer. C'est arrivé le 07/09 avec
  `+32460207490`. Rattrapage sans racheter : `npm run phone:adopt` (simulation) puis
  `--confirm`, qui importe chez Vapi et range dans le stock. Le même script répare
  une ligne déjà en stock restée sans `vapiNumberId`, y compris après un `phone:buy`
  interrompu entre l'achat et l'écriture en base.
- **Un client DÉJÀ actif ne prend pas de numéro tout seul.** `ensureLine` n'est
  appelée qu'à l'inscription (`onboardClient`), donc remplir le stock n'attribue
  rien aux clients installés avant l'achat : ils restent sur la ligne partagée
  avec un numéro belge libre qui les attend en base. `npm run phone:assign`
  (simulation) puis `--confirm` leur donne leur ligne, en passant par la même
  fonction que l'inscription. `--email=` cible un seul compte.
- **Une résiliation rend le numéro au lot**, elle ne le rend pas à Twilio : il est
  déjà payé et déjà couvert. Sans ce geste, chaque départ retirerait une ligne du
  stock pour toujours.
