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

### 6quinvicies. Un identifiant de modele ne se DEDUIT jamais (10/09/2026)
Trois valeurs posees dans `VOICE_REALTIME_MODEL` avant la bonne, et la meme
cause a chaque fois : l'identifiant venait d'ailleurs que de l'intermediaire qui
recoit la charge. `gpt-realtime-2.1`, lu dans le catalogue d'OpenAI. Puis
`gpt-realtime`, deduit du message d'erreur de Vapi alors que
`validate-assistant.ts` coupait ce message a 600 caracteres. Un nom d'ecran du
tableau de bord Vapi n'est pas davantage un identifiant d'API.
Le corps ENTIER, une fois la troncature levee, enumere SIX identifiants temps
reel et cinq d'entre eux sont **dates** : `gpt-4o-realtime-preview-2024-10-01`,
`gpt-4o-realtime-preview-2024-12-17`, `gpt-4o-mini-realtime-preview-2024-12-17`,
`gpt-realtime-2025-08-28`, `gpt-realtime-mini-2025-12-15`, `gpt-realtime-2`.
`gpt-realtime` tout court n'y figure pas.
La regle : **couper la reponse d'une API, c'est fabriquer une deduction fausse
qui a l'air d'une lecture.** Un test lit desormais le source de
`validate-assistant.ts` et interdit tout `body.slice(0, N)` ; un autre fige le
catalogue temps reel avec sa date, non pour remplacer `npm run voice:validate`
— seule chose qui parle vraiment a Vapi — mais pour qu'une valeur qui n'y a
jamais figure ne puisse pas etre reposee.
Ecart de cout a mesurer avant de choisir : le tableau de bord Vapi annonce
0,060 $ la minute pour `gpt-realtime-mini-2025-12-15` contre 0,645 $ pour
`gpt-realtime-2`, un facteur dix, et `VOICE_REALTIME_SURCHARGE_EUR` est a zero,
donc l'ecart est entierement pour nous.

### 6sexvicies. Un diagnostic FAUX coute plus cher qu'aucun diagnostic (11/09/2026)
`voice:doctor` lisait `assistant.tools`, la RACINE. Or Vapi refuse ce champ
(« property tools should not exist », 6novodecies) : un assistant distant n'en a
donc jamais. Le docteur annoncait « 0 outil » a TOUT LE MONDE, pour toujours, y
compris sur un assistant parfaitement configure, et il concluait en conseillant
de resynchroniser, geste qui ne changeait rien puisque rien n'etait casse.
Ce que ca a coute : une nuit passee a chercher une panne de synchronisation qui
n'existait pas, et un script (`voice:resync`) ecrit pour la debusquer. Le script
reste utile, c'est lui qui a prouve que la synchronisation REUSSIT, mais il
n'aurait pas du etre necessaire.
La regle : **quand une lecon deplace un champ, le CODE QUI LE LIT compte autant
que le code qui l'ecrit.** `tools-live-in-model.test.ts` interdisait
`assistantData.tools =` a l'ecriture et ne regardait pas la lecture ; il couvre
maintenant les deux, et la forme fautive a ete reintroduite une fois pour
verifier qu'il tombe.
Second releve du meme passage, sans rapport et bien reel : `[Greeting] variant N
failed: ElevenLabs responded 401` sur les trois variantes. La cle ElevenLabs du
backend est refusee. Ca n'empeche pas un appel (Vapi synthetise avec SA propre
cle) mais ca eteint l'accueil pre-enregistre, donc l'optimisation de latence de
la premiere phrase, en silence.

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

### 6septvicies. La langue de l'agent naît de la langue du SITE (12/09/2026)
Chaque chemin de création posait `agentLanguage: 'en'` (en dur, ou par le
défaut du schéma), et le profil d'appel laissait le PAYS renverser ce `'en'` :
un client belge était servi en français par présomption, et ne pouvait donc
JAMAIS passer son agent en anglais depuis Paramètres, l'écran disant enregistré
et l'appel restant en français. Désormais : le front envoie la langue du site à
l'inscription, à la connexion Google et à la caisse ; elle attend sur
`User.language` (le client naît au webhook Stripe, après la caisse) ;
`signupAgentLanguage` l'écrit à la naissance du client ; et `clientLocale`
(`utils/client-locale.ts`) est LA règle, le choix d'abord, le pays en repli,
pour le profil d'appel, la synchronisation et les routes du portail. La
migration `20260912000000` réécrit en `'fr'` les `'en'` jamais choisis des pays
francophones, pour que faire primer le choix ne repasse personne en anglais.
`language-single-rule.test.ts` interdit qu'une liste de pays soit recopiée dans
ces fichiers. Les voix Cartesia « fr » proposées au portail sont les 25 de
`config/cartesia-curated.ts`, par identifiant d'API ; une langue sans liste sert
le catalogue entier.

### 6octovicies. Un appel muet : l'URL d'accueil n'avait jamais été entendue (12/09/2026)
Deux appels entrants en `silence-timed-out`, « personne ne parle et il
raccroche ». L'assistant enregistré portait en `firstMessage` l'URL de
l'accueil pré-enregistré (LAT-7, 10/09) : ce mécanisme n'avait JAMAIS été
exercé sur un vrai appel, parce que les lignes d'accueil n'existaient pas tant
qu'ElevenLabs refusait la clé (401), et elles sont apparues avec la clé
Cartesia, quelques minutes avant ces deux appels. Le texte, que Vapi
synthétise, est le chemin prouvé : l'URL n'est épinglée que sur opt-in
(`VOICE_GREETING_PINNED=true`), à rallumer quand un appel réel aura été
entendu avec. `voice:doctor` lit désormais la première phrase DISTANTE (et va
chercher une URL comme Vapi le ferait) et compte les répliques de l'assistant
sur les derniers appels : un `silence-timed-out` sans réplique, c'est la
première phrase qui n'est pas partie, pas un appelant muet.
La règle, encore 6sexvicies : un mécanisme qui n'a jamais atteint un appel
réel n'est pas une optimisation, c'est un risque qui dort derrière une clé.

