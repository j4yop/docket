# Docket — Best Overall Council Verdict

**Date:** 2026-11-06  
**Deadline:** 2026-11-10, 11:59 p.m. ET  
**Question:** What is the highest-leverage 4-day plan to make Docket win Best Overall in the Clocked Build Challenge, with a live, working product and no hardcoded or gimmicked behavior?

> **Historical note:** this verdict was written before the post-tuning fixes. Current evidence is 29/31 post-tuning, 0 unsafe false-PUBLISH. See `README.md` and `JUDGES.md` for the final results.

---

## 1. The actual rubric

Best Overall App is scored out of 100 by four Rezolve.ai judges:

| Criterion | Points | What it rewards |
|---|---:|---|
| Practical usefulness | 25 | A real user, a real pain, a clear outcome |
| Quality of the core Clocked integration | 30 | Clocked outputs change what the app does |
| Thoughtful use of additional Clocked endpoints | 15 | Extra endpoints improve reliability, safety, retrieval or UX; unnecessary calls earn nothing |
| Implementation and user experience | 20 | Working app, clear flow, failure handling, polish |
| Clear explanation and reproducibility | 10 | A judge can understand and rerun it |

Group awards use depth 40, breadth 30 (10 per endpoint in the group), usefulness/execution 20, clarity/reproducibility 10.

**Strategic implication:** 45 points are usefulness + UX. Docket currently over-invests in the 45 points for integration/breadth and under-invests in the 45 points for the human product. The fix is not more API calls. It is a sharper product, a reliable judge path and a proof that Clocked is the decision engine.

---

## 2. What Docket already has

- All nine Clocked endpoints, each wired into the decision.
- Deterministic authority resolution: jurisdiction, precedence, effective date, expiry.
- HMAC-signed policy envelopes with seeded/admin/operator trust.
- Per-claim governing quotes, not just a verdict label.
- PUBLISH / REWRITE / HOLD with fail-closed behavior.
- Hash-chained audit ledger, atomic sequence claims, checkpoints, health verification.
- Durable human review records for HOLD/REWRITE.
- Policy approval UI and signed-envelope display.
- 92 tests.
- Held-out evidence: 25/31 locked (80.6%), 27/31 post-tuning (87.1%), 0 unsafe false-PUBLISH.
- Calibration: 13/14; Guard 0.50, Inspect 0.10.
- Live 8-case judge tour, 8/8 as expected.
- 10 parallel checks verified one chain.

This is enough raw material to win. The gap is the judge-facing product.

---

## 3. Competitive landscape

Public submission alerts found during the review:

| Project | Domain | Clocked endpoints | Why it is dangerous |
|---|---|---|---|
| **Margin** | Academic integrity review | Protect, Compare, Verify, Rerank | Sharp domain, strong "machine flags / educator decides" story, human review ledger |
| **Invoice Airlock** | Supplier bank-change fraud | Guard, Protect, Extract, Decide, Compare | Urgent, concrete, multilingual, RELEASE/HOLD/BLOCK, uncertainty band |
| **Inbox Shield** | Customer email injection | Guard, Protect, Decide, Extract | Clean separation of legitimate request and hostile instruction |
| **Gatehouse** | GitHub issue firewall | Guard, Inspect, Protect | Direct developer workflow, evidence on the original text |
| **AgentShield** | Agent input pre-flight | Guard, Protect, Inspect | Clear security panel and category explanation |
| **ClientCheck PH** | Freelancer contract review | Guard, Protect, Extract, Verify, Rerank | Clause-level evidence and explicit uncertainty |
| **KitBrief** | Workshop kit planning | Extract, Fill | Focused utility, exact quantities, human corrections |
| **Curre** | Android launcher | Decide, Extract | Consumer product, unusual surface |

**The field is crowded with input firewalls.** Docket must not be "another gate." Its unique position is:

> **The output-side policy gate: it proves which policy governs the answer, blocks the release when it cannot, and leaves a replayable audit record.**

That is a different product from an input firewall, and it is the one story none of the others can tell.

---

## 4. Council consensus

