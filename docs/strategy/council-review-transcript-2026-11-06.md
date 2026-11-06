# Council transcript — Docket Best Overall review

**Date:** 2026-11-06  
**Dossier:** `docs/strategy/council-review-dossier-2026-11-06.md`  
**Question:** What are the highest-leverage changes in the next four days to make Docket the Best Overall winner and rank #1, while keeping the project live, working, and free of hardcoded or gimmicked behavior? The marketing page is out of scope.

## Research dossier

The full dossier is in `docs/strategy/council-review-dossier-2026-11-06.md`. It includes the official 100-point Best Overall rubric, the four group awards, the current product and evidence, the public competitor set, the known weaknesses and the options considered.

## Advisor 1 — The Contrarian / Red Team

Docket's risk isn't shallowness — it's that a judge can't see the depth before the tab closes. Three actions, in this order.

**1. Make the demo unkillable, and cheap to finish.** The 60/hour per-IP budget against an eight-case, 103-credit tour is the highest-probability zero on the board: four judges behind one NAT plus one retry loop turns the submission into an error page. Add a judge-safe session quota (a signed session cookie with its own budget — not an allowlist gimmick), pre-warm the tour, and put a two-minute recording at the top of `/tour` for when Clocked itself is slow. Fix "incomplete until all eight finish": a three-case run must still render a complete, credible result. Delete the stale `static/` folder today — reproducibility is 10 points, and a judge who reads the wrong app donates them.

**2. Lead with France, not the suite.** One case fills the first viewport: the draft, the claim that would have shipped, the governing quote, the block, the audit hash. Then "seven more cases" as breadth. Right now the judge does the narrative assembly, and a focused competitor like Invoice Airlock wins precisely because it doesn't ask that.

**3. Kill everything that reads as fake.** "Release answer" that doesn't publish, Attest hidden behind seeded policies, and 29/31 sitting beside 25/31 locked. Rename to "Approve review — edit and re-run required"; ship one unapproved-policy example that works in one click; label the numbers in the tour: "25/31 held out; 29/31 after tuning on dev cases, not the headline." Judges forgive a modest number. They punish a massaged one.

Cut MCP, the ledger redesign, and the four-award spray. Half-built breadth is a liability; you have four days.

**Objection:** reliability work is invisible. If the live tour works, the budget plumbing and fallback video earn zero of the 100 points, and I've spent the one day that could have moved the 45 points tied to story and UX — optimizing for a failure that never happens while the legible competitor wins.

## Advisor 2 — The First Principles Thinker

**What it is.** Not a nine-endpoint checker — an authority resolver with a receipt. It decides which policy governs an answer and proves the check ran against that text. Competitors review documents; Docket decides which rule applies. That is what the 30-point integration score rewards.

**Judges reward** one moment where a plausible answer was about to ship and was stopped for a verifiable reason — then proof it generalizes. Proof: a draft cites the global refund policy and passes a naive check; the France annex overrides on precedence and the draft holds.

1. **Make that contrast the first screen of /tour.** Today it is row one of an eight-row table. Open with two verdicts: "against cited policy: PUBLISH," "against governing policy: HOLD" — the controlling quote and decision path (jurisdiction → precedence → date) above the fold. The suite sits behind "Run all eight." Run both live; let the judge switch to US and watch it pass. A hero they can falsify is a demo; one they can only watch is an ad.

2. **Make the record the product; stop the label lying.** "Release answer" that doesn't publish contradicts the core claim. Rename it "Approve review," show the real state — approved, re-run required — make the record permalinkable and verifiable (seq, hash, chain check), and fold in /ledger.

3. **Spend the rest on reliability and reproducibility.** Session-safe budget so four judges plus retries never hit 429; a preflight strip (live, ledger verified, registry 10/10); one command, `pnpm evidence`, replaying the locked 25/31 and 10/10 adversarial sets, chain verified. Label 29/31 post-tuning. That earns the explanation points and makes "self-authored" falsifiable.

Cut MCP, third-party corpora, the standalone /ledger. Enter all four awards; distribution, not product.

**Objection:** a single hero is the most stageable thing you build, and staging is what "no gimmicks" judges punish. As fixed narrative it suggests the other seven are decoration, concedes breadth to ClockedOmniGuard, and risks breaking the live demo. It survives only if editable: change one input, and the outcome changes for a real reason. Otherwise ship the preflight and evidence command; leave /tour alone.

## Advisor 3 — The Expansionist / Strategist

**Thesis:** Stop competing as document review. Claim the category nobody else occupies — the authority layer above review. One sentence: *every other entry checks the document; Docket checks whether the policy behind it is still the policy.*

