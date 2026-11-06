# docket ⚡

**The publish gate for AI service-desk answers.**

[![Clocked Build Challenge](https://img.shields.io/badge/CLOCKED_BUILD_CHALLENGE-2026_SUBMISSION-FEEA3B?style=for-the-badge&logoColor=black&labelColor=1e293b)](https://clocked.rezolve.ai/challenge)
[![Endpoints](https://img.shields.io/badge/CLOCKED_ENDPOINTS-9%2F9_INTEGRATED-38BDF8?style=for-the-badge&labelColor=1e293b)](https://clocked.rezolve.ai/docs)
[![Safety](https://img.shields.io/badge/UNSAFE_FALSE_PUBLISH-0-22c55e?style=for-the-badge&labelColor=1e293b)](#evidence--verification)
[![Tests](https://img.shields.io/badge/TESTS-114_PASSED-4ade80?style=for-the-badge&labelColor=1e293b)](#run-locally)
[![License](https://img.shields.io/badge/LICENSE-MIT-FEEA3B?style=for-the-badge&labelColor=1e293b)](LICENSE)
[![Live Demo](https://img.shields.io/badge/LIVE_DEMO-docket--clocked.vercel.app-6366F1?style=for-the-badge&logo=vercel&logoColor=white&labelColor=1e293b)](https://docket-clocked.vercel.app/tour)

**Live Demo:** [Judge Tour](https://docket-clocked.vercel.app/tour) · [Interactive Console](https://docket-clocked.vercel.app/console) · [Public Ledger](https://docket-clocked.vercel.app/ledger) · [2-Minute Video Fallback](https://docket-clocked.vercel.app/demo/docket-fallback.mp4)

<p align="center">
  <img src="docs/docket-pipeline.svg" alt="Docket Automated Publish Gate Pipeline" width="100%" />
</p>

---

## Clocked Build Challenge

Docket is our submission for the **[Clocked Build Challenge](https://clocked.rezolve.ai/challenge)** (October 21 – November 10, 2026).

| Track | Details |
|---|---|
| **Submission** | **Best Overall** and all three judged group awards |
| **Lead Category** | **Best Use of Verify, Compare, or Rerank** |
| **API Integration** | **All 9 Clocked Endpoints** integrated with live ablation proofs |
| **Live Entry Points** | [`/tour`](https://docket-clocked.vercel.app/tour) (guided live evaluation) · [`/console`](https://docket-clocked.vercel.app/console) (full case desk) |

---

## What is Docket?

When an AI service-desk assistant drafts an answer from internal documentation, how do you ensure it cited the active, approved, and legally governing policy rather than an outdated, superseded, or regional variant?

**Docket** is an automated publish gate that sits between your AI assistant and the employee. Given the policy documents, employee context, question, and candidate draft:
- Resolves document authority deterministically (jurisdiction, precedence, valid dates).
- Checks policy tamper integrity via signed HMAC envelopes before invoking any model.
- Uses Clocked's AI suite across 9 endpoints to screen injections, classify risk, find superseded values, detect omissions, and verify every factual claim.
- Issues a binding verdict: **`PUBLISH`**, **`REWRITE`**, or **`HOLD`** — sealed with a tamper-evident audit receipt.

---

## The Problem Statement & Questions Asked by Docket

### The Problem: Grounded in the Wrong Source
Enterprise AI assistant failures are rarely pure hallucinations. The draft is fluent, cited, and **grounded in the wrong source**:
1. **Recency Bias Fails Law:** Freshness heuristics assume "newest wins". In organizational governance, **precedence overrules recency** — an older regional annex legally overrides a newer blanket corporate policy.
2. **Silent Supersession:** When Policy v5 updates receipt limits, an assistant can still retrieve Policy v4. Traditional evaluators report 100% groundedness because the claim matches v4 verbatim.
3. **Untrusted Policy Text:** A document can look valid while its approval metadata is missing, expired, or tampered with after sign-off.
4. **Omission Blindness:** Grounding checks verify stated claims, but cannot flag material clauses omitted by the assistant.

### The Questions Asked by Docket

Before any draft answer reaches an employee, Docket resolves six core questions:

1. **Which policy actually governs this employee?** (Authority & precedence resolution)
2. **Is the policy approved and untampered?** (Cryptographic envelope integrity)
3. **Is the input safe to process?** (Prompt injection, malicious scripts, metadata conflicts)
4. **Where do governing and superseded sources conflict?** (Superseded value detection)
5. **Does the draft state only what the governing text supports, without omissions?** (Claim verification & completeness)
6. **What action must be taken, and who owns the record?** (Deterministic verdict & audit sequence)

---

## The Solution & Answers to Those Questions

> **Core Thesis:** Authority is a business rule; language is a model judgment.  
> Never delegate legal precedence to an LLM, and never let semantic similarity bypass an explicit authority rule.

Docket answers each question through a strict division of responsibility:

| # | Question | Answered By | How It Works |
|---|---|---|---|
| **1** | Which policy governs? | **App Engine** (Deterministic) | Ranks documents by explicit precedence, jurisdiction match, and effective date. Resolves ties into a `HOLD` without guessing. |
| **2** | Is text approved & intact? | **Policy Registry** (Cryptographic) | Validates HMAC-SHA256 envelopes and SHA-256 text hashes before calling any model. Unsigned text cannot publish. |
| **3** | Is input safe? | **Clocked Protect, Guard, Inspect** | Redacts PII (`/pii`), blocks prompt injections (`/injection`), and screens runbook scripts (`/script`). |
| **4** | Where do sources conflict? | **Clocked Compare & Rerank** | Rerank isolates governing clauses; Compare pinpoints superseded figures reused in the draft. |
| **5** | Are claims grounded & complete? | **Clocked Verify & Fill** | Verify checks each atomic claim against governing text; Fill flags omitted conditions and deadlines. |
| **6** | What action is taken? | **Deterministic Verdict Policy** | Generates binding `PUBLISH`, `REWRITE`, or `HOLD` verdict, appending a hash-chained receipt to the audit ledger. |

### The Three Gate Outcomes

* **`PUBLISH`**: Governing policy is approved and current; all counted claims are supported; no material omission or superseded value exists.
* **`REWRITE`**: Policy is valid, but draft contradicts it, reuses a superseded value, omits a material condition, or lacks claim support.
* **`HOLD`**: Ambiguous authority, unapproved/tampered policy, prompt injection detected, unsafe script found, or upstream API error.

---

## Workflow

```text
[ Question + Draft + Policies + Context ]
                    │
                    ▼
       1. Policy Integrity Check        Approved? Unchanged? ─── No ──► HOLD
                    │
                    ▼
       2. Authority Resolution          Precedence → Scope → Valid Time (Tie? ──► HOLD)
                    │
                    ▼
       3. Clocked Safety Layer          Protect (/pii) · Guard (/injection) · Inspect (/script)
                    │                   Unsafe input detected? ────────► HOLD
                    ▼
       4. Clocked Knowledge Layer       Rerank (/rerank) → Compare (/compare) · Fill (/fill) · Verify (/grounding)
                    │                   Contradiction, omission, or unsupported claim? ──► REWRITE
                    ▼
       5. Deterministic Verdict         PUBLISH  │  REWRITE  │  HOLD
                    │
                    ▼
       6. Tamper-Evident Audit          Durable review queue + hash-chained audit receipt (/ledger)
```

---

## Architecture

```text
Browser Surfaces
  /tour        Guided 8-case live evaluation tour for judges
  /console     Interactive publish gate desk, case editor, ablation workbench
  /ledger      Public hash-chain ledger verification
        │
        ▼
FastAPI Application Layer (app.py)
  ├── authority.py         Deterministic precedence & clause segmenter (pure)
  ├── policy.py            Claim verification & verdict policy rules (pure)
  ├── policy_registry.py   HMAC-signed policy envelopes & seed corpus
  ├── clocked_client.py    Clocked API client with retries & idempotency
  ├── reviews.py           Durable review records for held/rewritten cases
  ├── ledger.py            Hash-chain sequencer & checkpoint engine
  └── storage.py           Private Vercel Blob store with local fallback
        │
        ▼
Clocked API Suite (All 9 Endpoints Integrated)
```

### The 9 Clocked Endpoints

| Endpoint | Subsystem | Contribution to Docket | Gate Effect |
|---|---|---|---|
| **Protect** `/pii` | Safety | Redacts employee PII before audit preview storage | Record only |
| **Guard** `/injection` | Safety | Detects adversarial instructions hidden in policies/drafts | **HOLD** |
| **Inspect** `/script` | Safety | Screens service-desk runbooks before commands run | **HOLD** |
| **Extract** `/extract` | Intelligence | Validates authority metadata & extracts structured facts | **HOLD** on conflict |
| **Decide** `/decide` | Intelligence | Classifies operational risk & flags human-review escalations | **HOLD** on risk |
| **Rerank** `/rerank` | Knowledge | Selects governing clauses; skips superseded clauses | Candidate routing |
| **Compare** `/compare` | Knowledge | Identifies outdated superseded values reused in draft | **REWRITE** |
| **Fill** `/fill` | Knowledge | Identifies missing deadlines, approvers, or exceptions | **REWRITE** |
| **Verify** `/grounding` | Knowledge | Validates sentence-level factual claims against truth | **REWRITE / HOLD** |

*Every endpoint is ablated live in the console under **Technical details → Endpoint contribution**, proving each is load-bearing.*

---

## Tech Stack

| Layer | Technology | Details |
|---|---|---|
| **Backend** | Python 3.11+, FastAPI, Uvicorn, HTTPX | Async pipeline, typed requests, real Server-Sent Events |
| **Clocked Integration** | Clocked API (9/9 endpoints) | Protect, Guard, Inspect, Extract, Decide, Rerank, Compare, Fill, Verify |
| **Integrity & Cryptography** | HMAC-SHA256, SHA-256 | Signed policy envelopes, content-addressed text integrity |
| **Durable Audit** | Vercel Blob + SQLite WAL | Hash-chained receipt sequence with checkpoints and `/ledger` verifier |
| **Frontend Surfaces** | Semantic HTML5, CSS3, Vanilla JS | Zero build step, zero npm dependencies, WCAG AA accessible, dark/light modes |
| **Testing** | pytest | 114 automated tests covering all logic offline |

---

## Scenarios

Docket includes eight canonical challenge cases executable live in the **[Judge Tour](https://docket-clocked.vercel.app/tour)**:

| Case | Verdict | Key Mechanism Proven |
|---|:---:|---|
| **Precedence over Recency (France)** | **`REWRITE`** | Older France annex overrides newer global policy; catches reversed approval rule. |
| **Version Supersession** | **`REWRITE`** | Policy v5 replaces v4; catches outdated \$75 threshold and 30-day deadline. |
| **Omitted Condition** | **`REWRITE`** | Clocked Fill flags a missing mandatory training step omitted from the draft. |
| **Clean Access Request** | **`PUBLISH`** | Control case: valid policy, complete draft, 100% claim grounding. |
| **Injected Policy Note** | **`HOLD`** | Clocked Guard intercepts prompt injection hidden in uploaded policy text. |
| **Unsafe Runbook** | **`HOLD`** | Clocked Inspect detects bash script command disabling system endpoint security. |
| **Unapproved Policy** | **`HOLD`** | Cryptographic envelope check blocks policy lacking authorized signature. |
| **Tampered Policy** | **`HOLD`** | Text hash mismatch blocks policy modified after executive sign-off. |

---

## API Reference

### `POST /api/check`
Full gate evaluation via JSON or Server-Sent Events (`/api/check/stream`).

```bash
TOKEN=$(curl -s https://docket-clocked.vercel.app/api/session \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')

curl -s https://docket-clocked.vercel.app/api/check \
  -H "X-Docket-Session: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Does an employee in France need approval to expense a monitor?",
    "draft": "Monitor reimbursement requires prior manager approval.",
    "country": "FR",
    "documents": [{
      "title": "France annex",
      "jurisdiction": "FR",
      "effective_date": "2026-03-01",
      "precedence": 1,
      "approved_by": "Policy Owner",
      "approval_reference": "DEMO-1",
      "text": "For employees in France, monitor reimbursement does not require prior manager approval."
    }]
  }'
```

### Key API Endpoints
* `POST /api/check` · `/api/check/stream`: Full gate evaluation (JSON / SSE).
* `POST /api/ablate` · `/api/prove`: Counterfactual ablation proving endpoint necessity.
* `POST /api/policies/approve`: Admin policy signing and envelope registration.
* `GET /api/reviews` · `POST /api/reviews/{id}/resolve`: Durable review queue management.
* `GET /api/ledger` · `GET /api/health`: Cryptographic chain verification and system health.

---

## Evidence & Verification

| Metric | Result | Description |
|---|:---:|---|
| **Unsafe False-PUBLISH** | **0** | Zero unsafe answers published across 31 held-out and 10 adversarial benchmarks. |
| **Locked Held-Out Decisions** | **25 / 31** (80.6%) | Governing policy accuracy 100%; evaluated against frozen pre-registered corpus. |
| **Post-Tuning Held-Out** | **29 / 31** (93.5%) | Reported separately to prevent benchmark contamination. |
| **Adversarial Recall** | **10 / 10** (100%) | 100% recall on prompt injection and malicious script screening. |
| **Endpoint Necessity** | **9 / 9** | Every endpoint ablated with live counterfactual proof in UI. |
| **Unit Test Coverage** | **114 Passed** | Full offline regression suite (`pytest -v`). |

Detailed benchmarks: [`heldout-results.md`](benchmarks/heldout-results.md) · [`adversarial-results.md`](benchmarks/adversarial-results.md) · [`necessity-results.md`](benchmarks/necessity-results.md)

---

## Run Locally

```bash
# 1. Clone repository
git clone https://github.com/j4yop/docket.git
cd docket

# 2. Virtual environment & dependencies
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 3. Environment configuration
cp .env.example .env
# Set CLOCKED_API_KEY=... in .env

# 4. Start server
uvicorn app:app --reload --port 8000
# Tour: http://127.0.0.1:8000/tour
# Console: http://127.0.0.1:8000/console
# Ledger: http://127.0.0.1:8000/ledger
```

### Run Tests
```bash
pip install -r requirements-dev.txt
python -m pytest -v          # Runs all 114 tests
```

---

## License

MIT License. See [LICENSE](LICENSE) for details.
