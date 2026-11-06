# Docket

**The publish gate for AI service-desk answers.**

Docket decides which policy actually governs an answer, checks the draft against that text, records a human review when needed, and writes a tamper-evident receipt.

[![Clocked Build Challenge](https://img.shields.io/badge/CLOCKED_BUILD_CHALLENGE-submission-FEEA3B?style=for-the-badge&labelColor=1e293b)](https://clocked.rezolve.ai/challenge)
[![Clocked endpoints](https://img.shields.io/badge/CLOCKED_ENDPOINTS-9%2F9-38BDF8?style=for-the-badge&labelColor=1e293b)](https://clocked.rezolve.ai/docs)
[![Safety](https://img.shields.io/badge/UNSAFE_FALSE_PUBLISH-0-22c55e?style=for-the-badge&labelColor=1e293b)](#evidence)
[![Tests](https://img.shields.io/badge/TESTS-114_PASSED-4ade80?style=for-the-badge&labelColor=1e293b)](#run-locally)

**Live demo:** [Judge tour](https://docket-clocked.vercel.app/tour) · [Console](https://docket-clocked.vercel.app/console) · [Ledger](https://docket-clocked.vercel.app/ledger) · [2-minute fallback](https://docket-clocked.vercel.app/demo/docket-fallback.mp4)

Every result in the tour and console is computed live at request time; nothing is pre-recorded. The video is only a fallback if the network fails.

[Problem](#the-problem) · [Questions](#the-questions-docket-asks) · [How it works](#how-it-works) · [Architecture](#architecture) · [Clocked](#clocked-integration) · [Scenarios](#live-scenarios) · [Evidence](#evidence) · [API](#api) · [Run locally](#run-locally)

---

## Clocked Build Challenge

Docket is our submission to the **Clocked Build Challenge** — a three-week online hackathon to build a working application on the Clocked API.

| | |
|---|---|
| Challenge | [Clocked Build Challenge](https://clocked.rezolve.ai/challenge) · [rules](https://clocked.rezolve.ai/build-challenge/rules) |
| Build window | October 21 – November 10, 2026 |
| Submission | **Best Overall** and all three judged group awards |
| Lead award narrative | **Verify / Compare / Rerank** |
| Clocked usage | **All nine endpoints**, each with a live contribution proof |
| Demo entry point | [`/tour`](https://docket-clocked.vercel.app/tour) |

Clocked returns structured results instead of generated text. Docket uses that structure for the language work — extraction, classification, claim grounding, omission detection, injection and script screening — while keeping authority, approval and verdict rules deterministic.

---

## What is Docket?

An AI service-desk assistant answers an employee from your knowledge base. The answer is fluent, cited, and sometimes wrong — because the source it used is stale, superseded, or written for a different country or plan.

That is not a hallucination problem. It is a **source-authority problem**.

A retrieval score can find both the newer global policy and the older France annex. It cannot tell you which one governs. A groundedness check can compare the draft to a passage. It cannot tell you whether the policy was approved, whether its text changed after approval, or why the gate published it last Tuesday.

Docket is the gate between the assistant and the employee.

---

## The problem

1. **Authority is invisible to retrieval.** The newest policy is not always the governing policy. Jurisdiction, precedence, effective date and expiry decide.
2. **Approval is not in the text.** A policy can look valid while its envelope is missing, forged or modified after approval.
3. **Groundedness is not completeness.** A draft can cite a real clause and still omit a material condition or reuse a superseded value.
4. **The answer needs an owner.** When a check cannot publish, someone must review it, and that decision must be durable.
5. **The audit trail must survive the answer.** “The model said so” is not a release record.

---

## The questions Docket asks

| Question | Docket’s answer | Mechanism |
|---|---|---|
| **Which policy governs this answer?** | The one selected by jurisdiction, precedence and valid time — not by recency or retrieval score. | Deterministic authority resolver |
| **Is the policy approved and unchanged?** | Unapproved or tampered text cannot publish, even before a Clocked call. | HMAC-signed policy envelopes and SHA-256 content hashes |
| **Does the draft match the governing text?** | Every counted claim must be supported; superseded values and material omissions force a rewrite. | Clocked Verify, Compare and Fill |
| **Is the input safe to process?** | Instructions inside sources and unsafe scripts hold the answer. PII is redacted before storage. | Clocked Guard, Inspect and Protect |
| **Who reviewed the held answer?** | A named reviewer, a note, a resolution and a ledger event — or the answer stays held. | Durable review records and scoped capabilities |
| **What was recorded?** | Decision, governing policy, envelope hashes, credits, calls, latency and a hash-chained audit sequence. | Vercel Blob ledger with `/ledger` verification |

---

## The solution

Docket is one gate with three outcomes:

| Verdict | Meaning |
|---|---|
| **PUBLISH** | The governing policy is approved and current; every counted claim is supported; no material omission or unacknowledged superseded value remains. |
| **REWRITE** | The policy is valid, but the draft contradicts it, omits a condition, reuses a superseded value, or has unsupported claims. |
| **HOLD** | Authority is unresolved, the policy is unapproved or tampered, injection or an unsafe script is detected, a metadata conflict exists, human review is required, or a Clocked/ledger call failed. |

**Deterministic where it matters.** Authority selection, policy integrity and the final verdict rules are code, not a model vote. **Clocked where language is needed.** The nine endpoints do the extraction, classification and claim-level evidence work.

Every claim-level decision is paired with the governing quote, a signed policy envelope and an audit sequence. The console can show the exact claim that would have shipped and the passage that overrides it.

---

## How it works

```text
question + draft + policies + context
        │
        ▼
policy integrity          approved? unchanged? ─── no ──► HOLD
        │
        ▼
authority                 jurisdiction / precedence / valid time
        │
        ▼
Protect · Guard · Inspect · Extract · Decide
        │                 injection, unsafe script or metadata conflict ──► HOLD
        ▼
Rerank → Compare · Fill · Verify
        │                 superseded value, omission or unsupported claim ──► REWRITE
        ▼
deterministic verdict      PUBLISH / REWRITE / HOLD
        │
        ├── HOLD or REWRITE ──► durable review record
        │                         claim → approve / send back → ledger event
        ▼
signed envelopes + hash-chained audit receipt
```

A check is **not published** if the ledger write fails. The verdict is downgraded to HOLD with `audit_unavailable`.

---

## Architecture

```text
Browser
  /tour        live eight-case judge demo
  /console     check, review, scope, attestation, endpoint proof
  /ledger      public chain verification
        │
        ▼
FastAPI application
  app.py            routes, verdict rules, nine-endpoint pipeline
  authority.py      deterministic policy resolution
  policy.py         claim and evidence rules
  clocked_client.py Clocked API client
  policy_registry.py signed envelopes and seed corpus
  reviews.py        durable HOLD/REWRITE review queue
  ledger.py         hash chain and atomic sequence allocation
  storage.py        Vercel Blob or local-directory backend
  db.py             per-instance SQLite hot index
        │
        ▼
Private Vercel Blob
  audit/            one record per check
  ledger/           checkpoints and sequence claims
  policies/         signed policy envelopes
  reviews/          durable review records
```

| Layer | What it does |
|---|---|
| **Policy integrity** | Binds every policy to its text hash, metadata and approver in an HMAC-signed envelope. Seeded, admin-approved and operator-attested policies are distinct. |
| **Authority** | Resolves jurisdiction, precedence, effective date and expiry without a model. A newer global policy can be overridden by an older country annex. |
| **Clocked pipeline** | Uses all nine endpoints for the language layer; each stage is traced and each endpoint has an ablation proof. |
| **Review** | Opens a durable record for every recorded HOLD or REWRITE. Approval records the decision; it does **not** publish. The operator edits and re-runs. |
| **Audit** | Appends a hash-chained record with checkpoints, atomic sequence claims, redacted previews and a public verifier at `/ledger`. |
| **Health** | `/api/health` verifies the chain, seeded envelopes and storage backend instead of asserting that they work. |

Full design details: [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## Clocked integration

| Endpoint | What it contributes | Verdict effect |
|---|---|---|
| **Protect** `/pii` | Redacts personal data before the audit preview is stored. | Record only |
| **Guard** `/injection` | Detects prompt injection in the source or draft. | **HOLD** |
| **Inspect** `/script` | Reviews runbook scripts before an employee runs them. | **HOLD** |
| **Extract** `/extract` | Validates the metadata authority depends on and supplies policy facts. | **HOLD** on conflict |
| **Decide** `/decide` | Classifies request risk and routes high-impact cases to human review. | **HOLD** on review required |
| **Rerank** `/rerank` | Selects the governing clauses and skips superseded text. | Conditional |
| **Compare** `/compare` | Finds a superseded value reused in the draft. | **REWRITE** |
| **Fill** `/fill` | Finds material omissions in the draft. | **REWRITE** |
| **Verify** `/grounding` | Checks every counted claim against the governing text. | **REWRITE / HOLD** |

All nine endpoints are ablated in the console under **Technical details → Endpoint contribution**. Each row re-runs the same case with one endpoint disabled; Protect and Rerank show record and evidence-set deltas rather than a verdict change. Docket deliberately does not use Clocked’s opaque Pipeline composition endpoint: the value is in the deterministic authority and verdict rules between the primitives.

---

## Live scenarios

**The judge tour** runs eight real checks in order:

| Case | Verdict | What it proves |
|---|---|---|
| Precedence over recency (France) | **REWRITE** | An older France annex overrides a newer global policy; the draft would have shipped the opposite rule. |
| Version supersession | **REWRITE** | The draft keeps the old deadline and receipt threshold. |
| Omitted condition | **REWRITE** | A material condition is missing, even though the stated rule is correct. |
| Clean access request | **PUBLISH** | A control case that matches the governing policy. |
| Injected policy note | **HOLD** | Guard finds instructions embedded in the source. |
| Unsafe runbook | **HOLD** | Inspect finds a command that disables endpoint protection. |
| Unapproved policy | **HOLD** | No approved envelope matches the submitted text. |
| Tampered policy | **HOLD** | A signed policy changed after approval. |

**Console extras:** **Scope applicability** shows a deterministic out-of-scope determination from the authority trace, including why Verify had no substantive claim to check. **Unapproved policy** demonstrates HOLD → **Attest for this check** → re-run → PUBLISH.

Open the [tour](https://docket-clocked.vercel.app/tour) or load any scenario from **Examples** in the [console](https://docket-clocked.vercel.app/console).

---

## Evidence

| Signal | Result |
|---|---|
| Unsafe false-PUBLISH | **0** across 31 locked held-out cases and 10 adversarial cases |
| Locked held-out decisions | **25 / 31** · 80.6% · governing accuracy 100% |
| Post-held-out tuning | **29 / 31** · 93.5% · reported separately, not folded into the locked result |
| Adversarial suite | **10 / 10** · 0 unsafe false-PUBLISH · 100% injection and script recall |
| Calibration | **13 / 14** · accuracy 100% · Inspect threshold measured at 0.10 |
| Tuned regression suite | **37 / 37** |
| Endpoint necessity | **9 / 9** ablated on the case that triggers each |
| Tests | **114 passing** |

The headline is safety, not a perfect score. Both accuracy corpora were authored by the Docket team. The held-out labels and case bodies were hashed into `benchmarks/heldout.lock` before the first live call; the lock proves the labels were fixed before the run, not that authorship bias is gone. The post-tuning result is a separate iteration after seeing the failures.

Detailed results: [`heldout-results.md`](benchmarks/heldout-results.md) · [`heldout-results-post-tuning.md`](benchmarks/heldout-results-post-tuning.md) · [`adversarial-results.md`](benchmarks/adversarial-results.md) · [`calibration-results.md`](benchmarks/calibration-results.md) · [`necessity-results.md`](benchmarks/necessity-results.md)

Reproduce:

```bash
make evidence          # deterministic replay, no API key
make evidence-live     # all live corpora, spends Clocked credits
make preflight         # production surfaces, chain and policy registry
```

---

## API

`POST /api/check` runs the full gate. It requires a signed browser session (`X-Docket-Session`) or a bearer `DOCKET_API_TOKEN`.

```bash
TOKEN=$(curl -s https://docket-clocked.vercel.app/api/session \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')

curl -s https://docket-clocked.vercel.app/api/check \
  -H "X-Docket-Session: $TOKEN" -H 'Content-Type: application/json' \
  -d '{
    "question": "Does an employee in France need approval to expense a monitor?",
    "draft": "Monitor reimbursement requires prior manager approval.",
    "country": "FR",
    "documents": [{
      "title": "France annex",
      "jurisdiction": "FR",
      "effective_date": "2026-03-01",
      "precedence": 1,
      "approved_by": "Policy owner",
      "approval_reference": "DEMO-1",
      "text": "For employees in France, monitor reimbursement does not require prior manager approval."
    }]
  }'
```

| Route | Purpose |
|---|---|
| `POST /api/check` · `/api/check/stream` | Full evaluation, JSON or SSE stage progress |
| `POST /api/ablate` · `/api/prove` | Run one endpoint disabled, or baseline + counterfactual |
| `POST /api/policies/approve` | Admin-only signing and registry approval |
| `GET /api/samples` · `/api/samples/{id}` | Built-in cases |
| `GET /api/reviews` · `POST /api/reviews/{id}/assign` · `POST /api/reviews/{id}/resolve` | Durable review queue; scoped capability or admin token |
| `GET /api/ledger` · `GET /api/health` · `GET /api/checks` · `GET /api/stats` | Chain verification, live health, admin records, instance totals |
| `GET /tour` · `GET /console` · `GET /ledger` | Judge tour, product console, public ledger |

Demo budgets: **60 checks per session**, **600 per IP per hour**, **1000 per day**. A proof charges two checks.

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn, HTTPX |
| Clocked | All nine endpoints: Protect, Guard, Inspect, Extract, Decide, Fill, Rerank, Compare, Verify |
| Policy integrity | HMAC-SHA256 signed envelopes, SHA-256 content hashes, seeded/admin/operator trust levels |
| Durable audit | Private Vercel Blob hash chain, checkpoints, atomic sequence claims, `/ledger` verifier, local fallback |
| Review queue | Durable HOLD/REWRITE records, scoped capabilities, ledger `review_event` |
| Hot index | SQLite WAL, explicitly per-instance |
| Frontend | Semantic HTML, CSS and vanilla JS; no build step |
| Streaming | Server-Sent Events with real stage progress |
| Tests | pytest — 114 tests |
| Deploy | Vercel FastAPI service; Docker/Render/Railway supported |

---

## Run locally

```bash
git clone https://github.com/j4yop/docket.git
cd docket
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Required: CLOCKED_API_KEY
# Recommended: DOCKET_SESSION_SECRET, DOCKET_POLICY_SECRET
# Durable audit: BLOB_READ_WRITE_TOKEN
# Admin approval: DOCKET_ADMIN_TOKEN

uvicorn app:app --reload --port 8000
```

Open `http://127.0.0.1:8000/tour`, `/console` or `/ledger`. On first start Docket signs the sample corpus into the configured store. Custom policies need an approval reference or an admin envelope before they can publish.

```bash
pip install -r requirements-dev.txt
python -m pytest -v          # 114 tests
make preflight-local         # checks the public surfaces on :8000
```

---

## License

MIT. See [LICENSE](LICENSE).