### 6novovicies. L'agent ne connaissait pas la date (12/09/2026)
Appel réel : « un détartrage la semaine prochaine », et l'agent propose
« lundi 17 juin », un jour qui n'est pas un lundi et un mois passé. Aucun des
prompts ne disait quel jour on était, et la description de `checkAvailability`
lui demandait pourtant de « résoudre les dates relatives » avant d'appeler.
`services/voice/clock.ts` porte la date à TROIS endroits, et il faut les
trois : le prompt bâti à l'appel (`clockLine`, ligne partagée) ; l'assistant
ENREGISTRÉ, dont le prompt est figé à la synchronisation, reçoit le gabarit
`{{"now" | date: …}}` que Vapi remplit à chaque appel (`vapiClockLine`, une
date réelle y serait fausse dès le lendemain) ; et le chemin custom-LLM ajoute
la date en message système de queue à chaque tour (`clockBlock`), avant
l'humeur et la reprise, hors du préfixe mis en cache. L'agenda refuse une
date PASSÉE en nommant le jour d'aujourd'hui (le modèle s'est trompé de mois,
« aucun créneau » lui ferait proposer le lendemain) et rend un jour libre AVEC
son jour de semaine, que le modèle ne calcule pas. Un test de source interdit
de figer `clockLine` dans l'assistant enregistré.

### 6trigesies. Un rendez-vous à 9 h posé à 15 h : l'heure était celle du serveur (12/09/2026)
Appel réel : « neuf heures » demandé, rendez-vous posé à 15 h dans l'agenda.
Six heures d'écart, c'est New York → Bruxelles : `createEventFromBooking` et
`getAvailability` faisaient `setHours(9)` sur une `Date`, donc 9 h dans le
fuseau du PROCESSUS, et le profil d'appel avait sa propre règle de fuseau
(`Europe/Paris` par défaut) là où l'agenda en avait une autre. `utils/zoned-time.ts`
porte désormais UNE règle (`businessTimezone`, inscription puis pays/ville
puis langue) et `zonedInstant` pose une heure murale dans ce fuseau, quel que
soit celui du serveur. Deuxième défaut du même appel : le post-appel RECRÉAIT
une réservation depuis la transcription alors que `bookAppointment` l'avait
déjà prise en direct — deux rendez-vous, deux événements, le second à l'heure
lue par le modèle d'analyse. Le webhook passe désormais la réservation prise
en direct (`liveBookingId`), le post-appel la relie à l'appel et s'arrête là.
Même journée, même famille : le NOM se relit comme le numéro (« Polle »
entendu « Paul »), une fois par nom et par appel, AVANT d'écrire dans
l'agenda, avec épellation demandée si l'appelant corrige, et
`normaliseSpelledName` recolle « P O L L E » ; le SMS de confirmation part
PENDANT l'appel avec un lien `.ics` public (`/api/public/booking/:id.ics`),
et l'agent ne le promet que si `SMS_ENABLED` et un numéro le permettent ; les
résumés d'appel sont écrits dans la langue du client (`clientLocale`), le
modèle d'analyse répondant sinon dans la langue de sa consigne, l'anglais.
`voice:doctor` affiche les outils du dernier appel (arguments et réponses) et
si un enregistrement existe chez Vapi et chez nous : c'est ce qui dit à quelle
heure l'agent a réellement réservé, au lieu de le deviner.

### 6untrigesies. Cinq retours d'un même appel test (12/09/2026, après-midi)
- **Les horaires du portail n'étaient lus NULLE PART.** `onboardingData.hours`
  est un objet jour par jour ; le profil le mettait dans une chaîne, donc le
  prompt disait « Horaires: [object Object] », et l'agenda proposait 9 h-17 h
  tous les jours. Un rendez-vous a été pris un dimanche chez un commerce fermé
  le dimanche. `utils/opening-hours.ts` est la seule lecture : `describeHours`
  pour le prompt, `dayWindow` pour les créneaux (le speculator ne lit même pas
  Google un jour fermé) et pour `checkAvailability` / `bookAppointment`, qui
  refusent un jour fermé en nommant le prochain jour ouvert, et une heure hors
  fenêtre en nommant la fenêtre. `ClientVoiceProfile.weekHours` est obligatoire.
- **L'agent épelle LUI-MÊME le nom de famille** (`spellOut`, « P-O-L-L-E ») :
  relire « Polle » ne distingue pas de « Paul », les lettres si.
- **Il parlait par-dessus les respirations.** `VOICE_START_WAIT_SECONDS` passe
  de 0,12 à 0,4 (le défaut documenté de Vapi) et `onPunctuationSeconds` de 0,1 à
  0,4 (`VOICE_ENDPOINTING_PUNCTUATION_SECONDS`) : le transcripteur pose un point
  sur une respiration, et 0,1 s y faisait entrer l'agent. C'est un arbitrage
  (280 ms de plus par tour), réglable par variable, pas un réglage définitif.
- **Le SMS était PROMIS sans être possible.** `smsPromised` ne regardait que
  `SMS_ENABLED` ; `sendSMS` rendait `false` en silence sans `TWILIO_PHONE_NUMBER`
  ou sans identifiants. `services/sms-ready.ts` porte la règle, partagée par la
  promesse et par `voice:doctor`, qui affiche aussi la dernière réservation et
  ses tentatives de SMS avec l'erreur Twilio. Cause probable à vérifier au
  docteur : un numéro Twilio non SMS, ou l'erreur 21408 (région non autorisée
  pour la Belgique dans la console Twilio, Messaging > Geo permissions).
- **L'enregistrement affichait 0:00 / 0:00.** L'URL Vapi était posée telle
  quelle en `src` ; une URL stockée à la fin de l'appel n'est pas une URL qui se
  lit encore depuis un navigateur. `GET /my-dashboard/calls/:id/recording`
  redemande l'adresse fraîche à Vapi et sert les octets avec `Range` ; le portail
  la lit avec son jeton et joue un blob, et dit désormais POURQUOI quand ça rate.
