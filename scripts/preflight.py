#!/usr/bin/env python3
"""Production preflight for the Docket demo.

Checks the judge-facing surfaces and the durable health report without
spending a Clocked credit. Run before submitting or presenting:

    python scripts/preflight.py
    python scripts/preflight.py --base-url http://127.0.0.1:8020
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from dataclasses import dataclass


@dataclass
class Result:
    name: str
    ok: bool
    detail: str


def fetch(url: str, timeout: float = 40.0) -> tuple[int, bytes]:
    request = urllib.request.Request(url, headers={"User-Agent": "docket-preflight/1"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, response.read()


def check_page(base: str, path: str, markers: tuple[str, ...]) -> Result:
    url = f"{base}{path}"
    last_error = ""
    for _ in range(2):
        try:
            status, body = fetch(url)
            text = body.decode("utf-8", "replace")
            missing = [marker for marker in markers if marker not in text]
            if status != 200:
                last_error = f"HTTP {status}"
                continue
            if missing:
                last_error = f"missing marker(s): {', '.join(missing)}"
                continue
            return Result(path, True, f"HTTP 200 · {len(body):,} bytes")
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            last_error = str(error)
    return Result(path, False, last_error)


def check_health(base: str) -> list[Result]:
    results = []
    try:
        status, body = fetch(f"{base}/api/health")
        data = json.loads(body)
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        return [Result("/api/health", False, str(error))]

    if status != 200:
        return [Result("/api/health", False, f"HTTP {status}")]

    results.append(Result("/api/health", bool(data.get("ok")), f"ok={data.get('ok')}"))

    ledger = data.get("ledger") or {}
    results.append(
        Result(
            "ledger chain",
            bool(ledger.get("ok")),
            f"ok={ledger.get('ok')} · {ledger.get('records', '?')} records",
        )
    )

    registry = data.get("policy_registry") or {}
    registered = registry.get("registered")
    count = registry.get("count")
    registry_ok = bool(registry.get("ok")) and registered == count
    results.append(
        Result(
            "policy registry",
            registry_ok,
            f"ok={registry.get('ok')} · {registered}/{count} signed",
        )
    )
    return results


def check_session(base: str) -> Result:
    try:
        status, body = fetch(f"{base}/api/session")
        data = json.loads(body)
        ok = status == 200 and bool(data.get("token")) and int(data.get("expires_at") or 0) > 0
        return Result("/api/session", ok, "signed browser session issued" if ok else "no token")
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as error:
        return Result("/api/session", False, str(error))


def main() -> int:
    parser = argparse.ArgumentParser(description="Docket production preflight")
    parser.add_argument(
        "--base-url",
        default="https://docket-clocked.vercel.app",
        help="Deployment to check (default: production)",
    )
    args = parser.parse_args()
    base = args.base_url.rstrip("/")

    checks = [
        check_page(base, "/tour", ("The judge tour", "tour-feature-question", "tour-evidence")),
        check_page(base, "/console", ('id="docket-gate"', "gate-scope-block", "gate-record-block")),
        check_page(base, "/ledger", ("ledger", "chain")),
        check_session(base),
    ]
    checks.extend(check_health(base))

    width = max(len(check.name) for check in checks)
    failed = 0
    for check in checks:
        label = "PASS" if check.ok else "FAIL"
        if not check.ok:
            failed += 1
        print(f"{label}  {check.name:<{width}}  {check.detail}")

    print()
    if failed:
        print(f"{failed} check(s) failed against {base}")
        return 1
    print(f"All {len(checks)} checks passed against {base}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
