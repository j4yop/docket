"""Tamper-evident audit ledger.

Each check appends a record whose hash covers the previous record's hash. The
head is stored separately. Verification recomputes every hash and checks the
links, so editing or deleting a record is detectable.

Production storage is a private Vercel Blob store. Without a token, the same
chain is written to a local directory and labeled as a per-instance fallback.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import secrets
from datetime import datetime, timezone

import storage

GENESIS = "0" * 64
HEAD_PATH = "ledger/head.json"
_LOCKS: dict[int, asyncio.Lock] = {}


def _lock() -> asyncio.Lock:
    """One lock per event loop, so tests and server loops do not collide."""
    loop = asyncio.get_running_loop()
    return _LOCKS.setdefault(id(loop), asyncio.Lock())


def _canonical(data: dict) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _digest(data: dict) -> str:
    return hashlib.sha256(_canonical(data).encode("utf-8")).hexdigest()


async def head() -> dict:
    return await storage.get_json(HEAD_PATH) or {
        "seq": 0,
        "hash": GENESIS,
        "updated_at": None,
    }


async def append(payload: dict, *, question: str, draft: str) -> dict:
    async with _lock():
        current = await head()
        seq = int(current.get("seq") or 0) + 1
        checked_at = payload.get("checked_at") or datetime.now(timezone.utc).isoformat(timespec="seconds")
        authority = payload.get("authority") or {}
        governing = authority.get("governing") or {}
        record = {
            "seq": seq,
            "checked_at": checked_at,
            "decision": payload.get("decision"),
            "codes": list(payload.get("codes") or []),
            "governing": {
                "id": governing.get("id"),
                "title": governing.get("title"),
                "jurisdiction": governing.get("jurisdiction"),
                "effective_date": governing.get("effective_date"),
            },
            "policy_envelopes": [
                {
                    "doc_id": item.get("doc_id"),
                    "title": item.get("title"),
                    "content_hash": item.get("content_hash"),
                    "signature": (item.get("signature") or "")[:32],
                    "approved_by": item.get("approved_by"),
                    "approval_type": item.get("approval_type"),
                }
                for item in (payload.get("policy_envelopes") or [])
            ],
            "credits": payload.get("credits", 0),
            "api_calls": payload.get("api_calls", 0),
            "latency_ms": payload.get("latency_ms", 0),
            "question_preview": (question or "")[:240],
            "draft_preview": (draft or "")[:180].replace("\n", " "),
            "reasons": [str(reason)[:300] for reason in (payload.get("reasons") or [])[:4]],
            "prev_hash": current.get("hash") or GENESIS,
        }
        record["record_hash"] = _digest(record)
        day = checked_at[:10]
        path = f"audit/{day}/{seq:08d}-{secrets.token_hex(3)}.json"
        await storage.put_json(path, record, allow_overwrite=False)
        await storage.put_json(
            HEAD_PATH,
            {
                "seq": seq,
                "hash": record["record_hash"],
                "updated_at": checked_at,
            },
            allow_overwrite=True,
        )
        return record


async def verify() -> dict:
    paths = await storage.list_paths("audit/")
    records: list[dict] = []
    for path in paths:
        record = await storage.get_json(path)
        if isinstance(record, dict):
            records.append(record)
    records.sort(key=lambda item: int(item.get("seq") or 0))

    expected_prev = GENESIS
    for record in records:
        stored_hash = record.get("record_hash")
        body = {key: value for key, value in record.items() if key != "record_hash"}
        if record.get("prev_hash") != expected_prev:
            return {
                "ok": False,
                "records": len(records),
                "broken_at": record.get("seq"),
                "detail": "A record does not link to the previous hash.",
                "head": await head(),
                "storage": storage.backend(),
            }
        if _digest(body) != stored_hash:
            return {
                "ok": False,
                "records": len(records),
                "broken_at": record.get("seq"),
                "detail": "A record's contents do not match its recorded hash.",
                "head": await head(),
                "storage": storage.backend(),
            }
        expected_prev = stored_hash

    current = await head()
    head_ok = (current.get("hash") or GENESIS) == expected_prev
    return {
        "ok": head_ok,
        "records": len(records),
        "broken_at": None if head_ok else current.get("seq"),
        "detail": "The chain is intact." if head_ok else "The head does not match the last record.",
        "head": current,
        "storage": storage.backend(),
    }


async def recent(limit: int = 12) -> list[dict]:
    paths = await storage.list_paths("audit/")
    paths.sort(reverse=True)
    records = []
    for path in paths[: max(1, min(limit, 50))]:
        record = await storage.get_json(path)
        if isinstance(record, dict):
            records.append(record)
    records.sort(key=lambda item: int(item.get("seq") or 0), reverse=True)
    return records
