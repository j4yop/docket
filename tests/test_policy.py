from policy import Decision, evaluate


def claim(verdict, counted=True, kind="factual"):
    return {"claim": "x", "verdict": verdict, "counted": counted, "kind": kind}


def test_failed_check_holds():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify=None,
        failed_stage="verify",
        failed_message="timeout",
    )
    assert verdict.decision is Decision.HOLD
    assert verdict.codes == ["check_failed"]


def test_authority_error_holds():
    verdict = evaluate(authority_error="ambiguous", selected_count=0, verify=None)
    assert verdict.decision is Decision.HOLD
    assert verdict.codes == ["authority"]


def test_no_governing_clause_holds():
    verdict = evaluate(authority_error=None, selected_count=0, verify=None)
    assert verdict.decision is Decision.HOLD
    assert verdict.codes == ["no_governing_clause"]


def test_contradicted_claim_forces_rewrite():
    verdict = evaluate(
        authority_error=None,
        selected_count=2,
        verify={"grounded": 0.4, "claims": [claim("supported"), claim("contradicted")]},
    )
    assert verdict.decision is Decision.REWRITE
    assert verdict.codes == ["contradicted"]


def test_unsupported_claim_forces_rewrite():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={"grounded": 0.8, "claims": [claim("not_stated")]},
    )
    assert verdict.decision is Decision.REWRITE
    assert verdict.codes == ["unsupported"]


def test_all_supported_publishes():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={"grounded": 0.9, "claims": [claim("supported"), claim("supported")]},
    )
    assert verdict.decision is Decision.PUBLISH


def test_low_overall_support_forces_rewrite():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={"grounded": 0.3, "claims": [claim("supported")]},
    )
    assert verdict.decision is Decision.REWRITE
    assert verdict.codes == ["low_support"]


def test_non_claims_are_ignored():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={
            "grounded": 0.9,
            "claims": [claim("supported"), claim("contradicted", counted=False, kind="not_a_claim")],
        },
    )
    assert verdict.decision is Decision.PUBLISH


def test_internal_conflict_holds():
    verdict = evaluate(
        authority_error=None,
        selected_count=2,
        verify={"grounded": 0.9, "claims": [claim("supported")]},
        internal_conflict=True,
    )
    assert verdict.decision is Decision.HOLD
    assert verdict.codes == ["internal_conflict"]


def test_missing_verify_holds():
    verdict = evaluate(authority_error=None, selected_count=1, verify=None)
    assert verdict.decision is Decision.HOLD
    assert verdict.codes == ["verification_missing"]


def test_zero_claims_holds_even_with_high_score():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={"grounded": 1.0, "claims": []},
    )
    assert verdict.decision is Decision.HOLD
    assert verdict.codes == ["no_claims"]


def test_missing_grounded_score_holds():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={"claims": [claim("supported")]},
    )
    assert verdict.decision is Decision.HOLD
    assert verdict.codes == ["verification_missing"]


def test_unknown_claim_verdict_forces_rewrite():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={"grounded": 0.9, "claims": [claim("partial")]},
    )
    assert verdict.decision is Decision.REWRITE
    assert verdict.codes == ["unsupported"]


def test_coverage_gap_forces_rewrite():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={"grounded": 0.9, "claims": [claim("supported")]},
        coverage={
            "value": True,
            "obligations": ["Customer-facing employees must work on-site five days per week."],
            "missing_conditions": "Customer-facing employees must work on-site five days per week.",
        },
    )
    assert verdict.decision is Decision.REWRITE
    assert verdict.codes == ["coverage_gap"]


def test_missing_coverage_judgment_holds():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={"grounded": 0.9, "claims": [claim("supported")]},
        coverage={"value": None, "obligations": [], "missing_conditions": ""},
    )
    assert verdict.decision is Decision.HOLD
    assert verdict.codes == ["coverage_missing"]


def test_out_of_range_grounded_score_holds():
    for score in (1.5, -0.1):
        verdict = evaluate(
            authority_error=None,
            selected_count=1,
            verify={"grounded": score, "claims": [claim("supported")]},
        )
        assert verdict.decision is Decision.HOLD
        assert verdict.codes == ["verification_missing"]


def test_unacknowledged_superseded_value_forces_rewrite_even_when_verify_passes():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={"grounded": 0.95, "claims": [claim("supported")]},
        compare_unacknowledged=[
            {
                "kind": "value",
                "governing_quote": "Employees may claim up to EUR 60 per day.",
                "superseded_quote": "Employees may claim up to EUR 45 per day.",
                "used_values": ["45"],
            }
        ],
    )
    assert verdict.decision is Decision.REWRITE
    assert verdict.codes == ["superseded_value"]
    assert "EUR 45" in " ".join(verdict.reasons)
    assert "EUR 60" in " ".join(verdict.reasons)


def test_acknowledged_compare_conflict_does_not_block_publish():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={"grounded": 0.95, "claims": [claim("supported")]},
        compare_unacknowledged=[],
    )
    assert verdict.decision is Decision.PUBLISH


def test_triage_review_holds_a_clean_draft():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={"grounded": 0.95, "claims": [claim("supported")]},
        triage_review=True,
        triage_reason="Decide classified this as a high risk approval request.",
    )
    assert verdict.decision is Decision.HOLD
    assert verdict.codes == ["triage_review"]
    assert "high risk approval" in " ".join(verdict.reasons)


def test_triage_review_does_not_mask_a_contradiction():
    verdict = evaluate(
        authority_error=None,
        selected_count=1,
        verify={"grounded": 0.3, "claims": [claim("contradicted")]},
        triage_review=True,
    )
    assert verdict.decision is Decision.REWRITE
    assert verdict.codes == ["contradicted"]
