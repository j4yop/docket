"""The verdict policy. Pure functions, no I/O, unit-tested.

The rule is intentionally conservative: a counted claim that is contradicted
or unsupported blocks publication. A failed check holds the item. Only a
fully supported draft against a resolved governing document can publish.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class Decision(str, Enum):
    PUBLISH = "publish"
    REWRITE = "rewrite"
    HOLD = "hold"


@dataclass
class Verdict:
    decision: Decision
    reasons: list[str] = field(default_factory=list)
    codes: list[str] = field(default_factory=list)


def _counted(claim: dict) -> bool:
    if "counted" in claim:
        return bool(claim["counted"])
    return claim.get("kind") not in {"not_a_claim", "not_claim"}


def evaluate(
    *,
    authority_error: str | None,
    selected_count: int,
    verify: dict | None,
    internal_conflict: bool = False,
    coverage: dict | None = None,
    compare_unacknowledged: list[dict] | None = None,
    triage_review: bool = False,
    triage_reason: str | None = None,
    failed_stage: str | None = None,
    failed_message: str | None = None,
) -> Verdict:
    if failed_stage:
        return Verdict(
            Decision.HOLD,
            [f"The {failed_stage} check could not finish: {failed_message or 'upstream error'}. Nothing was published."],
            ["check_failed"],
        )

    if authority_error:
        return Verdict(Decision.HOLD, [authority_error], ["authority"])

    if selected_count == 0:
        return Verdict(
            Decision.HOLD,
            ["The governing document has no clause that answers this question. A reviewer must resolve the gap."],
            ["no_governing_clause"],
        )

    if internal_conflict:
        return Verdict(
            Decision.HOLD,
            ["Two clauses inside the governing document conflict. The policy itself must be fixed before an answer can ship."],
            ["internal_conflict"],
        )

    if verify is None:
        return Verdict(
            Decision.HOLD,
            ["Verify did not return a result. Nothing was published."],
            ["verification_missing"],
        )

    claims = [c for c in (verify.get("claims") or []) if _counted(c)]
    if not claims:
        return Verdict(
            Decision.HOLD,
            ["Verify returned no countable claims. Nothing was published."],
            ["no_claims"],
        )

    contradicted = [c for c in claims if (c.get("verdict") or "").lower() == "contradicted"]
    unsupported = [
        c
        for c in claims
        if (c.get("verdict") or "").lower() not in {"supported", "contradicted"}
    ]
    grounded = verify.get("grounded")

    if contradicted:
        return Verdict(
            Decision.REWRITE,
            [
                f"Verify contradicted {len(contradicted)} of {len(claims)} counted claims against the governing document.",
                "The contradicted claims are listed with the source passage that overrides them.",
            ],
            ["contradicted"],
        )

    if unsupported:
        return Verdict(
            Decision.REWRITE,
            [
                f"Verify could not find support for {len(unsupported)} of {len(claims)} counted claims.",
                "A statement the governing document does not establish is not safe to publish.",
            ],
            ["unsupported"],
        )

    if compare_unacknowledged:
        first = compare_unacknowledged[0]
        reasons = [
            "The draft repeats a value or rule from a superseded policy that the governing policy overrides.",
            f"Superseded text: \"{str(first.get('superseded_quote') or '')[:240]}\"",
            f"Governing text: \"{str(first.get('governing_quote') or '')[:240]}\"",
            "Replace the superseded value with the governing one before publishing.",
        ]
        if len(compare_unacknowledged) > 1:
            reasons.insert(0, f"Compare found {len(compare_unacknowledged)} unacknowledged superseded values in the draft.")
        return Verdict(Decision.REWRITE, reasons, ["superseded_value"])

    if coverage is not None:
        coverage_value = coverage.get("value")
        if coverage_value is True:
            missing = str(coverage.get("missing_conditions") or "").strip()
            reason = "The draft omits a material policy condition."
            if missing and missing.lower() not in {"none", "no material conditions omitted"}:
                reason = f"The draft omits a material policy condition: {missing[:300]}"
            return Verdict(
                Decision.REWRITE,
                [reason, "Add the missing condition or exception before publishing."],
                ["coverage_gap"],
            )
        if not isinstance(coverage_value, bool):
            return Verdict(
                Decision.HOLD,
                ["The coverage check returned no usable judgment. Nothing was published."],
                ["coverage_missing"],
            )

    if isinstance(grounded, bool) or not isinstance(grounded, (int, float)):
        return Verdict(
            Decision.HOLD,
            ["Verify did not return a usable support score. Nothing was published."],
            ["verification_missing"],
        )

    if not 0 <= grounded <= 1:
        return Verdict(
            Decision.HOLD,
            ["Verify returned a support score outside the valid range. Nothing was published."],
            ["verification_missing"],
        )

    if grounded < 0.5:
        return Verdict(
            Decision.REWRITE,
            [f"Overall support is {grounded:.0%}, below the 50% publish threshold."],
            ["low_support"],
        )

    if triage_review:
        return Verdict(
            Decision.HOLD,
            [
                triage_reason or "Decide routed this case to human review.",
                "A reviewer must confirm the answer before it is published.",
            ],
            ["triage_review"],
        )

    return Verdict(
        Decision.PUBLISH,
        [
            f"All {len(claims)} counted claims are supported by the governing document.",
            "No clause-level conflict changes the answer.",
        ],
        ["supported"],
    )


def split_claims(text: str, limit: int = 20) -> list[str]:
    """Split a draft into atomic sentences for Verify.

    Passing claims explicitly makes the claim table stable: the same draft
    produces the same rows on every run, instead of the model choosing its
    own sentence boundaries.
    """
    import re

    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [part.strip() for part in parts if len(part.strip()) > 3][:limit]