- **Ce que le docteur a dit le soir même (22:45), et qui tranche les deux
  derniers.** Le SMS : `Invalid 'To' Phone Number: 3248362XXXX [Twilio 21211]`.
  Le numéro de l'appelant passe par `normalizeNumber`, qui ne garde que les
  chiffres pour servir de CLÉ (attribution, mémoire d'appelant) ; Twilio veut
  E.164 avec le « + ». `utils/sms-e164.ts` remet le « + » au seul endroit qui
  envoie (`sendSMS`), donc pour tous les SMS. L'enregistrement : l'URL stockée
  est une URL SIGNÉE Cloudflare R2 (`r2.cloudflarestorage.com`) qui répond 400
  quelques heures plus tard. Elle a une durée de vie ; celle que Vapi rend à la
  demande vit. Le portail passe par la route, jamais par la colonne, et le
  docteur teste les deux URL, avec le corps du refus.
- **Second appel test du soir (23:00), transcript lu ligne à ligne.** Trois
  défauts et une mesure. (1) « Un nom corrigé est un nom nouveau, relu à son
  tour » a produit TROIS tours de « Parfait, je vous réserve ça » : chaque
  correction relançait une relecture, que l'appelant corrigeait. Une relecture
  par APPEL ; après, l'appelant a le dernier mot. (2) « VAN espace H0LD » : le
  transcripteur rend l'épellation en capitales collées, entend « O » comme 0
  et écrit le mot « espace » ; `normaliseSpelledName` lit les trois. (3) Sans
  horaires enregistrés, `dayWindow` tenait tous les jours pour ouverts 9 h-17 h
  et l'agent a inventé « exceptionnellement ouvert ce dimanche » ; le défaut
  est désormais celui que le portail AFFICHE (`DEFAULT_WEEK_HOURS`, week-end
  fermé), pour que l'écran et l'agent disent la même chose. (4) Le docteur
  lit l'horloge de Vapi (`secondsFromStart`) : durée de chaque outil et délai
  entre la fin de parole de l'appelant et la réponse, médiane et max. C'est ce
  qui mesure « il y a un délai » au lieu de le ressentir. `VOICE_IDLE_NUDGE_SECONDS`
  passe de 8 à 10 s : « Vous m'entendez ? » tombait sur une hésitation.
- **Troisième appel (« je dois modifier la date »).** (1) « Aucune
  réservation sous ce nom » alors qu'elle existait, prise par le même numéro :
  l'appel a traversé un déploiement, et la session en mémoire (qui porte le
  numéro de l'appelant) n'y survit pas ; `lookupBooking` cherchait alors par le
  nom seul. `handleToolCalls` recrée la session depuis l'événement, qui porte
  le numéro. (2) « Il ne reconnaît pas les clients » : le prompt de l'assistant
  ENREGISTRÉ est figé à la synchronisation, donc il naît avec un historique
  vide, et le chemin custom-LLM n'ajoutait rien. `callerHistoryBlock` (extrait
  de `buildSystemPrompt`) est posé à chaque tour par `llm-stream`, le numéro lu
  sur la requête de Vapi (`body.call.customer.number`), qui survit à tout.
  (3) « Modifier » finissait en `bookAppointment` : second rendez-vous, l'ancien
  toujours dans l'agenda. `rescheduleBooking` déplace la ligne, supprime
  l'ancien événement Google, recrée le nouveau et renvoie le SMS ; le prompt
  et `lookupBooking` disent l'ordre lookupBooking → checkAvailability →
  rescheduleBooking. Le plafond du prompt passe à 2700 pour cette ligne.
- **Nuit du 13/09, après les fusions.** (1) « Le plus tard, c'est 11 heures »
  pour un cabinet ouvert jusqu'à 18 h : `checkAvailability` coupait la liste
  à TROIS créneaux (`MAX_SPOKEN_SLOTS`) pour que l'agent n'en lise pas dix, et
  le modèle lisait la fin de la liste comme la fin de la journée. La liste est
  entière, avec la fenêtre d'ouverture du jour ; c'est la PAROLE qui se limite
  à un créneau à la fois, pas la connaissance. (2) `'From' +1934… is not a
  Twilio phone number [21659]` : le « + » de #233 était bien là, c'est
  l'expéditeur qui n'appartenait pas au compte. Le SMS part désormais de la
  ligne MOBILE attribuée au client (`smsService.senderFor`, stock Twilio,
  type `mobile` seul à porter le SMS), `TWILIO_PHONE_NUMBER` n'est que le
  repli de la ligne partagée, et l'agent ne promet un SMS que si CE client a
  un expéditeur. Le docteur demande à Twilio si le repli appartient au compte.
  (3) « Cannot read properties of undefined (reading '0') » : un refus
  d'OpenAI rend un corps sans `choices` ; l'analyse nomme désormais le statut
  et le message. (4) Avec `gpt-4.1-mini`, l'agent a écrit « MAR0N », « MASR0N »
  puis « MACRZRN » en épelant « Macron » : le petit modèle mange des lettres
  en épelant, et la synthèse lit « zéro ». À surveiller ; `VAPI_MODEL` se
  change sans déploiement.

### 6duotrigesies. « Est-ce que gpt-4.1-mini tourne vraiment ? » se LIT, il ne se déduit pas (13/09/2026)
Sur custom-LLM, le modèle se choisit dans le backend à CHAQUE tour, depuis
l'environnement de Render : `VAPI_MODEL` pour le tour complet (intention
métier, résultat d'outil à dire, plus de cinq mots), `VOICE_SMALL_MODEL`
(`gpt-4o-mini` par défaut) pour le tour court sans enjeu. Le nom de modèle que
porte l'assistant DISTANT chez Vapi est décoratif sur ce chemin, et
`voice:resync` / `voice:doctor` lancés depuis un poste lisent le `.env` de CE
poste, pas celui de Render. Trois lectures qui disent chacune autre chose que
ce qui sert. La seule qui compte est le flux d'OpenAI, qui nomme le modèle
daté (`gpt-4.1-mini-2025-04-14`) dans chaque tranche : il est consigné par tour
sur la session (`models`), écrit avec les métriques de fin d'appel
(`metadata.realtime.models`), journalisé en info sur Render (« modèle demandé
X, servi Y ») et lu par le docteur sur le dernier appel (« modèles servis »).

### 6tertrigesies. L'assistant enregistré n'était PAS sur custom-LLM (13/09/2026)
Sixième trou de la famille 6quindecies, relevé au docteur : « modèle porté par
l'assistant qui décroche (openai) : gpt-4.1 », « modèles servis : aucun
relevé ». Les deux écritures de `onboarding.service.ts` posaient
`provider: 'openai'` à la main, donc Vapi appelait OpenAI lui-même avec le
modèle figé à la synchronisation, et TOUT ce que `llm-stream` ajoute à chaque
tour (mémoire de l'appelant, date, reprise après coupure, étages de modèle,
cache de préfixe, transfert explicite, relevé du modèle servi) n'atteignait
aucun appel sur une ligne dédiée. `assistantModelBlock` (`speech-plans.ts`)
est désormais LE bloc `model`, appelé par `buildSpeech` et par les deux
écritures ; le choix custom-LLM se lit sur le profil ; `customLlmUrlFor` est
la seule source de l'URL. Un test de source interdit `provider: 'openai'`
dans `onboarding.service.ts`. Après déploiement : `npm run voice:validate`
puis `voice:resync --confirm`, sinon l'assistant distant reste en `openai`.
Même journée, trois autres : (1) lookupBooking rendait la PREMIÈRE réservation
du numéro par date, donc un autre rendez-vous du même appelant, et le modèle
concluait « rien le 14 » puis faisait répéter le nom cinq fois (« de la
Ford », « Delaforde », « de la foireux »…). Il rend maintenant TOUTES les
réservations à venir de l'appelant, classées par ressemblance de nom
(`utils/name-match.ts`, Levenshtein sur le nom entier et sur le nom de
famille, seuil 0,6) et par `currentDate` ; rescheduleBooking demande laquelle
quand deux se valent. (2) Le SMS lie `/api/public/booking/:id/agenda`, le
gabarit Google Agenda pour tous : un lien https vers un `.ics` tapé depuis
Messages sur iPhone ouvre « Ajouter un calendrier avec abonnement », un flux,
pas un rendez-vous, et sur Android il se téléchargeait sans rien ouvrir. (3) Le docteur décode `X-Amz-Date` et
`X-Amz-Expires` de l'URL d'enregistrement et dit si Vapi rend la même URL
signée qu'à la fin de l'appel : « 400 InvalidArgument Authorization » quatre
minutes après l'appel n'est pas une expiration, c'est à lire là.

