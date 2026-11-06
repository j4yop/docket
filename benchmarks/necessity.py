"""Run the endpoint necessity proofs against a live Docket server.

The output is evidence, not a benchmark score. It records one baseline and one
counterfactual for every endpoint. No audit records are written by /api/prove.

Usage:
    python benchmarks/necessity.py --base-url http://127.0.0.1:8000
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from benchmarks.necessity_cases import PROOFS, proof_payload  # noqa: E402
DEFAULT_OUT = ROOT / "benchmarks" / "necessity-results"
DEFAULT_WEBSITE = ROOT / "website" / "integrations" / "necessity.json"


def _request(base: str, path: str, token: str | None = None, data: dict | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if token:
        headers["x-docket-session"] = token
    request = urllib.request.Request(
        base.rstrip("/") + path,
        data=json.dumps(data).encode("utf-8") if data is not None else None,
        headers=headers,
        method="POST" if data is not None else "GET",
    )
    try:
        with urllib.request.urlopen(request, timeout=180) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:500]
        raise SystemExit(f"{path} returned HTTP {exc.code}: {detail}") from exc


def _delta(result: dict) -> str:
    baseline = result["baseline"]
    ablated = result.get("ablated")
    if result["mode"] == "measure" or not ablated:
        return "Record / evidence only"
    if baseline["decision"] != ablated["decision"]:
        return f"{baseline['decision'].upper()} → {ablated['decision'].upper()}"
    before = baseline["signal"]["label"]
    after = ablated["signal"]["label"]
    if before != after:
        return f"{before} → {after}"
    return "No observable change"


def _markdown(payload: dict) -> str:
    lines = [
        "# Docket endpoint necessity proofs",
        "",
        f"**Recorded:** {payload['recorded_at']}  ",
        f"**Mode:** {payload['mode']}  ",
        f"**Base URL:** `{payload['base_url']}`",
        "",
        "Each row is one live baseline and one live counterfactual. All nine endpoints are ablated; Protect and Rerank change the record or evidence set, not the verdict. `/api/prove` writes no audit record.",
        "",
        "| Endpoint | What it changes | Proof case | With endpoint | Without endpoint | Change |",
        "|---|---|---|---|---|---|",
    ]
    for proof in payload["proofs"]:
        result = proof["result"]
        baseline = result["baseline"]
        ablated = result.get("ablated")
        with_text = f"{baseline['decision'].upper()} · {baseline['signal']['label']}"
        without_text = (
            f"{ablated['decision'].upper()} · {ablated['signal']['label']}"
            if ablated
            else "—"
        )
        lines.append(
            f"| **{proof['label']}** | {proof['role']} | {proof['proof_case']} | "
            f"{with_text} | {without_text} | {proof['delta']} |"
        )
    lines += [
        "",
        "## Notes",
        "",
        "- The clean access-request proof publishes with Verify and holds without it. The gate fails closed when verification is missing.",
        "- Compare and Decide keep the same decision on the precedence case but lose their evidence and review routing when ablated. Their contribution is the conflict table and the review route, not a different label.",
        "- Protect and Rerank are not verdict levers. Their rows show what changes when they are disabled: the redaction count and the evidence set.",
        "- This is a targeted proof of endpoint contribution, not an accuracy benchmark. The held-out and adversarial results are separate.",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--out", default=str(DEFAULT_OUT))
    parser.add_argument("--website", default=str(DEFAULT_WEBSITE))
    args = parser.parse_args()

    session = _request(args.base_url, "/api/session")
    token = session.get("token")
    if not token:
        raise SystemExit("The server did not return a session token.")

    proofs = []
    for spec in PROOFS:
        payload = proof_payload(spec)
        result = _request(
            args.base_url,
            "/api/prove",
            token=token,
            data={**payload, "endpoint": spec["endpoint"]},
        )
        proofs.append(
            {
                "endpoint": spec["endpoint"],
                "label": spec["label"],
                "role": spec["role"],
                "proof_case": spec["proof_case"],
                "note": spec["note"],
                "payload": payload,
                "result": result,
                "delta": _delta(result),
            }
        )
        print(f"{spec['label']:9} {proofs[-1]['delta']}")

    output = {
        "recorded_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": "live",
        "base_url": args.base_url,
        "proofs": proofs,
    }
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.with_suffix(".json").write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    out.with_suffix(".md").write_text(_markdown(output), encoding="utf-8")
    website = Path(args.website)
    website.parent.mkdir(parents=True, exist_ok=True)
    website.write_text(json.dumps(output, indent=2) + "\n", encoding="utf-8")
    print(f"\nWrote {out.with_suffix('.json')}, {out.with_suffix('.md')} and {website}")


if __name__ == "__main__":
    main()
