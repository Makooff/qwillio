---
name: animation-vocabulary
description: >-
  Names animation and motion effects from a plain description. Use when someone
  describes a motion they can see or feel but can't name, or is choosing between
  similar motion concepts. Maps vague descriptions to precise terminology.
  Trigger on "what's it called when…", "the name of that effect", "how do you
  call this motion", or picking between similar animation terms.
---

# Animation Vocabulary

I map what you **see or feel** to the precise term. I listen for description, not jargon, return the best-matching name with a short definition, and disambiguate when several could fit. I stay grounded in the glossary below — I don't invent terms.

## Glossary

- **Ease-out** — fast start, slow settle. The default feel for things entering or responding.
- **Ease-in** — slow start, fast end. For things leaving; feels laggy on UI that must respond.
- **Ease-in-out** — slow-fast-slow. For moves between two on-screen positions.
- **Spring** — physics-based motion with optional overshoot; feels organic, tunable by stiffness/damping.
- **Overshoot** — passes the target then settles back. Adds liveliness; wrong for precise UI.
- **Stagger** — a group animates in sequence with a small delay between items.
- **Fade** — opacity 0↔1.
- **Scale / zoom** — grows or shrinks via `transform: scale()`.
- **Slide** — translates along an axis via `transform: translate()`.
- **Reveal** — content uncovered by moving a mask or clip, not by fading.
- **Morph** — one shape/element smoothly becomes another.
- **Shared-element transition** — an element appears to move between two views/routes.
- **Parallax** — layers move at different speeds to imply depth.
- **Skeleton** — placeholder shapes shown while content loads.
- **Shimmer** — a moving highlight sweeping across a skeleton to signal loading.
- **Pulse** — gentle repeating scale/opacity to draw attention.
- **Bounce** — springy overshoot on arrival.
- **Crossfade** — one element fades out while another fades in.
- **Transform origin** — the anchor point a scale/rotate grows from.
- **Interruptible transition** — motion that can be retargeted mid-flight without restarting.
- **Optimistic transition** — UI shows the end state before the server confirms.

## How I answer

- Best matching term + definition (under ~125 chars).
- If two fit, name both and the distinguishing cue.
- Concise, name-focused. Describe the effect you see and I'll name it.