### 6quattuortrigesies. Premier appel en custom-LLM sur l'assistant enregistré : raccroché après l'accueil (13/09/2026)
Le bloc `server` de l'assistant porte `x-vapi-secret` (`webhookServer`), le
bloc `model` d'un custom-LLM n'a pas d'en-têtes : ce que Vapi envoie sur ce
chemin dépend d'un réglage hors du dépôt. Un 401 sur le premier tour de
modèle se manifeste exactement ainsi : l'accueil (synthétisé par Vapi) part,
puis Vapi raccroche, et rien ne s'affiche nulle part. Le secret voyage donc
AUSSI dans l'URL (`customLlmPathToken`, HMAC par client, 32 caractères), et
`isCustomLlmAuthorized` accepte l'en-tête OU le jeton ; l'URL n'est connue que
de Vapi, même confidentialité qu'un en-tête. Le 401 est journalisé en warn en
disant ce qui manque. Après déploiement : `voice:resync --confirm` pose l'URL
avec jeton ; l'ancienne route sans jeton reste pour les assistants pas encore
resynchronisés. Cause à CONFIRMER au docteur (`endedReason` du dernier appel)
et dans les journaux Render (`[VoiceLLM] 401`).

### 6quinquetrigesies. « Pardon, je vous ai mal entendu » quatre fois : le corps de Vapi partait ENTIER chez OpenAI (13/09/2026)
Le 401 réglé, l'agent décroche et chaque tour tombe en phrase de repli. Le
docteur : 4 répliques, « modèles servis : aucun relevé ». Cause : `proxy()`
recopiait la requête de Vapi entière (`...request`), donc `call`,
`phoneNumber`, `customer`, `metadata`, et OpenAI refuse tout argument
inconnu (400 « Unrecognized request argument supplied »). Le harnais d'évals
ne pouvait pas le voir : il fabrique des requêtes propres. Donc le chemin
custom-LLM n'avait JAMAIS servi un appel réel, sur aucune ligne, et tout ce
qui a été mesuré aux évals depuis des semaines l'a été sur un chemin mort.
`toOpenAiBody` ne recopie que les champs qu'OpenAI lit ; l'erreur porte le
corps entier de la réponse ; chaque tour en repli est consigné sur la session
(`llmFailures`) et écrit avec les métriques, et le docteur l'affiche
(« TOURS EN REPLI : raison ×n »). La règle : un chemin qui n'a jamais
atteint un appel réel n'est pas prouvé, quel que soit le vert des évals
(6octovicies, encore).
Même relevé : les QUATRE adresses d'enregistrement de l'appel sont des
adresses R2 nues du même compte, donc le stockage Vapi de ce compte est
privé ; ce n'est pas une adresse à choisir, c'est un réglage Vapi ou des
clés R2 à donner au backend.

### 6sextrigesies. Premier appel réel sur custom-LLM qui tient (13/09/2026, 06:13) et ce qu'il laisse
Reconnu par le numéro, réservation retrouvée du premier coup, samedi refusé,
déplacement sans doublon, date connue. Trois restes. (1) La fiche d'appel et
le contact CRM portaient le nom ENTENDU par l'analyse (« Jean Lucas ») alors
que la réservation, relue et épelée, dit « Jean-Luc de la forge » :
`knownCallerName` fait primer la réservation de l'appel, puis la dernière
réservation du numéro, puis la mémoire d'appelant, sur le nom du transcript.
(2) Un tour en repli au milieu de l'appel : la raison est dans « TOURS EN
REPLI » du docteur, à lire avant de toucher `VOICE_FIRST_TOKEN_TIMEOUT_MS`.
(3) « 2 0 2 6 » lu chiffre par chiffre par Cartesia : le modèle a recopié
l'année de la ligne de date ; à traiter si ça se répète.

