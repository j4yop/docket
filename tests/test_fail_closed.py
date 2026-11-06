import asyncio

import app
import policy_registry
import storage
from clocked_client import ClockedClient, ClockedError


def test_all_clocked_endpoints_failing_holds_never_publishes(monkeypatch, tmp_path):
    monkeypatch.setattr(storage, "LOCAL_DIR", tmp_path)
    monkeypatch.setenv("CLOCKED_API_KEY", "test-key")

    text = (
        "Travel policy — effective 1 January 2026.\n\n"
        "Hotel stays are reimbursed up to EUR 180 per night. Receipts are required for all hotel claims."
    )
    envelope = policy_registry.build_envelope(
        text=text,
        title="Travel policy",
        policy_id=None,
        version=None,
        jurisdiction="Global",
        effective_date="2026-01-01",
        expiry_date=None,
        precedence=0,
        approved_by="Test admin",
        approval_type="admin",
    )
    request = app.CheckRequest(
        question="What is the hotel limit?",
        draft="Hotel stays are reimbursed up to EUR 180 per night. Receipts are required for all hotel claims.",
        country="Global",
        documents=[
            app.DocumentIn(
                title="Travel policy",
                text=text,
                jurisdiction="Global",
                effective_date="2026-01-01",
                policy_envelope=envelope,
            )
        ],
    )

    async def fail(*args, **kwargs):
        raise ClockedError("Clocked is unavailable")

    for name in ("protect", "guard", "inspect", "extract", "decide", "rerank", "compare", "fill", "verify"):
        monkeypatch.setattr(ClockedClient, name, fail)

    payload = asyncio.run(app.run_check(request, record=False))
    assert payload["decision"] == "hold"
    assert "publish" not in (payload.get("codes") or [])
    assert payload.get("api_calls") == 0
