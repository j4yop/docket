"""Durable object storage for the audit ledger and policy registry.

Vercel Blob is the production backend. When no token is configured (local
development, tests), the same interface writes to a local directory so the
chain can be verified without a network dependency.
"""

from __future__ import annotations

import json
import os
from pathlib import Path

LOCAL_DIR = Path(os.environ.get("DOCKET_STORE_DIR", ".docket-store"))


def backend() -> str:
    return "vercel-blob" if os.environ.get("BLOB_READ_WRITE_TOKEN", "").strip() else "local"


def _body(data: dict) -> bytes:
    return json.dumps(data, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


async def put_json(pathname: str, data: dict, *, allow_overwrite: bool = True) -> None:
    body = _body(data)
    if backend() == "vercel-blob":
        from vercel import blob

        await blob.put_blob(
            pathname,
            body,
            access="private",
            content_type="application/json",
            allow_overwrite=allow_overwrite,
            add_random_suffix=False,
        )
        return
    target = LOCAL_DIR / pathname
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and not allow_overwrite:
        raise FileExistsError(pathname)
    target.write_bytes(body)


async def get_json(pathname: str) -> dict | None:
    if backend() == "vercel-blob":
        from vercel import blob

        try:
            result = await blob.get_blob(pathname, access="private")
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
        async for item in blob.query_blobs(prefix=prefix, page_size=1000):
            paths.append(item.pathname)
        return paths
    root = LOCAL_DIR / prefix
    if not root.exists():
        return []
    return sorted(str(path.relative_to(LOCAL_DIR)) for path in root.rglob("*.json"))