### 6septtrigesies. L'enregistrement se lit par la route documentée, jamais par l'adresse de l'appel (13/09/2026)
Tranché avec l'onglet Réseau du tableau de bord Vapi : les adresses que
porte l'appel (`artifact.recordingUrl`, stéréo, par canal) sont des adresses
R2 NUES sur le stockage privé de Vapi (bucket `hipaa-recordings`, nom
interne, sans rapport avec un réglage HIPAA du compte ; aucun stockage
Cloudflare n'est configuré chez nous). Elles répondent « InvalidArgument /
Authorization » à tout le monde, et ce n'est pas une expiration. Le tableau
de bord obtient une adresse signée pour 30 minutes ; pour une clé API, le
chemin documenté est `GET /call/{id}/mono-recording` (ou `stereo-`,
`assistant-`, `customer-recording`), qui répond **302** vers cette adresse.
`vapiClient.recordingUrl` lit le `Location` sans suivre la redirection, le
portail l'essaie en premier, le docteur affiche « adresse signée
(/call/:id/mono-recording) ». La règle : une adresse rendue par une API
n'est pas forcément une adresse qui se lit ; quand le tableau de bord du
fournisseur y arrive et pas nous, l'onglet Réseau dit comment il fait.

### 6octotrigesies. Le nom : celui qui est ÉPELÉ, jamais celui qui est entendu (13/09/2026)
Appel réel : l'appelant dit « Jean-Luc », le transcripteur écrit « Jean Lucas »,
l'agent l'appelle ainsi tout l'appel alors que sa réservation, relue et épelée,
dit « Jean-Luc de la Forge » ; et la mémoire d'appelant, écrite depuis le lead
capté en cours d'appel, gardait le nom ENTENDU et le redisait à l'appel suivant.
Quatre endroits tiennent la même règle, le nom confirmé prime partout :
`getCallerHistory` lit d'abord le nom de la réservation confirmée (même ordre
que `knownCallerName`), le bloc d'historique dit au modèle « appelle-le X,
jamais par ce que tu as cru entendre », `persistMemory` écrit `nameCollected`
avant le nom du lead, et l'analyse post-appel reçoit le nom confirmé pour que
le résumé ne redise pas le nom entendu.
Un appelant INCONNU épelle son nom de famille à la première présentation
(`needsCallerSpelling`, une fois par appel, AVANT toute écriture) ; l'agent
relit ensuite les lettres une fois, et l'orthographe épelée est celle du lead
et des rappels. Un appelant connu n'est pas interrogé. Si l'historique est
illisible, on ne demande pas d'épeler : la relecture reste le filet.
**Un nom ne contient jamais de chiffre** : le petit modèle écrit « MAR0N » en
épelant et la synthèse lit « zéro ». `spellOut` et `normaliseSpelledName`
lisent 0 comme O, et la règle de parole le dit. Le plafond du prompt passe à
2900 pour cette ligne.
**Le retour de bâton, une heure après (16:52), à ne pas refaire.** Deux
défauts de la version ci-dessus. (1) `getCallerHistory` prenait le nom de la
PREMIÈRE réservation à venir rendue par la base, sans tri : une vieille
réservation de test « Paul Matthieu » sous le même numéro a nommé l'appelant.
Elle lit désormais la plus récemment TOUCHÉE (`updatedAt desc`), et si les
réservations à venir du numéro portent des noms différents (un numéro qui
réserve pour plusieurs personnes), elle ne nomme PERSONNE. (2) « Appelle-le X,
jamais par ce que tu as cru entendre » a tenu contre QUATRE démentis (« ce
n'est pas moi, moi c'est Jean-Luc de la forge ») : une consigne absolue sur
un nom est une consigne contre l'appelant. Le nom connu est dit
« probablement », et la règle ajoute que l'appelant qui dément a le dernier
mot : on redemande, on fait épeler, on cherche sous le nom qu'il donne. Le
même repli est écrit dans le retour de `lookupBooking`.

### 6novotrigesies. Le compte s'active avec quatre champs, et l'agent invente le reste (13/09/2026)
Retour : « on laisse le client trop libre, le compte est activable avec peu
d'informations, j'ai peur que l'IA invente ». Ce que le code disait : la
règle anti-invention (« appelle lookupKnowledge, n'invente jamais »)
n'existait QUE pour un client avec base de connaissances ; le compte neuf,
celui qui en sait le moins, était le seul sans consigne « dis que tu ne sais
pas ». Les lacunes (`knowledge_gaps`) existaient mais vivaient sous la ligne
de flottaison de la page Réceptionniste. Et un questionnaire guidé complet
existait dans `onboarding-flow.service.ts`, servi seulement au parcours
vendu (`/onboarding?token=`), jamais au libre-service.
Trois pièces, dans cet ordre. (1) `services/setup-completeness.ts` : un score
par MÉTIER depuis le preset (même table que le formulaire et le prompt),
pondéré (transfert 3, horaires et services 2, urgence / annulation /
mutuelles 2, le reste 1), porté par `/my-dashboard/overview` (`setup`) et
`/my-dashboard/setup`. Il vit DANS le bandeau « Démarrer avec Qwillio »,
comme l'étape « Apprendre son métier à votre réceptionniste » (cochée à
70 % pondérés, pas à 100 : « laissez vide ce qui ne vous concerne pas » est
écrit sur le formulaire), plus une étape par lot de questions d'appelants
sans réponse ; une carte à part sur la même page redisait la même chose et
a été fondue (retour du soir). Le bandeau reste tant que l'un des deux
manque. (2) `/dashboard/setup/guide`
(`ClientSetupGuide.tsx`) : ce qui manque, une question à la fois, avec
l'exemple rempli, enregistré par le PUT partiel de la page Réceptionniste,
UNE clé par étape ; le modèle d'horaires est partagé (`utils/week-hours.ts`).
(3) La règle anti-invention vaut pour tous les profils ; l'outil seul dépend
de la base. Deux scénarios d'éval (`fr-hors-base-sans-kb`,
`fr-hors-base-avec-kb`) posent une question que rien ne couvre. Plafond du
prompt à 3150 pour cette ligne.
(4) Page « Rendez-vous » (`/dashboard/bookings`) avec annulation : le
portail listait les réservations sans jamais permettre d'en annuler une, or
c'est la réservation EN BASE que l'agent lit pour reconnaître un appelant ;
supprimer l'événement Google ne la touche pas. L'annulation retire aussi
l'événement et oublie le nom en cache.
(5) Le 15/09, la page devient un CALENDRIER (`utils/month-grid.ts`, semaine du
lundi, fuseau du navigateur comme les libellés) : un compte par jour, un jour
choisi ouvre ses rendez-vous, un rendez-vous déplié lit
`GET /my-dashboard/bookings/:id/context` (mémoire d'appelant, appels du
numéro, dernier lead, autres rendez-vous, tout sous le `clientId` du jeton et
le numéro sous ses deux écritures, `phoneForms`) et mène à Appels et Leads
filtrés par `?phone=`, un filtre SERVEUR : la recherche locale de ces pages ne
voit qu'une page de vingt. `GET /bookings?from&to` sert le mois, annulés
exclus. Les cartes exposent `initialMonth` pour les tests.

