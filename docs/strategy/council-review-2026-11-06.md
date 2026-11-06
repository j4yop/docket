# Council review — how Docket wins Best Overall

**Date:** 2026-11-06  
**Deadline:** 2026-11-10, 11:59 p.m. ET  
**Question:** What are the highest-leverage changes in the next four days to make Docket the Best Overall winner and rank #1, while keeping the project live, working, and free of hardcoded or gimmicked behavior?  
**Scope:** The product, demo, evidence, and reliability. The marketing page is out of scope.

---

## Executive recommendation

**Win as the authority-and-receipt layer for AI answers, not as another document reviewer.**

The field is crowded with focused document and security reviewers: ClientCheck PH, Invoice Airlock, Gatehouse, DocShield, AgentShield, Inbox Shield, CleanScreen, KitBrief, Margin. The strongest breadth competitor, ClockedOmniGuard, advertises a 10-endpoint enterprise gateway with an MCP server.

Docket should not try to out-breadth that. It should own the question none of them answer:

> **Every other entry checks the document. Docket checks whether the policy behind it is still the policy — and records who released the answer.**

That is the 30-point core-integration story, the 25-point usefulness story, and the 10-point reproducibility story at once. It is also the only story in the field that ends in a signed policy envelope, a human review record, and a hash-chained receipt.

The product is already strong enough to win that story. The demo currently hides it.

## The three highest-leverage moves

### P0 — Make `/tour` one story, then breadth

The current tour is a QA harness in the judge's first viewport. The judge sees “Run eight service-desk cases,” a progress counter, and eight mechanism-named rows. They have to assemble the “a wrong answer would have shipped” narrative themselves.

Make the first act the France case:

- A support agent in France is about to send a draft.
- The newest global policy says manager approval is required.
- The older France annex says it is not.
- Latest-wins would publish the wrong answer.
- The gate resolves jurisdiction and precedence, contradicts the draft, opens a review, and writes an audit record.

Then keep the eight-case suite visible below as breadth, not as the opening. This is copy, layout, and a small amount of tour state — not a new product.

Also fix the concrete tour defects the review found:

- The counter shows **8 / 8 while every row is still Waiting**. The count uses failed-case retry state instead of completed cases.
- The meta line stays on **“Starting…”** during the run.
- The “Why” column shows raw codes (`coverage_gap`, `policy_unapproved`) with no human label.
- The page needs an honest evidence strip: **0 unsafe false-PUBLISH · 25/31 locked · 29/31 post-tuning · 10/10 adversarial · 102 tests · 9/9 endpoints**.

This is the only change that moves practical usefulness (25) and explanation (10) together, while improving implementation and UX (20).

### P0 — Make review honest

The console currently labels the review action **“Release answer.”** Approving a review resolves the review record, but it does not publish the answer. The decision remains HOLD or REWRITE until the operator edits and re-runs the check. The UI can say “Released by reviewer” while the unsafe draft is unchanged. That is a trust bug in a product whose entire claim is release integrity.

Fix it end to end:

- Rename the action to **Approve review**.
- After approval, show **“Approved — re-run required to publish”**, not “Released.”
- Keep **Send back** as the reject action.
- Put the governing quote and the deciding claim above the review buttons.
- Add a line: “Approving records the review decision. It does not publish the answer.”
- Update the README, JUDGES guide and review copy to match.

This is a correctness fix, not a wording preference. A judge who notices it will question the whole audit story.

### P0 — Make the demo unable to fail

The deployed check budget is 60 per hour per IP. One tour run is 8 checks; one console flagship is 1; one proof re-run is 2. Four judges behind one NAT plus one retry can exhaust the budget. A 429 at judging time is a zero on every criterion.

Make the budget judge-safe without hardcoding results:

- Keep a **60-check budget per session** so each judge has a full demo budget.
- Raise the **per-IP ceiling** to 240–600 for shared networks and panel traffic.
- Raise the daily cap so the demo does not stop mid-judging.
- Make partial runs credible: a completed subset must render an honest “Incomplete” result, not a broken screen.
- Record a **two-minute fallback video** and put it at the top of the tour.
- Add a preflight check for tour, console, ledger, health and policy registry.

This is a 0.5-day reliability task. It earns no points when it works, but it protects every point when the room’s network is bad.

## P1 — The moves that separate a winner from a finalist

1. **Enter all four judged awards, led by Verify / Compare / Rerank.**  
   Docket uses all nine endpoints. The Verify/Compare/Rerank bracket is its strongest and least crowded: authority across superseded, expired and conflicting policy, with governing accuracy and claim-level evidence. Decide/Extract/Fill is second: durable review, scoped capability, coverage gaps. Protect/Guard/Inspect is third because AgentShield, Gatehouse, Inbox Shield and DocShield crowd it. Entering all four is a form choice, not a diluted product; the narrative stays the same.

