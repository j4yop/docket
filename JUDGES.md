# Docket — judge guide

**Demo URL:** https://docket-clocked.vercel.app/tour
**Console:** https://docket-clocked.vercel.app/console
**Ledger:** https://docket-clocked.vercel.app/ledger
**Fallback recording:** https://docket-clocked.vercel.app/demo/docket-fallback.mp4
**Repository:** https://github.com/j4yop/docket

## Four-click path

1. Open `/tour`. The featured France case is already loaded live: the newest global policy would publish, the older France annex governs, and the draft must be rewritten.
2. Press **Run the tour**. Eight live cases complete in about 30 seconds: precedence, version, omission, clean control, injection, unsafe runbook, unapproved policy, tampered policy. The counter moves only when a case finishes, and a failed case can be retried on its own.
3. Open an **audit seq** link to verify the hash-chained record in `/ledger`.
4. Open `/console`, press **Try the France example**, then inspect the deciding claim, governing quote, decision record and review record. Open **Technical details → Endpoint contribution** to see the nine proofs; approve or send back the review with its scoped capability, and re-run any proof row. Two more samples are one click away: **Scope applicability** (a visible authority-trace determination) and **Unapproved policy** (HOLD → Attest for this check → re-run → PUBLISH).

## Two-minute demo script

| Time | Do this | Say this |
|---|---|---|
| 0:00 | Open `/tour` | “This is the submission demo. It is the product, not a slide.” |
| 0:10 | Point at the featured France case | “The newest global policy would publish. The older France annex governs on jurisdiction and precedence, and the draft says the opposite.” |
| 0:20 | Press **Run the tour** | “Eight live cases: precedence, versioning, omission, a clean control, injection, an unsafe script, an unapproved policy and a tampered policy.” |
| 0:45 | Point at the rows, human-readable reasons and audit links | “Every row is a real Clocked call, and every determination has a ledger sequence. Nothing here is pre-recorded.” |
| 0:55 | Open `/console` and press **Try the France example** | “The console meets a draft answer waiting to ship. The older France annex governs because of jurisdiction and precedence, not recency.” |
| 1:15 | Point at the deciding claim, governing quote and review card | “The audit sequence, signed policy envelopes, deciding claim and governing quote sit above the action. Approve review records the decision; it still requires an edit and re-run to publish. The shared queue stays admin-only.” |
| 1:40 | Open **Technical details → Endpoint contribution** and re-run Guard | “Each decision lever is proved on the case that triggers it. Guard off turns a HOLD into a PUBLISH. If Clocked is unavailable, the gate holds.” |
| 1:55 | Close on the evidence | “The headline is 0 unsafe false-PUBLISH across 31 locked held-out cases and 10 adversarial cases, with the exact-label results published honestly.” |

## What to look for

- **Authority is deterministic:** the France annex overrides the newer global policy because of jurisdiction and precedence, not recency.
- **Every claim has evidence:** the verdict is paired with the governing quote, not only a label.
- **Unsafe input stops:** injection and unsafe scripts HOLD before an answer can ship.
- **Policy integrity is real:** unapproved and tampered envelopes HOLD before any Clocked call.
- **The decision is auditable:** every check gets a ledger sequence, hash and review record. The review that check opened can be claimed, approved or sent back with its scoped capability; approving records the review and still requires an edit and re-run to publish. The shared queue stays admin-only.
- **Clocked is not decorative:** disable the decision endpoints and the gate fails closed; the console runs real ablations.
- **Scope is explained:** when a draft is only a negative applicability statement, the console shows the authority-trace scope determination and says why Verify had no substantive claim to check. Add a substantive claim and the normal Verify path runs.
- **The demo budget is judge-safe:** 60 checks per session, 600 per IP per hour and 1000 per day. A full tour is eight checks.
- **Preflight is one command:** `make preflight` checks `/tour`, `/console`, `/ledger`, `/api/session`, health, the ledger chain and the policy registry.

## Rubric map

