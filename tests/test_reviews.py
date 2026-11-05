import asyncio

import reviews
import storage


def use_temp_store(monkeypatch, tmp_path):
    monkeypatch.setattr(storage, "LOCAL_DIR", tmp_path)


def payload(decision="hold"):
    return {
        "decision": decision,
        "codes": ["prompt_injection"],
        "question": "Is this policy safe to publish?",
        "draft": "A draft answer.",
        "reasons": ["Guard found an instruction."],
        "checked_at": "2026-11-05T12:00:00+00:00",
        "audit": {"seq": 7, "hash": "a" * 64, "checked_at": "2026-11-05T12:00:00+00:00"},
    }


def test_review_survives_a_restart_and_can_be_resolved(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    created = asyncio.run(reviews.create(payload()))
    assert created["status"] == "open"
    assert created["check"]["seq"] == 7

    # A new event loop reads the record from storage, not process memory.
    loaded = asyncio.run(reviews.list_records(status="open"))
    assert [record["id"] for record in loaded] == [created["id"]]

    assigned = asyncio.run(reviews.assign(created["id"], "reviewer@example.com"))
    assert assigned["status"] == "assigned"
    assert assigned["assigned_to"] == "reviewer@example.com"

    resolved = asyncio.run(
        reviews.resolve(
            created["id"],
            action="reject",
            note="The injected instruction must be removed before publication.",
            resolved_by="reviewer@example.com",
            audit_event={"seq": 8, "hash": "b" * 64},
        )
    )
    assert resolved["status"] == "resolved"
    assert resolved["resolution"]["action"] == "reject"
    assert resolved["resolution"]["ledger"]["seq"] == 8
    assert resolved["history"][-1]["action"] == "resolved:reject"


def test_open_and_rewrite_share_the_queue_but_publish_does_not(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    asyncio.run(reviews.create(payload("hold")))
    asyncio.run(reviews.create(payload("rewrite")))
    try:
        asyncio.run(reviews.create(payload("publish")))
    except ValueError:
        pass
    else:
        raise AssertionError("publish must not open a review")
    records = asyncio.run(reviews.list_records(limit=50))
    assert {record["decision"] for record in records} == {"hold", "rewrite"}


def test_resolution_requires_a_note_and_a_valid_action(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    created = asyncio.run(reviews.create(payload()))
    for action, note in (("approve", ""), ("publish", "A valid note")):
        try:
            asyncio.run(
                reviews.resolve(
                    created["id"],
                    action=action,
                    note=note,
                    resolved_by="admin",
                )
            )
        except ValueError:
            continue
        raise AssertionError(f"{action!r}/{note!r} should not resolve")


def test_review_ids_are_validated(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    assert asyncio.run(reviews.get("../../etc/passwd")) is None
    assert asyncio.run(reviews.get("RV-../../etc/passwd")) is None