2. **Make the scope determination visible.**  
   The deterministic scope rule fixes the out-of-scope held-out case by resolving from the authority trace. A judge can reasonably ask whether that bypasses Verify. Add an explicit result block: “Scope determination — the named annex is out of scope for this country; the draft is a negative applicability statement, so there is no substantive claim to verify.” Add a live console example for “Does the EU annex apply?” and a test where a negative scope draft also contains an unsafe or substantive extra claim; that must not publish.

3. **Make policy attestation discoverable.**  
   The seeded France samples disable the Attest button. A judge may never see the public policy-approval path. Add a one-click **unapproved custom policy** example: run it, see the HOLD, press **Attest for this check**, re-run, and publish. That is a real workflow and a differentiator no competitor shows.

4. **Make the evidence one click away.**  
   Add the evidence strip to `/tour` and a `make evidence` or equivalent command that reproduces the offline tests and points at the locked, post-tuning, adversarial, calibration and ablation documents. Keep 25/31 locked as the locked result and 29/31 post-tuning clearly labelled.

5. **Record the 90-second France video and the two-minute fallback.**  
   Use the video for the submission and, if you want the separate People's Choice award, one public LinkedIn post. The judged awards do not depend on LinkedIn; the video protects the live demo.

## P2 — Do not spend the four days here

- **Do not add MCP.** ClockedOmniGuard has one; Docket's advantage is authority and receipt, not another integration surface. The API and cURL copy already make it embeddable.
- **Do not redesign `/ledger`.** It is functional and verified; it is not the first two minutes. A small “chain verified” badge or link is enough if time allows.
- **Do not add a third-party corpus now.** It is the right long-term move, but it will not move the judged score in four days. Disclose the self-authored limitation honestly.
- **Delete the stale `static/` app folder.** It is tracked but not served; it makes the repo look like it contains a second, older product.
- **Do not chase endpoint count alone.** All nine is enough. The proof is that each endpoint changes a decision, not that a tenth call exists.

## Competitive matrix

| Project | Their wedge | Clocked use | Where they are strong | Where Docket wins |
|---|---|---|---|---|
| **Docket** | Policy authority and release receipt | All 9 | Deterministic authority, signed policies, review, ledger, 9-endpoint ablation proof | The only entry that proves *which policy governs over time* and *who released the answer* |
| **ClockedOmniGuard** | Enterprise deal-room, DevSecOps, agent security gateway | 10 endpoints, MCP | Breadth, short-circuiting, agent integration | Docket has a sharper authority story and a real review/ledger loop; do not fight on MCP |
| **ClientCheck PH** | Contract review | Guard, Protect, Extract, Verify | Evidence and uncertainty shown together | Docket resolves authority across documents and records the release decision |
| **Invoice Airlock** | AP supplier-email screening | Guard, Protect, Extract, Decide, Compare | Clear enterprise workflow, multilingual demo | Docket governs policy over time, not one message |
| **Gatehouse** | GitHub issue screening | Guard, Inspect, Protect | Human-review band, evidence marking | Docket has policy envelopes, authority, review and ledger |
| **DocShield** | Document understanding and redaction | Protect, Extract, Decide, Verify | Redacted copy, typed decisions, credit cost | Docket adds governing-policy resolution and audit |
| **AgentShield** | Agent input pre-flight | Guard, Protect, Inspect | Security UI, category bars | Docket uses all nine and produces a release record |
| **Inbox Shield** | Customer-message screening | Guard, Protect, Decide, Extract | Preserves useful request while removing hostile text | Docket decides which policy governs and records the release |
| **CleanScreen** | Resume hidden-content detection | Protect, Verify, Decide | Deterministic/model separation | Docket applies the same discipline to policy authority |
| **KitBrief** | Workshop kit quantities | Extract, Fill | Traceable quantities and corrections | Docket has broader governance and audit |
| **Margin** | Academic integrity review | Clocked endpoints | Focused academic workflow | Docket targets the enterprise policy release problem |

The pattern is clear: the field is strong at **document and message review**. Docket is the only entry positioned at **policy authority and release accountability**. The demo must say that in the first 20 seconds.

## What the council disagreed on

