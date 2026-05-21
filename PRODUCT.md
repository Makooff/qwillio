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
3. Premier mois offert. Sans engagement. Annulez en un clic.
4. Suite agent modulaire: Email, Comptabilite, Inventaire, Paiements. Greffes a la carte.

## Pricing
- Starter $497/mois — 800 appels, support email
- Pro $1297/mois — 2000 appels, support prioritaire (le plus populaire)
- Enterprise $2497/mois — 4000 appels, responsable dedie, SLA
- Agent modules: +$197/mois par module

## Brand Identity (LOGO-DRIVEN, NOT INHERITED FROM TAILWIND)
The Qwillio logo carries two overlapping circles:
- **Q-circle** (left, primary): indigo `oklch(56% 0.22 264)` = `#6366f1`
- **W-circle** (right, secondary): violet `oklch(67% 0.26 299)` = `#a855f7`

These two colors ARE the brand. Both must be visible across the system, not just indigo alone. Use indigo for receptionist / call / voice contexts. Use violet for agent / modules / outbound contexts. Drenched-color sections alternate indigo and violet across the page rhythm.

## The Color Strategy
**Committed** (per impeccable taxonomy): indigo OR violet carries 30 to 60 percent of a given brand surface. Public hero, quote, drenched CTA = drenched. Product surfaces = restrained (neutrals tinted toward indigo, accent ≤ 10 percent of pixels).

## Justification for Indigo + Violet (Escapes the "LILA Ban")
The taste-skill's LILA ban targets generic "AI purple + neon glow" SaaS aesthetic. Qwillio's indigo+violet pair is semantically anchored to the logo's two Q+W circles, used WITHOUT gradient text, WITHOUT outer glows, WITHOUT mesh-blob backgrounds. It functions as committed brand identity, not decorative cliché.

## What Currently Ships (state of the codebase 2026-05)
- Home, Landing (Receptionist), Pricing, Agent, About, Contact, Affiliate, Blog: editorial redesign in progress, brand-register
- Public Navbar + Footer: editorial, two-color brand
- Auth (Login, Register): two-column cream + dark indigo, in production
- Dashboard, Calls, Leads, Prospects, Clients, Billing, Settings, Campaigns: dark surfaces using ProBlocks design system
- Client portal: dark, editorial-aware (ClientOverview, ClientReceptionist, ClientCalls, ClientLeads, ClientBilling, etc.)
- Closer workspace: dark, ProBlocks
- Admin pages: dark, ProBlocks
- Legal: light theme intentional for legal readability, editorial TOC + scroll-spy
- AgentAccounting / Email / Inventory / Payments: light-mode demo screens of the agent suite (intentional, marketing showcase)
