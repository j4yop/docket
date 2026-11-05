# Docket — design and architecture

**What it is:** a publish gate for service-desk knowledge. It takes policy documents, an employee question and a draft answer, then decides **Publish / Rewrite / Hold** with citations, signed policy envelopes and a durable audit record.

**Delivery format:** a deployed responsive web app plus a JSON API for agent pipelines. The console is the product surface; the marketing page is a static shell.

---

## 1. The problem

An AI assistant answers an employee from the knowledge base. The answer is fluent, cited, and sometimes wrong — because the source it used is stale, superseded, or written for a different country or plan.

The failure is not hallucination. It is **grounded in the wrong source**. Retrieval and groundedness checks cannot catch it: a perfectly grounded answer can still cite a policy that no longer governs. They also cannot answer the governance questions: who approved this policy, did its text change after approval, and can we prove why the gate published?

**Who feels it:** knowledge managers, service-desk leads, incident managers, and anyone who owns an AI assistant that answers policy questions.

## 2. The questions the product answers

| # | Question | Who answers it | How |
|---|---|---|---|
| 1 | Was this policy approved, and is the text unchanged? | **Policy registry** (deterministic) | HMAC-signed envelope bound to a SHA-256 content hash, metadata and approver. Unapproved/tampered = HOLD before any model call. |
| 2 | Does the audit preview contain personal data? | **Protect** | Clocked `/pii` replaces personal data before the preview is stored. |
| 3 | Is the source trying to take control? | **Guard** | Clocked `/injection` screens policies and draft for instruction overrides, fabricated approvals and secret extraction. A positive signal HOLDs before retrieval. |
| 4 | Does the draft contain a runbook script? | **Inspect** | Clocked `/script` reviews fenced blocks and command lines for destructive behavior, security blinding, persistence or exfiltration. |
| 5 | Which document governs this employee? | **Authority** (deterministic) | Jurisdiction, precedence, effective date and expiry. Future-dated and expired documents cannot govern. No model call. |
| 6 | Does the submitted metadata match the policy text? | **Extract** | Clocked `/extract` reads stated dates, jurisdiction, approval, amount, deadline and exception. A conflict HOLDs; a missing date is adopted with its source. |
| 7 | How should this request be handled? | **Decide** | Clocked `/decide` classifies request type and risk, selects the verification profile, and routes review-required cases to a human. |
| 8 | Which clause answers the question? | **Rerank** | Clocked `/rerank` selects governing clauses (`use`/`expand`) and skips superseded text. |
| 9 | Do the sources disagree, and did the draft use the old value? | **Compare** | Clocked `/compare` aligns governing and superseded clauses. A superseded value that appears in the draft forces REWRITE. |
| 10 | Does the draft omit a material condition? | **Fill** | Clocked `/fill` extracts material obligations and returns an omission judgment plus the missing condition. |
| 11 | Does the draft claim only what the governing source supports? | **Verify** | Clocked `/grounding` returns claim-by-claim supported / contradicted / not stated with evidence. |
| 12 | What should happen now? | **Policy** (deterministic) | Publish, Rewrite or Hold, with reason codes and an ordered rule set. |
| 13 | Can we prove it later? | **Ledger** | Hash-chained audit record in durable storage, public chain verifier, signed policy envelope hashes. |

**The core insight:** authority is a business rule; relevance is a model judgment. Docket never delegates "which policy wins" to a model, and never lets a relevance score override a stated precedence rule.

## 3. User flow

1. Paste a question and employee context (country, role, plan).
2. Add one or more policies with optional authority metadata and an approval reference.
3. Paste the draft answer.
4. Run the check.
5. Read the verdict, policy integrity, authority trace, claim table, omissions, conflicts and stage trace.
6. If Rewrite, use the cited corrections. If Hold, the publish path stays blocked.
7. Open `/ledger` to verify the audit chain.

## 4. Pipeline

