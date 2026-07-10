---
name: product-design
description: >-
  Single entry point for product design and user-facing product implementation
  in apps/vercel-site. Use whenever work changes what a user sees, understands,
  chooses, or does: shaping requirements and flows; building or redesigning
  pages and components; reviewing URLs, screenshots, diffs, or Vercel Agent
  findings; improving product copy, information architecture, component choice,
  Geist compliance, hierarchy, layout, interaction, accessibility, responsive
  behavior, and loading, empty, error, permission, billing, or destructive
  states. Trigger on design, UX, UI, usability, flow, onboarding, settings,
  dashboard, build, improve, fix, audit, review, polish, simplify, or
  production-ready requests. Also use when backend behavior changes a
  user-visible outcome. Not for backend-only work with no user-visible effect,
  tests with no shipped UI impact, telemetry-only work, documentation, or
  marketing content.
---

# Vercel Product Design

Make the interface correct for the user, the product, and Vercel. Working code is not enough: choose the right interaction, make scope and consequences clear, cover reality beyond the happy path, and verify the rendered result.

## Operating Contract

- **Start with the job, not the pixels.** Identify who is acting, what they are trying to accomplish, the product object involved, and what the system will change.
- **Define the outcome before the output.** Establish the current user problem, desired behavior, success signal, and non-goals before choosing a surface or component.
- **Use evidence, not taste.** Trace decisions to product behavior, canonical repository guidance, an accepted design decision, or a verified adjacent pattern.
- **Separate facts from decisions.** Mark assumptions and unresolved product choices explicitly; do not hide them inside implementation details.
- **Treat shipped code as evidence, not automatic precedent.** It proves what exists, not why it is correct. Check it against current components, product behavior, and explicit guidance.
- **Choose the smallest coherent intervention.** Consider better defaults, behavior, or reuse before adding UI. Do not solve one job by creating unrelated settings or abstractions.
- **Decide before decorating.** Resolve information architecture, component semantics, interaction, and state behavior before styling or rewriting copy.
- **Design every reachable state.** Include only states the product can actually enter, but do not stop at the populated success case.
- **Verify the real surface.** Source inspection establishes behavior; a rendered interface establishes visual and interaction quality. Never claim visual verification from code alone.
- **Keep one user-facing entry point.** Invoke `product-design`; route internally to the canonical sources below.

## Request Modes

Resolve the mode from the user's verb and artifact before acting.

| Mode      | Typical request                                                                    | Required behavior                                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shape     | "Design this flow", "How should this work?", feature brief without settled UI      | Frame the problem and evidence, compare material alternatives, then define the flow, states, acceptance criteria, risks, and open decisions. Do not edit unless asked. |
| Implement | "Build", "fix", "improve", "make compliant", or "run product-design on everything" | Resolve material product decisions, then implement the smallest coherent end-to-end change within scope. Do not absorb unrelated review findings.                      |
| Review    | "Audit", "critique", "what's wrong?", code review                                  | Inspect source and rendered evidence, then report prioritized findings. Do not edit unless asked.                                                                      |
| Copy      | "Fix the copy", "rewrite these errors"                                             | Edit user-facing language, accessible names, and directly required JSX only. Report structural blockers without silently broadening scope.                             |
| Harden    | "Polish", "production-ready", "handle edge cases"                                  | Preserve the settled product direction while fixing state, resilience, responsive, accessibility, and finish defects.                                                  |

When intent is ambiguous, use the narrowest mode supported by the verb. A URL, screenshot, route, or component identifies scope; it does not by itself authorize edits.

A material decision changes the user's task, default, scope, consequence, navigation, interaction surface, or reachable states. Copy mechanics, token replacement, and established component substitutions usually are not material.

## Decision Authority

Resolve conflicts in this order:

1. The user's explicit goal and constraints.
2. Verified user/product evidence and system truth.
3. Repository-canonical guidance: `AGENTS.md`, Geist component APIs, `packages/geist/STYLE_GUIDE.md`, and routed skills.
4. Accepted product/design decisions and exemplars with stable evidence.
5. Verified adjacent shipped patterns in the same product area.
6. General interface heuristics.

