# Council dossier — Docket Best Overall review

**Date:** 2026-11-06  
**Deadline:** 2026-11-10, 11:59 p.m. ET  
**Question:** What are the highest-leverage changes in the next four days to make Docket the Best Overall winner and rank #1, while keeping the project live, working, and free of hardcoded or gimmicked behavior? Ignore the marketing page.

## Official judging criteria (Best Overall, 100 points)

- Practical usefulness — 25
- Quality of the core Clocked integration — 30
- Thoughtful use of additional Clocked endpoints — 15
- Implementation and user experience — 20
- Clear explanation and reproducibility — 10

The challenge also has three group awards: Decide/Extract/Fill; Protect/Guard/Inspect; Verify/Compare/Rerank. Group awards score depth 40, breadth 30 (10 per endpoint), usefulness/execution 20, explanation/reproducibility 10. A project may enter multiple awards and can win one judged award plus People's Choice. Docket uses all nine endpoints, so it is eligible for all four judged awards.

## Current Docket state

**Product:** A release gate for support answers. It resolves which policy governs by jurisdiction, precedence, effective date and expiry; checks the draft against the governing text; blocks unsafe, unapproved, tampered, stale or injected input; opens a durable review record for HOLD/REWRITE; and writes a hash-chained audit record.

**Endpoints:** All nine Clocked endpoints are integrated:
- Protect (PII redaction)
- Guard (prompt injection)
- Inspect (script safety)
- Extract (policy metadata/facts)
- Decide (triage/review routing)
- Rerank (evidence selection)
- Compare (superseded conflicts)
- Fill (coverage/omissions)
- Verify (claim grounding)

**Evidence:**
- Locked held-out: 25/31 exact decisions (80.6%), governing accuracy 100%, 0 unsafe false-PUBLISH.
- Post-held-out tuning: 29/31 (93.5%), 0 unsafe false-PUBLISH; two remaining failures are label disputes.
- Adversarial suite: 10/10, 0 unsafe false-PUBLISH, 100% injection/script recall, 0% clean false-HOLD.
- Calibration: 13/14, 100% decision accuracy.
- 102 tests passing.
- Endpoint necessity: all nine have real ablation/measurement output; Protect and Rerank show record/evidence deltas.
- Production tour: 8/8 cases, 103 credits, 6.1s.
- Production health: ledger verified, policy registry 10/10, seed current.
- Review workflow: the check that opens a review returns a scoped capability; the console can claim, approve review, or send back that record without an admin token. The shared queue and registry approval remain admin-only.
- Policy approval: custom policies can be operator-attested for one check; the shared registry approval is admin-only.

**Frontend surfaces:**
- `/tour` is the submission demo. It runs eight live cases and shows decision, reason codes, governing policy, calls, credits and audit seq.
- `/console` is the product surface: check a draft, France example, full-width decision, decision record, decision path, authority, claims, conflicts; technical proof and operations are collapsed drawers.
- `/ledger` is a separate plain page showing chain verification and recent determinations.

**Known weaknesses / risks:**
- The tour is still framed as a test harness (“Run eight service-desk cases”), not a single product story. The judge has to assemble the “wrong answer would have shipped” narrative.
- The benchmark corpora are self-authored; the locked 25/31 is honest but not a high accuracy headline. The stronger 29/31 is post-tuning and must stay clearly separated.
- The console is information-dense; the first viewport shows the verdict and record, but the governing quote and decision path require scrolling.
- The review action is labelled “Release answer,” but approving a review does not publish the answer; the operator must still edit and re-run. This can look contradictory.
- The seeded sample policies disable the public Attest button; a judge may not discover the policy-attestation workflow.
- The `/ledger` page does not use the console shell; it can look like a different product and may show a loading state.
- The 60/hour per-IP check budget can be exhausted by four judges plus retries or public voters.
- There is no agent/MCP integration; a competitor (ClockedOmniGuard) advertises an MCP server.
- There is no 2-minute fallback video; the demo is live and reliable but a recording is not available.
- The repo contains a stale `static/` app folder that is not served; it may confuse judges about which app is live.
- The scope rule for out-of-scope applicability is deterministic and narrow, but a judge may ask whether it bypasses Verify. It needs a visible, explicit “scope determination from the authority trace” explanation.
- The project is more complex than the focused competitor apps; judges may value a simpler, more immediately legible single workflow.

## Public competitor set (from Clocked submission alerts)

- **ClockedOmniGuard** — “10-endpoint enterprise deal-room, DevSecOps and agent-security gateway”; MCP server; short-circuits flagged workflows; recorded examples. Direct breadth competitor.
- **ClientCheck PH** — contract review; Guard/Protect/Extract/Verify; flags point to clauses; evidence and uncertainty shown together.
- **Invoice Airlock** — AP supplier email; Guard/Protect/Extract/Decide/Compare; RELEASE/HOLD/BLOCK; multilingual recorded examples.
- **Gatehouse** — GitHub issue screening; Guard/Inspect/Protect; Forward/Hold/Block; evidence marked on original; human-review band.
- **DocShield** — contracts/offer letters/invoices; Protect/Extract/Decide/Verify; redacted copy; credit cost shown per step.
- **AgentShield** — Guard/Protect/Inspect; go/no-go panel; category bars; redacted copy.
- **Inbox Shield** — customer messages; Guard/Protect/Decide/Extract; preserves useful request while removing flagged instructions.
- **CleanScreen** — resume screening; hidden-content detection, Protect, Verify; deterministic vs model separation.
- **KitBrief** — workshop kits; Extract/Fill; quantities recalculated; traceable corrections.
- **Margin** — academic integrity review.

The field is crowded with focused document/security review apps. Docket’s differentiation is policy authority, signed policy envelopes, human review and a durable audit record: the governance layer above document review. It has the deepest endpoint use, but the least immediately obvious story.

## Options under consideration

A. Make `/tour` a product narrative: one flagship France case first, then the eight-case suite as breadth.
B. Add a visible evidence strip to `/tour`: 0 unsafe false-PUBLISH, 29/31 post-tuning (25/31 locked), 10/10 adversarial, 102 tests, all nine endpoints.
C. Redesign `/ledger` in the console shell and make verification/records legible.
D. Rename “Release answer” to “Approve review” and show “approved, re-run required” rather than implying publication.
E. Add a one-click unapproved-policy example that demonstrates attestation.
F. Raise the demo budget or add a session-based/judge-safe budget.
G. Add a minimal MCP/agent gate integration.
H. Add a public third-party-style case set, or a judge-reproducible one-command evidence check.
I. Enter all four judged awards, not only Best Overall.
J. Record a 2-minute fallback video and prepare a LinkedIn post for People’s Choice.

## The council question

What are the **top three** actions Docket should take before November 10 to maximize its Best Overall score and rank #1 against this field? Be specific about product, demo, evidence and reliability. Identify what to cut, what to keep, and the strongest counterargument to your own recommendation.
