from types import SimpleNamespace

import app


def doc(**overrides):
    values = {
        "title": "European procurement annex",
        "jurisdiction": "EU",
        "effective_date": "2026-03-01",
        "expires_date": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def extracted(**fields):
    return {
        "fields": {
            name: {"value": value}
            for name, value in fields.items()
        }
    }


def test_title_returned_as_jurisdiction_is_not_a_conflict():
    conflicts = app._metadata_conflicts(
        doc(),
        extracted(
            jurisdiction="EUROPEAN PROCUREMENT ANNEX",
            effective_date="2026-03-01",
            expiry_date="2026-03-01",
        ),
    )
    assert conflicts == []


def test_effective_date_copied_into_expiry_is_not_a_conflict():
    conflicts = app._metadata_conflicts(
        doc(title="Security policy", jurisdiction="Global", effective_date="2026-01-01"),
        extracted(
            jurisdiction="GLOBAL",
            effective_date="2026-01-01",
            expiry_date="2026-01-01",
        ),
    )
    assert conflicts == []


def test_a_real_expiry_conflict_is_still_reported():
    conflicts = app._metadata_conflicts(
        doc(expires_date="2026-06-01"),
        extracted(
            jurisdiction="EU",
            effective_date="2026-03-01",
            expiry_date="2026-12-01",
        ),
    )
    assert any("expiry date" in conflict for conflict in conflicts)
