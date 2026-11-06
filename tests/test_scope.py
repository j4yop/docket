"""Scope determinations must stay narrow and visible.

The deterministic applicability path exists for one narrow case: a yes/no
question about whether one named policy applies, answered with a single
negative applicability statement. Anything substantive must go through the
normal Verify path.
"""

from types import SimpleNamespace

from app import _scope_determination
from samples import SAMPLES


def _authority():
    return SimpleNamespace(
        trace=[
            {"title": "France travel policy", "jurisdiction": "FR", "outcome": "governing"},
            {"title": "Germany travel annex", "jurisdiction": "DE", "outcome": "out of scope"},
        ]
    )


def _request(draft: str, question: str = "Does the Germany travel annex apply to an employee in France?"):
    return SimpleNamespace(
        question=question,
        draft=draft,
        country="FR",
    )


def test_negative_applicability_statement_resolves_scope() -> None:
    result = _scope_determination(
        _request("The Germany travel annex does not apply to employees in France."),
        _authority(),
    )
    assert result is not None
    assert result["document"] == "Germany travel annex"
    assert result["jurisdiction"] == "DE"
    assert result["country"] == "FR"
    assert result["determination"] == "out_of_scope"
    assert "authority trace" in result["reason"]


def test_extra_substantive_claim_is_not_a_scope_bypass() -> None:
    result = _scope_determination(
        _request(
            "The Germany travel annex does not apply to employees in France. "
            "Travel requires director approval."
        ),
        _authority(),
    )
    assert result is None


def test_numeric_or_positive_claims_are_not_scope_determinations() -> None:
    assert _scope_determination(
        _request("The Germany travel annex does not apply to employees in France within 30 days."),
        _authority(),
    ) is None
    assert _scope_determination(
        _request("The Germany travel annex requires director approval in France."),
        _authority(),
    ) is None


def test_scope_requires_an_applicability_question_and_one_out_of_scope_policy() -> None:
    assert _scope_determination(
        _request("The Germany travel annex does not apply.", question="What is the hotel limit?"),
        _authority(),
    ) is None

    ambiguous = SimpleNamespace(
        trace=[
            {"title": "Germany travel annex", "jurisdiction": "DE", "outcome": "out of scope"},
            {"title": "Austria travel annex", "jurisdiction": "AT", "outcome": "out of scope"},
        ]
    )
    assert _scope_determination(
        _request("The Germany travel annex does not apply to employees in France."),
        ambiguous,
    ) is None


def test_unapproved_policy_sample_is_not_part_of_the_seed_corpus() -> None:
    sample = next(item for item in SAMPLES if item["id"] == "unapproved-policy")
    assert sample["seed"] is False
    assert sample["documents"]
    assert all("policy_envelope" not in document for document in sample["documents"])
