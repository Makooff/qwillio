---
name: agentic-practice
description: >-
  Agentic engineering discipline — from vibe coding to reliable execution. Use
  before committing or pushing, when you want work done cleanly, or when
  establishing how to approach a change. Trigger on "before push", "before
  commit", "do this properly", "best practice", "clean it up", "make it
  production-ready", or any moment work is about to leave your hands.
---

# Agentic Practice

Practice makes the agent reliable. The difference between vibe coding and agentic engineering is discipline: verify what you claim, work in small batches, fix causes not symptoms.

## Verify before you claim

- **Never report done without checking.** Run the app, run the test, look at the rendered UI. Reading the code is not verification. Route to `Skill(verify)` when available.
- State results honestly: if tests fail, say so with the output. If you skipped a step, say that.
- No hedging on verified work; no false confidence on unverified work.

## Small batches

- One focused change per commit. A commit should have a single reason to exist.
- Don't bundle a refactor into a feature into a fix. Separate them.
- Short diffs are easier to review, revert, and reason about — for humans and for you.

## Root cause over symptom

- When something breaks, find why before patching. A symptom fix that hides the cause creates two bugs.
- Reproduce first. A bug you can't reproduce isn't fixed, it's hidden. Route to `Skill(systematic-debugging)`.

## Permission & blast radius

- Irreversible or outward-facing actions (delete, force-push, deploy, send) — confirm first unless explicitly authorized.
- Before overwriting or deleting, look at the target. If it contradicts how it was described, or you didn't create it, surface that instead of proceeding.
- Approval in one context doesn't extend to the next.

## No slop

- Match the surrounding code's style, naming, and comment density. New code should read like it was always there.
- Comments explain *why*, not *what*. No comment restating the line below it.
- Delete dead code and debug prints before committing.
- Commit messages: `feat|fix|refactor: concise description`. No filler.

## The loop

Understand → change → verify → report. Skipping "verify" is where reliability dies. Every claim in your final report should be something you actually checked this session.
