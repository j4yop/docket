# Docket endpoint necessity proofs

**Recorded:** 2026-11-06T06:32:41+00:00
**Mode:** live
**Base URL:** `http://127.0.0.1:8020`

Each row is one live baseline and one live counterfactual. All nine endpoints are ablated; Protect and Rerank change the record or evidence set, not the verdict. `/api/prove` writes no audit record.

| Endpoint | What it changes | Proof case | With endpoint | Without endpoint | Change |
|---|---|---|---|---|---|
| **Guard** | Injection gate | Injected policy note | HOLD · Injection detected | PUBLISH · No injection gate | HOLD → PUBLISH |
| **Inspect** | Script safety | Unsafe runbook | HOLD · Unsafe script detected | REWRITE · No script inspection | HOLD → REWRITE |
| **Extract** | Metadata integrity | Metadata conflict | HOLD · 1 metadata conflict | PUBLISH · No metadata check | HOLD → PUBLISH |
| **Decide** | Triage and review routing | Precedence over recency | REWRITE · Review required | REWRITE · No review route | Review required → No review route |
| **Compare** | Superseded conflicts | Precedence over recency | REWRITE · 2 conflict pairs | REWRITE · No conflict pairs | 2 conflict pairs → No conflict pairs |
| **Fill** | Omission detection | Omitted remote-work condition | REWRITE · Omission detected | PUBLISH · No omission check | REWRITE → PUBLISH |
| **Verify** | Claim grounding | Clean access request | PUBLISH · Claims grounded | HOLD · No verification | PUBLISH → HOLD |
| **Protect** | Audit redaction | PII in the question | REWRITE · 1 PII entity redacted | REWRITE · No redaction | 1 PII entity redacted → No redaction |
| **Rerank** | Evidence selection | Precedence over recency | REWRITE · 1 of 8 clauses used | REWRITE · 3 of 3 clauses used | 1 of 8 clauses used → 3 of 3 clauses used |

## Notes

- The clean access-request proof publishes with Verify and holds without it. The gate fails closed when verification is missing.
- Compare and Decide keep the same decision on the precedence case but lose their evidence and review routing when ablated. Their contribution is the conflict table and the review route, not a different label.
- Protect and Rerank are not verdict levers. Their rows show what changes when they are disabled: the redaction count and the evidence set.
- This is a targeted proof of endpoint contribution, not an accuracy benchmark. The held-out and adversarial results are separate.
