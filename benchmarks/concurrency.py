"""Run N real checks concurrently against one ledger and verify the chain.

This deliberately refuses to run against Vercel Blob. The point is to exercise
sequence allocation with more than one in-flight check without writing test
traffic into the production audit prefix. Set BLOB_READ_WRITE_TOKEN='' and a
throwaway DOCKET_STORE_DIR before running.

    BLOB_READ_WRITE_TOKEN= DOCKET_STORE_DIR=/tmp/docket-concurrency \
      python benchmarks/concurrency.py --count 10
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import ledger  # noqa: E402
import policy_registry  # noqa: E402
import reviews  # noqa: E402
import storage  # noqa: E402
from app import CheckRequest, run_check  # noqa: E402
from samples import SAMPLES  # noqa: E402


def sample_case(sample_id: str) -> dict:
    sample = next(item for item in SAMPLES if item["id"] == sample_id)
    context = sample.get("context") or {}
    return {
        "question": sample["question"],
        "draft": sample["draft"],
        "country": context.get("country") or "",
        "role": context.get("role") or "",
        "plan": context.get("plan") or "",
        "documents": sample["documents"],
    }


async def run(count: int, sample_id: str) -> dict:
    if storage.backend() != "local":
        raise SystemExit("Refusing to run: this harness writes only to the local store.")
    await policy_registry.seed_samples(SAMPLES)
    before = await ledger.head()
    case = sample_case(sample_id)
    started = datetime.now(timezone.utc)

    async def one(index: int):
        payload = await run_check(CheckRequest(**case), record=True)
        return {
            "index": index,
            "decision": payload.get("decision"),
            "codes": payload.get("codes") or [],
            "audit_seq": (payload.get("audit") or {}).get("seq"),
            "audit_hash": (payload.get("audit") or {}).get("hash"),
            "review": (payload.get("review") or {}).get("id"),
            "credits": payload.get("credits"),
            "latency_ms": payload.get("latency_ms"),
            "error": None,
        }

    rows = await asyncio.gather(*[one(index) for index in range(count)], return_exceptions=False)
    state = await ledger.verify()
    queue = await reviews.list_records(limit=100)
    after = await ledger.head()
    elapsed = (datetime.now(timezone.utc) - started).total_seconds()
    return {
        "run_at": started.isoformat(timespec="seconds"),
        "count": count,
        "sample": sample_id,
        "storage": storage.backend(),
        "records_before": int(before.get("seq") or 0),
        "records_after": int(after.get("seq") or 0),
        "ledger": state,
        "decisions": sorted({row["decision"] for row in rows}),
        "audit_sequences": sorted(row["audit_seq"] for row in rows if row["audit_seq"] is not None),
        "unique_sequences": len({row["audit_seq"] for row in rows if row["audit_seq"] is not None}),
        "review_records": len(queue),
        "credits": round(sum(float(row["credits"] or 0) for row in rows), 2),
        "elapsed_seconds": round(elapsed, 2),
        "rows": rows,
    }


def write_markdown(result: dict, path: Path) -> None:
    ledger_state = result["ledger"]
    lines = [
        "# Docket concurrency check",
        "",
        f"**Run:** {result['run_at']}  ",
        f"**Checks:** {result['count']} concurrent  ",
        f"**Case:** `{result['sample']}`  ",
        f"**Storage:** `{result['storage']}`",
        "",
        "## Result",
        "",
        "| Metric | Result |",
        "|---|---:|",
        f"| Checks completed | {len(result['rows'])} |",
        f"| Decisions | {', '.join(result['decisions'])} |",
        f"| Audit records before / after | {result['records_before']} / {result['records_after']} |",
        f"| Unique audit sequences | {result['unique_sequences']} / {result['count']} |",
        f"| Review records opened | {result['review_records']} |",
        f"| Chain verified | **{ledger_state.get('ok')}** |",
        f"| Chain records / checks / events | {ledger_state.get('records')} / {ledger_state.get('checks')} / {ledger_state.get('events')} |",
        f"| Head sequence / hash | {ledger_state.get('head', {}).get('seq')} / `{ledger_state.get('head', {}).get('hash')}` |",
        f"| Credits / elapsed | {result['credits']} / {result['elapsed_seconds']} s |",
        "",
        "## Audit sequences",
        "",
        f"`{', '.join(str(item) for item in result['audit_sequences'])}`",
        "",
        "## Interpretation",
        "",
        "The local store uses the same `put_json(allow_overwrite=False)` / `claim()` path as Blob. "
        "Ten checks in one event loop exercise the per-loop lock; the two-event-loop unit test exercises "
        "the atomic sequence claim. Production Blob uses the same conditional create. A verified chain here "
        "means no duplicate or missing sequence was produced by the concurrent checks.",
        "",
    ]
    path.write_text("\n".join(lines), encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=10)
    parser.add_argument("--sample", default="expense-update")
    parser.add_argument("--out", default="benchmarks/concurrency-results")
    args = parser.parse_args()
    result = asyncio.run(run(max(2, args.count), args.sample))
    output = Path(args.out)
    output.with_suffix(".json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    write_markdown(result, output.with_suffix(".md"))
    print(
        json.dumps(
            {
                "checks": len(result["rows"]),
                "decisions": result["decisions"],
                "records": [result["records_before"], result["records_after"]],
                "unique_sequences": result["unique_sequences"],
                "review_records": result["review_records"],
                "ledger_ok": result["ledger"].get("ok"),
                "credits": result["credits"],
                "elapsed_seconds": result["elapsed_seconds"],
            },
            indent=2,
        )
    )
    return 0 if result["ledger"].get("ok") and result["unique_sequences"] == result["count"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
