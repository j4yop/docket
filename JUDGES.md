# Docket — judge guide

**Demo URL:** https://docket-clocked.vercel.app/tour  
**Console:** https://docket-clocked.vercel.app/console  
**Ledger:** https://docket-clocked.vercel.app/ledger  
**Repository:** https://github.com/j4yop/docket

## Four-click path

1. Open `/tour` and press **Run the tour**.
2. Watch eight live cases complete in about 6 seconds: precedence, version, omission, clean control, injection, unsafe runbook, unapproved policy, tampered policy.
3. Open an **audit seq** link to verify the hash-chained record in `/ledger`.
4. Open `/console`, press **Run flagship France case**, then inspect the verdict, the decision record and the “What each endpoint changes” table. Re-run any proof row to see the same result live.

## What to look for

- **Authority is deterministic:** the France annex overrides the newer global policy because of jurisdiction and precedence, not recency.
- **Every claim has evidence:** the verdict is paired with the governing quote, not only a label.
- **Unsafe input stops:** injection and unsafe scripts HOLD before an answer can ship.
- **Policy integrity is real:** unapproved and tampered envelopes HOLD before any Clocked call.
- **The decision is auditable:** every check gets a ledger sequence, hash and review record.
- **Clocked is not decorative:** disable the decision endpoints and the gate fails closed; the console runs real ablations.

## Rubric map

| Criterion | Points | Where to see it |
|---|---:|---|
| Practical usefulness | 25 | The console’s flagship case, decision record and review state |
| Quality of core Clocked integration | 30 | Authority + Compare + Fill + Verify decide the verdict; Guard/Inspect stop unsafe inputs |
| Additional endpoints | 15 | “What each endpoint changes” table: nine proof cases, recorded live, each row re-runnable |
| Implementation and UX | 20 | One-click tour, retry on partial runs, ledger, health, review queue |
| Clear explanation and reproducibility | 10 | This guide, `/tour`, README, public repo, 101 tests |

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

Protect and Rerank change the record or evidence set; they are not verdict levers and are measured, not ablated. The seven decision levers are ablated live in the console. The recorded proof table is in `benchmarks/necessity-results.md`; every row can be re-run from the console with no audit record written.

## Evidence

- **Safety first: 0 unsafe false-PUBLISH** across the 31 locked held-out cases and the 10 adversarial cases. No injected source, unsafe script, forged envelope, stale value or malformed policy reached PUBLISH.
- **Held-out, locked before the run:** 25/31 exact decisions, governing accuracy 100%, injection/script/omission recall 100%. Failures are published in `benchmarks/heldout-results.md`.
- **Post-held-out tuning:** 27/31, published separately in `benchmarks/heldout-results-post-tuning.md`; not folded into the locked result.
- **Calibration:** 13/14, with the Inspect boundary measured at 0.10 (`benchmarks/calibration-results.md`).
- **Endpoint necessity:** seven decision levers ablated on the case that triggers each, plus Protect/Rerank measurements (`benchmarks/necessity-results.md`).
- **Adversarial suite:** 10/10, 0 unsafe false-PUBLISH, 100% injection/script recall (`benchmarks/adversarial-results.md`).
- **Concurrency:** ten real checks, ten unique audit sequences, chain verified (`benchmarks/concurrency-results.md`).
- **Clocked-off negative control:** every Clocked call failing holds the check; see `tests/test_fail_closed.py`.
- **Tests:** 101 passing.

## Limitations

- Both accuracy corpora are authored by the Docket team. The lock proves the held-out labels were not edited after the run; it does not remove authorship bias.
- The locked run has six failures: three from one Extract metadata bug class, two label disputes about omitted conditions, and one clause-selection miss. Post-held-out tuning fixes the Extract bug class. The post-tuning run still has four failures: the two label disputes, one scope question that resolves to `no_governing_clause`, and one broad-question clause-selection miss.
- Operator attestation records a reference but is not proof of organizational authority. Admin approval is the stronger path.
- The review queue and policy approval endpoints require `DOCKET_ADMIN_TOKEN`; the public demo shows their state but cannot execute admin actions without the token.
- The demo uses synthetic policy data. It does not store full policy documents in the audit ledger.