1. **Docket reads as an API/eval harness, not a must-have product.** The console asks the user to assemble a check. It does not meet them at the moment of work: a draft answer waiting to ship.
2. **The judge path is the highest-leverage fix.** `/tour` is strong; `/` is a generic marketing shell and the console is dense. The submission demo URL should be `/tour`, not `/`.
3. **The admin-locked workflow is a demo gap.** Review queue and policy approval return 404 without `DOCKET_ADMIN_TOKEN`; judges cannot try the most product-like surface.
4. **Nine endpoints are an advantage only if each one visibly changes the result.** Otherwise it reads as checkbox breadth. The ablation harness is the proof; put it in the judge path.
5. **The held-out headline must be honest and safety-first.** Lead with **0 unsafe false-PUBLISH** and the four published failures; do not present 27/31 as the locked result.
6. **The moat is audit, not the verdict.** Signed envelopes + authority + hash chain + review records are hard to clone and directly support the 30-point integration score.
7. **Reliability beats features.** A partial tour that says "Complete," or a rate limit in the middle of judging, destroys more score than a new endpoint adds.
8. **Do not add Slack/Zendesk/multi-tenant/replay products in four days.** Freeze scope and polish the core loop.

---

## 5. Contested points

| Tension | Position A | Position B | Decision |
|---|---|---|---|
| Front door | Redirect `/` to console/tour | User explicitly said ignore marketing page | Use `/tour` as the submission demo URL; do not change `/` |
| Demo admin | Give judges a scoped demo operator | A public bypass weakens the security story | Do not add a public admin bypass; make the queue/ledger visible as evidence, and document the admin flow |
| Replay CLI | Build decision replay + policy lifecycle | It is a second product; judges will not run it | Only add a minimal `replay` proof if it costs under a day; otherwise `/ledger` + health + tests are enough |
| Evidence headline | Lead with 25/31 or 27/31 | Lead with safety outcome | Lead with 0 unsafe false-PUBLISH; show 25/31 locked and 27/31 post-tuning as labelled context |
| Console scope | Collapse to one queue | Judges need the full trace | Default to verdict + evidence; put envelopes/traces behind "details" |

---

## 6. Blind spots caught in peer review

- **Adversarial robustness.** The held-out suite covers injection, but there is no dedicated red-team suite trying to talk the gate into PUBLISH through the draft, policy text, question, Unicode, markdown comments, forged approvals or a superseded value. Add one; publish the result.
- **"Remove Clocked."** Prove the app fails closed without Clocked. The code already does; add a test and a judge-facing explanation.
- **Tour failure states.** A non-fatal case error used to end with "Complete." Fixed: partial runs now show "Incomplete," list failed cases, and offer "Retry failed cases" that reruns only those cases. The per-IP limit was raised from 20 to 60 checks/hour.
- **Loading states.** Health and ledger now time out and show an error instead of sitting on "Checking..." forever.
- **Buyer ambiguity.** Pick one: support operations / knowledge management in a regulated service desk. Do not try to sell to "everyone with policies."

---

## 7. The 4-day plan

### Day 1 — Nov 6: judge path and reliability

- Use `https://docket-clocked.vercel.app/tour` as the submission demo URL, not `/`.
- Verify the tour live: one click, 8 rows, 8/8, under 30 seconds.
- Keep the partial-run fix: "Incomplete," failed rows, "Retry failed cases."
- Keep the 60/hour demo budget and add a fallback video.
- Record a 2-minute backup video: tour → ledger → console injection → health.
- Add a prominent "Judge tour" button in the console, not only the audit-note link.
- Add a `JUDGES.md` one-pager: 4-click path, rubric map, endpoint table, evidence links, honest limitations.

### Day 2 — Nov 7: product clarity and core loop

- Add a one-line value proposition at the top of the console: "For support teams shipping AI answers: Docket proves the governing policy, catches stale or unsafe claims, and records who released it."
- Add a "Run the flagship case" action that preloads the France precedence case and runs it. Preloading a sample is not hardcoding a verdict.
- Make the verdict panel the first thing a judge sees: verdict, governing policy, the superseded value, the governing quote, and the review state.
- Add a "Decision record" card: audit seq, policy envelopes, review status, release/send-back state. Link to `/ledger`.
- Add plain-language definitions for envelope, operator-attested, held-out, lock and ablation.
- Do not touch the marketing page.

### Day 3 — Nov 8: proof of necessity and robustness

- Add an endpoint coverage section: for each of the nine endpoints, what it changes, which live case demonstrates it, and what happens when it is disabled. Use the real `/api/ablate` output.
- Add a "Clocked off" negative control to the test suite: every Clocked call fails or is disabled → HOLD, never PUBLISH.
- Run a 10-case adversarial suite: injection in policy/draft/question, Unicode, markdown comments, forged approval, superseded value, unsafe script, malformed metadata, tampered envelope, clean control. Publish `benchmarks/adversarial-results.md`; report unsafe PUBLISH = 0.
- Fix the two real held-out `no_governing_clause` cases with a deterministic broad-question/scope fallback. Re-run post-tuning and label it as post-tuning. Keep the locked 25/31 result.
- If time is short, skip benchmark tuning and ship the adversarial suite; safety evidence is worth more than two label disputes.