**1. Rebuild `/tour` as one live supersession case, then breadth.**
Open on France: a confident draft citing a policy superseded nine days earlier; the gate blocks it, opens a review record, writes audit seq. Only then the eight-case suite, labelled "8 live cases · 9 endpoints." Reordering and copy, not new machinery — nothing canned. This hands the judge the "wrong answer would have shipped" story instead of making them assemble it, and it is the field's only narrative about authority *over time* rather than content classification.

**2. Submit four tailored entries, led by Verify/Compare/Rerank.**
That bracket is Docket's winnable one: 100% governing accuracy across superseded, expired and conflicting policy, plus rerank evidence selection. No competitor does this. Decide/Extract/Fill is second (durable review record, scoped capability, coverage gaps). Enter Protect/Guard/Inspect but don't lead with it — AgentShield, Gatehouse, Inbox Shield and DocShield crowd that bracket. Each entry opens with its group's own artifact, not shared boilerplate; group awards score depth 40 and explanation 10. Add `make evidence`: one command regenerating held-out, adversarial, calibration and ablation numbers. That is the cheapest 10 points on five scorecards.

**3. Make the ledger the shareable proof object.**
Console shell, hash chain visible. One 90-second France recording, one post with the stakes hook. The recording is the fallback video; the post is the People's Choice engine. Docket is the only entry with chain of custody — what judges screenshot and voters share.

**Cut:** MCP, new endpoints, `static/` beyond a README line. Protect the 60/hour budget — a rate-limited hero case kills the narrative.

**Objection:** The hero case narrows Docket to "support answers," which reads lower-stakes than contracts or invoices, and one flagship can look like a one-trick demo beside broad security suites. Keep breadth and all nine endpoints one glance from the hero.

## Advisor 4 — The Outsider / Domain Skeptic

`/tour` reads like a QA harness. It addresses the judge, not the problem; rows are named after mechanisms ("Precedence over recency"). I click Run and the progress counter never moves from 8/8 while every row says Waiting and "Starting…" stays on screen. The finish is raw codes — `coverage_gap`, `policy_unapproved` — with no story. `/console` opens on an empty policy-authoring form: over-engineered for a first look, under-engineered as a story. The France example is the one moment that lands: 2/2 contradicted, France annex governs, 8 calls, 24 credits. But "Release answer" sits above the evidence. On a REWRITE I can add a note and release it; the ledger says "released by reviewer" while the unsafe draft is unchanged. A prompt-injection HOLD offers the same button. That is a logic hole, not a label problem.

**1. Make review honest.** On REWRITE/HOLD, remove "Release answer." Offer "Send back" or "Override hold (reason required)," and state "not published; re-run required." Put claims, governing quote and superseded clause above the buttons. An unchanged REWRITE or injection HOLD must never be one note away from "released."

**2. Make `/tour` one story, then breadth.** Open with the France case expanded live: question, draft, governing quote, superseded quote, REWRITE, "this would have shipped." Then run the suite. Use human case names and one-line reasons, not raw codes. Fix the 8/8-while-running counter, stale "Starting…", 6.1s compute-vs-wall label, and repeated DK-261106-0002. Add an honest strip: 0 unsafe false-PUBLISH, 25/31 locked, 29/31 post-tuning, 10/10 adversarial.

**3. Put endpoint proof first.** The buried "Technical details" drawer is the best evidence: nine endpoints, with/without deltas, live re-run. Surface it as a strip on `/tour` and link each row to its full record. Make the unapproved-policy case a live Attest → re-run → Publish path; the disabled Attest button hides a key differentiator.

**Objection:** #1 is the least visible. Most judges will stay on `/tour`, never open a review, and never see the bug; if only one thing ships, #2 is the higher-leverage first impression. Changing review semantics also risks breaking the scoped-capability flow that differentiates the human review. If I ranked by visibility, #2 would be first and #1 would be a correctness fix, not the headline.

## Advisor 5 — The Executor / Pragmatic Engineer

**1. (Day 1–2) Turn `/tour` into one story instead of eight rows.** Keep the existing runner and `TOUR` array in `website/tour.js` intact; add a flagship first act above it: the France draft, the newer global policy that would have shipped, the older France annex that governs, the HOLD, the review record, the audit seq. Render the eight-case suite fully visible below as breadth, not behind a click. Close with one evidence strip: 0 unsafe false-PUBLISH, 25/31 locked (29/31 post-tuning labeled separately), 10/10 adversarial, 102 tests, 9/9 endpoints. Reuse the live `precedence-recency` sample and a real check — no canned verdicts. ~1.5 days. This is the only change that moves usefulness (25) and explanation (10) together.