- **Four-award spray vs focus.** The Contrarian calls it a spray. The Expansionist and First Principles advisors call it free distribution. The verdict: enter all four judged awards because the form allows it and the product genuinely uses all nine endpoints, but use one narrative and one demo. Do not write four different products.
- **Ledger redesign vs cut.** The Expansionist sees the ledger as the shareable proof object. The Contrarian, Outsider and Executor say cut it from the four-day critical path. The verdict: do not redesign; add a verified badge/link only if the P0 work is done.
- **Reliability vs story.** The Contrarian says reliability is invisible; the Executor says it is the only thing that prevents a zero. The verdict: timebox reliability to half a day and do it before the demo polish. A live story that 429s is not a story.
- **Single hero vs breadth.** The First Principles advisor warns a single hero can look stageable and one-trick. The verdict: hero first, but keep the eight-case suite and the nine-endpoint proof visible on the same page.

## Blind spots caught in peer review

1. **The scope rule can undermine the safety headline.** The deterministic out-of-scope path bypasses Verify. It is defensible — the draft is a negative applicability statement, not a substantive policy claim — but the UI and a live test must make that explicit. Do not let a judge discover it in the code.
2. **The benchmark is self-authored.** The headline must stay **0 unsafe false-PUBLISH**, with 25/31 locked and 29/31 post-tuning labelled separately. Do not present 29/31 as the locked result. The honesty is a strength; a hidden switch is a disqualifier in the judge's mind.
3. **The first minute is doing more work than the feature list.** Focused competitors win because a judge understands them immediately. Docket's depth is real, but it must be legible before the judge scrolls.
4. **The 60/hour budget is a silent single point of failure.** The council's strongest disagreement is about whether to spend time on it. The verdict is yes, but only half a day.

## Four-day execution plan

### Day 1 — Story and trust (Nov 6)

- Rebuild `/tour` first act around the France case; keep the eight-case suite visible below.
- Fix the progress counter, meta line, human-readable “Why” labels and partial-run state.
- Add the evidence strip.
- Rename the review action to **Approve review**; show **Approved — re-run required**; put the governing quote and claim above the action; update docs.
- Delete the stale `static/` folder.

### Day 2 — Judge-safe demo and differentiators (Nov 7)

- Add per-session budget and IP headroom; verify four concurrent sessions and retries.
- Add the visible scope determination block and a live scope example.
- Add the one-click unapproved-policy example with Attest → re-run → Publish.
- Add `make evidence` or a one-command evidence check.
- Verify the tour at desktop and mobile; verify the ledger loads and verifies.

### Day 3 — Freeze and record (Nov 8)

- Full regression: 102 tests, tour 8/8, console flagship, review approve/send-back, attestation, ledger, health.
- Record the 90-second France video and the two-minute fallback video.
- Write the submission copy: demo URL `/tour`, repo, how Clocked is used, evidence links, limitations.
- Select Best Overall + all three group awards, led by Verify/Compare/Rerank.

### Day 4 — Submit and verify (Nov 9)

- Submit the entry.
- Re-run the four-click path on production from a clean browser and a second network/session.
- Verify the public repo has no secrets, the README setup is current, and `/tour` is the demo URL.
- Optional: publish the People's Choice LinkedIn post.

November 10 is the buffer. Do not leave submission or video to the deadline.

## What would make Docket lose

- A 429 during judging.
- A first screen that still looks like a QA harness.
- “Release answer” on an unchanged HOLD or REWRITE.
- Presenting 29/31 as if it were the locked result.
- A scope rule that looks like a benchmark-specific bypass.
- Letting ClockedOmniGuard out-breadth Docket or a focused competitor out-clarify it.
- Spending the four days on MCP or a ledger redesign instead of the first two minutes.

## Evidence and sources

- Official challenge page and rubric: https://clocked.rezolve.ai/challenge
- Docket demo: https://docket-clocked.vercel.app/tour
- Docket console: https://docket-clocked.vercel.app/console
- Docket ledger: https://docket-clocked.vercel.app/ledger
- Docket evidence: `README.md`, `JUDGES.md`, `benchmarks/heldout-results.md`, `benchmarks/heldout-results-post-tuning.md`, `benchmarks/adversarial-results.md`, `benchmarks/calibration-results.md`, `benchmarks/necessity-results.md`
- Public competitor signals: Clocked submission alerts for ClockedOmniGuard, ClientCheck PH, Invoice Airlock, Gatehouse, DocShield, AgentShield, Inbox Shield, CleanScreen, KitBrief and Margin (LinkedIn, October–November 2026).
- Council dossier: `docs/strategy/council-review-dossier-2026-11-06.md`
- Full advisor responses and peer reviews: `docs/strategy/council-review-transcript-2026-11-06.md`

---

**Verdict:** Docket can win Best Overall, but not by adding more product. It wins by making the authority-and-receipt story impossible to miss in the first two minutes, making the review semantics honest, and making the live demo unable to fail. The product depth is already there; the demo is what is standing between Docket and rank #1.
