"""Durable object storage for the audit ledger and policy registry.

Vercel Blob is the production backend. When no token is configured (local
development, tests), the same interface writes to a local directory so the
chain can be verified without a network dependency.
"""

from __future__ import annotations

import json
import os
import time
from pathlib import Path
from urllib.parse import quote

LOCAL_DIR = Path(os.environ.get("DOCKET_STORE_DIR", ".docket-store"))


def backend() -> str:
    return "vercel-blob" if os.environ.get("BLOB_READ_WRITE_TOKEN", "").strip() else "local"


def _env_prefix() -> str:
    """Keep Production, Preview and Development from sharing one chain."""
    env = os.environ.get("VERCEL_ENV", "").strip()
    return f"{env}/" if env in {"production", "preview", "development"} else ""


def _full(pathname: str) -> str:
    return f"{_env_prefix()}{pathname}"


def _logical(pathname: str) -> str:
    prefix = _env_prefix()
    return pathname[len(prefix):] if prefix and pathname.startswith(prefix) else pathname


def _store_id() -> str:
    token = os.environ.get("BLOB_READ_WRITE_TOKEN", "").strip()
    marker = "vercel_blob_rw_"
    if token.startswith(marker):
        store, _, _ = token[len(marker):].partition("_")
        return store
    return os.environ.get("BLOB_STORE_ID", "").strip()


def _body(data: dict) -> bytes:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


async def put_json(
    pathname: str,
    data: dict,
    *,
    allow_overwrite: bool = True,
    cache_control_max_age: int | None = None,
) -> None:
    body = _body(data)
    if backend() == "vercel-blob":
        from vercel import blob

        await blob.put_blob(
            _full(pathname),
            body,
            access="private",
            content_type="application/json",
            allow_overwrite=allow_overwrite,
            add_random_suffix=False,
            cache_control_max_age=cache_control_max_age,
        )
        return
    target = LOCAL_DIR / pathname
    target.parent.mkdir(parents=True, exist_ok=True)
    if not allow_overwrite:
        # O_EXCL is the local equivalent of Blob's conditional create. It makes
        # sequence claims and checkpoint writes atomic across processes.
        try:
            descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o644)
        except FileExistsError:
            raise FileExistsError(pathname) from None
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(body)
            handle.flush()
            os.fsync(handle.fileno())
        return
    # Atomic replace: a reader never sees a half-written JSON document.
    temporary = target.with_name(f"{target.name}.{os.getpid()}.{time.time_ns()}.tmp")
    temporary.write_bytes(body)
    os.replace(temporary, target)


async def get_json(pathname: str) -> dict | None:
    if backend() == "vercel-blob":
        from vercel import blob

        store = _store_id()
        # The head is mutable. A cache-busting query stops a stale CDN copy
        # from producing a duplicate sequence number.
        target = (
            f"https://{store}.private.blob.vercel-storage.com/{quote(_full(pathname), safe='/')}"
            f"?ts={time.time_ns()}"
            if store
            else _full(pathname)
        )
        try:
            result = await blob.get_blob(target, access="private")
        except blob.BlobNotFoundError:
            return None
        return json.loads(result.body)
    target = LOCAL_DIR / pathname
    if not target.exists():
        return None
    return json.loads(target.read_bytes())


async def list_paths(prefix: str) -> list[str]:
    if backend() == "vercel-blob":
        from vercel import blob

        paths = []
        async for item in blob.query_blobs(prefix=_full(prefix), page_size=1000):
            paths.append(_logical(item.pathname))
        return paths
    root = LOCAL_DIR / prefix
    if not root.exists():
        return []
    return sorted(str(path.relative_to(LOCAL_DIR)) for path in root.rglob("*.json"))


async def delete(pathname: str) -> None:
    if backend() == "vercel-blob":
        from vercel import blob

        await blob.delete_blob(_full(pathname))
        return
    target = LOCAL_DIR / pathname
    if target.exists():
        target.unlink()


async def claim(pathname: str, data: dict) -> bool:
    """Atomically claim a name. Returns False when another writer owns it.

    Vercel Blob enforces ``allow_overwrite=False`` on create, so the same call
    is the cross-instance lock. The local backend uses O_EXCL.
    """
    try:
        await put_json(pathname, data, allow_overwrite=False)
        return True
    except FileExistsError:
        return False
    except Exception as exc:  # noqa: BLE001 - backend-specific conflict class
        message = str(exc).lower()
        if "already exists" in message or "overwrite" in message or "conflict" in message:
            return False
        raise