### Day 4 — Nov 9: submission and freeze

- Write the entry form around the rubric:
  - Practical usefulness: who the user is, what breaks today, what Docket changes.
  - Core integration: authority + signed envelope + Verify/Compare/Fill/Guard/Inspect decide the outcome; Clocked is not decoration.
  - Additional endpoints: table of all nine and the specific decision each changes.
  - Implementation/UX: live tour, retries, health, ledger, review queue, 92 tests.
  - Clarity: `/tour`, `JUDGES.md`, README top, 3-command quickstart, 2-minute video.
- Select Best Overall App **and** all three group awards. A project can win only one judged award; entering all maximizes the chance of at least one and does not hurt Best Overall.
- Freeze code. Run tests, deploy, smoke-test in incognito, verify `/tour`, `/console`, `/ledger`, `/api/health`.
- Reserve Nov 10 for upload failures only.

---

## 8. The 2-minute judge demo

1. **0:00–0:15 — Problem.** "An AI assistant answers a policy question confidently from a superseded source. The answer is fluent, cited, and wrong."
2. **0:15–0:35 — Tour.** Open `/tour`, click Run. Eight cases: precedence, version, omission, clean, injection, runbook, unapproved, tampered. 8/8, audit seqs shown.
3. **0:35–0:55 — Precedence.** Show the France annex overriding the newer global policy. Point at the superseded value and the governing quote.
4. **0:55–1:10 — Injection / runbook.** Show HOLD, not a confident answer. Mention Guard/Inspect.
5. **1:10–1:30 — Review + ledger.** Show the HOLD/REWRITE review record and the hash-chained record. "A human can release or send back; the decision is auditable."
6. **1:30–1:50 — Why nine.** "Rerank/Compare/Fill/Verify decide; Guard/Inspect/Protect protect; Extract/Decide preserve metadata and triage. Disable any of the decision endpoints and the gate fails closed."
7. **1:50–2:00 — Honest close.** "25/31 locked held-out, 27/31 post-tuning, zero unsafe false-PUBLISH. Four failures are published. Live, no hardcoded verdicts."

---

## 9. Rubric map

| Rubric | Current evidence | What to add |
|---|---|---|
| Practical usefulness 25 | Real policy-sprawl problem; live gate; review queue | One buyer, one sentence, one flagship case, unsafe-PUBLISH metric |
| Core integration 30 | All nine endpoints; authority; envelopes; per-claim quotes | Endpoint necessity table; Clocked-off fail-closed test; ablation proof |
| Additional endpoints 15 | All nine wired | Show each endpoint's effect, not just the call count |
| Implementation/UX 20 | 92 tests; ledger; health; tour; review queue; concurrency | Tour reliability, console CTA, loading/error states, first-run clarity |
| Clarity/reproducibility 10 | README; benchmark docs; lock; tests | JUDGES.md, 2-minute video, 3-command quickstart, honest evidence labels |

---

## 10. What not to do

- Do not add Slack, Zendesk, Teams, multi-tenant auth or a second product.
- Do not build a replay CLI, policy lifecycle product or model-agnostic middleware in four days unless it directly supports the demo and costs under a day.
- Do not edit locked held-out cases or present post-tuning as the locked result.
- Do not headline 25/31 or 27/31. Headline zero unsafe false-PUBLISH, then show the labelled numbers.
- Do not add a public admin bypass. Keep the admin boundary; show the queue and ledger as evidence.
- Do not change the marketing page. Use `/tour` as the demo URL.
- Do not add more cases or endpoints. The bottleneck is clarity and reliability, not coverage.

---

## 11. Final verdict

Docket can be a credible Best Overall winner, but only if it stops presenting itself as a nine-endpoint verification laboratory and starts presenting itself as **the release gate for AI answers that must be defensible**.

The winning sentence is:

> **Docket proves which policy governs an AI answer, blocks the release when the evidence does not hold, and leaves a replayable audit record of who released it.**

The winning demo is `/tour`, not `/`. The winning proof is zero unsafe false-PUBLISH, not a perfect self-authored score. The winning engineering is the reliability of the live path, not another endpoint.

If the team executes the four-day plan, Docket has a real shot at Best Overall and a strong shot at the Verify/Compare/Rerank group award. If it only polishes the backend, it will lose to a sharper domain story.