```
input
  │
  ├─ segment into clauses (deterministic)
  │
  ├─ policy integrity (deterministic)
  │     signed envelope → content hash → approval type
  │     unapproved / tampered / bad signature = HOLD
  │
  ├─ authority (deterministic)
  │     jurisdiction → precedence → effective date → expiry
  │     future-dated or expired = not in force
  │     unresolved tie = HOLD
  │
  ├─ Protect (question + draft, audit copy)
  │     → personal data replaced before the preview is stored
  │
  ├─ Guard (policies + draft, untrusted source)
  │     → injection / prompt takeover = HOLD, before retrieval
  │
  ├─ Inspect (fenced blocks and command lines)
  │     → unsafe runbook = HOLD, before Rerank
  │
  ├─ Extract (each document, capped and batched)
  │     → metadata conflict = HOLD
  │     → missing date adopted with source span
  │     → approval/amount/deadline facts feed Fill
  │
  ├─ Decide (question + draft + governing facts)
  │     → request_type, risk, review_required
  │     → review_required = HOLD after correctness checks
  │     → profile appended to Fill/Verify instructions
  │
  ├─ Rerank (bounded clause candidates, authority rule in instructions)
  │     → governing clauses marked use / expand
  │     → superseded clauses marked skip + reason
  │
  ├─ Compare (only aligned governing/superseded pairs)
  │     → conflicts and quotes
  │     → unacknowledged superseded value in draft = REWRITE
  │
  ├─ Fill (governing policy + question + draft)
  │     → material obligations, omission judgment, missing condition
  │
  ├─ Verify (prose claims; command lines excluded)
  │     → claim verdicts, grounded score, weakest claim
  │
  └─ policy → PUBLISH / REWRITE / HOLD
        ├─ prompt injection              → HOLD
        ├─ unsafe script                 → HOLD
        ├─ policy unapproved/tampered    → HOLD
        ├─ metadata conflict             → HOLD
        ├─ authority error / no clause   → HOLD
        ├─ review required               → HOLD
        ├─ no countable claims           → HOLD
        ├─ missing support/coverage      → HOLD
        ├─ audit write failed            → HOLD
        ├─ contradicted claim            → REWRITE
        ├─ unsupported claim             → REWRITE
        ├─ unacknowledged old value      → REWRITE
        ├─ material omission             → REWRITE
        ├─ grounded < 0.50               → REWRITE
        └─ otherwise                     → PUBLISH
```

## 5. Why the pipeline is ordered this way

### Policy integrity before authority

Authority depends on metadata. If an attacker can change the effective date or swap the text, the resolver's answer is meaningless. Docket verifies every envelope first, then resolves authority from verified metadata. An unapproved custom policy returns HOLD before any Clocked call.

### Extract before Fill and Verify

The submitted metadata is untrusted. Extract reads the governing document's stated dates and jurisdiction, catches a form/text mismatch, and adopts a missing date with its source span. It also extracts approval, amount, deadline and exception language so Fill and Verify can be told which constraint matters. Without this, authority is built on unverified form fields and the draft can miss a constraint that only the text states.

### Decide before Rerank

Decide classifies the request and its risk. It selects a verification profile (deadline cases emphasize dates; amount cases emphasize numbers; approval cases emphasize approvers) and routes ambiguous or high-impact cases to human review. The profile is appended to Fill and Verify instructions, so the classification changes what the downstream checks look for.

### Compare after Rerank

Compare is accurate and cheap on short aligned passages, and unreliable on full documents. The app segments first, pairs governing and superseded clauses by token overlap and position, then sends only aligned pairs. See the measured note in §9.

### Verify excludes command lines

A command is an action, not a factual assertion. Inspect owns script safety; Verify reads the prose around the command. This prevents a safe runbook from being marked unsupported because a shell verb is not stated in the policy.

### Short policies are read whole

Rerank is a cost control, not a decision. Dropping the fourth clause of a short policy to save a little retrieval work creates real misses when the question matches a condition rather than the headline rule. Documents with up to five clauses go to Rerank in full; larger documents are bounded.

## 6. Architecture

```
Browser (HTML + CSS + JS, no build step)
   │  POST /api/check/stream  (SSE)
   │  POST /api/ablate        (counterfactual)
   ▼
FastAPI
   ├─ authority.py        clause segmentation + authority resolver (pure, tested)
   ├─ policy_registry.py  signed envelopes, seeded/admin/operator trust, tamper checks
   ├─ policy.py           verdict order (pure, tested)
   ├─ ledger.py           hash-chained records, verification, public history
   ├─ storage.py          Vercel Blob or local-directory JSON store
   ├─ clocked_client.py   auth, idempotency, bounded retries, error classes
   ├─ db.py               per-instance SQLite hot index (redacted)
   └─ app.py              routes, orchestration, SSE, policy envelopes
         │
         ├─ Clocked API: Protect, Guard, Inspect, Extract, Decide, Fill, Rerank, Compare, Verify
         ├─ Vercel Blob: policies/ and audit/ chains
         └─ SQLite: per-instance console index
```

**No hardcoded verdicts.** The verdict is a pure function of API responses, verified policy envelopes and the user's authority metadata. The sample corpus is editable input, not a fixture the app depends on. Running the same check twice produces the same decision because the inputs are the same, not because the answer is stored.

## 7. Data model

### Policy envelope

