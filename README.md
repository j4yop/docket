# Docket

**The publish gate that proves a policy was approved, current, governing, and correctly applied — then records the determination in a tamper-evident ledger.**

[![Hackathon](https://img.shields.io/badge/HACKATHON-CLOCKED_BUILD_CHALLENGE-FEEA3B?style=for-the-badge&logoColor=black&labelColor=1e293b&color=FEEA3B)](https://clocked.rezolve.ai/challenge)
[![Endpoints](https://img.shields.io/badge/CLOCKED_ENDPOINTS-9%2F9-38BDF8?style=for-the-badge&labelColor=1e293b&color=38BDF8)](https://clocked.rezolve.ai/docs)
[![Benchmark](https://img.shields.io/badge/BENCHMARK-37%2F37-4ade80?style=for-the-badge&labelColor=1e293b&color=22c55e)](#measured-accuracy)
[![Tests](https://img.shields.io/badge/tests-71_passed-4ade80?style=for-the-badge&labelColor=1e293b&color=22c55e)](#run-tests)
[![Python](https://img.shields.io/badge/python-3.11_%7C_3.12_%7C_3.13-3775A9?style=for-the-badge&logo=python&logoColor=white&labelColor=1e293b)](https://www.python.org/)
[![Live Demo](https://img.shields.io/badge/Live_Demo-docket--clocked.vercel.app-6366F1?style=for-the-badge&logo=vercel&logoColor=white&labelColor=1e293b)](https://docket-clocked.vercel.app)
[![Console](https://img.shields.io/badge/Gate_Console-%2Fconsole-059669?style=for-the-badge&labelColor=1e293b)](https://docket-clocked.vercel.app/console)
[![Ledger](https://img.shields.io/badge/Audit_Ledger-%2Fledger-FEEA3B?style=for-the-badge&labelColor=1e293b)](https://docket-clocked.vercel.app/ledger)

<p align="center">
  <img src="docs/docket-pipeline.svg" alt="Docket automated publish gate pipeline" width="100%" />
</p>

---

## The problem

An AI service-desk assistant answers an employee from the knowledge base. The answer is fluent, cited, and sometimes wrong — because the source it used is stale, superseded, or written for a different country or plan.

The failure is not hallucination. It is **grounded in the wrong source**. A retrieval score cannot see that an older France annex overrides a newer global policy. A groundedness check cannot see that the draft uses the superseded receipt threshold. Neither can tell you who approved the policy, whether its text changed after approval, or why the gate published it last Tuesday.

Docket is the gate between the assistant and the employee.

## What Docket proves

1. **The policy was approved.** Every policy is signed into an envelope bound to its text hash, metadata, approver and approval type. Unapproved or tampered policy text cannot publish.
2. **The policy is current and governing.** A deterministic resolver applies jurisdiction, precedence, effective date and expiry. No model decides which policy wins.
3. **The answer is complete and supported.** Clocked Fill finds material omissions; Clocked Verify checks every claim against the governing text; Clocked Compare forces a rewrite when the draft reuses a superseded value.
4. **The determination is durable.** Every check is appended to a hash chain in a private Vercel Blob store. `/ledger` verifies the chain in public without exposing policy text or personal data.

## The pipeline

```
Policies + context + question + draft
        │
        ▼
Policy integrity (deterministic)  → unapproved / tampered = HOLD
        │
        ▼
Authority (deterministic)         → precedence / jurisdiction / valid time
        │
        ▼
Protect   /clocked/pii            → redacts the audit preview
Guard     /clocked/injection      → injection = HOLD
Inspect   /clocked/script         → unsafe runbook = HOLD
Extract   /clocked/extract        → metadata conflict = HOLD; governing facts
Decide    /clocked/decide         → triage; review_required = HOLD; profile
Rerank    /clocked/rerank         → selects the governing clauses
Compare   /clocked/compare        → superseded value in draft = REWRITE
Fill      /clocked/fill           → material omission = REWRITE
Verify    /clocked/grounding      → contradicted / unsupported = REWRITE
        │
        ▼
Deterministic policy              → PUBLISH / REWRITE / HOLD
        │
        ▼
Signed policy envelopes + hash-chained audit record
```

### All nine Clocked endpoints, and what each one actually changes

| Endpoint | Group | What it changes | Can it change the verdict alone? |
|---|---|---|---|
| **Protect** `/pii` | Safety | Redacts the audit preview before storage | No — it changes the record, not the decision |
| **Guard** `/injection` | Safety | Holds the source or draft on prompt injection | **Yes — HOLD** |
| **Inspect** `/script` | Safety | Holds an unsafe runbook before an employee runs it | **Yes — HOLD** (when a script exists) |
| **Extract** `/extract` | Decisions | Verifies the metadata authority depends on; adopts stated dates; supplies approval/amount/deadline facts to Fill | **Yes — HOLD** on a metadata conflict |
| **Decide** `/decide` | Decisions | Classifies request type and risk; routes high-impact cases to human review; selects the verification profile | **Yes — HOLD** on `review_required` |
| **Fill** `/fill` | Decisions | Extracts obligations and detects material omissions | **Yes — REWRITE** |
| **Rerank** `/rerank` | Knowledge | Selects the governing clauses and skips superseded text | Conditional — no applicable clause HOLDs |
| **Compare** `/compare` | Knowledge | Detects a superseded value that the draft still uses | **Yes — REWRITE** |
| **Verify** `/grounding` | Knowledge | Checks every counted claim against the governing text | **Yes — REWRITE / HOLD** |

Protect changes what is stored. Rerank changes the evidence set. The other seven can move the verdict on their own, on the cases where their signal exists. Docket does not claim every endpoint changes every verdict.

---

## Trust architecture

### Signed policy envelopes

A policy is not just text. At check time Docket builds an envelope:

```json
{
  "policy_id": "TRV-FR-01",
  "version": "1.0",
  "title": "France travel annex",
  "jurisdiction": "FR",
  "effective_date": "2026-03-01",
  "expiry_date": null,
  "precedence": 1,
  "content_hash": "sha256:…",
  "approved_by": "R. Moreau",
  "approved_at": "2026-11-05T12:00:00+00:00",
  "approval_type": "admin",
  "signature": "hmac-sha256:…"
}
```

The HMAC covers the canonical envelope. Changing the text or any signed field breaks verification. There are three trust levels:

- `seeded` — the built-in sample corpus, signed at startup with real hashes.
- `admin` — approved through `POST /api/policies/approve` with `DOCKET_ADMIN_TOKEN`.
- `operator` — explicitly attested for one check by the person running the gate. It is recorded in the audit record but never written into the shared registry.

A custom policy with no approval reference and no admin envelope returns **HOLD** with `policy_unapproved` before any Clocked call. A signed policy whose text changed returns **HOLD** with `policy_tampered`. The console shows the approval type, approver, policy ID and hash prefix for every document.

### Durable, tamper-evident audit

`ledger.py` appends one record per check:

- sequence, timestamp, decision, reason codes;
- governing policy ID, title, jurisdiction, effective date;
- every policy envelope hash, signature prefix and approval type;
- credits, API calls, latency;
- redacted question/draft previews;
- `prev_hash` and `record_hash`.

Records live under `audit/YYYY-MM-DD/` in a private Vercel Blob store. Each record also writes an immutable checkpoint under `ledger/checkpoints/`, so deleting a record — including the last one — leaves a checkpoint that verification detects. The head is derived from the append-only audit prefix instead of a mutable head object, because Blob has no conditional put and a mutable head can be served stale. `/api/ledger` recomputes the chain and `/ledger` shows the result. Without a Blob token the same chain is written to `.docket-store/` and labeled as a local fallback. SQLite remains a per-instance hot index for the console, not the system of record.

A check is **not published** if the ledger write fails: the verdict is downgraded to HOLD with `audit_unavailable`. The gate fails closed.

### Real ablation, not a counterfactual paragraph

`POST /api/ablate` runs the same inputs with exactly one endpoint skipped. It returns a real payload, never a hardcoded string, does not write to the ledger, and never publishes. The console's **Counterfactual** control runs it in one click.

The flagship demonstration is real: on the injected-policy case, the baseline HOLDs after Guard. With Guard skipped, the same case proceeds through the rest of the pipeline and **PUBLISHes** — the injected note is no longer screened. That is the measured difference the endpoint makes, not a claim in a slide.

### Policy integrity in the UI

Every result shows:

- the approved envelope for each policy;
- the approver and approval type;
- the policy ID and content hash;
- a red failure panel for an unapproved or tampered policy.

Custom policies can be approved by an admin with a token, or attested for a single check with an approval reference in the policy editor.

---

## Measured accuracy

`benchmarks/` contains **37 synthetic policy-governance cases** across authority, version supersession, omissions, clean controls, prompt injection, unsafe scripts, malformed metadata and policy integrity. The live runner calls the real Clocked API for every case with `record=False`; the offline runner checks the deterministic authority and integrity layers in CI.

Latest live run (`benchmarks/results.md`, 5 November 2026):

| Metric | Result |
|---|---:|
| Cases passed | **37 / 37** |
| Decision accuracy | **100%** |
| Governing-policy accuracy | **100%** (26 scored cases) |
| Clean false-HOLD rate | **0%** (5 controls) |
| Unsafe false-PUBLISH rate | **0%** (24 unsafe cases) |
| Injection recall | **100%** (4 cases) |
| Unsafe-script recall | **100%** (2 malicious, 1 safe control) |
| Strict omission recall | **75%** (3 of 4; the fourth is caught by contradiction) |
| Average calls / credits / latency | **5.19 / 13.16 / 3.1 s** |

The threshold sweep is deliberately reported as **flat**: Guard scores for injection cases are ≥ 0.99 and clean cases ≤ 0.01, so every threshold from 0.30 to 0.80 produces the same measured result. Docket keeps its 0.50 operating point instead of claiming a calibration win the corpus cannot support.

Reproduce:

```bash
python benchmarks/run.py --offline          # deterministic, no API key
python benchmarks/run.py --live --sweep    # real Clocked calls, writes results.md/json
```

**What this does not prove:** the corpus is synthetic and was authored by the Docket team. It is a regression suite, not a held-out test set. A perfect score on authored cases is not evidence of perfect accuracy on unseen policy sprawl. The first live run failed 10 of 37 cases; the fixes are documented in the commit history, and the remaining strict omission miss is reported rather than hidden. A larger, externally labelled corpus is the next step.

---

## Verdict rules

| Verdict | Triggers |
|:---:|---|
| **HOLD** | Prompt injection; unsafe runbook; unapproved or tampered policy; metadata conflict with the policy text; Decide routes to human review; ambiguous/absent authority; no governing clause; no countable claims; missing support or coverage judgment; internal conflict; a Clocked call or the ledger write failed. |
| **REWRITE** | A counted claim is contradicted or unsupported; the draft uses an unacknowledged superseded value; a material condition is omitted; overall support is below 50%. |
| **PUBLISH** | Every counted claim is supported, coverage finds no material omission, the support score is numeric and in range, no Compare conflict is unacknowledged, Decide does not require review, and the policy envelope verifies. |

Ordering matters: a contradiction is a REWRITE even when Decide also wants review, because the actionable first step is to fix the draft. A review-required case with a clean draft HOLDs.

---

## Live scenarios

Eight worked cases are built in. Load one from **Examples** in the console, then run it:

1. **Precedence over recency (flagship):** a France annex overrides a newer global policy. Verdict **REWRITE** with the governing quote.
2. **Version supersession:** the draft uses the old 30-day deadline and $75 receipt threshold. Verdict **REWRITE** with both superseded values.
3. **Clean access request:** the draft matches the policy. Verdict **PUBLISH**.
4. **Omitted condition:** the draft states the remote-work rule but omits the customer-facing on-site exception. Verdict **REWRITE** with the missing condition.
5. **Injected policy note:** Guard detects the embedded instruction. Verdict **HOLD**. Run the **Guard-off counterfactual** to see the same case publish.
6. **Unsafe runbook:** Inspect finds `Set-MpPreference -DisableRealtimeMonitoring $true`. Verdict **HOLD**.
7. **Metadata conflict:** the form says January, the policy text says June. Extract catches it. Verdict **HOLD** before any downstream call.
8. **Unapproved policy:** a custom policy with no approval reference. Verdict **HOLD** with `policy_unapproved`; add an approval reference or an admin envelope to proceed.

---

## API

### `POST /api/check`

Synchronous full JSON evaluation. Requires a signed session (`X-Docket-Session`) or bearer `DOCKET_API_TOKEN`.

```bash
TOKEN=$(curl -s https://docket-clocked.vercel.app/api/session \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')

curl -s https://docket-clocked.vercel.app/api/check \
  -H "X-Docket-Session: $TOKEN" \
  -H 'Content-Type: application/json' \
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

Every result includes `audit` (`storage`, `seq`, `hash`, `prev_hash`), `policy_envelopes`, `policy_integrity`, `extract`, `decide`, `compare_unacknowledged` and the per-stage trace.

### `POST /api/ablate`

Same body plus `"endpoint": "guard" | "inspect" | "extract" | "decide" | "compare" | "coverage" | "verify"`. Runs the same inputs with one endpoint disabled. Returns `simulation: true`, no ledger record, no publication.

### `POST /api/policies/approve`

Admin-only (`X-Docket-Admin: $DOCKET_ADMIN_TOKEN`). Hashes and signs a policy envelope, stores it in the durable registry, and returns the signed envelope.

```bash
curl -s https://docket-clocked.vercel.app/api/policies/approve \
  -H "X-Docket-Admin: $DOCKET_ADMIN_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"title":"Travel policy","text":"…","approved_by":"R. Moreau","jurisdiction":"FR","effective_date":"2026-02-01"}'
```

### Other routes

| Route | Purpose |
|---|---|
| `GET /api/session` | Short-lived signed browser session |
| `POST /api/check/stream` | SSE stage progress and final determination |
| `GET /api/samples` · `GET /api/samples/{id}` | Built-in cases |
| `GET /api/checks` | Admin-only recent ledger records |
| `GET /api/ledger` | Public chain verification and recent determinations |
| `GET /api/stats` | Per-instance index totals and audit backend |
| `GET /api/health` | Clocked, streaming, audit backend, policy-integrity status |
| `GET /ledger` | Human-readable ledger page |

`POST /api/check`, `/api/check/stream` and `/api/ablate` require a session or bearer token. Check and ablation routes share the per-IP and daily demo budget.

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn, HTTPX |
| Clocked | All nine endpoints: Protect, Guard, Inspect, Extract, Decide, Fill, Rerank, Compare, Verify |
| Policy integrity | HMAC-SHA256 signed envelopes, SHA-256 content hashes, seeded/admin/operator trust levels |
| Durable audit | Private Vercel Blob hash chain (`vercel-blob`), `/ledger` verifier, local-directory fallback |
| Hot index | SQLite WAL (`/tmp` on Vercel, explicitly labeled per-instance) |
| Frontend | Semantic HTML, CSS, vanilla JS, no build step |
| Streaming | Server-Sent Events with real stage progress |
| Tests | pytest — 71 tests |
| Deploy | Vercel FastAPI service; Docker/Render/Railway supported |

---

## Quickstart

```bash
git clone https://github.com/j4yop/docket.git
cd docket
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Required: CLOCKED_API_KEY
# Recommended: DOCKET_SESSION_SECRET, DOCKET_POLICY_SECRET
# Durable audit: BLOB_READ_WRITE_TOKEN (Vercel Blob)
# Admin approval: DOCKET_ADMIN_TOKEN

uvicorn app:app --reload --port 8000
# Marketing: http://127.0.0.1:8000
# Console:   http://127.0.0.1:8000/console
# Ledger:    http://127.0.0.1:8000/ledger
```

On first start Docket signs the sample corpus into the configured store. Custom policies need an approval reference or an admin envelope before they can publish.

### Run tests

```bash
pip install -r requirements-dev.txt
python -m pytest -v
```

71 tests cover authority resolution, valid-time/expiry handling, clause segmentation, date parsing, policy envelopes and tamper detection, the hash-chained ledger, coverage/omission policy, Compare verdict rules, Decide triage, and route authentication. The deterministic layers run without a Clocked key.

---

## Limits and honest gaps

- **Synthetic, self-authored benchmark.** 37 cases is a regression suite, not a held-out evaluation. The 100% decision score is not a claim about unseen policy sprawl.
- **Single model snapshot.** Clocked behavior can drift; the benchmark records the date and the measured scores.
- **Threshold sweep is flat.** The corpus separates Guard/Inspect scores too cleanly to calibrate a boundary. Docket keeps 0.50 and says so.
- **Operator attestation is not proof of authority.** Docket records who attested and signs the text, but it does not verify that the approver had organizational authority. Admin envelopes are the stronger path.
- **Single-tenant demo.** No multi-tenant auth or per-customer policy registries yet.
- **No PDF upload in the demo.** The API supports it; the console stays text-first.
- **The marketing page is a static shell.** The product surface, evidence and ledger are `/console`, `/ledger` and the API.

## License

MIT. See [LICENSE](LICENSE).