**2. (Day 2–3) Remove the contradictions a judge will catch.** In `website/integrations/gate.js`, change "Release answer" to "Approve review" and render the post-approval state as "Approved — edit and re-run to publish," not release/publication. Promote the governing quote, a three-step decision path, and the one-line scope determination ("France annex governs; Verify ran on its clauses") into the first decision card. Leave technical details collapsed. Front-end only; tests are API-level. ~1 day.

**3. (Day 3) Make judging unable to fail.** The configured 60 checks/hour/IP against a tour that spends eight checks per run leaves little headroom for four judges, retries and public voters on shared IPs. Raise the limit to ~600/hour and the daily cap proportionally, or exempt the fixed tour sequence and cap per session. Add a two-minute recording of the four-click path and a smoke script covering tour, France case, ledger verify. ~0.5 day.

**Cut:** MCP (G), a new third-party corpus (H), ledger redesign (C), a new attestation flow (E). **Keep:** entering all four awards — ten minutes. Freeze code end of Day 3; Day 4 is recording, deploy verification and submission copy.

**Objection:** the tour is the one thing judges actually run; restructuring a working demo risks breaking it, and a flagship first act may make the eight-endpoint breadth look thinner. Mitigation: keep the suite rendered and runnable on the same page — only the lead-in changes.

## Anonymous peer review 1 — evidence and judge psychology

**1. Strongest — Advisor D.** It is the only one naming a defect that can actively lose the pitch: "Release answer" on a REWRITE/HOLD, publishable unchanged, plus the contradiction of an integrity product shipping a dishonest button. Its objection is also the sharpest judge-psychology call: most judges never open review, so it explicitly trades visibility against leverage instead of assuming depth gets seen.

**2. Fatal blind spot — Advisor B.** It never mentions the 60/hour IP budget or any demo-failure path, yet its entire thesis (falsifiable first screen, permalinked record) is live-demo dependent. "Enter all four awards" also contradicts A and E and dilutes a single strong bracket entry. A stageable hero with no fallback is a coin flip.

**3. Missing — all five.** None asks what the rubric actually scores, and all five cut MCP in unison. If the Clocked Build Challenge weights MCP/agent integration, that is forfeited points, not focus. Groupthink, not strategy.

## Anonymous peer review 2 — execution and differentiation

**1. Strongest argument — E.** It is the only plan that improves the judge's first 60 seconds without betting the working demo: flagship France act above the existing runner, suite kept as breadth, contradictions fixed, evidence strip, budget/recording safety, and a Day-3 freeze. Concrete, sequenced, regression-aware.

**2. Fatal blind spot — C.** It sells "authority layer" while leaving the authority receipt dishonest: "Release answer" can approve an unchanged REWRITE/HOLD, and C doubles down on `/ledger`, which the dossier says reads as a different product. Positioning without fixing that contradiction is fatal; "protect the 60/hour budget" is also not a fix.

**3. Missing consideration — the out-of-scope rule.** A judge can ask whether Docket's deterministic scope determination bypasses Verify, collapsing the "0 unsafe false-PUBLISH" claim. None of the five prepares an on-screen authority-trace explanation or a live test case for that question.

## Chairman synthesis

The council agrees on the product's real identity: **an authority resolver with a receipt**, not a document checker. It also agrees on the weakest surface: the demo is a QA harness, and the first two minutes hide the product's best story.

The highest-confidence findings:

1. **Lead `/tour` with the France case.** The judge should see the wrong answer, the governing quote, the block, the review and the audit sequence before the eight-case suite. This is the only change that moves usefulness, explanation and UX together.
2. **Make review honest.** “Release answer” on an unchanged HOLD or REWRITE is a trust bug. Rename it, show the real state, put the evidence above the action.
3. **Make the demo unable to fail.** The 60/hour per-IP budget is a single point of failure; use a session budget with IP headroom, fix partial runs, and record a fallback.

The council splits on the ledger and the four-award strategy. The chairman's verdict: do not redesign the ledger in the critical path; enter all four judged awards because the product genuinely uses all nine endpoints, but lead with Verify/Compare/Rerank and keep one narrative.

The peer review adds the missing integrity question: the deterministic scope path bypasses Verify. It is defensible, but it must be visible, explained, and tested. A judge should never discover it in the code.

The final verdict and four-day plan are in `docs/strategy/council-review-2026-11-06.md`.
