# Docket — design and architecture

**What it is:** a publish gate for service-desk knowledge. It takes real policy documents, an employee question and a draft answer, and decides **Publish / Rewrite / Hold** with citations.

**Delivery format:** a deployed responsive web app, plus a JSON API for agent pipelines. Not a Chrome extension, not an agent-first product. Reasoning in §7.

---

## 1. The problem

An AI assistant answers an employee from the knowledge base. The answer is fluent, cited, and sometimes wrong — because the source it used is stale, superseded, or written for a different country or plan. Nothing in the answer signals which.

The failure is not hallucination. It is **grounded in the wrong source**. Retrieval and groundedness checks cannot catch it: a perfectly grounded answer can still cite a policy that no longer governs.

**Who feels it:** knowledge managers, service-desk leads, incident managers, and anyone who owns an AI assistant that answers policy questions.

**Why now:** assistants moved into production. The cost of a confident wrong answer is no longer a bad search result; it is an employee acting on it, an auditor asking how it was validated, or a ticket that should never have existed.

## 2. The questions the product answers

| # | Question | Who answers it | How |
|---|---|---|---|
| 1 | Which document governs this employee? | **App** (deterministic) | Jurisdiction, precedence and effective date resolve authority. No model call. |
| 2 | Do the sources disagree? | **Compare** | Clause-level comparison of the governing and superseded text, with both passages quoted. |
| 3 | Does the draft claim only what the governing source supports? | **Verify** | Claim-by-claim supported / contradicted / not stated, with source evidence. |
| 4 | Which passage applies to this employee? | **Rerank** | `use` / `expand` / `skip` per clause, conditioned on country, role, plan, and the authority rule. |
| 5 | What should happen now? | **App policy** (deterministic) | Publish, Rewrite or Hold, with reason codes. |
| 6 | Can we prove it? | **App** | Offsets, quotes, per-claim evidence, credits, latency, and the raw API responses. |

**The core insight:** authority is a business rule; relevance is a model judgment. The app must never delegate "which policy wins" to a model, and must never let a model's relevance score override a stated precedence rule.

## 3. The solution

### User flow

1. Paste a question and the employee context (country, role, plan).
2. Add one or more policy documents. Each carries optional authority metadata: jurisdiction, effective date, and an "overrides" flag.
3. Paste the draft answer the assistant is about to send.
4. Run the check.
5. Read the verdict, the claim table, the conflict evidence and the authority trace.
6. If Rewrite, use the citation list to fix the draft. If Hold, the publish button stays disabled.

### Pipeline

```
input
  │
  ├─ segment into clauses (deterministic)
  │
  ├─ resolve authority (deterministic)
  │     jurisdiction → precedence → effective date
  │     tie = HOLD (ambiguous authority)
  │
  ├─ Rerank  (all candidate clauses, with the authority rule in instructions)
  │     → governing clauses marked use / expand
  │     → superseded clauses marked skip + reason
  │
  ├─ Compare (only the governing vs superseded clause pairs)
  │     → conflicts, duplicates, both passages
  │     → skipped when there is only one source
  │
  ├─ Verify  (draft vs governing clauses)
  │     → claim verdicts, grounded score, weakest claim
  │
  └─ policy  → PUBLISH / REWRITE / HOLD
        ├─ authority error            → HOLD
        ├─ no governing clause        → HOLD
        ├─ any check failed           → HOLD
        ├─ counted claim contradicted → REWRITE
        ├─ counted claim not stated   → REWRITE
        ├─ grounded < 0.50            → REWRITE
        └─ otherwise                  → PUBLISH
```

### Why Compare is clause-level only

Live testing on real documents showed Compare is accurate and cheap on short, aligned passages (5 credits, under a second, exact quotes) and unreliable on full documents (false conflicts, misaligned passages, 584 credits and 17 seconds for four documents). The app therefore segments first and never sends a whole document to Compare.

### Why Rerank gets the authority rule in `instructions`

Live testing showed Rerank selects relevant passages well but does not infer that a regional annex overrides a global policy, or that a prior year is superseded. When the rule is stated in `instructions`, it follows it exactly. The app owns the rule; Rerank applies it.

## 4. Architecture

