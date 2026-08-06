---
name: context-engineering
description: >-
  Multi-agent architecture and context engineering for complex, multi-step
  work. Use when a task is too big for one pass, spans many files or subsystems,
  or benefits from parallel agents, decomposition, and verification. Trigger on
  orchestrate, decompose, "do X then Y then Z", multi-step, large migration,
  exhaustive audit, "be comprehensive", or coordinating multiple agents.
---

# Context Engineering

Structure work across agents to be comprehensive (cover in parallel), confident (independent verification), or bigger than one context (migrations, audits). The skill is deciding what fans out, what verifies, and what synthesizes.

## Objectif n°1 : économiser les tokens du thread principal

Déléguer = payer moins. Chaque sous-agent lit dans **son propre contexte** et ne renvoie que la **conclusion** — le thread principal ne charge jamais les fichiers bruts. Concrètement :

- **Lecture lourde → sous-agent.** « Où est défini X », « mappe ce dossier », « liste les usages de Y » : envoie un sous-agent (Explore/Task), garde le résumé, pas les extraits.
- **Ne relance pas une recherche déjà déléguée.** Attends le résultat du sous-agent au lieu de la refaire toi-même.
- **Retourne des données structurées** (schéma), pas de la prose, quand le parent doit agir dessus.
- **Un brief étroit par agent** — il raisonne mieux sur un contexte qu'il tient d'un coup, et te renvoie moins de bruit.
- **Résultat net :** le thread principal reste léger même sur une tâche qui touche 50 fichiers. C'est l'inverse de tout lire soi-même.

Règle simple : *si la réponse tient en 5 lignes mais exige de lire 2000 lignes, délègue la lecture.*

## When to reach for it

- The task names multiple independent subsystems.
- Coverage matters and one pass will miss things (audits, bug hunts, reviews).
- The work is larger than a single context can hold (migrations, sweeps).
- You want independent perspectives before committing (design, high-stakes review).

Not for simple, single-file, or conversational tasks — that overhead isn't worth it.

## Core patterns

- **Fan-out / gather** — split independent work across agents, run concurrently, merge. Use `Skill(dispatching-parallel-agents)` and the `Workflow` tool when available.
- **Pipeline** — each item flows through stages independently; no barrier between stages unless a stage genuinely needs all prior results.
- **Adversarial verify** — spawn N skeptics per finding, each prompted to refute. Kill findings a majority refutes. Prevents plausible-but-wrong conclusions.
- **Perspective-diverse verify** — give each verifier a distinct lens (correctness, security, perf, repro) instead of N identical checks.
- **Judge panel** — generate N independent attempts from different angles, score with parallel judges, synthesize from the winner while grafting the best of the rest.
- **Loop-until-dry** — for unknown-size discovery, keep spawning finders until K consecutive rounds find nothing new. Dedup against everything seen, not just what's confirmed.
- **Completeness critic** — a final pass asking "what's missing — a modality not run, a claim unverified, a source unread?"

## Barrier discipline

Default to pipelines. A barrier (wait for all) is only justified when a stage truly needs cross-item context: dedup/merge across the full set, early-exit on zero results, or "compare against the other findings". "It's cleaner code" is not a justification — barrier latency is real.

## Context hygiene

- Give each agent a **narrow, self-contained brief** — what to do, what to return, what it depends on. Agents reason better over context they can hold at once.
- Return **structured data** from agents (schema), not prose, when the parent will act on it.
- Keep the **main thread's context lean** — delegate reading-heavy work to subagents and keep only their conclusions.
- **Log what you drop.** If you cap coverage (top-N, no-retry, sampling), say so — silent truncation reads as "covered everything".

## Scale to the ask

"Find any bugs" → a few finders, single-vote verify. "Thoroughly audit" → larger pool, 3–5 vote adversarial pass, synthesis stage. Match the harness to the request.
