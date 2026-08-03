# Qwillio — Product Context

## Product Purpose
AI voice platform for SMBs. The receptionist (Receptionist AI) answers inbound calls 24/7, books appointments, captures leads, transfers urgent calls. The agent suite (Qwillio Agent) adds Email, Accounting, Inventory, Payments AI modules. One brain, multiple workflows.

## Users
- **Primary**: Owners and operators of small French and Quebec service businesses (dental, salon, HVAC, garage, law, restaurant, real estate) — 1 to 30 employees, missing inbound calls daily, no front desk staff
- **Secondary**: French B2B sales agencies that want outbound voice automation
- **Tertiary**: Affiliates (consultants, agencies) reselling Qwillio for 30% recurring commission

## Surfaces and Register
This product has TWO registers across its surfaces. Identify before designing.

- **Brand register** (`register: brand`) — public marketing: Home, Landing/Receptionist, Agent, Pricing, About, Contact, Affiliate, Blog, Legal, Auth landing panels. Design IS the product here. Editorial, asymmetric, committed brand color.
- **Product register** (`register: product`) — authed app: Dashboard, Calls, Leads, Prospects, Clients, Billing, Settings, Campaigns, Client portal, Closer workspace, Admin tools. Design SERVES the product. Dark surfaces, dense data, restrained color, fast.

## Register
mixed

## Brand Voice
- Direct. French B2B, no startup enthusiasm. No "révolutionnaire", no "game-changer".
- Confident, results-focused. Slightly provocative when justified.
- Bilingual FR + EN. Proper French accents (é, è, à, ç, ô) always.
- No emojis. Use lucide-react icons or inline SVG.

## Anti-References
- Salesforce, HubSpot (enterprise bloat, white + teal, "saas-clean")
- Default Tailwind + shadcn out of the box
- Centered hero with three metric tiles below (saturated SaaS template)
- Identical card grid + 4 icons + headline + paragraph row (the "AI feature reveal" template)
- Generic gradient-text headlines
- Flat illustrations of robots / avatars / "AI brains"

## Tone
Linear × Vercel × Granola. Tools made by people who care about craft. Confident typography, asymmetric layout, single committed brand color carrying the surface.

## Core Value Props
1. Decroche en moins d'une seconde, prend les rendez-vous, qualifie les leads.
2. 24/7. Premier appel traité le jour meme. Transfert intelligent vers humain quand il faut.
3. 7 jours d'essai gratuit. Sans engagement. Annulez en un clic.
4. Suite agent modulaire: Email, Comptabilite, Inventaire, Paiements. Greffes a la carte.

## Pricing
Source unique de vérité: `backend/src/config/plans.ts`. Facturation à la minute, en euros.

- Solo 99 EUR/mois : 250 minutes incluses, 0,45 EUR/min au-delà, français
- Starter 249 EUR/mois : 750 minutes incluses, 0,39 EUR/min, bilingue FR/EN
- Pro 599 EUR/mois : 2 000 minutes incluses, 0,35 EUR/min (le plus populaire)
- Enterprise 1 290 EUR/mois : 5 000 minutes incluses, 0,30 EUR/min, responsable dédié, SLA 99,5 %

7 jours d'essai gratuit, sans frais d'installation. Une carte est demandée à l'inscription. Annuel: -20 %.
Toute modification de prix se fait dans `plans.ts` en premier, puis se propage à Pricing.tsx, Landing.tsx, Faq.tsx, Vertical.tsx, comparisons.ts et llms.txt.

## Brand Identity (LOGO-DRIVEN, NOT INHERITED FROM TAILWIND)
The Qwillio logo carries two overlapping circles:
- **Q-circle** (left, primary): indigo `oklch(56% 0.22 264)` = `#6366f1`
- **W-circle** (right, secondary): violet `oklch(67% 0.26 299)` = `#a855f7`

These two colors ARE the brand. Both must be visible across the system, not just indigo alone. Use indigo for receptionist / call / voice contexts. Use violet for agent / modules / outbound contexts. Drenched-color sections alternate indigo and violet across the page rhythm.

