import asyncio
from types import SimpleNamespace

import policy_registry
import storage
from authority import Document


def make_doc(**overrides):
    values = {
        "id": "doc1",
        "title": "Travel policy",
        "text": "Travel policy.\n\nHotels are reimbursed up to EUR 180 per night.",
        "jurisdiction": "FR",
        "effective_date": "2026-02-01",
        "expires_date": None,
        "precedence": 1,
    }
    values.update(overrides)
    return Document(**values)


def make_in(**overrides):
    values = {
        "policy_id": "TRV-FR-01",
        "version": "1.0",
        "approved_by": None,
        "approval_reference": None,
        "policy_envelope": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def use_temp_store(monkeypatch, tmp_path):
    monkeypatch.setattr(storage, "LOCAL_DIR", tmp_path)
    monkeypatch.setenv("DOCKET_POLICY_SECRET", "test-policy-secret")
    policy_registry._CACHE.clear()


def test_hash_is_stable_across_line_endings():
    one = "Policy.\r\n\r\nLimit is EUR 180.\r\n"
    two = "Policy.\n\nLimit is EUR 180.\n"
    assert policy_registry.content_hash(one) == policy_registry.content_hash(two)


def test_hash_changes_when_a_value_changes():
    assert policy_registry.content_hash("limit 180") != policy_registry.content_hash("limit 240")


def test_envelope_signature_round_trip():
    envelope = policy_registry.build_envelope(
        text="Policy text.",
        title="Policy",
        policy_id="P-1",
        version="1",
        jurisdiction="FR",
        effective_date="2026-01-01",
        expiry_date=None,
        precedence=0,
        approved_by="Approver",
        approval_type="admin",
    )
    signature = envelope.pop("signature")
    assert policy_registry.verify(envelope, signature)
    envelope["title"] = "Changed"
    assert not policy_registry.verify(envelope, signature)


def test_seeded_envelope_is_found_by_hash(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    doc = make_doc()
    envelope = policy_registry.build_envelope(
        text=doc.text,
        title=doc.title,
        policy_id="TRV-FR-01",
        version="1.0",
        jurisdiction="FR",
        effective_date="2026-02-01",
        expiry_date=None,
        precedence=1,
        approved_by="Docket sample corpus",
        approval_type="seeded",
    )
    asyncio.run(
        storage.put_json(
            f"policies/{envelope['content_hash']}.json", envelope, allow_overwrite=True
        )
    )
    envelopes, failures = asyncio.run(policy_registry.resolve([make_in()], [doc]))
    assert failures == []
    assert envelopes[0]["approval_type"] == "seeded"
    assert envelopes[0]["content_hash"] == envelope["content_hash"]


def test_unapproved_policy_is_blocked(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    doc = make_doc()
    envelopes, failures = asyncio.run(policy_registry.resolve([make_in()], [doc]))
    assert envelopes == []
    assert failures[0]["code"] == "policy_unapproved"


def test_operator_attestation_is_scoped_and_signed(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    doc = make_doc()
    envelopes, failures = asyncio.run(
        policy_registry.resolve(
            [make_in(approved_by="Jay", approval_reference="DEMO-1")], [doc]
        )
    )
    assert failures == []
    assert envelopes[0]["approval_type"] == "operator"
    assert envelopes[0]["approved_by"] == "Jay · DEMO-1"
    signature = envelopes[0].pop("signature")
    assert policy_registry.verify(envelopes[0], signature)


def test_supplied_envelope_detects_tampered_text(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    doc = make_doc()
    original = make_doc()
    envelope = policy_registry.build_envelope(
        text=original.text,
        title=original.title,
        policy_id="TRV-FR-01",
        version="1.0",
        jurisdiction="FR",
        effective_date="2026-02-01",
        expiry_date=None,
        precedence=1,
        approved_by="Admin",
        approval_type="admin",
    )
    tampered = make_doc(text=original.text.replace("180", "240"))
    envelopes, failures = asyncio.run(
        policy_registry.resolve([make_in(policy_envelope=envelope)], [tampered])
    )
    assert envelopes == []
    assert failures[0]["code"] == "policy_tampered"


def test_supplied_envelope_with_invalid_signature_is_blocked(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    doc = make_doc()
    envelope = policy_registry.build_envelope(
        text=doc.text,
        title=doc.title,
        policy_id="TRV-FR-01",
        version="1.0",
        jurisdiction="FR",
        effective_date="2026-02-01",
        expiry_date=None,
        precedence=1,
        approved_by="Admin",
        approval_type="admin",
    )
    envelope["approved_by"] = "Someone else"
    envelopes, failures = asyncio.run(
        policy_registry.resolve([make_in(policy_envelope=envelope)], [doc])
    )
    assert envelopes == []
    assert failures[0]["code"] == "policy_tampered"


def test_seed_status_verifies_every_signed_policy(monkeypatch, tmp_path):
    import asyncio

    import policy_registry
    import storage

    monkeypatch.setattr(storage, "LOCAL_DIR", tmp_path)
    monkeypatch.setattr(policy_registry, "_CACHE", {})
    samples = [
        {
            "documents": [
                {
                    "title": "Travel policy",
                    "text": "Travel policy — effective 1 January 2026.\n\nHotel stays are reimbursed up to EUR 180 per night.",
                    "jurisdiction": "Global",
                    "effective_date": "2026-01-01",
                    "precedence": 0,
                },
                {
                    "title": "Security policy",
                    "text": "Security policy — effective 1 January 2026.\n\nPasswords must be at least 14 characters.",
                    "jurisdiction": "Global",
                    "effective_date": "2026-01-01",
                    "precedence": 0,
                },
            ]
        }
    ]
    asyncio.run(policy_registry.seed_samples(samples))
    status = asyncio.run(policy_registry.seed_status(samples))
    assert status["ok"] is True
    assert status["registered"] == 2

    digest = policy_registry.content_hash(samples[0]["documents"][0]["text"])
    path = tmp_path / "policies" / f"{digest}.json"
    envelope = __import__("json").loads(path.read_text())
    envelope["title"] = "Tampered title"
    path.write_text(__import__("json").dumps(envelope))
    monkeypatch.setattr(policy_registry, "_CACHE", {})
    status = asyncio.run(policy_registry.seed_status(samples))
    assert status["ok"] is False
    assert status["invalid"] == ["Travel policy"]


def test_stale_seed_marker_does_not_fail_a_valid_corpus(monkeypatch, tmp_path):
    import asyncio
    import json

    import policy_registry
    import storage

    monkeypatch.setattr(storage, "LOCAL_DIR", tmp_path)
    monkeypatch.setattr(policy_registry, "_CACHE", {})
    samples = [
        {
            "documents": [
                {
                    "title": "Travel policy",
                    "text": "Travel policy — effective 1 January 2026.\n\nHotel stays are reimbursed up to EUR 180 per night.",
                    "jurisdiction": "Global",
                    "effective_date": "2026-01-01",
                    "precedence": 0,
                }
            ]
        }
    ]
    asyncio.run(policy_registry.seed_samples(samples))
    marker = asyncio.run(storage.get_json(policy_registry.SEED_PATH))
    marker["seed_id"] = "stale-marker"
    asyncio.run(storage.put_json(policy_registry.SEED_PATH, marker, allow_overwrite=True))
    monkeypatch.setattr(policy_registry, "_CACHE", {})

    status = asyncio.run(policy_registry.seed_status(samples))
    assert status["ok"] is True
    assert status["seed_current"] is False
    assert status["registered"] == 1

    written = asyncio.run(policy_registry.seed_samples(samples))
    assert written == 0
    repaired = asyncio.run(policy_registry.seed_status(samples))
    assert repaired["ok"] is True
    assert repaired["seed_current"] is True
