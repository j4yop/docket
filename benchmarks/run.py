"""Run the Docket benchmark.

Offline mode is deterministic and free: authority resolution plus policy
integrity. Live mode calls Clocked and measures the full decision.

Examples:
    python benchmarks/run.py --offline
    python benchmarks/run.py --live --limit 10
    python benchmarks/run.py --live --category clean
    python benchmarks/run.py --live --sweep
"""

from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from authority import Document, resolve  # noqa: E402
from benchmarks.calibration_cases import CALIBRATION_CASES  # noqa: E402
from benchmarks.cases import CASES  # noqa: E402
from benchmarks.heldout_cases import HELDOUT_CASES  # noqa: E402
import policy_registry  # noqa: E402
from app import CheckRequest, run_check  # noqa: E402


SUITES = {
    "tuned": CASES,
    "calibration": CALIBRATION_CASES,
    "heldout": HELDOUT_CASES,
}
HELDOUT_LOCK = ROOT / "benchmarks" / "heldout.lock"
LOCKED_FIELDS = (
    "id",
    "category",
    "request",
    "expected",
    "envelope_text",
    "sign_documents",
)


def case_material(case: dict) -> dict:
    return {key: case.get(key) for key in LOCKED_FIELDS}


def case_fingerprint(case: dict) -> str:
    body = json.dumps(case_material(case), sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(body.encode("utf-8")).hexdigest()


def build_lock(cases: list[dict]) -> dict:
    entries = [{"id": case["id"], "sha256": case_fingerprint(case)} for case in cases]
    overall = hashlib.sha256(
        json.dumps(entries, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    return {
        "suite": "heldout",
        "algorithm": "sha256",
        "locked_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "case_count": len(entries),
        "cases": entries,
        "sha256": overall,
    }


def write_lock(cases: list[dict], path: Path = HELDOUT_LOCK) -> dict:
    payload = build_lock(cases)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    return payload


def verify_lock(cases: list[dict], path: Path = HELDOUT_LOCK) -> tuple[bool, str, dict | None]:
    if not path.exists():
        return False, f"The held-out lock file is missing ({path}).", None
    try:
        locked = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return False, f"The held-out lock file could not be read: {exc}", None
    entries = [{"id": case["id"], "sha256": case_fingerprint(case)} for case in cases]
    overall = hashlib.sha256(
        json.dumps(entries, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()
    if locked.get("case_count") != len(cases):
        return False, (
            f"The held-out suite has {len(cases)} cases but the lock has "
            f"{locked.get('case_count')}."
        ), None
    if locked.get("cases") != entries:
        changed = sorted(
            {entry["id"] for entry in entries}
            ^ {entry.get("id") for entry in (locked.get("cases") or [])}
        )
        detail = f" Changed cases: {', '.join(changed[:6])}." if changed else ""
        return False, (
            "The held-out cases do not match the locked suite. A locked case was edited "
            "after the lock was written." + detail
        ), None
    if locked.get("sha256") != overall:
        return False, "The held-out lock digest does not match its case fingerprints.", None
    return True, "The locked held-out suite matches case-for-case.", locked


def prepare_documents(case: dict) -> list[dict]:
    documents = [dict(document) for document in case["request"]["documents"]]
    if case.get("sign_documents"):
        for document in documents:
            document["policy_envelope"] = policy_registry.build_envelope(
                text=document["text"],
                title=document["title"],
                policy_id=document.get("policy_id"),
                version=document.get("version"),
                jurisdiction=document.get("jurisdiction") or "Global",
                effective_date=document.get("effective_date"),
                expiry_date=document.get("expires_date"),
                precedence=int(document.get("precedence") or 0),
                approved_by="Benchmark admin",
                approval_type="admin",
            )
    if case.get("envelope_text"):
        document = documents[0]
        document["policy_envelope"] = policy_registry.build_envelope(
            text=case["envelope_text"],
            title=document["title"],
            policy_id=document.get("policy_id"),
            version=document.get("version"),
            jurisdiction=document.get("jurisdiction") or "Global",
            effective_date=document.get("effective_date"),
            expiry_date=document.get("expires_date"),
            precedence=int(document.get("precedence") or 0),
            approved_by="Benchmark admin",
            approval_type="admin",
        )
    return documents


def make_request(case: dict) -> CheckRequest:
    request = dict(case["request"])
    request["documents"] = prepare_documents(case)
    return CheckRequest(**request)


def documents_from(case: dict) -> list[Document]:
    prepared = prepare_documents(case)
    return [
        Document(
            id=f"doc{index}",
            title=item.get("title") or f"Policy {index}",
            text=item.get("text") or "",
            jurisdiction=item.get("jurisdiction") or "Global",
            effective_date=item.get("effective_date") or None,
            expires_date=item.get("expires_date") or None,
            precedence=int(item.get("precedence") or 0),
        )
        for index, item in enumerate(prepared, start=1)
    ]


def offline(cases: list[dict]) -> list[dict]:
    results = []
    for case in cases:
        docs = documents_from(case)
        expected_governing = case["expected"].get("governing")
        try:
            authority = resolve(docs, case["request"].get("country", ""))
            actual_governing = authority.governing.title if authority.governing else None
            authority_error = authority.error
        except Exception as exc:  # noqa: BLE001
            actual_governing = None
            authority_error = str(exc)

        prepared = prepare_documents(case)
        req = CheckRequest(**{**case["request"], "documents": prepared})
        envelopes, failures = asyncio.run(policy_registry.resolve(req.documents, docs))
        failure_codes = sorted({item["code"] for item in failures})
        expected_codes = case["expected"].get("codes_any") or []
        integrity_expected = any(code.startswith("policy_") for code in expected_codes)
        if integrity_expected:
            integrity_ok = bool(failure_codes)
        else:
            integrity_ok = not failure_codes

        results.append(
            {
                "id": case["id"],
                "category": case["category"],
                "expected_decision": case["expected"]["decision"],
                "expected_governing": expected_governing,
                "actual_governing": actual_governing,
                "governing_ok": (
                    actual_governing == expected_governing
                    if expected_governing is not None
                    else case["expected"]["decision"] == "hold"
                ),
                "authority_error": authority_error,
                "failure_codes": failure_codes,
                "integrity_ok": integrity_ok,
                "mode": "offline",
            }
        )
    return results


async def live_once(case: dict) -> dict:
    request = make_request(case)
    try:
        payload = await run_check(request, record=False)
    except Exception as exc:  # noqa: BLE001
        return {
            "id": case["id"],
            "category": case["category"],
            "error": f"{type(exc).__name__}: {exc}",
            "expected_decision": case["expected"]["decision"],
            "decision": "error",
            "codes": [],
            "passed": False,
        }
    authority = payload.get("authority") or {}
    governing = (authority.get("governing") or {}).get("title")
    verify = payload.get("verify") or {}
    claims = [claim for claim in (verify.get("claims") or []) if claim.get("counted", True)]
    guard = payload.get("guard") or {}
    inspect = payload.get("inspect") or {}
    extract = payload.get("extract") or {}
    return {
        "id": case["id"],
        "category": case["category"],
        "expected_decision": case["expected"]["decision"],
        "expected_governing": case["expected"].get("governing"),
        "expected_codes": case["expected"].get("codes_any") or [],
        "decision": payload.get("decision"),
        "codes": payload.get("codes") or [],
        "headline": payload.get("headline"),
        "governing": governing,
        "governing_ok": (
            governing == case["expected"].get("governing")
            if case["expected"].get("governing") is not None
            else case["expected"]["decision"] == "hold"
        ),
        "api_calls": payload.get("api_calls", 0),
        "credits": payload.get("credits", 0),
        "latency_ms": payload.get("latency_ms", 0),
        "guard_score": guard.get("injection"),
        "guard_verdict": guard.get("verdict"),
        "inspect_score": inspect.get("probability"),
        "inspect_verdict": inspect.get("verdict"),
        "coverage_value": (payload.get("coverage") or {}).get("value"),
        "claims": [
            {"verdict": claim.get("verdict"), "claim": claim.get("claim")}
            for claim in claims[:6]
        ],
        "extract_conflicts": (extract.get("conflicts") or []),
        "reasons": (payload.get("reasons") or [])[:4],
        "mode": "live",
    }


def score_live(row: dict) -> bool:
    if row.get("error"):
        return False
    decision_ok = row.get("decision") == row.get("expected_decision")
    governing_ok = row.get("governing_ok")
    if governing_ok is None:
        governing_ok = row.get("governing") == row.get("expected_governing")
    expected_codes = row.get("expected_codes") or []
    codes_ok = not expected_codes or any(code in (row.get("codes") or []) for code in expected_codes)
    return bool(decision_ok and governing_ok and codes_ok)


def summarise(rows: list[dict], mode: str) -> dict:
    by_category = defaultdict(lambda: {"n": 0, "passed": 0})
    for row in rows:
        bucket = by_category[row["category"]]
        bucket["n"] += 1
        if mode == "offline":
            ok = row.get("governing_ok") and row.get("integrity_ok")
        else:
            ok = row.get("passed", False)
        bucket["passed"] += 1 if ok else 0

    clean = [row for row in rows if row["category"] == "clean"]
    unsafe = [
        row
        for row in rows
        if row["category"] in {"injection", "script", "version", "omission", "malformed", "integrity"}
        and row.get("expected_decision") != "publish"
    ]
    injection = [row for row in rows if row["category"] == "injection"]
    script = [row for row in rows if row["category"] == "script"]
    omission = [row for row in rows if row["category"] == "omission"]

    summary = {
        "mode": mode,
        "cases": len(rows),
        "passed": (
            sum(1 for row in rows if row.get("passed"))
            if mode == "live"
            else sum(1 for row in rows if row.get("governing_ok") and row.get("integrity_ok"))
        ),
        "by_category": {key: dict(value) for key, value in sorted(by_category.items())},
    }
    if mode == "offline":
        scored = [row for row in rows if row.get("expected_governing") is not None]
        summary["governing_cases"] = len(scored)
        summary["governing_accuracy"] = (
            round(sum(1 for row in scored if row.get("governing_ok")) / len(scored), 3) if scored else None
        )
        summary["integrity_accuracy"] = round(
            sum(1 for row in rows if row.get("integrity_ok")) / max(1, len(rows)), 3
        )
        return summary

    summary["decision_accuracy"] = round(
        sum(1 for row in rows if row.get("decision") == row.get("expected_decision")) / max(1, len(rows)), 3
    )
    scored = [row for row in rows if row.get("expected_governing") is not None]
    summary["governing_cases"] = len(scored)
    summary["governing_accuracy"] = (
        round(sum(1 for row in scored if row.get("governing_ok")) / len(scored), 3) if scored else None
    )
    def rate(part: int, whole: int):
        return round(part / whole, 3) if whole else None

    summary["false_hold_rate_clean"] = rate(
        sum(1 for row in clean if row.get("decision") == "hold"), len(clean)
    )
    summary["false_publish_rate_unsafe"] = rate(
        sum(1 for row in unsafe if row.get("decision") == "publish"), len(unsafe)
    )
    summary["injection_recall"] = rate(
        sum(1 for row in injection if "prompt_injection" in (row.get("codes") or [])), len(injection)
    )
    summary["script_recall"] = rate(
        sum(1 for row in script if "unsafe_script" in (row.get("codes") or [])),
        sum(1 for row in script if row.get("expected_decision") == "hold"),
    )
    omission_expected = [row for row in omission if row.get("expected_decision") == "rewrite"]
    summary["omission_recall"] = rate(
        sum(1 for row in omission_expected if "coverage_gap" in (row.get("codes") or [])),
        len(omission_expected),
    )
    summary["average_calls"] = round(
        sum(float(row.get("api_calls") or 0) for row in rows) / max(1, len(rows)), 2
    )
    summary["average_credits"] = round(
        sum(float(row.get("credits") or 0) for row in rows) / max(1, len(rows)), 2
    )
    summary["average_latency_ms"] = round(
        sum(float(row.get("latency_ms") or 0) for row in rows) / max(1, len(rows)), 0
    )
    return summary


def threshold_table(rows: list[dict], *, score_key: str, positives: list[dict], negatives: list[dict]) -> list[dict]:
    positives = [row for row in positives if isinstance(row.get(score_key), (int, float))]
    negatives = [row for row in negatives if isinstance(row.get(score_key), (int, float))]
    table = []
    thresholds = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    for threshold in thresholds:
        tp = sum(1 for row in positives if row[score_key] >= threshold)
        fp = sum(1 for row in negatives if row[score_key] >= threshold)
        precision = tp / (tp + fp) if tp + fp else 0.0
        recall = tp / len(positives) if positives else 0.0
        f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
        table.append(
            {
                "threshold": threshold,
                "true_positives": tp,
                "false_positives": fp,
                "precision": round(precision, 3),
                "recall": round(recall, 3),
                "f1": round(f1, 3),
            }
        )
    return table


def threshold_sweep(rows: list[dict]) -> dict:
    positives_guard = [row for row in rows if row["category"] == "injection"]
    negatives_guard = [row for row in rows if row["category"] == "clean"]
    positives_inspect = [
        row for row in rows
        if row["category"] == "script" and row.get("expected_decision") == "hold"
    ]
    negatives_inspect = [
        row
        for row in rows
        if row["category"] == "clean"
        or (row["category"] == "script" and row.get("expected_decision") == "publish")
    ]
    guard = threshold_table(
        rows,
        score_key="guard_score",
        positives=positives_guard,
        negatives=negatives_guard,
    )
    inspect = threshold_table(
        rows,
        score_key="inspect_score",
        positives=positives_inspect,
        negatives=negatives_inspect,
    )

    def flat(table: list[dict]) -> bool:
        return len({(row["f1"], row["false_positives"], row["true_positives"]) for row in table}) == 1

    def operating_row(table: list[dict], operating: float) -> dict:
        return min(table, key=lambda row: abs(row["threshold"] - operating))

    guard_operating = float(os.environ.get("DOCKET_GUARD_THRESHOLD", "0.5"))
    inspect_operating = float(os.environ.get("DOCKET_INSPECT_THRESHOLD", "0.5"))
    guard_flat = flat(guard)
    inspect_flat = flat(inspect)

    def choose(table: list[dict], is_flat: bool, operating: float, positives: list[dict], negatives: list[dict], score_key: str) -> dict:
        if is_flat:
            return operating_row(table, operating)
        bounded = [row for row in table if row["false_positives"] == 0]
        pool = bounded or table
        best = max(row["f1"] for row in pool)
        candidates = [row for row in pool if row["f1"] == best]
        negative_scores = [float(row[score_key]) for row in negatives if isinstance(row.get(score_key), (int, float))]
        positive_scores = [float(row[score_key]) for row in positives if isinstance(row.get(score_key), (int, float))]
        if negative_scores and positive_scores and max(negative_scores) < min(positive_scores):
            # Put the boundary in the measured gap, then take the nearest row.
            target = (max(negative_scores) + min(positive_scores)) / 2
            return min(candidates, key=lambda row: abs(row["threshold"] - target))
        return min(candidates, key=lambda row: row["threshold"])

    return {
        "guard": guard,
        "inspect": inspect,
        "guard_chosen": choose(guard, guard_flat, guard_operating, positives_guard, negatives_guard, "guard_score"),
        "inspect_chosen": choose(inspect, inspect_flat, inspect_operating, positives_inspect, negatives_inspect, "inspect_score"),
        "guard_flat": guard_flat,
        "inspect_flat": inspect_flat,
        "guard_operating": os.environ.get("DOCKET_GUARD_THRESHOLD", "0.5"),
        "inspect_operating": os.environ.get("DOCKET_INSPECT_THRESHOLD", "0.5"),
        "note": (
            "The sweep applies measured Guard/Inspect scores from this run. A clean false positive "
            "is a clean case that the endpoint would hold at that threshold. A flat sweep means the "
            "corpus does not distinguish the thresholds; Docket keeps its operating point and reports "
            "the limitation. A non-flat sweep places the boundary in the measured gap between the "
            "highest negative and the lowest positive score."
        ),
    }


def write_results(
    rows: list[dict],
    summary: dict,
    sweep: dict | None,
    out_base: Path,
    mode: str,
    suite: str = "tuned",
    lock: dict | None = None,
) -> None:
    payload = {
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "mode": mode,
        "suite": suite,
        "lock": lock,
        "summary": summary,
        "sweep": sweep,
        "cases": rows,
    }
    out_base.parent.mkdir(parents=True, exist_ok=True)
    out_base.with_suffix(".json").write_text(json.dumps(payload, indent=2), encoding="utf-8")

    lines = [
        f"# Docket benchmark results — {suite}",
        "",
        f"**Run:** {payload['run_at']}  ",
        f"**Mode:** {mode}  ",
        f"**Suite:** `{suite}`  ",
        f"**Cases:** {summary['cases']}",
        "",
    ]
    if lock:
        lines += [
            "## Suite lock",
            "",
            f"- Lock file: `benchmarks/heldout.lock`  ",
            f"- Locked before the run: **{lock.get('locked_at')}**  ",
            f"- Locked cases: **{lock.get('case_count')}**  ",
            f"- Lock digest: `{lock.get('sha256')}`  ",
            "- Verification: the case fingerprints matched the lock before this run.",
            "",
        ]
    lines += [
        "## Summary",
        "",
    ]
    def pct(value):
        return "n/a" if value is None else f"{value:.0%}"

    if mode == "live":
        lines += [
            f"- Decision accuracy: **{pct(summary['decision_accuracy'])}**",
            f"- Governing-policy accuracy: **{pct(summary['governing_accuracy'])}**",
            f"- Clean false-HOLD rate: **{pct(summary['false_hold_rate_clean'])}**",
            f"- Unsafe false-PUBLISH rate: **{pct(summary['false_publish_rate_unsafe'])}**",
            f"- Injection recall: **{pct(summary['injection_recall'])}**",
            f"- Script recall: **{pct(summary['script_recall'])}**",
            f"- Omission recall: **{pct(summary['omission_recall'])}**",
            f"- Average calls: {summary['average_calls']}",
            f"- Average credits: {summary['average_credits']}",
            f"- Average latency: {summary['average_latency_ms']:.0f} ms",
        ]
    else:
        lines += [
            f"- Governing-policy accuracy: **{pct(summary['governing_accuracy'])}**",
            f"- Policy-integrity accuracy: **{pct(summary['integrity_accuracy'])}**",
            "- Live decision metrics are not measured offline.",
        ]
    lines += ["", "## By category", "", "| Category | Passed | Cases |", "|---|---:|---:|"]
    for category, bucket in summary["by_category"].items():
        lines.append(f"| {category} | {bucket['passed']} | {bucket['n']} |")

    if mode == "live":
        lines += [
            "",
            "## All cases",
            "",
            "| Case | Category | Expected | Actual | Governing | Codes | Result |",
            "|---|---|---|---|---|---|---|",
        ]
        for row in rows:
            lines.append(
                f"| {row['id']} | {row.get('category')} | {row.get('expected_decision')} | "
                f"{row.get('decision')} | {row.get('governing') or '—'} | "
                f"{', '.join(row.get('codes') or []) or '—'} | "
                f"{'PASS' if row.get('passed') else 'FAIL'} |"
            )
        failures = [row for row in rows if not row.get("passed")]
        lines += ["", "## Failures", ""]
        if failures:
            lines += ["| Case | Expected | Actual | Codes | Governing |", "|---|---|---|---|---|"]
            for row in failures:
                lines.append(
                    f"| {row['id']} | {row.get('expected_decision')} | {row.get('decision')} | "
                    f"{', '.join(row.get('codes') or [])} | {row.get('governing') or '—'} |"
                )
        else:
            lines.append("No failures in this run.")

    if sweep:
        lines += [
            "",
            "## Threshold calibration",
            "",
            f"Operating Guard threshold: `{sweep['guard_operating']}` · Inspect: `{sweep['inspect_operating']}`",
            "",
            "### Guard",
            "",
            "| Threshold | TP | FP | Precision | Recall | F1 |",
            "|---:|---:|---:|---:|---:|---:|",
        ]
        for row in sweep["guard"]:
            lines.append(
                f"| {row['threshold']:.2f} | {row['true_positives']} | {row['false_positives']} | "
                f"{row['precision']:.2f} | {row['recall']:.2f} | {row['f1']:.2f} |"
            )
        lines += [
            "",
            ("The Guard sweep is flat across the tested thresholds; the measured cases do not "
             "justify moving off the operating point. "
             if sweep.get("guard_flat") else "")
            + f"Selected Guard threshold: **{sweep['guard_chosen']['threshold']:.2f}** "
            f"(F1 {sweep['guard_chosen']['f1']:.2f}, FP {sweep['guard_chosen']['false_positives']}).",
            "",
            "### Inspect",
            "",
            "| Threshold | TP | FP | Precision | Recall | F1 |",
            "|---:|---:|---:|---:|---:|---:|",
        ]
        for row in sweep["inspect"]:
            lines.append(
                f"| {row['threshold']:.2f} | {row['true_positives']} | {row['false_positives']} | "
                f"{row['precision']:.2f} | {row['recall']:.2f} | {row['f1']:.2f} |"
            )
        lines += [
            "",
            ("The Inspect sweep is flat across the tested thresholds; both malicious scripts score "
             "above 0.99 and the safe script below 0.01, so the corpus cannot calibrate a boundary. "
             if sweep.get("inspect_flat") else "")
            + f"Selected Inspect threshold: **{sweep['inspect_chosen']['threshold']:.2f}** "
            f"(F1 {sweep['inspect_chosen']['f1']:.2f}, FP {sweep['inspect_chosen']['false_positives']}).",
            "",
            sweep["note"],
        ]

    if suite == "heldout":
        limitations = [
            "The held-out corpus was authored by the Docket team after the tuning suite was frozen. It is a second authored corpus, not a third-party benchmark. The lock proves it was not edited after the labels were fixed; it does not remove authorship bias.",
            "A live run measures one model at one point in time; model behavior can drift.",
            "Every failure in this document is reported in the Failures table. A post-run fix belongs to a new iteration and must be reported as post-held-out tuning, not folded into this result.",
            "Clean false-HOLD and unsafe false-PUBLISH rates are reported from this corpus only.",
        ]
    elif suite == "calibration":
        limitations = [
            "Calibration cases are deliberately borderline and selected to probe Guard and Inspect boundaries. They are not accuracy evidence and must not be quoted as a benchmark score.",
            "The sweep reuses measured scores from this run. If it is flat, the corpus still cannot distinguish the thresholds and Docket keeps its operating point.",
            "A live run measures one model at one point in time; model behavior can drift.",
        ]
    else:
        limitations = [
            "The corpus is synthetic and was authored by the Docket team. It is a regression suite, not a held-out test set. A perfect score on authored cases is not evidence of perfect accuracy on unseen policy sprawl.",
            "The corpus covers policy governance, not every domain. A live run measures one model at one point in time; model behavior can drift.",
            "Omission recall is measured strictly as `coverage_gap`. One omission case is caught by a contradiction instead, so the decision is still correct while strict omission recall is 75%.",
            "Clean false-HOLD and unsafe false-PUBLISH rates are reported from this corpus only.",
            "The threshold sweep reuses measured scores. It is flat across 0.3–0.8 because the measured cases are easy to separate; that is a limitation, not a calibration win.",
        ]
    lines += ["", "## Limitations", ""] + [f"- {item}" for item in limitations] + [""]
    out_base.with_suffix(".md").write_text("\n".join(lines), encoding="utf-8")


async def run_live(rows_cases: list[dict]) -> list[dict]:
    rows = []
    for case in rows_cases:
        row = await live_once(case)
        rows.append(row)
        status = "PASS" if score_live(row) else "FAIL"
        print(f"[{status}] {case['id']:<28} expected={case['expected']['decision']:<8} actual={row.get('decision')}")
    return rows


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="Call Clocked for every case")
    parser.add_argument("--offline", action="store_true", help="Run deterministic checks only")
    parser.add_argument(
        "--suite",
        choices=sorted(SUITES),
        default="tuned",
        help="Corpus: tuned regression suite, borderline calibration, or locked held-out",
    )
    parser.add_argument("--limit", type=int, default=0, help="Run the first N cases")
    parser.add_argument("--category", default="", help="Only run one category")
    parser.add_argument("--sweep", action="store_true", help="Include threshold calibration in live mode")
    parser.add_argument("--out", default="benchmarks/results", help="Output basename")
    parser.add_argument("--write-lock", action="store_true", help="Write the held-out lock before running")
    parser.add_argument("--relock", action="store_true", help="Replace an existing held-out lock explicitly")
    args = parser.parse_args()

    suite_cases = list(SUITES[args.suite])
    lock_meta = None
    if args.suite == "heldout":
        if args.write_lock:
            if HELDOUT_LOCK.exists() and not args.relock:
                print(f"Held-out lock already exists at {HELDOUT_LOCK}; refusing to overwrite it.")
            else:
                lock_meta = write_lock(suite_cases)
                print(f"Wrote held-out lock at {HELDOUT_LOCK}.")
        ok, message, lock_meta = verify_lock(suite_cases)
        if not ok:
            print("Held-out suite is not locked for this run.")
            print(message)
            print("Fix the lock before running. Do not edit locked cases after a held-out result.")
            return 2
        print(f"Lock verified: {message}")
        print(
            f"Locked at {lock_meta.get('locked_at')} · {lock_meta.get('case_count')} cases · "
            f"{lock_meta.get('sha256')}"
        )

    cases = list(suite_cases)
    if args.category:
        cases = [case for case in cases if case["category"] == args.category]
    if args.limit:
        cases = cases[: args.limit]
    if not cases:
        print("No cases selected.")
        return 2

    mode = "live" if args.live else "offline"
    print(f"Running {len(cases)} cases from the {args.suite} suite in {mode} mode.")
    if mode == "offline":
        rows = offline(cases)
        for row in rows:
            ok = row.get("governing_ok") and row.get("integrity_ok")
            print(f"[{'PASS' if ok else 'FAIL'}] {row['id']:<28} governing={row.get('actual_governing')}")
        summary = summarise(rows, "offline")
        write_results(rows, summary, None, Path(args.out), "offline", args.suite, lock_meta)
        print(json.dumps(summary, indent=2))
        return 0 if all(row.get("governing_ok") and row.get("integrity_ok") for row in rows) else 1

    if not os.environ.get("CLOCKED_API_KEY"):
        print("CLOCKED_API_KEY is not set.")
        return 2

    async def run():
        await policy_registry.seed_samples(
            __import__("samples", fromlist=["SAMPLES"]).SAMPLES
        )
        return await run_live(cases)

    rows = asyncio.run(run())
    for row in rows:
        row["passed"] = score_live(row)
    summary = summarise(rows, "live")
    sweep = threshold_sweep(rows) if args.sweep else None
    write_results(rows, summary, sweep, Path(args.out), "live", args.suite, lock_meta)
    print(json.dumps(summary, indent=2))
    if sweep:
        print(json.dumps({"guard": sweep["guard_chosen"], "inspect": sweep["inspect_chosen"]}, indent=2))
    return 0 if all(row.get("passed") for row in rows) else 1


if __name__ == "__main__":
    raise SystemExit(main())
