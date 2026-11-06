# Docket

**The publish gate that proves a policy was approved, current, governing, and correctly applied — then records the determination in a tamper-evident ledger.**

[![Hackathon](https://img.shields.io/badge/HACKATHON-CLOCKED_BUILD_CHALLENGE-FEEA3B?style=for-the-badge&logoColor=black&labelColor=1e293b&color=FEEA3B)](https://clocked.rezolve.ai/challenge)
[![Endpoints](https://img.shields.io/badge/CLOCKED_ENDPOINTS-9%2F9-38BDF8?style=for-the-badge&labelColor=1e293b&color=38BDF8)](https://clocked.rezolve.ai/docs)
[![Held-out](https://img.shields.io/badge/HELD_OUT-25%2F31-f5b544?style=for-the-badge&labelColor=1e293b&color=e2a65a)](#held-out-locked-before-the-run)
[![Tests](https://img.shields.io/badge/tests-92_passed-4ade80?style=for-the-badge&labelColor=1e293b&color=22c55e)](#run-tests)
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

Every counted claim is paired with the governing quote that supports or overrides it. The console, API and audit record show the passage behind the verdict, not just the label.

Clocked also offers a Pipeline composition endpoint. Docket deliberately does not call it: the product's value is the deterministic authority, policy-integrity and verdict rules *between* the primitives, which one opaque Pipeline call would hide. All nine primitive endpoints are used; Pipeline would be a checkbox.

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

Records live under `audit/YYYY-MM-DD/` in a private Vercel Blob store. Each record also writes an immutable checkpoint under `ledger/checkpoints/`, so deleting a record — including the last one — leaves a checkpoint that verification detects. The head is derived from the append-only audit prefix instead of a mutable head object. Sequence allocation uses an atomic claim under `ledger/claims/` (`allow_overwrite=False` on Blob, `O_EXCL` locally), so two instances cannot allocate the same sequence. `/api/ledger` recomputes the chain and `/ledger` shows the result. Without a Blob token the same chain is written to `.docket-store/` and labeled as a local fallback. SQLite remains a per-instance hot index for the console, not the system of record.

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

Custom policies can be approved by an admin with a token, or attested for a single check with an approval reference in the policy editor. The console now has an **Approve active policy** action: it returns the signed envelope, shows the content hash and approval type, and sends that envelope with the next check. Seeded, admin-approved and operator-attested policies are visually distinct.

### Human review, not auto-publish

Every recorded HOLD or REWRITE opens a durable review record in the same storage backend as the ledger. The console's **Review queue** panel lists open and assigned records, assigns an owner, and resolves them with a note. The resolution is appended to the hash chain as a `review_event`, linked to the original check sequence and hash.

Approving a review records the human decision. It does **not** publish the held answer automatically. The operator still edits and re-runs the check, because the policy, the draft or both may need to change. Rejecting records why the answer must not ship.

```
POST /api/check          → HOLD
  ├─ ledger record #41
  └─ review RV-… (open)
       ├─ POST /api/reviews/{id}/assign   → assigned
       └─ POST /api/reviews/{id}/resolve  → resolved + ledger event #42
```

Review endpoints require `X-Docket-Admin`. Without `DOCKET_ADMIN_TOKEN` they return 404, not an empty queue.

### Live verification

`GET /api/health` now verifies, rather than asserts:

- the Blob/local hash chain: every link, every record hash, every checkpoint;
- the seeded policy corpus: every seeded envelope exists and its HMAC verifies;
- the audit backend and whether it is durable or a per-instance fallback;
- a `last_verified_at` timestamp.

The result is cached for 20 seconds and shown as **Ledger verified** in the console and on `/ledger`. The console panel also shows the number of checks and review events, and the seeded-policy registration count.

### Concurrency, measured

Ten real checks were run in parallel against one local ledger (`benchmarks/concurrency-results.md`):

| Metric | Result |
|---|---:|
| Checks completed | 10 / 10 |
| Unique audit sequences | 10 / 10 |
| Chain verified | **yes** |
| Review records opened | 10 |
| Credits / elapsed | 271.0 / 13.33 s |

Sequence allocation uses an atomic claim (`allow_overwrite=False` on Blob, `O_EXCL` locally), so two instances cannot own the same sequence. The live run used the local backend; a unit test drives **two event loops** against one store to exercise the cross-instance path. Production Blob uses the same conditional create, but this repository does not write test traffic into the production audit prefix.

### Judge tour

`/tour` is additive. The marketing front door at `/` is unchanged. The tour runs eight real cases in order and shows expected vs actual, credits, latency and audit sequence numbers. Latest local run: **8/8 as expected, 95 credits, 23.7 s**. The header tab and console link to it; the tour source is [`website/tour.html`](website/tour.html). It is not deployed by this branch.

---

## Measured accuracy

Docket ships two accuracy corpora and a separate calibration set. None is a third-party benchmark, and the documents say so.

### Held-out: locked before the run

`benchmarks/heldout_cases.py` contains **31 cases written after the tuning corpus was frozen**. The labels and case bodies were hashed into `benchmarks/heldout.lock` **before the first live call**. The runner refuses a held-out run if any case was edited after the lock. The failures below are the complete set from that run, not a filtered view.

Latest live run (`benchmarks/heldout-results.md`, 5 November 2026):

| Metric | Result |
|---|---:|
| Cases passed | **25 / 31** |
| Decision accuracy | **80.6%** |
| Governing-policy accuracy | **100%** (21 scored cases) |
| Clean false-HOLD rate | **20%** (1 of 5 controls) |
| Unsafe false-PUBLISH rate | **0%** (19 unsafe cases) |
| Injection recall | **100%** (4 cases) |
| Unsafe-script recall | **100%** (3 cases) |
| Strict omission recall | **100%** (3 of 3) |
| Average calls / credits / latency | **4.61 / 14.65 / 3.25 s** |
| Lock digest | `e8de3c5766edfa31c56c50a8fdd5f66e832a264f57f6cfa97ccfa6afd657b903` |

The six failures, in full:

| Case | Why it failed | Finding |
|---|---|---|
| `holdout-auth-procurement` | Expected REWRITE; held `metadata_conflict` | Extract returned the document title as jurisdiction, so the form-vs-text check false-positived. |
| `holdout-auth-scope` | Expected PUBLISH; held `metadata_conflict` | Same Extract title-as-jurisdiction false positive on an out-of-scope annex. |
| `holdout-clean-security` | Expected PUBLISH; held `metadata_conflict` | Extract returned the effective date as an expiry date, so the policy looked expired on the day it took effect. |
| `holdout-auth-tie` | Expected PUBLISH; REWRITE `coverage_gap` | The draft omits “Receipts are required for all hotel claims”, which the policy states. On review the expected label is arguably wrong; the gate's REWRITE is defensible. The locked case is not edited. |
| `holdout-script-safe` | Expected PUBLISH; REWRITE `coverage_gap` | The draft omits “Endpoint protection must remain enabled”. Same label dispute: the safe script cleared Inspect, but the answer is incomplete. |
| `holdout-omission-complete` | Expected PUBLISH; held `no_governing_clause` | Rerank found no clause that answers the broad “incident response steps” question. A real clause-selection miss. |

Three failures are one Extract bug class: metadata adopted from the wrong part of the document. Two are label disputes where the gate's omission finding is defensible. One is a real clause-selection miss. Any fix after this run is reported as **post-held-out tuning**, in a separate run, not folded into the table above.

### Post-held-out tuning (separate run, not the locked result)

After the locked run, the Extract metadata bug class was fixed: a document title returned as a jurisdiction is ignored, and an expiry date equal to the effective date is treated as no expiry. The locked cases were **not** edited. The same lock was re-run and published separately as `benchmarks/heldout-results-post-tuning.md`.

| Metric | Locked run | Post-tuning run |
|---|---:|---:|
| Cases passed | 25 / 31 | **27 / 31** |
| Decision accuracy | 80.6% | **87.1%** |
| Clean false-HOLD | 20% | **0%** |
| Unsafe false-PUBLISH | 0% | **0%** |
| Governing accuracy | 100% | 100% |
| Average calls / credits / latency | 4.61 / 14.65 / 3.25 s | 4.97 / 12.65 / 3.63 s |

The four remaining post-tuning failures are `holdout-auth-scope` (a scope question that resolves to `no_governing_clause`), `holdout-auth-tie` and `holdout-script-safe` (the two label disputes about omitted receipt/endpoint conditions), and `holdout-omission-complete` (the real clause-selection miss). The post-tuning number is **not** the locked result; it is the product after seeing the failures. Both documents are in the repository so a judge can compare them.

### Calibration: borderline cases and a measured Inspect boundary

`benchmarks/calibration_cases.py` contains **14 deliberately borderline cases**: instruction-like policy prose, legitimate “ignore earlier versions” language, targeted approval instructions, safe scripts that mention stopping services, a privilege-policy bypass, a persistence command, and subtle omissions.

Latest live run (`benchmarks/calibration-results.md`):

| Metric | Result |
|---|---:|
| Cases passed | **13 / 14** |
| Decision accuracy | **100%** |
| Guard | flat from 0.05 to 0.90; **0.50 kept** |
| Inspect | **0.10 chosen** from the measured gap: highest safe score 0.008, lowest unsafe score 0.188 |
| Strict omission recall | **50%** (1 of 2; the miss is caught as unsupported, so the decision is still REWRITE) |

The Guard corpus still cannot distinguish a threshold: injection cases score ≥ 0.99 and benign policy prose scores ≤ 0.013. The Inspect corpus now can. Docket sets `DOCKET_INSPECT_THRESHOLD=0.1` by default and documents the trade: a lower Inspect threshold catches a privilege-policy bypass that scored 0.188, while every measured safe script stayed below 0.009. The one calibration miss is reported, not hidden.

### Tuned regression suite

`benchmarks/cases.py` remains the **37-case regression suite**. The live runner calls the real Clocked API for every case with `record=False`; the offline runner checks the deterministic authority and integrity layers in CI. Latest live run: **37/37**, governing accuracy 100%, clean false-HOLD 0%, unsafe false-PUBLISH 0%, injection/script recall 100%, strict omission recall 75%, average 5.19 calls / 13.16 credits / 3.1 s (`benchmarks/results.md`).

Reproduce:

```bash
python benchmarks/run.py --offline                       # deterministic, no API key
python benchmarks/run.py --live --sweep                   # tuned regression suite
python benchmarks/run.py --live --suite calibration --sweep
python benchmarks/run.py --live --suite heldout            # refuses without a valid lock
python benchmarks/run.py --write-lock --suite heldout      # write the lock before the first run
```

**What none of this proves:** both corpora were authored by the Docket team. The lock proves the held-out labels were fixed before the run; it does not remove authorship bias. A 25/31 locked held-out result, or the 27/31 post-tuning result, is evidence of behavior on 31 unseen authored cases, not a claim about all policy sprawl. A post-run fix is a new iteration and is labelled as such.

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
| `GET /api/reviews` | Admin-only durable review queue |
| `POST /api/reviews/{id}/assign` | Assign a review owner |
| `POST /api/reviews/{id}/resolve` | Approve or reject with a note; appends a ledger event |
| `GET /api/stats` | Per-instance index totals and audit backend |
| `GET /api/health` | Verified chain, seeded corpus, audit backend and last-verified time |
| `GET /ledger` | Human-readable ledger page |
| `GET /tour` | Eight-case judge tour; `/` remains the marketing page |

`POST /api/check`, `/api/check/stream` and `/api/ablate` require a session or bearer token. Check and ablation routes share the per-IP and daily demo budget.

---

## Tech stack

| Layer | Choice |
|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn, HTTPX |
| Clocked | All nine endpoints: Protect, Guard, Inspect, Extract, Decide, Fill, Rerank, Compare, Verify |
| Policy integrity | HMAC-SHA256 signed envelopes, SHA-256 content hashes, seeded/admin/operator trust levels |
| Durable audit | Private Vercel Blob hash chain (`vercel-blob`), atomic sequence claims, `/ledger` verifier, local-directory fallback |
| Review queue | Durable HOLD/REWRITE records, assign/resolve endpoints, ledger `review_event` |
| Hot index | SQLite WAL (`/tmp` on Vercel, explicitly labeled per-instance) |
| Frontend | Semantic HTML, CSS, vanilla JS, no build step |
| Streaming | Server-Sent Events with real stage progress |
| Tests | pytest — 92 tests |
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
# Tour:      http://127.0.0.1:8000/tour
```

On first start Docket signs the sample corpus into the configured store. Custom policies need an approval reference or an admin envelope before they can publish.

### Run tests

```bash
pip install -r requirements-dev.txt
python -m pytest -v
```

92 tests cover authority resolution, valid-time/expiry handling, clause segmentation, date parsing, policy envelopes and tamper detection, seeded-corpus verification, the hash-chained ledger, ten-way and two-loop concurrency, review-queue persistence and resolution, health verification, coverage/omission policy, Compare verdict rules, Decide triage, console feature coverage, ledger views and route authentication. The deterministic layers run without a Clocked key.

---

## Limits and honest gaps

- **Two self-authored accuracy corpora.** The 37-case regression suite and the 31-case held-out suite were both written by the Docket team. The lock proves the held-out labels were fixed before the run; it does not remove authorship bias. The honest headline is **25/31 held-out**, not 100%.
- **Six held-out failures are public.** Three are one Extract metadata bug class, two are label disputes where the gate's omission finding is defensible, and one is a real clause-selection miss. Fixes after the run are reported as post-held-out tuning in a separate run.
- **Single model snapshot.** Clocked behavior can drift; both benchmark documents record the date and measured scores.
- **Threshold calibration is corpus-bound.** Guard remains at 0.50 because the measured scores are flat. Inspect is 0.10 because the calibration corpus found a real gap between 0.008 and 0.188. That is a measured trade, not a universal optimum.
- **Review approval does not auto-publish.** The queue records the human decision. The operator still edits and re-runs the check.
- **Operator attestation is not proof of authority.** Docket records who attested and signs the text, but it does not verify that the approver had organizational authority. Admin envelopes are the stronger path.
- **Single-tenant demo.** No multi-tenant auth or per-customer policy registries yet.
- **No PDF upload in the demo.** The API supports it; the console stays text-first.
- **The marketing page is a static shell.** The product surface, evidence and ledger are `/console`, `/ledger` and the API.

## License

MIT. See [LICENSE](LICENSE).
