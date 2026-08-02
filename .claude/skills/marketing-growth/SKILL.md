---
name: marketing-growth
description: >-
  Marketing, conversion, and growth engineering for Claude Code. Use for
  landing pages, ad copy, CRO, SEO on-page, email/funnel copy, positioning,
  and growth experiments. Trigger on campaign, landing page, ad copy, headline,
  conversion, funnel, CRO, A/B test, SEO, growth, copywriting, value prop, or
  "sell / pitch / convert".
---

# Marketing Growth

Ship copy and pages that convert. Evidence over adjectives. Always pair with `Skill(prose-clean)` so nothing reads as slop, and `Skill(product-design)` when it's a real page.

## Copy frameworks

- **AIDA** — Attention → Interest → Desire → Action.
- **PAS** — Problem → Agitate → Solution. Strongest for pain-driven products.
- **Hook → Problem → Solution → CTA** — the default for a landing hero.
- **Before / After / Bridge** — current pain → desired state → your product as the bridge.

Pick one per asset. Don't mix frameworks in one section.

## Landing page structure

1. **Hero** — one clear value prop (what + for whom + outcome), one primary CTA. No carousel.
2. **Social proof** — logos, numbers, a real quote. Specific beats generic ("13M weekly downloads" > "loved by developers").
3. **Problem/solution** — the job the user is hiring you for.
4. **How it works** — 3 steps max.
5. **Objection handling** — pricing clarity, security, "does it work with X".
6. **Final CTA** — repeat the primary action. One action, not five.

One primary action per page. Secondary actions visibly subordinate.

## Headlines

- Lead with the outcome, not the mechanism. "Ship faster" > "AI-powered CI pipeline".
- Specific > clever. Numbers, timeframes, concrete nouns.
- Test the "so what?" — if a reader can shrug, rewrite.

## SEO on-page checklist

- One `<h1>` matching search intent; descending `<h2>`/`<h3>`.
- Title tag < 60 chars, meta description < 155, both with the primary keyword naturally.
- Semantic HTML, descriptive alt text, internal links with real anchor text.
- Fast LCP, no layout shift, mobile-first.
- Content answers the query in the first screen; depth below.
- Structured data (FAQ, Product, Article) where it fits.

## Growth experiments

- One hypothesis per test: "Changing X will move [metric] because [reason]."
- Change one variable. Define the success metric and minimum effect before running.
- Instrument first (event, funnel step), then ship, then read.

## Metrics vocabulary

CTR (click-through), CVR (conversion), CAC (acquisition cost), LTV (lifetime value), AOV (order value), activation, retention, churn. Tie every experiment to one of these.

## Nova context

For agency work (spots, Meta/Google Ads, sites, local SEO), route through `Skill(nova-agency)`, which coordinates `meta-ads`, `ads-production`, `web-creation`, and `seo-local`.
