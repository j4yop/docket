"""Durable human-review queue for HOLD and REWRITE determinations.

Every recorded determination that cannot publish creates a review record.
The record survives a restart because it is stored through the same backend
as the ledger. Assignment and resolution are appended to the audit chain by
the API layer, so the queue decision has the same tamper evidence as the check
that opened it.
"""

from __future__ import annotations

import asyncio
import hmac
import re
import secrets
from datetime import datetime, timezone

import storage

REVIEW_PREFIX = "reviews/"
ACTIONS = {"approve", "reject"}
STATUSES = {"open", "assigned", "resolved"}
_LOCKS: dict[int, asyncio.Lock] = {}
_ID_RE = re.compile(r"^RV-[A-Za-z0-9-]{8,64}$")


def _lock() -> asyncio.Lock:
    loop = asyncio.get_running_loop()
    return _LOCKS.setdefault(id(loop), asyncio.Lock())


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _valid_id(review_id: str) -> bool:
    return bool(_ID_RE.match(review_id or ""))


def capability_matches(record: dict, supplied: str) -> bool:
    stored = str(record.get("capability") or "")
    if not stored or not supplied:
        return False
    return hmac.compare_digest(stored, supplied)


def _path(review_id: str) -> str:
    return f"{REVIEW_PREFIX}{review_id}.json"


async def create(payload: dict) -> dict:
    """Open one review record for a HOLD or REWRITE."""
    decision = str(payload.get("decision") or "").lower()
    if decision not in {"hold", "rewrite"}:
        raise ValueError("Only HOLD and REWRITE determinations enter review.")
    reviewed_at = _now()
    review_id = f"RV-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S')}-{secrets.token_hex(4)}"
    audit = payload.get("audit") or {}
    review = {
        "id": review_id,
        "capability": secrets.token_urlsafe(24),
        "status": "open",
        "decision": decision,
        "codes": list(payload.get("codes") or []),
        "question": str(payload.get("question") or "")[:500],
        "draft_preview": str(payload.get("draft") or "")[:400].replace("\n", " "),
        "reasons": [str(reason)[:300] for reason in (payload.get("reasons") or [])[:5]],
        "check": {
            "seq": audit.get("seq"),
            "hash": audit.get("hash"),
            "checked_at": payload.get("checked_at"),
        },
        "assigned_to": None,
        "assigned_at": None,
        "resolution": None,
        "created_at": reviewed_at,
        "updated_at": reviewed_at,
        "history": [{"at": reviewed_at, "action": "opened", "by": "docket"}],
    }
    await storage.put_json(_path(review_id), review, allow_overwrite=False)
    return review


async def get(review_id: str) -> dict | None:
    if not _valid_id(review_id):
        return None
    record = await storage.get_json(_path(review_id))
    return record if isinstance(record, dict) else None


async def list_records(status: str | None = None, limit: int = 50) -> list[dict]:
    if status and status not in STATUSES:
        raise ValueError("Unknown review status.")
    paths = await storage.list_paths(REVIEW_PREFIX)
    records = []
    for path in paths[-200:]:
        record = await storage.get_json(path)
        if isinstance(record, dict) and _valid_id(str(record.get("id") or "")):
            if status is None or record.get("status") == status:
                records.append(record)
    records.sort(key=lambda item: str(item.get("created_at") or ""), reverse=True)
    return records[: max(1, min(limit, 100))]


async def counts() -> dict:
    records = await list_records(limit=100)
    return {
        "open": sum(1 for record in records if record.get("status") == "open"),
        "assigned": sum(1 for record in records if record.get("status") == "assigned"),
        "resolved": sum(1 for record in records if record.get("status") == "resolved"),
        "total": len(records),
    }


async def assign(review_id: str, assignee: str) -> dict:
    assignee = (assignee or "").strip()[:120]
    if not assignee:
        raise ValueError("An assignee is required.")
    async with _lock():
        record = await get(review_id)
        if not record:
            raise LookupError("Review not found.")
        if record.get("status") == "resolved":
            raise ValueError("A resolved review cannot be reassigned.")
        now = _now()
        record.update(
            status="assigned",
            assigned_to=assignee,
            assigned_at=now,
            updated_at=now,
        )
        record.setdefault("history", []).append(
            {"at": now, "action": "assigned", "by": assignee}
        )
        await storage.put_json(_path(review_id), record, allow_overwrite=True)
        return record


async def resolve(
    review_id: str,
    *,
    action: str,
    note: str,
    resolved_by: str,
    audit_event: dict | None = None,
) -> dict:
    action = (action or "").strip().lower()
    note = (note or "").strip()
    resolved_by = (resolved_by or "").strip()[:120]
    if action not in ACTIONS:
        raise ValueError("Action must be approve or reject.")
    if len(note) < 3:
        raise ValueError("A resolution note is required.")
    if not resolved_by:
        raise ValueError("A resolver is required.")
    async with _lock():
        record = await get(review_id)
        if not record:
            raise LookupError("Review not found.")
        if record.get("status") == "resolved":
            raise ValueError("This review is already resolved.")
        now = _now()
        record.update(
            status="resolved",
            updated_at=now,
            resolution={
                "action": action,
                "note": note[:1000],
                "resolved_by": resolved_by,
                "resolved_at": now,
                "ledger": audit_event,
            },
        )
        record.setdefault("history", []).append(
            {"at": now, "action": f"resolved:{action}", "by": resolved_by}
        )
        await storage.put_json(_path(review_id), record, allow_overwrite=True)
        return record
