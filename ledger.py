"""Tamper-evident audit ledger.

Each check appends an immutable record whose hash covers the previous record's
hash. A checkpoint object is written beside each record, so deleting a record
(including the last one) leaves a checkpoint that verification can detect.

There is no mutable head object: Blob storage does not offer a conditional put
and a mutable head can be served stale. The head is derived from the highest
sequence in the append-only audit prefix, which the list API returns fresh.

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
AUDIT_PREFIX = "audit/"
CHECKPOINT_PREFIX = "ledger/checkpoints/"
CLAIM_PREFIX = "ledger/claims/"
_LOCKS: dict[int, asyncio.Lock] = {}


def _lock() -> asyncio.Lock:
    """One lock per event loop, so tests and server loops do not collide."""
    loop = asyncio.get_running_loop()
    return _LOCKS.setdefault(id(loop), asyncio.Lock())


def _canonical(data: dict) -> str:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _digest(data: dict) -> str:
    return hashlib.sha256(_canonical(data).encode("utf-8")).hexdigest()


def _seq_from_path(path: str) -> int | None:
    name = path.rsplit("/", 1)[-1]
    try:
        return int(name[:8])
    except (ValueError, IndexError):
        return None


def _checkpoint_key(path: str) -> tuple[int, str] | None:
    name = path.rsplit("/", 1)[-1]
    if not name.endswith(".json"):
        return None
    stem = name[:-5]
    seq_text, _, digest_prefix = stem.partition("-")
    try:
        return int(seq_text), digest_prefix
    except ValueError:
        return None


async def head() -> dict:
    paths = await storage.list_paths(AUDIT_PREFIX)
    candidates = [(seq, path) for path in paths if (seq := _seq_from_path(path)) is not None]
    if not candidates:
        return {"seq": 0, "hash": GENESIS, "updated_at": None}
    seq, path = max(candidates)
    record = await storage.get_json(path)
    if not isinstance(record, dict):
        return {"seq": 0, "hash": GENESIS, "updated_at": None}
    return {
        "seq": seq,
        "hash": record.get("record_hash") or GENESIS,
        "updated_at": record.get("checked_at"),
    }


def _record(payload: dict, *, seq: int, prev_hash: str, checked_at: str, question: str, draft: str) -> dict:
    authority = payload.get("authority") or {}
    governing = authority.get("governing") or {}
    record = {
        "kind": "check",
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
        "prev_hash": prev_hash,
    }
    record["record_hash"] = _digest(record)
    return record


async def _claim(seq: int) -> bool:
    return await storage.claim(
        f"{CLAIM_PREFIX}{seq:08d}.json",
        {
            "seq": seq,
            "claimed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
    )


async def _append(build) -> dict:
    """Allocate a sequence, wait for the predecessor, then write one record.

    The claim object is an atomic create. Two app instances that read the same
    head cannot both own the same sequence: the loser retries after the winner
    advances the head. This is the cross-instance lock that a per-process
    asyncio lock cannot provide.
    """
    async with _lock():
        for _ in range(80):
            current = await head()
            seq = int(current.get("seq") or 0) + 1
            if not await _claim(seq):
                await asyncio.sleep(0.02 + secrets.randbelow(20) / 1000)
                continue

            previous = current
            for _ in range(500):
                previous = await head()
                if int(previous.get("seq") or 0) == seq - 1:
                    break
                if int(previous.get("seq") or 0) >= seq:
                    raise RuntimeError("The ledger sequence was written by another instance.")
                await asyncio.sleep(0.01)
            else:
                raise RuntimeError("The ledger head did not advance to the claimed sequence.")

            checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
            record = build(seq, previous.get("hash") or GENESIS, checked_at)
            day = checked_at[:10]
            path = f"{AUDIT_PREFIX}{day}/{seq:08d}-{secrets.token_hex(4)}.json"
            await storage.put_json(path, record, allow_overwrite=False)
            checkpoint = f"{CHECKPOINT_PREFIX}{seq:08d}-{record['record_hash'][:12]}.json"
            await storage.put_json(
                checkpoint,
                {
                    "seq": seq,
                    "record_hash": record["record_hash"],
                    "checked_at": checked_at,
                },
                allow_overwrite=False,
            )
            return record
    raise RuntimeError("The ledger could not allocate a sequence.")


async def append(payload: dict, *, question: str, draft: str) -> dict:
    checked_at = payload.get("checked_at") or datetime.now(timezone.utc).isoformat(timespec="seconds")

    def build(seq: int, prev_hash: str, written_at: str) -> dict:
        return _record(
            payload,
            seq=seq,
            prev_hash=prev_hash,
            checked_at=checked_at or written_at,
            question=question,
            draft=draft,
        )

    return await _append(build)


def _event_record(event: dict, *, seq: int, prev_hash: str, checked_at: str) -> dict:
    resolution = event.get("resolution") or {}
    record = {
        "kind": "review_event",
        "seq": seq,
        "checked_at": checked_at,
        "event": event.get("event") or "review_event",
        "review_id": event.get("review_id"),
        "review_status": event.get("review_status"),
        "action": event.get("action") or resolution.get("action"),
        "actor": event.get("actor") or resolution.get("resolved_by"),
        "note": str(event.get("note") or resolution.get("note") or "")[:500],
        "check_seq": event.get("check_seq"),
        "check_hash": event.get("check_hash"),
        "decision": None,
        "codes": [],
        "governing": {},
        "credits": 0,
        "api_calls": 0,
        "latency_ms": 0,
        "question_preview": str(event.get("question") or "")[:240],
        "draft_preview": str(event.get("draft") or "")[:180].replace("\n", " "),
        "reasons": [str(event.get("summary") or "Review queue event")[:300]],
        "prev_hash": prev_hash,
    }
    record["record_hash"] = _digest(record)
    return record


async def append_event(event: dict) -> dict:
    """Anchor a review-queue decision in the same hash chain as checks."""
    checked_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    return await _append(
        lambda seq, prev_hash, written_at: _event_record(
            event, seq=seq, prev_hash=prev_hash, checked_at=checked_at or written_at
        )
    )


async def verify() -> dict:
    paths = await storage.list_paths(AUDIT_PREFIX)
    records: list[dict] = []
    for path in paths:
        record = await storage.get_json(path)
        if isinstance(record, dict):
            records.append(record)
    records.sort(key=lambda item: int(item.get("seq") or 0))

    checkpoints: set[tuple[int, str]] = set()
    for path in await storage.list_paths(CHECKPOINT_PREFIX):
        key = _checkpoint_key(path)
        if key:
            checkpoints.add(key)

    expected_prev = GENESIS
    seen_sequences: set[int] = set()
    for record in records:
        seq = int(record.get("seq") or 0)
        if seq in seen_sequences:
            return {
                "ok": False,
                "records": len(records),
                "broken_at": seq,
                "detail": "Two records share a sequence number; the chain forked.",
                "head": await head(),
                "storage": storage.backend(),
            }
        seen_sequences.add(seq)
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

    for record in records:
        key = (int(record.get("seq") or 0), str(record.get("record_hash") or "")[:12])
        if key not in checkpoints:
            return {
                "ok": False,
                "records": len(records),
                "broken_at": record.get("seq"),
                "detail": "A record has no checkpoint; a record may have been deleted.",
                "head": await head(),
                "storage": storage.backend(),
            }
        checkpoints.discard(key)

    if checkpoints:
        missing = min(checkpoints)[0]
        return {
            "ok": False,
            "records": len(records),
            "broken_at": missing,
            "detail": "A checkpoint has no record; a record may have been deleted.",
            "head": await head(),
            "storage": storage.backend(),
        }

    current = await head()
    checks = sum(1 for record in records if record.get("kind") != "review_event")
    events = sum(1 for record in records if record.get("kind") == "review_event")
    return {
        "ok": True,
        "records": len(records),
        "checks": checks,
        "events": events,
        "broken_at": None,
        "detail": "The chain is intact.",
        "head": current,
        "storage": storage.backend(),
    }


async def recent(limit: int = 12) -> list[dict]:
    paths = await storage.list_paths(AUDIT_PREFIX)
    paths.sort(reverse=True)
    records = []
    for path in paths[: max(1, min(limit, 50))]:
        record = await storage.get_json(path)
        if isinstance(record, dict):
            records.append(record)
    records.sort(key=lambda item: int(item.get("seq") or 0), reverse=True)
    return records