## The Color Strategy
**Committed** (per impeccable taxonomy): indigo OR violet carries 30 to 60 percent of a given brand surface. Public hero, quote, drenched CTA = drenched. Product surfaces = restrained (neutrals tinted toward indigo, accent ≤ 10 percent of pixels).

## Justification for Indigo + Violet (Escapes the "LILA Ban")
The taste-skill's LILA ban targets generic "AI purple + neon glow" SaaS aesthetic. Qwillio's indigo+violet pair is semantically anchored to the logo's two Q+W circles, used WITHOUT gradient text, WITHOUT outer glows, WITHOUT mesh-blob backgrounds. It functions as committed brand identity, not decorative cliché.

## What Currently Ships (state of the codebase 2026-08)

### Voice core (next-gen receptionist, `backend/src/services/voice/`)
- Acts during the call: reads a connected Google Calendar live (availability is fetched as soon as a day is named), writes the booking confirmed, and holds a slot so two simultaneous calls cannot take the same one. Live booking requires a connected Google calendar; without one the agent captures the request and the caller's details.
- Warm transfer: spoken summary to the operator before the bridge, plus an SMS brief carrying name, number, reason and the caller's live mood.
- Caller memory (`caller_memories`): a known caller is greeted by first name, the previous call summary and upcoming appointment are loaded before pickup, and nothing already known is asked again.
- Real conversation: barge-in on voice activity (a cough or a "mhm" does not cut the agent), low-energy backchannels that are never read as consent, a nudge after a long silence, and shorter, non-commercial phrasing with an earlier human offer when the caller is upset.
- Business knowledge (`business_knowledge`): the highest-priority entries (rules first) sit in the system prompt, everything else is reachable on demand via `lookupKnowledge`, so a client can hold hundreds of entries. Lookup is token-overlap scoring, so a question phrased differently still finds its answer.
- Lead capture writes during the call, not at the end. External-tool failures degrade to an actionable instruction (take details, offer a callback); the caller never hears an error message.
- Weekly learning loop (`receptionist-learning.service`): reports what is off (too talkative, calendar disconnected, questions missing from the FAQ). It reports, it does not silently rewrite the agent.
- Conserved: spam shield off-quota, appointment confirmation SMS to the end customer, post-call analysis (summary, sentiment, scored lead), 24 h appointment reminders on Pro and Enterprise, recording announced at pickup (GDPR), EU hosting, 24/7, FR and EN on the same call.
- Not shipped: per-stage latency monitoring, own audio transport (transport stays with Vapi).

### Configuration
- Config chat (`assistant-chat.service`): the client changes settings by writing or dictating a sentence, applied through the same validated writer as the settings form.
- Rate import from a photo (`price-extraction.service`): the image is held in memory for the request only and dropped, nothing is stored; the extracted lines are written only after explicit confirmation.
- Live test call in the browser (`components/client/VapiLiveCall.tsx`) before forwarding the real number.
- 7 characters (5 FR: Marie, Camille, Léa, Lucas, Sofia; 2 EN: Ashley, Ethan) in `config/voice-characters.ts`, each pairing a voice with one of the 6 tones in `config/personalities.ts`. Trade-specific scripts in `config/niche-scripts.ts`.

### Surfaces
- Marketing V2 "Papier & Signal" (`pages/v2/`, `components/v2/`): Home, Receptionist, Pricing, Agent, About, Contact, Affiliate, Blog, FAQ, verticals, legal. Brand register, DA/v2-direction.md is law.
- Public Navbar + Footer: single `PublicShell`, two-color brand.
- Auth (Login, Register): two-column cream + dark indigo, in production.
- Client portal V2 (`components/v2/app/`, `pages/v2/app/`): dark "instrument" register, Blocks kit.
- Dashboard, Calls, Leads, Prospects, Clients, Billing, Settings, Campaigns, Closer workspace, Admin: dark surfaces, still on the ProBlocks design system.
- Legal: light theme intentional for legal readability, editorial TOC + scroll-spy.
- AgentAccounting / Email / Inventory / Payments: light-mode demo screens of the agent suite (intentional, marketing showcase).
