---
name: emil-design-eng
description: >-
  Design engineering and animation craft, after Emil Kowalski (Sonner, Vercel,
  Linear). Use when building or reviewing UI motion, micro-interactions,
  transitions, easing, hover/press states, modals, popovers, toasts, and the
  invisible details that make software feel right. Trigger on animation, motion,
  transition, easing, micro-interaction, framer-motion, hover, press, spring,
  gesture, or "make it feel good / polished / smooth".
---

# Emil Design Engineering

Every detail compounds into something that feels right. Users never consciously notice correct motion — they just love the product. Beauty and polish are a competitive advantage once functionality is table stakes.

## Taste is a trained skill

Good taste comes from study, not talent. Reverse-engineer animations in software you admire. Slow them down, inspect the easing, count the duration, notice what moves and what stays. "A thousand barely audible voices all singing in tune" (Paul Graham) — the sum of invisible correctness.

## Should this animate at all?

Decide by **frequency** and **purpose**.

- **Frequency** — the more often an action fires, the less it should animate. Keyboard-triggered actions (used 100+ times/day) should **never** animate. Rare, meaningful moments can afford delight.
- **Purpose** — every animation must justify itself with one of: spatial continuity, state indication, feedback, or preventing a jarring change. "It looks cool" is not a reason.

If it can't answer why it exists, cut it.

## Duration

- UI animations: **under 300ms** as a rule.
- Buttons / small feedback: **100–160ms**.
- Modals / larger surfaces: **200–500ms**.
- Slower than ~500ms on routine UI feels sluggish and blocks the user.

## Easing

- Use **strong custom cubic-bezier** curves (see easing.dev), not the weak built-in CSS keywords.
- **Never `ease-in` on UI** — it starts slow and feels laggy. Prefer `ease-out` or a custom curve for things entering/responding.
- Signature curve: `cubic-bezier(0.16, 1, 0.3, 1)` for entrances/expansions.
- Asymmetric timing: things can enter and exit at different speeds; exits are often faster.

## What to animate

- **Only `transform` and `opacity`** — GPU-accelerated, off the main thread.
- Never animate layout properties (width, height, top, left, margin) — they trigger reflow and jank.
- Never `transition: all` — it animates properties you didn't intend and hurts performance.
- Prefer **percentages/transforms** over hardcoded pixel values.

## Component patterns

- **Buttons** — `:active` gives `scale(0.97)` press feedback.
- **Popovers / dropdowns** — scale from the **trigger's origin**, not center. Set `transform-origin` to the anchor.
- **Tooltips** — animate on first hover; skip animation on rapid subsequent hovers (feels responsive, not laggy).
- **Modals** — fade + subtle scale/translate; exit faster than enter.
- **Toasts** — enter with transform, never `scale(0)` (looks broken); stack gracefully.

## Interruptibility

CSS **transitions** beat keyframes for dynamic UI: a transition can be retargeted mid-flight without restarting. Keyframe animations restart from zero and feel rigid when state changes fast. Use transitions for anything a user can interrupt (hover, open/close, drag).

## Accessibility & performance

- Respect **`prefers-reduced-motion`** — drop or reduce non-essential motion.
- **Touch-safe hover** — gate hover motion behind `@media (hover: hover)`; never trap touch users in a hover state.
- Prefer **CSS animation over JS** when the main thread is busy (page load, heavy render) — CSS runs off-thread and stays smooth.

## When reviewing motion

Hand off to `Skill(review-animations)` for a strict Block/Approve audit. Use `Skill(animation-vocabulary)` to name an effect you can see but can't name.

Deeper study: Emil's course at [animations.dev](https://animations.dev/).
