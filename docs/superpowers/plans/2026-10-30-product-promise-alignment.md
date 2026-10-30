# Product promise alignment implementation plan

**Goal:** Implement the missing core capabilities identified by the read-only marketing audit, cover reliability gaps with tests, and make public copy match executable behavior.

**Architecture:** Keep existing Vapi and voice-core paths. Carry client-specific voice configuration through the authenticated profile bridge into a per-call copy of worker configuration. Add bounded, cancellable agent backchannels using supported SDK behavior, never consent-bearing utterances. Keep calendar uniqueness at the database boundary and cover conflict responses. Preserve original site design and feature lists.

**Tech stack:** Express/Prisma/Vitest, Python/LiveKit/pytest, React/Vite.

**Specification:** User: « fix tout et ajoute daans le core ce qui est pas » following the functional marketing audit in this session.

## Global constraints
- User explicitly authorized local merging once fixes are complete and verified (« et merge qd fini »). Parent performs the merge only after full review/tests and verification of the intended target branch; preserve unrelated dirty work. No push, deployment, production configuration changes, live phone calls, sent SMS or created remote records without separate approval.
- Preserve all pre-existing dirty work in both repositories, especially voice locale/metrics/recording fixes. Apply narrow patches only, never reset files.
- Do not print secrets or copy environment values into reports.
- Distinguish tested implementation from live acoustic/integration validation. No categorical cough, uptime, error-proof or timing guarantee based on mocks.
- Voice configuration is tenant-scoped, validated and provider-aware. No mutable global client override or silent wrong-provider clone fallback.

## Work ownership
1. Client voice pipeline: core brain.py/platform.py, only agent.py::_configuration_appel; bridge voice-core profile construction and its dedicated tests. No other agent.py regions or config.py.
2. Conversational behavior: core agent.py except _configuration_appel, config.py, new backchannel module and dedicated tests; do not modify brain.py/platform.py or profile bridge.
3. Booking/reachability reliability: bridge booking-reminder.service.ts and dedicated tests; tool-runtime conflict regression tests and minimum implementation fix if needed. Do not modify voice-core profile route.
4. Parent: marketing wording and feature emphasis, integration review, all-suite verification and final report.

## Task 1 — Client-specific cloned voice
- [x] Write failing contract/selection tests for valid client voice, language default fallback, provider/model compatibility, missing/invalid voice and two simultaneous tenants.
- [x] Pass saved client voice metadata through the authenticated profile transport, into the per-call configuration, and into the actual TTS construction. Preserve engine defaults when no override exists; reject unsupported combinations explicitly.
- [x] Run Python voice/locale tests and bridge profile contract tests. Document any SDK/provider capability restriction.

## Task 2 — Backchannels and interruption safety
- [x] Write failing tests for bounded acknowledgement during meaningful caller speech, debounce/cooldown, cancellation on turn end/disconnect, no reply during agent speech/tool announcement, and no commitment-bearing utterance.
- [x] Inspect installed SDK and official API before using speech APIs. Implement a separate, bounded controller with a safe configuration gate; do not add an audio detector that pretends to classify coughs without evidence.
- [x] Exercise nonverbal/no-word interruption behavior, real speech and short urgent utterances using deterministic SDK-contract tests. Document that real audio remains to be checked.

## Task 3 — Booking conflict and follow-up
- [x] Write a failing regression for Prisma P2002 booking conflict resulting in a safe alternative-slot response, no false booking success/SMS and correct hold cleanup.
- [x] Review no-show follow-up: enable an existing consent/config-compatible SMS channel when phone is present but no email, with idempotency/retry tests; otherwise retain a truthful explicit email condition rather than fabricate delivery.
- [x] Run focused backend tests; do not touch real databases or suppliers.

## Task 4 — Honest, stronger marketing
- [x] Add coverage preventing unconditional guaranteed-noise/no-error claims and highlighting booking cancellation/rescheduling.
- [x] Describe tested interruption behavior without promising immunity to all noise. Make SMS/reminder conditions and Agent-roadmap availability clear. Mention Google and Outlook consistently.
- [x] Preserve the three setup-list entries, existing voice carousel, original design, media arrangement and removal of the hero trial/card tagline.

## Review focus
- A cloned voice from the wrong provider must not break all calls or leak between clients.
- Empty/noisy transcriptions must not create consent or endless agent acknowledgements.
- Fast turn changes and disconnects must cancel scheduled backchannels.
- Conflicting bookings must not send confirmations for a failed insert.
- Follow-up retries must not create duplicate notifications or mark failed delivery as successful.

## Verification
- [x] Review precise diffs against the saved baseline; independent review of the combined voice changes.
- [x] Full worker pytest, focused/full backend unit suites as practical, frontend tests/TypeScript/build/lint.
- [x] Browser FR/EN marketing checks, update code graphs, and report implemented / tested / still requiring real calls separately.

## Delivery evidence and activation gates

- Clean staged snapshots, excluding unrelated dirty work: core 1,335 passed / 1 skipped; backend 3,094 passed / 5 skipped; frontend 522 passed. Frontend production build and backend TypeScript pass. Different counts in reviewer reports include unrelated local tests and are not counts for the delivered snapshot.
- Isolated PostgreSQL/WASM suite: 8 passed, covering strict migration refusal without deletion, valid partial unique index, duplicate rejection, replay, invalid-index recovery and same-name index guards. No application or production database was touched.
- Independent final core and backend reviews passed without blocking findings. Frontend review also passed. Updated both knowledge graphs.
- Clone selection is wired to per-call cascade TTS; realtime intentionally does not use the clone. Requires the correct provider credentials/workspace before live use.
- Agent backchannels remain disabled by default and cascade-only. Real acoustic validation remains outstanding; tests are not proof of cough/noise immunity.
- The SQL migration is committed for later application, not applied to production. Existing duplicate confirmed slots require manual resolution; the migration fails closed and never deletes bookings.
- No-show messages use the existing transactional channel; delivery remains conditional on configuration and usable contact details. This is not a new marketing-consent mechanism.
- No push, deployment, external supplier calls or production activation. Live telephony/calendar/SMS/transfer validation remains separate from this local merge.
