"""Signed policy envelopes.

A policy is not just text. Docket binds the text to a content hash, the
metadata that authority depends on, and an identified approval. The signature
is an HMAC over the canonical envelope, so changing the text or any signed
field is detectable.

Trust levels:
- ``seeded``: the built-in sample corpus, signed at startup.
- ``admin``: approved through the admin-only approval endpoint.
- ``operator``: explicitly attested for one check. It is recorded in the
  audit ledger but never written to the shared registry.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone

import storage

_CACHE: dict[str, dict] = {}
SEED_PATH = "policies/_seed.json"


def _secret() -> bytes:
    value = (
        os.environ.get("DOCKET_POLICY_SECRET", "").strip()
        or os.environ.get("DOCKET_SESSION_SECRET", "").strip()
        or "docket-local-policy-secret"
    )
    return value.encode("utf-8")


def normalize_text(text: str) -> str:
    return "\n".join(line.rstrip() for line in (text or "").replace("\r\n", "\n").replace("\r", "\n").strip().split("\n"))


def content_hash(text: str) -> str:
    return hashlib.sha256(normalize_text(text).encode("utf-8")).hexdigest()


def _canonical(fields: dict) -> str:
    return json.dumps(fields, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def sign(fields: dict) -> str:
    return hmac.new(_secret(), _canonical(fields).encode("utf-8"), hashlib.sha256).hexdigest()


def verify(fields: dict, signature: str | None) -> bool:
    if not isinstance(signature, str) or not signature:
        return False
    expected = sign(
        {key: value for key, value in fields.items() if key not in {"signature", "doc_id"}}
    )
    return hmac.compare_digest(signature, expected)


def build_envelope(
    *,
    text: str,
    title: str,
    policy_id: str | None,
    version: str | None,
    jurisdiction: str,
    effective_date: str | None,
    expiry_date: str | None,
    precedence: int,
    approved_by: str,
    approval_type: str,
    approved_at: str | None = None,
) -> dict:
    digest = content_hash(text)
    fields = {
        "policy_id": policy_id or f"POL-{digest[:8].upper()}",
        "version": version or "unversioned",
        "title": title.strip(),
        "jurisdiction": (jurisdiction or "Global").strip() or "Global",
        "effective_date": effective_date,
        "expiry_date": expiry_date,
        "precedence": int(precedence or 0),
        "content_hash": digest,
        "approved_by": approved_by,
        "approved_at": approved_at or datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "approval_type": approval_type,
    }
    fields["signature"] = sign(fields)
    return fields


async def resolve(documents_in, documents) -> tuple[list[dict], list[dict]]:
    """Return one envelope per document plus any integrity failures."""
    envelopes: list[dict] = []
    errors: list[dict] = []
    for doc_in, doc in zip(documents_in, documents):
        digest = content_hash(doc.text)

        supplied = getattr(doc_in, "policy_envelope", None)
        if isinstance(supplied, dict) and supplied:
            envelope = dict(supplied)
            signature = envelope.get("signature")
            fields = {key: value for key, value in envelope.items() if key != "signature"}
            if fields.get("content_hash") != digest:
                errors.append({
                    "code": "policy_tampered",
                    "message": (
                        f"{doc.title}: the supplied policy envelope does not match the submitted text "
                        f"(sha256 {digest[:12]}). The policy was modified after approval."
                    ),
                })
                continue
            if not verify(fields, signature):
                errors.append({
                    "code": "policy_tampered",
                    "message": f"{doc.title}: the policy envelope signature is invalid. The policy was modified after approval.",
                })
                continue
            envelopes.append({**fields, "signature": signature, "doc_id": doc.id})
            continue

        cached = _CACHE.get(digest)
        if cached is None:
            stored = await storage.get_json(f"policies/{digest}.json")
            cached = stored if isinstance(stored, dict) else False
            _CACHE[digest] = cached  # type: ignore[assignment]
        if cached and verify(cached, cached.get("signature")):
            envelopes.append({**cached, "doc_id": doc.id})
            continue

        approved_by = (getattr(doc_in, "approved_by", None) or "").strip()
        if approved_by:
            reference = (getattr(doc_in, "approval_reference", None) or "").strip()
            envelope = build_envelope(
                text=doc.text,
                title=doc.title,
                policy_id=getattr(doc_in, "policy_id", None),
                version=getattr(doc_in, "version", None),
                jurisdiction=doc.jurisdiction,
                effective_date=doc.effective_date,
                expiry_date=doc.expires_date,
                precedence=doc.precedence,
                approved_by=f"{approved_by}" + (f" · {reference}" if reference else ""),
                approval_type="operator",
            )
            envelopes.append({**envelope, "doc_id": doc.id})
            continue

        errors.append({
            "code": "policy_unapproved",
            "message": (
                f"{doc.title}: no approved policy envelope matches this text (sha256 {digest[:12]}). "
                "Add an approval reference or ask an admin to approve the policy."
            ),
        })
    return envelopes, errors


async def seed_samples(samples) -> int:
    """Sign the built-in sample corpus once. Idempotent across cold starts."""
    pairs = []
    for sample in samples:
        for document in sample.get("documents") or []:
            pairs.append(document)
    seed_id = hashlib.sha256(
        "|".join(content_hash(document.get("text") or "") for document in pairs).encode("utf-8")
    ).hexdigest()[:16]
    marker = await storage.get_json(SEED_PATH)
    if isinstance(marker, dict) and marker.get("seed_id") == seed_id:
        return int(marker.get("count") or 0)

    count = 0
    for document in pairs:
        envelope = build_envelope(
            text=document.get("text") or "",
            title=document.get("title") or "Untitled policy",
            policy_id=document.get("policy_id"),
            version=document.get("version"),
            jurisdiction=document.get("jurisdiction") or "Global",
            effective_date=document.get("effective_date"),
            expiry_date=document.get("expires_date"),
            precedence=int(document.get("precedence") or 0),
            approved_by="Docket sample corpus",
            approval_type="seeded",
            approved_at="2026-11-01T00:00:00+00:00",
        )
        await storage.put_json(
            f"policies/{envelope['content_hash']}.json", envelope, allow_overwrite=True
        )
        _CACHE[envelope["content_hash"]] = envelope
        count += 1
    await storage.put_json(
        SEED_PATH,
        {
            "seed_id": seed_id,
            "count": count,
            "seeded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        allow_overwrite=True,
    )
    return count


async def approve(
    *,
    text: str,
    title: str,
    policy_id: str | None,
    version: str | None,
    jurisdiction: str,
    effective_date: str | None,
    expiry_date: str | None,
    precedence: int,
    approved_by: str,
) -> dict:
    envelope = build_envelope(
        text=text,
        title=title,
        policy_id=policy_id,
        version=version,
        jurisdiction=jurisdiction,
        effective_date=effective_date,
        expiry_date=expiry_date,
        precedence=precedence,
        approved_by=approved_by,
        approval_type="admin",
    )
    await storage.put_json(
        f"policies/{envelope['content_hash']}.json", envelope, allow_overwrite=True
    )
    _CACHE[envelope["content_hash"]] = envelope
    return envelope
