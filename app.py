"""Docket — a publish gate for service-desk knowledge.

Authority is resolved deterministically. Rerank selects the governing clause.
Compare shows what the superseded clause said. Verify decides whether the
draft can ship. The verdict is a pure function of those outputs.
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import traceback
import uuid
from pathlib import Path
from typing import Awaitable, Callable, Literal

from fastapi import FastAPI
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

import db
from authority import (
    Clause,
    Document,
    align_superseded,
    best_clause_for_text,
    candidate_clauses,
    parse_date,
    resolve,
    segment_document,
)
from clocked_client import ClockedClient, ClockedError
from policy import Decision, evaluate, split_claims
from samples import SAMPLES


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


load_env(Path(__file__).resolve().parent / ".env")

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="Docket", version="1.0.0", docs_url=None, redoc_url=None)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


class DocumentIn(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    text: str = Field(min_length=20, max_length=60_000)
    jurisdiction: str = Field(default="Global", max_length=20)
    effective_date: str | None = Field(default=None, max_length=10)
    precedence: int = Field(default=0, ge=0, le=2)


class CheckRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2_000)
    draft: str = Field(min_length=3, max_length=10_000)
    country: str = Field(default="", max_length=40)
    role: str = Field(default="", max_length=60)
    plan: str = Field(default="", max_length=60)
    documents: list[DocumentIn] = Field(min_length=1, max_length=4)


Emit = Callable[[str, dict], Awaitable[None]]

RERANK_POLICY = (
    "The document titled '{governing}' governs for this employee. "
    "These documents are superseded and must not govern: {superseded}. "
    "Treat any passage from a superseded document as different_case and skip it, even if it answers the same question. "
    "Select every clause from the governing document that answers the question for this employee, "
    "including clauses that state a condition, exception or deadline. "
    "Use 'use' when the clause itself answers the question, 'expand' when the answer is in another part of the same document, "
    "and 'skip' otherwise."
)

COMPARE_POLICY = (
    "'{governing}' governs this employee. The other documents are superseded. "
    "Identify passages where the documents disagree about the same fact, number, approver or deadline. "
    "Return each conflict with both passages. Do not treat a difference in scope, jurisdiction or effective date "
    "as a conflict unless the two passages claim the same rule for the same case."
)

VERIFY_POLICY = (
    "The supplied documents are the governing policy for this employee. "
    "Check the draft answer only against them. A claim is contradicted when the documents state a different rule, "
    "number, approver or deadline. A claim is not_stated when the documents do not address it. "
    "Do not use outside knowledge. Treat each sentence as a separate claim."
)


# --------------------------------------------------------------------------
# orchestration
# --------------------------------------------------------------------------
async def run_check(req: CheckRequest, emit: Emit | None = None) -> dict:
    started = time.perf_counter()
    credits = 0.0
    stages: list[dict] = []

    async def send(event: str, data: dict) -> None:
        if emit is not None:
            await emit(event, data)

    async def begin(stage: str) -> None:
        entry = {"stage": stage, "status": "running"}
        stages.append(entry)
        await send("stage", entry)

    async def finish(stage: str, elapsed: int, spent: float, summary: dict) -> None:
        for entry in reversed(stages):
            if entry["stage"] == stage:
                entry.update(status="done", ms=elapsed, credits=round(spent, 2), summary=summary)
                await send("stage", entry)
                return

    async def skip(stage: str, reason: str) -> None:
        entry = {"stage": stage, "status": "skipped", "reason": reason}
        stages.append(entry)
        await send("stage", entry)

    def complete(decision: Decision, reasons: list[str], codes: list[str], **extra) -> dict:
        payload = {
            "question": req.question,
            "draft": req.draft,
            "context": {"country": req.country, "role": req.role, "plan": req.plan},
            "document_titles": [doc.title for doc in req.documents],
            "decision": decision.value,
            "reasons": reasons,
            "codes": codes,
            "stages": stages,
            "credits": round(credits, 2),
            "latency_ms": int((time.perf_counter() - started) * 1000),
            "authority": None,
            "rerank": None,
            "compare": None,
            "verify": None,
            "raw": {},
            **extra,
        }
        verify = payload.get("verify") or {}
        claims = verify.get("claims") or []
        contradicted = sum(1 for c in claims if (c.get("verdict") or "") == "contradicted")
        payload["id"] = db.record(
            question=req.question,
            decision=payload["decision"],
            governing_title=(payload.get("authority") or {}).get("governing", {}).get("title"),
            doc_count=len(req.documents),
            claim_count=len([c for c in claims if c.get("counted", True)]),
            contradicted=contradicted,
            credits=payload["credits"],
            latency_ms=payload["latency_ms"],
            draft=req.draft,
            reasons=reasons,
        )
        return payload

    # ---- validation ------------------------------------------------------
    for doc in req.documents:
        try:
            parse_date(doc.effective_date)
        except ValueError as exc:
            return complete(Decision.HOLD, [str(exc)], ["validation"])

    documents = [
        Document(
            id=f"doc{i}",
            title=doc.title.strip(),
            text=doc.text.strip(),
            jurisdiction=doc.jurisdiction.strip() or "Global",
            effective_date=doc.effective_date,
            precedence=doc.precedence,
        )
        for i, doc in enumerate(req.documents, start=1)
    ]

    # ---- authority (deterministic, no API call) --------------------------
    await begin("authority")
    mark = time.perf_counter()
    authority = resolve(documents, req.country)
    clause_map: dict[str, Clause] = {}
    doc_map = {doc.id: doc for doc in documents}
    all_clauses: list[Clause] = []
    for doc in documents:
        clauses = segment_document(doc)
        all_clauses.extend(clauses)
        for clause in clauses:
            clause_map[clause.id] = clause

    authority_payload = {
        "governing": (
            {
                "id": authority.governing.id,
                "title": authority.governing.title,
                "jurisdiction": authority.governing.jurisdiction,
                "effective_date": authority.governing.effective_date,
                "precedence": authority.governing.precedence,
            }
            if authority.governing
            else None
        ),
        "superseded": [
            {
                "id": doc.id,
                "title": doc.title,
                "jurisdiction": doc.jurisdiction,
                "effective_date": doc.effective_date,
                "precedence": doc.precedence,
            }
            for doc in authority.superseded
        ],
        "trace": authority.trace,
        "error": authority.error,
    }
    await finish(
        "authority",
        int((time.perf_counter() - mark) * 1000),
        0,
        {
            "governing": authority_payload["governing"]["title"] if authority_payload["governing"] else None,
            "superseded": len(authority.superseded),
        },
    )

    if authority.error or not authority.governing:
        verdict = evaluate(authority_error=authority.error, selected_count=0, verify=None)
        return complete(
            verdict.decision, verdict.reasons, verdict.codes, authority=authority_payload
        )

    governing = authority.governing
    candidates = candidate_clauses(
        all_clauses,
        req.question,
        [req.country, req.role, req.plan, governing.title],
        limit=12,
        per_doc=3,
    )

    api_key = os.environ.get("CLOCKED_API_KEY", "").strip()
    if not api_key:
        verdict = evaluate(
            authority_error=None,
            selected_count=0,
            verify=None,
            failed_stage="configuration",
            failed_message="CLOCKED_API_KEY is not set on the server",
        )
        return complete(verdict.decision, verdict.reasons, verdict.codes, authority=authority_payload)

    client = ClockedClient(api_key)
    try:
        # ---- Rerank ------------------------------------------------------
        await begin("rerank")
        mark = time.perf_counter()
        try:
            rerank_res = await client.rerank(
                query=req.question,
                documents=[
                    {
                        "id": clause.id,
                        "title": f"{doc_map[clause.doc_id].title} — clause {clause.order + 1}",
                        "text": clause.text,
                    }
                    for clause in candidates
                ],
                context={
                    "country": req.country,
                    "role": req.role,
                    "plan": req.plan,
                    "governing_document": governing.title,
                    "superseded_documents": [doc.title for doc in authority.superseded],
                },
                instructions=RERANK_POLICY.format(
                    governing=governing.title,
                    superseded=", ".join(doc.title for doc in authority.superseded) or "none",
                ),
                idem_key=str(uuid.uuid4()),
            )
        except ClockedError as exc:
            for entry in reversed(stages):
                if entry["stage"] == "rerank":
                    entry.update(status="error", reason=exc.message)
                    await send("stage", entry)
                    break
            verdict = evaluate(
                authority_error=None,
                selected_count=0,
                verify=None,
                failed_stage="rerank",
                failed_message=exc.message,
            )
            return complete(verdict.decision, verdict.reasons, verdict.codes, authority=authority_payload)

        credits += rerank_res.credits
        rerank_rows = rerank_res.data.get("results") or []
        rerank_payload = []
        for row in rerank_rows:
            clause = clause_map.get(row.get("id"))
            if not clause:
                continue
            rerank_payload.append(
                {
                    "clause_id": clause.id,
                    "doc_id": clause.doc_id,
                    "doc_title": doc_map[clause.doc_id].title,
                    "text": clause.text,
                    "action": row.get("action"),
                    "reason": row.get("reason"),
                    "relevance": row.get("relevance_score"),
                    "document_score": row.get("document_score"),
                }
            )
        selected = [
            row
            for row in rerank_payload
            if row["doc_id"] == governing.id and row["action"] in {"use", "expand"}
        ]
        selected.sort(key=lambda row: row["relevance"] or 0, reverse=True)
        await finish(
            "rerank",
            int((time.perf_counter() - mark) * 1000),
            rerank_res.credits,
            {
                "selected": len(selected),
                "skipped": len(rerank_payload) - len(selected),
                "model": rerank_res.data.get("model"),
            },
        )

        if not selected:
            verdict = evaluate(authority_error=None, selected_count=0, verify=None)
            return complete(
                verdict.decision,
                verdict.reasons,
                verdict.codes,
                authority=authority_payload,
                rerank={"rows": rerank_payload, "selected": [], "skipped": rerank_payload},
                raw={"rerank": rerank_res.data},
            )

        # ---- Compare (clause level, only when a superseded source exists)
        compare_payload = None
        compare_raw = None
        internal_conflict = False
        if not authority.superseded:
            await skip("compare", "Only one source applies, so there is no superseded clause to compare.")
        else:
            superseded_ids = {doc.id for doc in authority.superseded}
            superseded_clauses = [c for c in all_clauses if c.doc_id in superseded_ids]
            governing_clauses = [clause_map[row["clause_id"]] for row in selected[:2]]
            aligned = align_superseded(governing_clauses, superseded_clauses, limit=2)
            compare_rows = []
            for governing_clause, superseded_clause in aligned:
                compare_rows.append(
                    {
                        "clause_id": governing_clause.id,
                        "text": governing_clause.text,
                        "doc_id": governing_clause.doc_id,
                    }
                )
                compare_rows.append(
                    {
                        "clause_id": superseded_clause.id,
                        "text": superseded_clause.text,
                        "doc_id": superseded_clause.doc_id,
                    }
                )
            if len(compare_rows) < 2:
                superseded_rows = [
                    row for row in rerank_payload if row["doc_id"] != governing.id
                ]
                superseded_rows.sort(key=lambda row: row["relevance"] or 0, reverse=True)
                compare_rows = selected[:2] + superseded_rows[:2]
            if len(compare_rows) < 2:
                await skip("compare", "No superseded clause was retrieved for comparison.")
            else:
                await begin("compare")
                mark = time.perf_counter()
                try:
                    compare_res = await client.compare(
                        documents=[
                            {"id": row["clause_id"], "text": row["text"]} for row in compare_rows
                        ],
                        instructions=COMPARE_POLICY.format(governing=governing.title),
                        idem_key=str(uuid.uuid4()),
                    )
                except ClockedError as exc:
                    for entry in reversed(stages):
                        if entry["stage"] == "compare":
                            entry.update(status="error", reason=exc.message)
                            await send("stage", entry)
                            break
                    verdict = evaluate(
                        authority_error=None,
                        selected_count=len(selected),
                        verify=None,
                        failed_stage="compare",
                        failed_message=exc.message,
                    )
                    return complete(
                        verdict.decision,
                        verdict.reasons,
                        verdict.codes,
                        authority=authority_payload,
                        rerank={"rows": rerank_payload, "selected": selected, "skipped": []},
                        raw={"rerank": rerank_res.data},
                    )

                credits += compare_res.credits
                compare_raw = compare_res.data
                pairs = compare_res.data.get("pairs") or []
                governing_ids = {row["clause_id"] for row in selected}
                internal_conflict = any(
                    pair.get("a") in governing_ids
                    and pair.get("b") in governing_ids
                    and pair.get("relation") == "conflicting"
                    for pair in pairs
                )
                compare_payload = {
                    "verdict": compare_res.data.get("verdict"),
                    "pairs": pairs,
                    "conflict_count": sum(len(pair.get("conflicts") or []) for pair in pairs),
                    "internal_conflict": internal_conflict,
                }
                await finish(
                    "compare",
                    int((time.perf_counter() - mark) * 1000),
                    compare_res.credits,
                    {
                        "pairs": len(pairs),
                        "conflicts": compare_payload["conflict_count"],
                        "model": compare_res.data.get("model"),
                    },
                )

        # ---- Verify ------------------------------------------------------
        await begin("verify")
        mark = time.perf_counter()
        # Verify reads the whole governing document, not only the clause that
        # answers the question: the draft may make claims the question did not
        # ask about. For very large documents, fall back to the selected clauses.
        if len(governing.text) <= 50_000:
            verify_documents = [{"id": governing.id, "text": governing.text}]
        else:
            verify_documents = [{"id": row["clause_id"], "text": row["text"]} for row in selected[:8]]
        try:
            verify_res = await client.verify(
                documents=verify_documents,
                answer=req.draft,
                question=req.question,
                instructions=VERIFY_POLICY,
                idem_key=str(uuid.uuid4()),
                claims=split_claims(req.draft),
            )
        except ClockedError as exc:
            for entry in reversed(stages):
                if entry["stage"] == "verify":
                    entry.update(status="error", reason=exc.message)
                    await send("stage", entry)
                    break
            verdict = evaluate(
                authority_error=None,
                selected_count=len(selected),
                verify=None,
                failed_stage="verify",
                failed_message=exc.message,
            )
            return complete(
                verdict.decision,
                verdict.reasons,
                verdict.codes,
                authority=authority_payload,
                rerank={"rows": rerank_payload, "selected": selected, "skipped": []},
                compare=compare_payload,
                raw={"rerank": rerank_res.data, "compare": compare_raw},
            )

        credits += verify_res.credits
        governing_clauses = [c for c in all_clauses if c.doc_id == governing.id]
        for claim in verify_res.data.get("claims") or []:
            if not claim.get("evidence"):
                match = best_clause_for_text(claim.get("claim") or "", governing_clauses)
                if match:
                    claim["governing_quote"] = match.text
                    claim["governing_doc"] = governing.title
        verify_payload = {
            "grounded": verify_res.data.get("grounded"),
            "ungrounded": verify_res.data.get("ungrounded"),
            "verdict": verify_res.data.get("verdict"),
            "answers_question": verify_res.data.get("answers_question"),
            "weakest_claim": verify_res.data.get("weakest_claim"),
            "claims": verify_res.data.get("claims") or [],
        }
        await finish(
            "verify",
            int((time.perf_counter() - mark) * 1000),
            verify_res.credits,
            {
                "grounded": verify_payload["grounded"],
                "claims": len(verify_payload["claims"]),
                "model": verify_res.data.get("model"),
            },
        )

        verdict = evaluate(
            authority_error=None,
            selected_count=len(selected),
            verify=verify_payload,
            internal_conflict=internal_conflict,
        )
        return complete(
            verdict.decision,
            verdict.reasons,
            verdict.codes,
            authority=authority_payload,
            rerank={"rows": rerank_payload, "selected": selected, "skipped": [r for r in rerank_payload if r not in selected]},
            compare=compare_payload,
            verify=verify_payload,
            raw={"rerank": rerank_res.data, "compare": compare_raw, "verify": verify_res.data},
        )
    except Exception:
        traceback.print_exc()
        verdict = evaluate(
            authority_error=None,
            selected_count=0,
            verify=None,
            failed_stage="internal",
            failed_message="unexpected error",
        )
        return complete(verdict.decision, verdict.reasons, verdict.codes, authority=authority_payload)
    finally:
        await client.aclose()


# --------------------------------------------------------------------------
# routes
# --------------------------------------------------------------------------
@app.get("/")
async def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/samples")
async def sample_list() -> list[dict]:
    return [{"id": s["id"], "label": s["label"], "blurb": s["blurb"]} for s in SAMPLES]


@app.get("/api/samples/{sample_id}")
async def sample_detail(sample_id: str) -> JSONResponse:
    for sample in SAMPLES:
        if sample["id"] == sample_id:
            return JSONResponse(sample)
    return JSONResponse({"detail": "not found"}, status_code=404)


@app.post("/api/check")
async def check(req: CheckRequest) -> JSONResponse:
    return JSONResponse(await run_check(req))


@app.post("/api/check/stream")
async def check_stream(req: CheckRequest) -> StreamingResponse:
    queue: asyncio.Queue = asyncio.Queue()

    async def emit(event: str, data: dict) -> None:
        await queue.put((event, data))

    async def worker() -> None:
        try:
            result = await run_check(req, emit)
            await queue.put(("result", result))
        except Exception:
            traceback.print_exc()
            await queue.put(("error", {"message": "The check failed unexpectedly. Nothing was published."}))
        finally:
            await queue.put((None, None))

    task = asyncio.create_task(worker())

    async def stream():
        yield ": docket stream open\n\n"
        try:
            while True:
                event, data = await queue.get()
                if event is None:
                    break
                yield f"event: {event}\ndata: {json.dumps(data)}\n\n"
        finally:
            if not task.done():
                task.cancel()

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache, no-transform", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


@app.get("/api/checks")
async def checks(limit: int = 12) -> list[dict]:
    return db.recent(limit)


@app.get("/api/stats")
async def stats() -> dict:
    return db.totals()


@app.get("/api/health")
async def health() -> dict:
    return {
        "ok": bool(os.environ.get("CLOCKED_API_KEY")),
        "clocked_configured": bool(os.environ.get("CLOCKED_API_KEY")),
        "streaming": os.environ.get("DOCKET_STREAMING", "1") != "0",
    }


db.init()
