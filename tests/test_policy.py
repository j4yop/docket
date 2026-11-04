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
