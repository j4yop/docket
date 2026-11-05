import asyncio
import json

import ledger
import storage


def payload(decision="publish", credits=10, seq_reason="ok"):
    return {
        "checked_at": "2026-11-05T12:00:00+00:00",
        "decision": decision,
        "codes": ["supported"],
        "authority": {
            "governing": {
                "id": "doc1",
                "title": "Travel policy",
                "jurisdiction": "FR",
                "effective_date": "2026-02-01",
            }
        },
        "credits": credits,
        "api_calls": 7,
        "latency_ms": 1200,
        "reasons": [seq_reason],
        "policy_envelopes": [],
    }


def use_temp_store(monkeypatch, tmp_path):
    monkeypatch.setattr(storage, "LOCAL_DIR", tmp_path)


def test_chain_links_and_verifies(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    first = asyncio.run(ledger.append(payload(), question="q1", draft="d1"))
    second = asyncio.run(ledger.append(payload(decision="hold"), question="q2", draft="d2"))
    assert first["seq"] == 1
    assert second["seq"] == 2
    assert second["prev_hash"] == first["record_hash"]
    state = asyncio.run(ledger.verify())
    assert state["ok"] is True
    assert state["records"] == 2
    assert state["head"]["hash"] == second["record_hash"]


def test_editing_a_record_breaks_verification(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    asyncio.run(ledger.append(payload(), question="q1", draft="d1"))
    path = next((tmp_path / "audit").rglob("*.json"))
    record = json.loads(path.read_text())
    record["decision"] = "publish" if record["decision"] != "publish" else "hold"
    path.write_text(json.dumps(record, sort_keys=True, separators=(",", ":")))
    state = asyncio.run(ledger.verify())
    assert state["ok"] is False
    assert state["broken_at"] == 1


def test_deleting_the_last_record_breaks_the_head(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    asyncio.run(ledger.append(payload(), question="q1", draft="d1"))
    second = asyncio.run(ledger.append(payload(), question="q2", draft="d2"))
    path = next(
        candidate
        for candidate in (tmp_path / "audit").rglob("*.json")
        if json.loads(candidate.read_text())["seq"] == second["seq"]
    )
    path.unlink()
    state = asyncio.run(ledger.verify())
    assert state["ok"] is False
    assert state["broken_at"] == second["seq"]


def test_head_records_the_latest_hash(monkeypatch, tmp_path):
    use_temp_store(monkeypatch, tmp_path)
    record = asyncio.run(ledger.append(payload(), question="q1", draft="d1"))
    head = asyncio.run(ledger.head())
    assert head["seq"] == 1
    assert head["hash"] == record["record_hash"]