| Criterion | Points | Where to see it |
|---|---:|---|
| Practical usefulness | 25 | The console’s flagship case, decision record and review state |
| Quality of core Clocked integration | 30 | Authority + Compare + Fill + Verify decide the verdict; Guard/Inspect stop unsafe inputs |
| Additional endpoints | 15 | **Endpoint contribution** under Technical details: nine proof cases, recorded live, each row re-runnable |
| Implementation and UX | 20 | One-click tour, retry on partial runs, ledger, health, review queue |
| Clear explanation and reproducibility | 10 | This guide, `/tour`, README, public repo, 114 tests |

## Endpoint map

| Endpoint | What it changes | Live case |
|---|---|---|
| **Protect** | Redacts PII in the audit preview | Any case containing personal data |
| **Guard** | HOLD on prompt injection | Injected policy note |
| **Inspect** | HOLD on an unsafe runbook script | Unsafe runbook |
| **Extract** | Verifies policy metadata against the text | Metadata conflict case |
| **Decide** | Routes high-impact or ambiguous requests to review | Precedence over recency (review route) |
| **Rerank** | Selects the clauses that answer the question | Any policy question |
| **Compare** | Finds superseded values reused in the draft | Precedence over recency (two conflict pairs) |
| **Fill** | Finds material omissions in the draft | Omitted remote-work condition |
| **Verify** | Grounds each claim and returns the governing quote | Clean access request |

All nine endpoints are ablated in the console. Protect and Rerank change the record or evidence set rather than the verdict, so their rows show the redaction count and the evidence-set change. The recorded proof table is in `benchmarks/necessity-results.md`; every row can be re-run with no audit record written.

## Evidence

- **Safety first: 0 unsafe false-PUBLISH** across the 31 locked held-out cases and the 10 adversarial cases. No injected source, unsafe script, forged envelope, stale value or malformed policy reached PUBLISH.
- **Held-out, locked before the run:** 25/31 exact decisions, governing accuracy 100%, injection/script/omission recall 100%. Failures are published in `benchmarks/heldout-results.md`.
- **Post-held-out tuning:** 29/31, published separately in `benchmarks/heldout-results-post-tuning.md`; not folded into the locked result. The two `no_governing_clause` failures are fixed; the two remaining failures are label disputes about omitted conditions.
- **Calibration:** 13/14, with the Inspect boundary measured at 0.10 (`benchmarks/calibration-results.md`).
- **Endpoint necessity:** all nine endpoints ablated on the case that triggers each (`benchmarks/necessity-results.md`).
- **Adversarial suite:** 10/10, 0 unsafe false-PUBLISH, 100% injection/script recall (`benchmarks/adversarial-results.md`).
- **Concurrency:** ten real checks, ten unique audit sequences, chain verified (`benchmarks/concurrency-results.md`).
- **Clocked-off negative control:** every Clocked call failing holds the check; see `tests/test_fail_closed.py`.
- **Tests:** 114 passing.

## Limitations

- Both accuracy corpora are authored by the Docket team. The lock proves the held-out labels were not edited after the run; it does not remove authorship bias.
- The locked run has six failures: three from one Extract metadata bug class, two label disputes about omitted conditions, and one clause-selection miss. Post-held-out tuning fixes the Extract bug class and both `no_governing_clause` cases: a broad-question governing-clause fallback and a deterministic scope rule from the authority trace. The post-tuning run still has two label disputes, `holdout-auth-tie` and `holdout-script-safe`.
- Operator attestation records a reference but is not proof of organizational authority. Admin approval is the stronger path.
- The deterministic scope path is deliberately narrow: one named out-of-scope policy, one negative applicability sentence, no numbers or substantive requirement. Any extra substantive claim leaves the scope path and goes through Verify. The console states this on screen.
- Rate limits are enforced per server instance; Vercel may run more than one instance. The session budget is the primary judge protection, with per-IP and daily ceilings as headroom.
- The shared review queue and shared policy registry approval require `DOCKET_ADMIN_TOKEN`. The check that opens a review returns a scoped capability, so a judge can claim, approve or send back that specific record without the token. Per-check policy attestation is public; durable registry approval is admin-only.
- The demo uses synthetic policy data. It does not store full policy documents in the audit ledger.