```
Browser (HTML + CSS + JS, no build step)
   │  POST /api/check/stream  (SSE)
   ▼
FastAPI
   ├─ authority.py    clause segmentation + authority resolver (pure, tested)
   ├─ policy.py       verdict logic (pure, tested)
   ├─ clocked_client.py  auth, idempotency, bounded retries, error classes
   ├─ db.py           SQLite audit log (results + previews, not full documents)
   └─ app.py          routes, orchestration, SSE
         │
         ▼
   Clocked API  (Rerank, Compare, Verify)
```

**No hardcoded results.** The verdict is a pure function of the API responses and the user's authority metadata. The sample corpus is editable input, not a fixture the app depends on. Running the same check twice produces the same decision because the inputs are the same, not because the answer is stored.

## 5. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend | Python 3.11+, FastAPI, Uvicorn | Already installed; async, SSE, typed requests |
| HTTP | httpx | Timeouts, retries, one client per request |
| Storage | SQLite (stdlib) | Zero setup, portable, enough for an audit log |
| Frontend | Semantic HTML, CSS, vanilla JS | No build step, no framework risk, full accessibility control |
| Streaming | Server-Sent Events | Real stage progress, not a fake animation |
| Tests | pytest | Authority resolver and verdict policy are pure functions |
| Deploy | Docker / Render / Railway (Procfile included) | One container, one process, no database server |

**Rejected:** Next.js (build step and hydration risk for a six-day scope), a vector database (not needed; clauses are small), an LLM-generated rewrite (adds a fourth endpoint and a new failure mode).

## 6. Accessibility

- Semantic landmarks, one `h1`, labelled fieldsets, visible labels (no placeholder-only inputs).
- Full keyboard operation; `Ctrl/Cmd+Enter` runs the check; focus-visible rings on every control.
- `aria-live="polite"` on the verdict and stage status.
- Verdict is conveyed by text and icon, never color alone.
- Contrast targets WCAG AA on all text; body text at 16px minimum.
- `prefers-reduced-motion` disables transitions and the stage pulse.
- Responsive down to 360px; the three-column desk stacks into one column.
- Error messages are specific and tied to the field that caused them.

## 7. How judges experience it

**Primary: a deployed URL.** A judge opens it on a laptop or phone, clicks "Load example" or pastes their own documents, and gets a live verdict in about three seconds. No install, no key, no seed script.

**Secondary: a 90-second video** showing the France monitor case end to end, including the raw JSON toggle so the API responses are visible.

**Tertiary: a JSON API** (`POST /api/check`) with a curl example in the UI, for an agent pipeline. This is the "agent integration" answer without making the agent the product.

**Why not a Chrome extension:** judges will not side-load an unpacked extension, and the value is a server-side gate that an assistant calls, not a browser action.

**Why not an agent-first product:** the product's value is the verdict and its evidence. An agent wrapper hides both and adds setup friction.

## 8. Rubric mapping

| Criterion | How the app earns it |
|---|---|
| Practical usefulness (25) | A named buyer, a documented failure mode, a blocked publish, and a measurable outcome |
| Core Clocked integration (30) | All three group endpoints are load-bearing: Rerank selects, Compare evidences, Verify decides |
| Additional endpoints (15) | 3/3 in the group; no decorative calls; Compare is skipped when there is only one source |
| Implementation / UX (20) | A clear desk, real stage progress, citations, keyboard and mobile support |
| Explanation / reproducibility (10) | README, architecture, pure-function tests, failure table, raw JSON |

## 9. Failure behaviour

| Failure | Behaviour |
|---|---|
| 402 credits / spend limit | HOLD, with the stage and message |
| 409 idempotency conflict | HOLD, no blind retry |
| 429 rate limit | Bounded retry with backoff and jitter, then HOLD |
| 5xx / timeout | Bounded retry, then HOLD |
| 400 / 422 | HOLD with the endpoint's detail |
| Authority tie | HOLD before any API call |
| No governing clause | HOLD |
| No superseded document | Compare skipped, decision still valid |
| Draft missing | Validation error, no API call |

Every retry reuses the same `Idempotency-Key` and payload. Each endpoint gets its own key.

## 10. Privacy

The audit log stores the decision, credits, latency, document titles and a short redacted preview — not the full documents. The raw API responses shown in the UI are kept in memory for the session only. The API key lives in the server environment and never reaches the browser.

## 11. What is deliberately out of scope

- PDF upload (the docs support it; the demo stays text-first for reliability).
- Multi-tenant auth (the demo is single-tenant; the README says so).
- Automatic rewriting (the gate lists the exact claims and sources; a human edits).
- A vector store (clause segmentation is deterministic and sufficient).
