# Docket improvement workflow — 2026-11-06

**Goal:** close the concrete gaps from the council review and the P0/P1 plan. The marketing page stays out of scope.

**Status:** complete. Verified locally and against production on 6 November 2026.

## P0 — Demo correctness and story

- [x] Fix the tour progress counter: starts at 0/8, increments only when a case finishes, never shows 8/8 while rows are waiting.
- [x] Fix the tour meta line: shows completed cases, credits and latency during the run.
- [x] Humanize the tour “Why” column; raw codes stay in the title tooltip.
- [x] Make partial/fatal runs render **Incomplete** and retry only failed cases.
- [x] Add a France-first feature block using the live sample question, draft and policy metadata.
- [x] Add the evidence strip: 0 unsafe false-PUBLISH, 25/31 locked, 29/31 post-tuning, 10/10 adversarial, 114 tests, 9/9 endpoints.
- [x] Keep the eight-case suite visible as breadth.

## P0 — Review honesty

- [x] Rename **Release answer** to **Approve review**.
- [x] Show **Approved — re-run required to publish**; never “Released” for an unresolved answer.
- [x] Put the deciding claim and governing quote above the review action.
- [x] Add the note: approving records the review, it does not publish.
- [x] Update README, JUDGES, review queue copy and audit copy.

## P0 — Demo reliability

- [x] Add a 60-check per-session budget.
- [x] Raise the per-IP check ceiling to 600 and the daily cap to 1000.
- [x] Add rate-limit tests for session, per-IP and daily separation.
- [x] Add `scripts/preflight.py` for tour, console, ledger, session, health, ledger chain and policy registry.
- [x] Add `make preflight` and `make preflight-local`.
- [x] Record a two-minute fallback video of the live production tour and console: `website/demo/docket-fallback.mp4`.

## P1 — Transparency and differentiators

- [x] Add a scope determination block to the console result with an explicit authority-trace explanation.
- [x] Add the live **Scope applicability** sample and tests, including a negative case with an extra substantive claim.
- [x] Add the one-click **Unapproved policy** sample: HOLD → Attest → re-run → PUBLISH.
- [x] Exclude non-seeded sample documents from the seed corpus and health check.
- [x] Add tests for scope determination, the attestation sample and seed exclusion.
- [x] Add `make evidence` (deterministic) and `make evidence-live` (all live corpora).

## Cleanup and verification

- [x] Remove the stale `static/` app folder.
- [x] Full test suite: **114 passed**.
- [x] Production tour: 8/8, honest counter, human-readable reasons, 93 credits, 6.1 s compute.
- [x] Production console: France review approval, scope determination, Attest → re-run → PUBLISH.
- [x] Production preflight: 7/7 checks, ledger chain verified, policy registry 12/12 signed.
- [x] Deploy and verify production.