## Workflow

### 1. Set scope and mode

Name the target surface and request mode in the work plan or review notes.

### 2. Load product context

Before proposing UI, read the applicable `AGENTS.md` chain, supplied briefs and designs, and the product logic that determines mutations, permissions, validation, errors, and side effects.

### 3. Model the product decision

For Shape, Implement, Harden, full Review, or any material product/flow change, read `product-judgment.md` and write a compact internal brief covering user, job, current behavior, desired outcome, success signal, non-goals, object, scope, action, consequence, reversibility, permissions, and open decisions.

### 4. Map the surface and states

Inventory entry points, visible regions, overlays, transitions, exits, and return paths. Map only reachable states including loading, empty, sparse, populated, validation, error, permission, disabled, optimistic, stale, destructive, and responsive variants.

### 5. Load the routed references

| Need | Load |
| ---- | ---- |
| Product/flow/component decision | `product-judgment.md` + `component-guide` |
| Implementation, material visual change, or full review | `interface-quality.md` |
| Copy or accessible names | `copy.md` + `surfaces.md` routing |
| Layout, typography, color, spacing, Geist APIs | `design-guidelines` + `packages/geist/STYLE_GUIDE.md` |
| Keyboard, focus, forms, touch, animation, URL state, performance | `web-interface-guidelines` |
| Overflow, localization, extreme data, network/error resilience | `resilience.md` |

### 6. Decide, then implement

For each non-mechanical change, be able to answer: what user problem does this solve, why is this component appropriate, what consequence must the interface communicate, which evidence supports the decision, and what is the smallest coherent change?

### 7. Verify

1. Confirm the primary job and acceptance criteria.
2. Run repository lint checks.
3. Inspect relevant compact and wide viewports.
4. Exercise every materially changed reachable state.
5. Verify keyboard order, focus movement, loading behavior, and pointer/touch targets.
6. Test long content, large values, constrained width, and localization/RTL risk.
7. Load `review-design-system` for structural visible changes.

## Product Design Standards

- Make the user's primary task and primary action unmistakable.
- Preserve the user's mental model and current context unless changing it solves a verified problem.
- Name the exact object, scope, and consequence of important actions.
- Use navigation components for navigation and action components for actions.
- Choose surface persistence to match importance.
- Prefer inline disclosure before adding a modal.
- Expose advanced controls when needed without making the default path carry their complexity.
- Prefer strong defaults and direct behavior over adding configuration the user must learn and maintain.
- Use semantic Geist components and their APIs before custom HTML or styling.
- Use hierarchy, spacing, and alignment before adding containers.
- Preserve user input through validation and recoverable errors.
- Keep loading control labels stable; use the component's loading/busy affordance.
- Make destructive actions proportional to impact and provide undo when the system can honestly support it.
- Do not add decorative novelty, motion, or copy unless it clarifies structure, state, or brand intent.

## Review Output

Lead with findings, ordered by user impact:

- **P0:** blocks the primary task, creates severe accessibility failure, or can cause unrecoverable user harm.
- **P1:** likely task failure, misleading consequence, missing critical state, or major responsive/accessibility defect.
- **P2:** meaningful friction, inconsistency, weak hierarchy, or recoverability issue.
- **P3:** minor craft or consistency improvement.

For each finding include: file/line or rendered location, verification status, canonical source, user consequence, and smallest concrete fix.

## Skill Integrity

- Add or change a rule only after current-source verification and human acceptance.
- Record scope, rationale, evidence, exceptions, and a bad/good example.
- Prefer the narrowest destination: canonical source, routed reference, exemplar, lint/eval check, or coverage gap.
- Keep deterministic checks mechanical. Keep judgment in prose with its evidence and degree of freedom.
- Never promote one screenshot, one shipped file, or one reviewer comment into a universal rule by itself.