### 6quadragesies. « Parfait, je vous réserve ça » sans nom, donc sans réservation (15/09/2026)
Appel réel depuis un numéro INCONNU : créneau proposé, « oui, je confirme »,
« parfait, je vous réserve ça », au revoir. Aucun nom demandé, rien dans
l'agenda, aucun SMS. Le SMS ne part qu'APRÈS une ligne de réservation, et
`bookAppointment` refuse sans `customerName` : soit l'outil n'a pas été appelé,
soit il a rendu « INFOS MANQUANTES », un texte qui ne disait ni que rien n'était
pris, ni quoi faire, et le modèle a annoncé une réservation qui n'existait pas.
Trois choses tiennent la règle, au moment où le modèle la lit : le résultat des
créneaux dit la suite (prénom et nom de famille, puis l'outil, réservé
seulement après RESERVE) ; `missingBookingInfo` dit « RIEN N'EST RESERVE », ce
qui manque et l'ordre ; la règle de prompt porte le nom et interdit « c'est
réservé » avant le retour de l'outil. `fr-reservation-sans-nom` mesure le cas
exact. Plafond du prompt à 3300 pour cette ligne. `npm run voice:doctor` dit si
l'outil a été appelé sur l'appel et avec quels arguments : c'est ce qui tranche
entre « pas appelé » et « appelé sans nom ».
**Ce que le docteur a dit une heure après, et qui n'était ni l'un ni l'autre :**
`bookAppointment { customerName: "client" }`. Le modèle a REMPLI le champ
obligatoire avec un mot, l'outil a pris « client » pour un inconnu à faire
épeler, et le modèle a annoncé la réservation puis appelé `endCall`. Deux
règles en sortent. Un nom bidon vaut absence de nom : `nameProblem()`
(`utils/spelled-name.ts`) écarte les remplissages (« client », « inconnu »,
« Monsieur », « unknown »…) et un prénom seul, et `captureLead` n'écrit jamais
un tel nom dans le CRM ni la mémoire. Et tout résultat qui retarde la
réservation (épellation, relecture) COMMENCE par « RIEN N'EST ENCORE RESERVE,
ne l'annonce pas et ne raccroche pas » : la consigne seule ne suffisait pas,
l'état doit être dit avant. `fr-reservation-nom-bidon` rejoue le résultat exact.

### 6unquadragesies. Le montage à UN numéro : possible avec un renvoi conditionnel (15/09/2026)
Demande : « mon numéro, l'IA répond dessus, et si besoin ça sonne sur mon
téléphone ». Le code refusait le propre mobile du client en numéro de
transfert (`wouldLoop`), pour tout type de renvoi, et l'écran disait
« indiquez une autre ligne ». C'est vrai SEULEMENT pour le renvoi de tous les
appels (`*21*`) : le réseau ne fait alors plus jamais sonner le téléphone, y
compris quand c'est l'IA qui l'appelle, et aucun code ne contourne ça. Le
défaut « Automatique » reste ce renvoi-là, par choix : sinon chaque appelant
attend la sonnerie avant l'IA.
Avec un renvoi CONDITIONNEL (occupé, non-réponse, ou le complet `**004*`), le
téléphone sonne d'abord, donc son propre mobile devient une cible valide.
Trois pièces tiennent le montage, et il les faut toutes : (1) `wouldLoop`
reçoit le type de renvoi (envoyé par le PUT, sinon celui en base, sinon le
pire cas) et ne refuse plus en conditionnel ; le profil d'appel porte
`forwardingType` pour la même décision à la construction des outils.
(2) Le délai est ÉCRIT dans le code composé, `*61*numéro**30#`
(`NO_ANSWER_DELAY_SECONDS`), et doit rester plus long que
`VOICE_TRANSFER_RING_SECONDS` (20 s) : Vapi abandonne le transfert avant que
le renvoi ne le ramène chez nous. Sans délai écrit, l'opérateur applique le
sien, souvent 15 s, et le transfert reviendrait vers l'IA. (3) Le cas
« occupé » revient chez nous immédiatement : `self-call-guard.ts` raccroche
tout appel dont l'appelant PRÉSENTÉ est une ligne de la PLATEFORME (dédiée ou
partagée), par l'adresse de contrôle de l'appel (`vapiClient.endCall`). Jamais
comparé aux numéros déclarés par le client : un opérateur peut présenter la
ligne qui renvoie sur un vrai appel renvoyé (REL-11), et raccrocher là
couperait un client. **Le message `end-call` sur `controlUrl` n'a pas encore
été vu sur un appel réel** : à confirmer dans les journaux Render
(`[Voice] BOUCLE entrante`) au premier cas.

### 6duoquadragesies. « Il est lent » : où va la seconde, lue et non devinée (16/09/2026)
Premier relevé du docteur sur un appel réel : LLM 1,8 s de médiane avant le
premier jeton, TTFA 3,5 s, « son parti avant la fin du texte : 0/6 ». Trois de
ces chiffres mentaient par construction, et c'est ce qui est corrigé avant de
régler quoi que ce soit. (1) « LLM » additionnait NOTRE préparation (profil,
historique, blocs) et le délai d'OpenAI : `PREP` (entrée → envoi) et `LLM`
(envoi → premier jeton) sont deux étages, `markLlmRequestSent` posé juste
avant le `fetch`. (2) Le TTFA comptait les tours où le modèle répond par un
OUTIL : le son ne pouvait pas partir avant l'agenda et le tour suivant, donc
la médiane de synthèse portait du temps d'agenda. `markToolTurn` (sur
`tool-calls` et sur le transfert local) efface les bornes de synthèse de ce
tour ; le TOTAL le garde, c'est ce que l'appelant attend. (3) Le taux de
cache de préfixe OpenAI était consigné (`metadata.realtime.tokens`) et jamais
montré : le docteur l'affiche, et 0 % se lit « préfixe payé à chaque tour ».
Deux gains sans nouvel appel : `prompt_cache_key` se mesurait sur le seul
message système (seuil 4 000 caractères) alors qu'OpenAI hache prompt ET
définitions d'outils, qui pèsent plus que le prompt, donc la clé n'était
jamais posée (`cacheablePrefixChars`) ; et l'historique de l'appelant plus
l'expéditeur SMS se lisent à l'OUVERTURE de l'appel (`warmCallerContext`),
pendant l'accueil, au lieu du premier tour et de `bookAppointment` (memo de
cinq minutes par client). Les réglages Vapi (`VOICE_START_WAIT_SECONDS`,
`VOICE_ENDPOINTING_PUNCTUATION_SECONDS`) se touchent APRÈS le prochain
relevé, quand PREP et LLM diront à qui appartient la seconde.

