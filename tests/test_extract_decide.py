from app import _compare_unacknowledged, _metadata_conflicts
from authority import Document


def doc(**overrides):
    values = {
        "id": "doc1",
        "title": "Travel policy",
        "text": "x" * 40,
        "jurisdiction": "FR",
        "effective_date": "2025-03-01",
        "expires_date": None,
        "precedence": 0,
    }
    values.update(overrides)
    return Document(**values)


def field(value, start=0, end=4):
    return {"value": value, "start": start, "end": end, "confidence": 0.9}


def extracted(**values):
    return {"fields": {name: field(value) for name, value in values.items()}}


def test_matching_metadata_produces_no_conflict():
    assert _metadata_conflicts(doc(), extracted(effective_date="2025-03-01", jurisdiction="France")) == []


def test_effective_date_conflict_is_reported():
    conflicts = _metadata_conflicts(doc(), extracted(effective_date="2025-04-01"))
    assert len(conflicts) == 1
    assert "2025-03-01" in conflicts[0]
    assert "2025-04-01" in conflicts[0]


def test_expiry_date_conflict_is_reported():
    conflicts = _metadata_conflicts(
        doc(expires_date="2026-01-01"), extracted(expiry_date="2025-12-31")
    )
    assert len(conflicts) == 1
    assert "expiry" in conflicts[0]


def test_jurisdiction_conflict_is_reported():
    conflicts = _metadata_conflicts(doc(), extracted(jurisdiction="Germany"))
    assert len(conflicts) == 1
    assert "DE" in conflicts[0]


def test_global_metadata_is_treated_as_unspecified():
    assert _metadata_conflicts(doc(jurisdiction="Global"), extracted(jurisdiction="France")) == []


def test_missing_extracted_values_do_not_conflict():
    assert _metadata_conflicts(doc(), {"fields": {}}) == []


def compare_payload(a_quote, b_quote):
    return {
        "pairs": [
            {
                "a": "doc1-c1",
                "b": "doc2-c1",
                "relation": "conflicting",
                "conflicts": [
                    {
                        "kind": "value",
                        "a": {"document": "doc1-c1", "quote": a_quote},
                        "b": {"document": "doc2-c1", "quote": b_quote},
                    }
                ],
            }
        ]
    }


def test_compare_flags_a_superseded_number_used_in_the_draft():
    found = _compare_unacknowledged(
        compare_payload(
            "Employees may claim up to EUR 60 per day.",
            "Employees may claim up to EUR 45 per day.",
        ),
        "You can claim up to EUR 45 per day.",
        "doc1",
    )
    assert len(found) == 1
    assert found[0]["used_values"] == ["45"]


def test_compare_ignores_the_governing_number():
    found = _compare_unacknowledged(
        compare_payload(
            "Employees may claim up to EUR 60 per day.",
            "Employees may claim up to EUR 45 per day.",
        ),
        "You can claim up to EUR 60 per day.",
        "doc1",
    )
    assert found == []


def test_compare_ignores_numbers_outside_the_conflict():
    found = _compare_unacknowledged(
        compare_payload(
            "Employees may claim up to EUR 60 per day.",
            "Employees may claim up to EUR 45 per day.",
        ),
        "Submit the claim within 30 days.",
        "doc1",
    )
    assert found == []