```json
{
  "policy_id": "TRV-FR-01",
  "version": "1.0",
  "title": "France travel annex",
  "jurisdiction": "FR",
  "effective_date": "2026-03-01",
  "expiry_date": null,
  "precedence": 1,
  "content_hash": "sha256 hex",
  "approved_by": "R. Moreau",
  "approved_at": "2026-11-05T12:00:00+00:00",
  "approval_type": "seeded | admin | operator",
  "signature": "hmac-sha256 hex"
}
```

`content_hash` is SHA-256 over the normalized policy text (line endings normalized, trailing whitespace removed). `signature` is HMAC-SHA256 over the canonical envelope minus `signature` and `doc_id`. `doc_id` is a per-check binding added after signing.

### Audit record

```json
{
  "seq": 42,
  "checked_at": "2026-11-05T12:00:00+00:00",
  "decision": "rewrite",
  "codes": ["contradicted"],
  "governing": {"id": "doc2", "title": "France annex", "jurisdiction": "FR", "effective_date": "2026-03-01"},
  "policy_envelopes": [{"doc_id": "doc2", "content_hash": "…", "signature": "…", "approval_type": "seeded"}],
  "credits": 17.5,
  "api_calls": 8,
  "latency_ms": 4200,
  "question_preview": "redacted question",
  "draft_preview": "redacted draft",
  "reasons": ["…"],
  "prev_hash": "…",
  "record_hash": "…"
}
```

`record_hash = SHA-256(canonical record without record_hash)`. The next record's `prev_hash` is this hash. `ledger/head.json` holds the latest sequence and hash.

## 8. Security and failure behaviour

| Failure | Behaviour |
|---|---|
| Unapproved custom policy | HOLD `policy_unapproved`, no Clocked call |
| Tampered text or invalid signature | HOLD `policy_tampered`, no Clocked call |
| Metadata conflicts with policy text | HOLD `metadata_conflict` after Extract |
| Audit ledger write fails | Verdict downgraded to HOLD `audit_unavailable` |
| Prompt injection | HOLD before Rerank, risky passage shown |
| Unsafe script | HOLD before Rerank, offending line shown |
| Decide requires review | HOLD after correctness checks |
| Material omission | REWRITE with the missing condition |
| Contradicted / unsupported claim | REWRITE with the governing quote |
| Superseded value used in draft | REWRITE with both quotes |
| Missing coverage or support score | HOLD |
| Authority tie / no governing clause | HOLD |
| 402 / 409 / 429 / 5xx | Bounded retry with the same idempotency key, then HOLD |
| Protect failure | Raw preview suppressed; check continues with redaction unavailable |

Every retry reuses the same `Idempotency-Key` and payload. Each endpoint gets its own key.

## 9. Measured behaviour

The benchmark and results live in `benchmarks/`. The latest live run covered 37 synthetic cases: 37/37 passed, governing accuracy 100%, clean false-HOLD 0%, unsafe false-PUBLISH 0%, injection recall 100%, script recall 100%, strict omission recall 75%, average 5.19 calls / 13.16 credits / 3.1 s.

Two design discoveries from live testing:

1. **Compare is clause-level.** Whole-document Compare produced false conflicts and cost far more. Aligned clause pairs are accurate and cheap.
2. **Retrieval must not drop short-policy clauses.** A fixed three-clause cap missed the 14-day leave-notice clause on a four-clause policy, turning an omission case into `no_governing_clause`. Short policies now go to Rerank whole.

The corpus is authored and synthetic. It is a regression suite, not a held-out test set. The threshold sweep is flat (Guard/Inspect scores separate cleanly at 0.3–0.8), so Docket keeps 0.50 and reports the limitation.

## 10. Accessibility

- Semantic landmarks and one `h1` on the home and console.
- Full keyboard operation; `Cmd/Ctrl+Enter` runs the check; arrow keys move between policy tabs.
- `aria-live="polite"` on verdict and stage status.
- Verdict is conveyed by text and icon, never color alone.
- Axe WCAG A/AA checks pass on the home and console.
- `prefers-reduced-motion` disables transitions and the stage pulse.
- Responsive down to 360px; the desk stacks into one column.

## 11. Privacy

Full policy texts exist only in memory during the check. The audit record stores hashes, titles, metadata, redacted question/draft previews (≤ 240 / ≤ 180 chars) and reason codes — not full documents. Protect redacts the previews before the record is written. The API key stays server-side. `/api/check`, `/api/check/stream` and `/api/ablate` require a signed session or bearer token and are rate-limited per IP and by a daily demo budget. `/ledger` is public but contains no previews.

## 12. Deliberately out of scope

- PDF upload in the console (the API supports it).
- Multi-tenant auth and per-customer policy registries.
- Automatic rewriting (the gate lists exact claims and sources; a human edits).
- A vector store (deterministic clause segmentation is sufficient for the demo).
- An agent-first UI (the value is the verdict and its evidence).