### 6terquadragesies. `voice:audit` tranche, `voice:doctor` décrit (16/09/2026)
Après un appel test, la question est « tout marche ? tout est réglé ? », et
le docteur y répond par deux écrans de faits qu'il faut relire. `npm run
voice:audit` (`scripts/audit-call.ts`, dernier appel par défaut,
`--call=<vapiCallId>` ou `--email=` sinon) collecte les faits (notre ligne
d'appel et son `metadata.realtime`, l'appel chez Vapi avec son horloge, la
réservation liée et ses SMS, l'assistant DISTANT, l'env du processus) et
`services/voice/call-audit.ts` rend une ligne par vérification : verdict,
valeur, cible, LEVIER (variable, commande ou code à toucher), en trois
familles (fonctionnement, latence, réglages) et une liste « à faire, dans
l'ordre ». Le module est pur et testé sur des faits écrits à la main ; le
script ne fait que lire. Les cibles (`TARGETS`) sont des cibles de
conversation naturelle : PREP 150 ms, LLM 900 ms, TTFA 700 ms, TOTAL 2 s,
délai Vapi 2 s, outil 1,5 s, cache ≥ 40 % (jugé à partir de trois tours).
Le script d'APPEL, ce que l'appelant dit pour exercer tout ce qui compte en
DEUX appels (accueil, hors-base, agenda, nom épelé, réservation, SMS,
interruption, bruit, puis appelant connu, déplacement, transfert, et les
refus propres, placés là où ils tombent dans une vraie conversation), est
dans `docs/SCRIPT-APPEL-TEST.md`.

### 6quaterquadragesies. DEUX niveaux, et le septième trou de la même famille (16/09/2026)
Demande : « deux modèles, les agents classiques et les superagents en temps
réel ». Le mode parole-à-parole existait déjà, réglable par client
(`voiceMode`), validé par `voice:validate` sur les six variantes. Ce qu'il
n'avait pas, et que personne ne pouvait voir en lisant le réglage : les DEUX
écritures de `onboarding.service.ts` posaient `buildRealtimePlans(lang, false,
…)`, un `false` écrit en dur, et assemblaient le bloc `model` avec
`assistantModelBlock`, c'est-à-dire toujours en classique. Or c'est l'assistant
ENREGISTRÉ qui décroche sur une ligne DÉDIÉE (6quindecies / 6tervicies). Donc
un client réglé en temps réel gardait la chaîne classique **dès qu'il payait**,
le réglage s'enregistrait, l'écran disait enregistré, et seule la ligne
partagée des essais entendait l'autre moteur. Septième trou de la famille.
Pire que l'inverse : les plans classiques partaient AVEC le mode temps réel
s'il avait pu s'activer, et ces plans comptent des MOTS que le transcripteur
retiré ne fournit plus, donc la réceptionniste attend, ne répond pas, et le
délai de silence raccroche.
`services/voice/voice-tiers.ts` porte la table : `base` (la chaîne
d'aujourd'hui, `tuning` VIDE pour que nommer ne change rien) et `superagent`
(parole-à-parole). `voiceModeFor` est LA lecture, le niveau d'abord, l'ancien
`voiceMode` en repli au même endroit (6duovicies) ; `useSpeechToSpeech` reste
seul à trancher, donc une voix CLONÉE prime toujours sur le niveau demandé.
`assistantSpeechForProfile` est l'assembleur partagé par les deux écritures, et
les cinq chemins qui font parler l'agent lisent la même règle : un test de
source interdit `voiceMode: profile.voiceMode` dans les quatre fichiers, et la
forme fautive a été réintroduite une fois pour vérifier qu'il tombe.
Ce que superagent PERD, et qu'il faut dire avant de le vendre : sur ce chemin
Vapi appelle OpenAI directement, donc plus de custom-LLM, donc rien de ce que
`llm-stream` ajoute par tour (mémoire de l'appelant, date, reprise après
coupure, étages de modèle, cache de préfixe). Le prompt et les outils, si.
L'audit a été rendu conscient du niveau pour la même raison qui l'a fait
naître : il annonçait « l'assistant distant est en openai, resynchroniser » à
tout client superagent, un diagnostic FAUX qui envoie chercher une panne
inexistante (6sexvicies). Il porte désormais `niveau servi par l'assistant qui
décroche`, lu sur l'assistant DISTANT et comparé au profil.
`npm run voice:tier` fait les TROIS gestes sans lesquels le champ ne sert à
rien : écrire, vider le cache, resynchroniser. `docs/VOICE-TIERS.md` dit le
reste, dont le coût (facteur dix entre `gpt-realtime-2` et le mini, pour une
recette de 0,26 à 0,40 € la minute incluse).
**Superagent n'a jamais été entendu sur un appel réel**, et c'est la seule
chose qui compte avant de le proposer par défaut : un mécanisme qui n'a pas
atteint un appel n'est pas une optimisation (6octovicies, 6quinquetrigesies).

### 6quinquequadragesies. Le Superagent se VEND, et le modèle est la décision (16/09/2026)
Demande : inclus à partir de Pro, en option sur les petits forfaits, activable
à l'achat et après, sans perdre la marge. `config/voice-economics.ts` pose
chaque tarif fournisseur avec sa SOURCE, et `npm run voice:pricing` rend la
feuille. Ce que ça dit, et qui n'était devinable nulle part : la minute
classique coûte 0,094 € (la grille était posée sur « ~0,15 », donc
prudemment), le mini coûte 0,110 €, soit **1,6 centime de surcoût**, donc
l'inclure haut de gamme coûte 4 à 6 % du prix du forfait et la grille n'a pas
besoin de bouger. Avec `gpt-realtime-2`, la minute coûte 0,651 € quand la plus
chère de la grille en rapporte 0,396 : **tous les paliers paient pour vendre**,
et aucun prix d'option ne rattrape ça. Le choix du modèle n'est pas un réglage
technique, c'est la décision tarifaire.
**Le tarif du modèle par DÉFAUT (`gpt-realtime-2025-08-28`) n'a jamais été
relevé**, et le module REFUSE de calculer plutôt que d'inventer : c'est
6quinvicies appliqué à l'argent, une valeur supposée qui a l'air d'une lecture
coûte plus cher que pas de valeur.
Le droit : `superagent` entre dans `PLAN_CAPABILITIES` (pro, enterprise) et
`superagentAllowed(client)` est la SEULE lecture, forfait puis option achetée.
L'option vit sur une COLONNE (`superagent_option`), jamais dans `vapiConfig` :
ce JSON est celui que le PUT du portail fusionne, donc un droit facturé qui
vivrait là serait accordable depuis le navigateur de celui qui doit le payer.
Le contrôle est posé à deux endroits et il faut les deux : le PUT répond 403 en
nommant le forfait (sinon l'écran dit « enregistré » et l'appelant entend
l'autre moteur), et `entitledTier` borne à la RÉSOLUTION, parce qu'un compte
qui redescend de Pro à Starter perd le droit sans que rien ne réécrive son
réglage. `ClientVoiceProfile.superagentAllowed` est obligatoire : ça a fait
sortir les trois autres constructeurs au compilateur, et ils n'ont pas la même
réponse (évals oui, `voice:validate` oui sinon trois variantes sur six ne
testent rien, démo publique NON, c'est un coût sans recette en face).
Facturation : `reportRealtimeSurcharge` ne facture PAS un forfait qui inclut le
Superagent. Sans cette ligne, poser le prix de l'option prélèverait deux fois
la même chose à un client Pro, sur une vraie carte, invisible jusqu'au relevé.
`npm run voice:tier -- --option=on` vend l'option ; sans argument le script
liste le niveau ET le droit, et il REFUSE de poser « superagent » sur un client
qui n'y a pas droit plutôt que d'écrire un réglage sans effet.
Reste à faire, et qui demande une décision : la caisse Stripe qui vend l'option
à l'inscription. Le supplément à la minute existe déjà ; le forfait mensuel
équivalent serait +20 €/mois sur Solo et +40 € sur Starter, et il n'est tenable
que parce que le surcoût par minute est petit.

### 6sexquadragesies. La phrase d'attente disait que c'était fait (16/09/2026)
Deux appels réels, et le relevé renverse l'hypothèse de départ. **La latence va
bien** : TOTAL médiane 1620 ms, dans la médiane publiée de l'industrie
(1,4-1,7 s), PREP à 1 ms, cache de préfixe à 76 % (la correction de
6duoquadragesies a marché). Ce qui a rendu ces appels pénibles est fonctionnel.
**La cause principale n'était pas le modèle, c'était une constante.**
`voice-tools.ts`, table `FILLER`, phrases dites au DÉMARRAGE d'un outil, avant
sa réponse : `bookAppointment` disait « Parfait, je vous réserve ça »,
`rescheduleBooking` disait « Je déplace votre rendez-vous ». Entendu : « Parfait,
je vous réserve ça » suivi dans la seconde de « pourriez-vous épeler votre nom de
famille » (rien n'était réservé, et rien ne l'a été de tout l'appel), puis
« Je déplace votre rendez-vous » SEPT fois pendant que l'outil répondait sept
fois « AUCUNE RESERVATION trouvee ». Le prompt avait été durci pendant des
semaines contre exactement ça (6quadragesies) pendant qu'une chaîne de
caractères le disait à voix haute avant que l'outil ne tourne.
**La règle** : une phrase d'attente décrit ce qui est EN COURS, jamais son
ISSUE. `checkAvailability` portait déjà la bonne forme (« Je regarde ça tout de
suite ») et sert de modèle. `filler-says-nothing-done.test.ts` gèle les formes
fautives et impose que chaque phrase de démarrage se lise comme une action en
cours. Un piège de méthode : ajouter une méthode au magasin de session casse les
tests qui le bouchonnent partiellement, et l'outil retombe alors sur « AGENDA
INDISPONIBLE », un repli sûr qui MASQUE le vrai message.
**La boucle, second défaut** : `rescheduleBooking` appelé NEUF fois avec les
mêmes arguments, 2,4 à 9,4 s chacun. Deux causes qui se renforcent : le résultat
INVITAIT le rappel (« puis rappelle rescheduleBooking avec ce nom ») et rien ne
comptait les essais. `CallSession.toolFailures` compte par `outil:raison`, et au
DEUXIÈME échec le résultat cesse d'inviter, nomme l'outil à ne plus appeler et
exige `captureLead`. C'est 6septies (le repli clavier au deuxième numéro dicté
illisible) appliqué aux outils : la cause ne bouge pas entre deux essais.
**Le troisième défaut est le plus coûteux commercialement** : l'agent a fini par
dire « je note votre demande et je transmets à l'équipe pour qu'ils vous
recontactent » **sans un seul appel à `captureLead`**. Rien n'a été noté,
personne ne rappellera, et l'appelant a raccroché rassuré. Trois lignes de
prompt en sortent (plafond à 3500) : un outil qui dit NON veut dire non,
promettre un rappel EXIGE `captureLead`, un outil qui échoue deux fois ne se
rappelle pas une troisième.
**Ce qu'il ne faut PAS faire** : baisser `VOICE_START_WAIT_SECONDS` ou
`VOICE_ENDPOINTING_PUNCTUATION_SECONDS`. Le ressenti à 2,2 s est TOTAL plus la
détection de fin de tour ; ces deux seuils ont été montés exprès le 12/09 après
« il parle par-dessus moi », et la chaîne est déjà dans les clous. Ce qui a duré,
ce sont les outils en boucle, pas les tours de conversation.
**Le SIP natif d'OpenAI, tranché le même jour** : l'API Realtime accepte
désormais un trunk SIP direct (250-350 ms, verbes `reject`, `refer`, `hangup`).
Ce n'est pas la réponse ici : les trois défauts ci-dessus sont notre code et la
discipline du modèle, donc ils voyageraient tels quels, et le parole-à-parole est
justement le terrain où l'appel d'outils est le plus faible. Coût caché relevé
en passant : **le traqueur de latence se nourrit des webhooks `speech-update` de
Vapi**, donc partir en SIP, c'est perdre la mesure. À rouvrir seulement quand les
défauts fonctionnels seront corrigés et qu'une cible sous 600 ms sera visée.

### 6quinquadragesies. Le calendrier montre le CONTENU, et la recherche est SERVEUR (16/09/2026)
Deux retours sur la page Rendez-vous, une même cause de forme. (1) La grille
tenait dans 880 px avec des cases de 56 px portant une pastille de compte: il
fallait cliquer un jour pour savoir qui venait. La page passe à
`max-w-[1600px]` (celle de Réceptionniste, déjà dans le portail), les cases à
`h-24 xl:h-28`, et chaque case porte DEUX rendez-vous lisibles (heure et nom)
puis « +N autres ». Le compte grossissant au survol est retiré: il révélait
un chiffre désormais écrit, et il aurait recouvert le contenu de la case.
(2) La recherche (client, sujet, numéro) est une route SERVEUR
(`GET /my-dashboard/bookings?q=`), pas un filtre sur l'état: la page ne
charge qu'un mois, donc une recherche locale aurait répondu « aucun
résultat » pour un rendez-vous de novembre. C'est le piège déjà payé par le
filtre `?phone=` d'Appels et Leads. `bookingSearch()` cherche le nom et le
sujet sans casse, et le numéro sur ses CHIFFRES (stocké tantôt
« 32483620980 », tantôt « +32… », tapé « 0483 62 »: un zéro initial cherche
aussi la forme sans zéro). Moins de deux caractères ne cherche rien, moins de
trois chiffres ne cherche pas un numéro. Pendant une recherche, les flèches
de mois et le sélecteur de vue disparaissent au lieu de rester inertes, et le
compte est dit UNE fois (sous le titre), la carte vide expliquant seulement
ce qui a été cherché.

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
