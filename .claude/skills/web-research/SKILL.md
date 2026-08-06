---
name: web-research
description: >-
  Multi-source web research with adversarial verification, no paid APIs. Use to
  research a topic across Reddit, YouTube, X/Twitter, GitHub, Hacker News, and
  the open web; to compare tools/products; to find what people actually say
  about something; or to check a trend. Trigger on research, benchmark,
  compare, "what do people say about", reviews of, trend, "is X or Y better",
  or "find sources on".
---

# Web Research

Give the agent eyes on the whole internet using `WebSearch` + `WebFetch` — zero API keys. Never trust one source; a claim survives only when two independent sources agree.

## Source map (search each angle it applies to)

- **Reddit** — real user opinion, pain points. Search `site:reddit.com <topic>`.
- **Hacker News** — technical depth, contrarian takes. `site:news.ycombinator.com <topic>` or Algolia.
- **GitHub** — code reality, issues, stars, recency, maintenance. Read the issues, not just the README.
- **YouTube** — walkthroughs, demos. Read titles/descriptions/transcripts.
- **X/Twitter** — recency, announcements. Via nitter mirrors or search.
- **Official docs / blog** — the primary source for capabilities and pricing.
- **Comparison/review sites** — treat as leads, verify their claims independently.

## Method

1. **Decompose** the question into sub-questions and search angles.
2. **Fan out** — search each relevant source. Prefer multiple query phrasings.
3. **Fetch** the promising results; read the actual content, not the snippet.
4. **Cross-check** — every material claim needs 2+ independent sources. One blog is a lead, not a fact.
5. **Date-check** — is the info current? Tools and pricing change. Note "as of <date>".
6. **Adversarial pass** — actively look for evidence that contradicts the emerging conclusion. If none survives, the claim holds.
7. **Synthesize** — a clear answer, the trade-offs, and a "Sources" list of the URLs used.

## Rules

- **Cite everything.** End with `Sources:` as markdown links.
- **Separate fact from opinion.** "The docs say X" vs "Reddit users report Y".
- **Flag uncertainty.** If sources conflict and you can't resolve it, say so.
- **No hallucinated sources.** If you didn't fetch it, don't cite it.

## Agent-Reach CLI (optionnel)

Si `agent-reach` est installé (l'install SuperClaude le pose via pip), il donne un accès CLI direct à Twitter, Reddit, YouTube, GitHub, Bilibili, XiaoHongShu — zéro clé API :

```bash
agent-reach search "<requête>" --platform reddit
agent-reach read <url>
```

Utilise-le en priorité pour Reddit/YouTube/X quand disponible ; sinon retombe sur `WebSearch`/`WebFetch`.

Pour des rapports profonds multi-tours, escalade vers `Skill(deep-research)` quand disponible (fan-out parallèle + vérification). Ce skill est le chemin léger always-on.
