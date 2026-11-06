from fastapi.testclient import TestClient

from app import app


client = TestClient(app)


def test_homepage_serves_docket_marketing_site() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "Docket — The newest policy is often not the governing one." in response.text
    assert "/docket-hero.js" in response.text


def test_console_route_serves_the_gate() -> None:
    response = client.get("/console")
    assert response.status_code == 200
    assert 'id="docket-gate"' in response.text


def test_integrations_redirects_to_console() -> None:
    response = client.get("/integrations", follow_redirects=False)
    assert response.status_code == 302
    assert response.headers["location"] == "/console"


def test_next_image_route_serves_captured_variant() -> None:
    response = client.get(
        "/_next/image",
        params={"url": "/assets/home/hero-wave.webp", "w": "1920", "q": "75"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("image/")


def test_public_feature_flags_are_available() -> None:
    response = client.get("/v1/feature-flags/public")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")


def _check_payload() -> dict:
    return {
        "question": "Can I expense a monitor?",
        "draft": "Yes, with manager approval.",
        "country": "FR",
        "documents": [
            {
                "title": "Policy",
                "jurisdiction": "Global",
                "text": "A monitor can be expensed with manager approval.",
            }
        ],
    }


def test_session_endpoint_issues_a_token() -> None:
    response = client.get("/api/session")
    assert response.status_code == 200
    body = response.json()
    assert body["token"]
    assert body["expires_at"] > 0


def test_check_requires_a_session_or_api_token() -> None:
    response = client.post("/api/check", json=_check_payload())
    assert response.status_code == 401


def test_check_rejects_an_invalid_session() -> None:
    response = client.post(
        "/api/check",
        json=_check_payload(),
        headers={"X-Docket-Session": "not-a-valid-token"},
    )
    assert response.status_code == 401


def _session_headers() -> dict:
    token = client.get("/api/session").json()["token"]
    return {"X-Docket-Session": token}


def test_ablate_requires_a_session() -> None:
    response = client.post("/api/ablate", json={**_check_payload(), "endpoint": "guard"})
    assert response.status_code == 401


def test_ablate_rejects_an_unknown_endpoint() -> None:
    response = client.post(
        "/api/ablate",
        json={**_check_payload(), "endpoint": "authority"},
        headers=_session_headers(),
    )
    assert response.status_code == 400


def test_ablate_skips_the_endpoint_without_recording(monkeypatch) -> None:
    import importlib

    module = importlib.import_module("app")
    seen = {}

    async def fake_run_check(req, emit=None, ablate=None, record=True):
        seen["ablate"] = ablate
        seen["record"] = record
        return {
            "decision": "publish",
            "reasons": [],
            "codes": [],
            "credits": 0,
            "api_calls": 0,
            "latency_ms": 0,
            "headline": "",
            "recorded": record,
            "simulation": not record,
        }

    monkeypatch.setattr(module, "run_check", fake_run_check)
    response = client.post(
        "/api/ablate",
        json={**_check_payload(), "endpoint": "guard"},
        headers=_session_headers(),
    )
    assert response.status_code == 200
    assert seen == {"ablate": {"guard"}, "record": False}
    body = response.json()
    assert body["simulation"] is True
    assert body["ablation"]["endpoint"] == "guard"
    assert "not written to the audit ledger" in body["ablation"]["note"]


def test_prove_requires_a_session() -> None:
    response = client.post("/api/prove", json={**_check_payload(), "endpoint": "guard"})
    assert response.status_code == 401


def test_prove_rejects_an_unknown_endpoint() -> None:
    response = client.post(
        "/api/prove",
        json={**_check_payload(), "endpoint": "authority"},
        headers=_session_headers(),
    )
    assert response.status_code == 400


def test_prove_runs_a_baseline_and_one_counterfactual(monkeypatch) -> None:
    import importlib

    module = importlib.import_module("app")
    seen = []

    async def fake_run_check(req, emit=None, ablate=None, record=True):
        seen.append({"ablate": ablate, "record": record})
        ablated = bool(ablate)
        return {
            "decision": "hold" if ablated else "publish",
            "reasons": ["proof"],
            "codes": [],
            "credits": 0,
            "api_calls": 0,
            "latency_ms": 0,
            "headline": "",
            "authority": {"governing": {"title": "Policy"}},
            "guard": None if ablated else {"verdict": "injection"},
        }

    monkeypatch.setattr(module, "run_check", fake_run_check)
    response = client.post(
        "/api/prove",
        json={**_check_payload(), "endpoint": "guard"},
        headers=_session_headers(),
    )
    assert response.status_code == 200
    assert len(seen) == 2
    assert {item["record"] for item in seen} == {False}
    assert {str(item["ablate"]) for item in seen} == {"None", "{'guard'}"}
    body = response.json()
    assert body["mode"] == "ablate"
    assert body["baseline"]["decision"] == "publish"
    assert body["ablated"]["decision"] == "hold"
    assert body["baseline"]["signal"]["label"] == "Injection detected"
    assert body["ablated"]["signal"]["label"] == "No injection gate"


def test_prove_ablates_protect(monkeypatch) -> None:
    import importlib

    module = importlib.import_module("app")
    seen = []

    async def fake_run_check(req, emit=None, ablate=None, record=True):
        seen.append({"ablate": ablate, "record": record})
        return {
            "decision": "rewrite",
            "reasons": ["proof"],
            "codes": [],
            "credits": 0,
            "api_calls": 0,
            "latency_ms": 0,
            "headline": "",
            "authority": {"governing": {"title": "Policy"}},
            "protect": None if ablate else {"entity_count": 2},
        }

    monkeypatch.setattr(module, "run_check", fake_run_check)
    response = client.post(
        "/api/prove",
        json={**_check_payload(), "endpoint": "protect"},
        headers=_session_headers(),
    )
    assert response.status_code == 200
    assert len(seen) == 2
    assert {item["record"] for item in seen} == {False}
    assert {str(item["ablate"]) for item in seen} == {"None", "{'protect'}"}
    body = response.json()
    assert body["mode"] == "ablate"
    assert body["baseline"]["signal"]["label"] == "2 PII entities redacted"
    assert body["ablated"]["signal"]["label"] == "No redaction"


def test_console_includes_the_necessity_proof_table() -> None:
    response = client.get("/console")
    assert response.status_code == 200
    assert 'id="gate-necessity"' in response.text
    assert "Endpoint contribution" in response.text


def test_check_holds_when_the_policy_registry_fails(monkeypatch) -> None:
    import importlib

    module = importlib.import_module("app")

    async def boom(*args, **kwargs):
        raise RuntimeError("blob unavailable")

    async def fake_append(payload, *, question, draft):
        return {
            "seq": 1,
            "record_hash": "a" * 64,
            "prev_hash": "0" * 64,
        }

    monkeypatch.setattr(module.policy_registry, "resolve", boom)
    monkeypatch.setattr(module.ledger, "append", fake_append)
    response = client.post(
        "/api/check",
        json=_check_payload(),
        headers=_session_headers(),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["decision"] == "hold"
    assert body["codes"] == ["check_failed"]
    assert "policy registry could not be read" in body["reasons"][0]


def test_console_exposes_the_pipeline_features() -> None:
    response = client.get("/console")
    assert response.status_code == 200
    for fragment in (
        'id="gate-trace"',
        'id="gate-technical-details"',
        'id="gate-ablate-endpoint"',
        'id="gate-policies-block"',
        'id="gate-audit-note"',
    ):
        assert fragment in response.text


def test_ledger_page_serves_the_public_ledger() -> None:
    response = client.get("/ledger")
    assert response.status_code == 200
    assert "The audit ledger." in response.text


def test_ledger_api_returns_the_verified_chain(monkeypatch) -> None:
    import importlib

    module = importlib.import_module("app")

    async def fake_verify():
        return {
            "ok": True,
            "records": 2,
            "broken_at": None,
            "detail": "The chain is intact.",
            "head": {"seq": 2, "hash": "a" * 64, "updated_at": "2026-11-05T12:00:00+00:00"},
            "storage": "local",
        }

    async def fake_recent(limit=12):
        return []

    monkeypatch.setattr(module.ledger, "verify", fake_verify)
    monkeypatch.setattr(module.ledger, "recent", fake_recent)
    response = client.get("/api/ledger")
    assert response.status_code == 200
    body = response.json()
    assert body["ledger"]["ok"] is True
    assert body["ledger"]["records"] == 2
    assert body["records"] == []


def test_tour_route_is_additive() -> None:
    response = client.get("/tour")
    assert response.status_code == 200
    assert "The judge tour" in response.text
    assert "/tour.js" in response.text
    assert 'class="gate-page-bg"' in response.text
    assert "dk-console-footer" in response.text
    assert "/docket-footer.js" in response.text
    assert 'id="docket-gate"' in response.text


def test_console_exposes_health_approval_and_review_queue() -> None:
    response = client.get("/console")
    assert response.status_code == 200
    for fragment in (
        'id="gate-approve-policy"',
        'id="gate-admin-token"',
        'id="gate-review-load"',
        'id="gate-review-list"',
        'id="gate-health-ledger"',
        'id="gate-operations"',
    ):
        assert fragment in response.text


def test_health_verifies_the_ledger_and_policy_corpus(monkeypatch) -> None:
    import importlib

    module = importlib.import_module("app")

    async def fake_verify():
        return {
            "ok": True,
            "records": 5,
            "checks": 4,
            "events": 1,
            "broken_at": None,
            "detail": "The chain is intact.",
            "head": {"seq": 5, "hash": "a" * 64, "updated_at": "2026-11-05T12:00:00+00:00"},
            "storage": "local",
        }

    async def fake_seed_status(samples):
        return {
            "ok": True,
            "count": 12,
            "registered": 12,
            "seed_id": "seed",
            "expected_seed_id": "seed",
            "seeded_at": "2026-11-05T12:00:00+00:00",
            "missing": [],
            "invalid": [],
        }

    monkeypatch.setattr(module.ledger, "verify", fake_verify)
    monkeypatch.setattr(module.policy_registry, "seed_status", fake_seed_status)
    monkeypatch.setenv("CLOCKED_API_KEY", "test-key")
    module._HEALTH_CACHE["at"] = 0.0
    module._HEALTH_CACHE["payload"] = None
    response = client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["ok"] is True
    assert body["ledger"]["records"] == 5
    assert body["policy_registry"]["registered"] == 12
    assert body["last_verified_at"]


def test_health_reports_a_broken_chain(monkeypatch) -> None:
    import importlib

    module = importlib.import_module("app")

    async def fake_verify():
        return {
            "ok": False,
            "records": 2,
            "checks": 2,
            "events": 0,
            "broken_at": 2,
            "detail": "A record does not link to the previous hash.",
            "head": {"seq": 2, "hash": "b" * 64, "updated_at": None},
            "storage": "local",
        }

    async def fake_seed_status(samples):
        return {"ok": True, "count": 1, "registered": 1, "missing": [], "invalid": []}

    monkeypatch.setattr(module.ledger, "verify", fake_verify)
    monkeypatch.setattr(module.policy_registry, "seed_status", fake_seed_status)
    monkeypatch.setenv("CLOCKED_API_KEY", "test-key")
    module._HEALTH_CACHE["at"] = 0.0
    module._HEALTH_CACHE["payload"] = None
    body = client.get("/api/health").json()
    assert body["ok"] is False
    assert body["ledger"]["broken_at"] == 2


def test_review_api_lists_assigns_and_resolves(monkeypatch, tmp_path) -> None:
    import asyncio
    import importlib

    import reviews
    import storage

    module = importlib.import_module("app")
    monkeypatch.setattr(storage, "LOCAL_DIR", tmp_path)
    monkeypatch.setenv("DOCKET_ADMIN_TOKEN", "test-admin")

    review = asyncio.run(
        reviews.create(
            {
                "decision": "hold",
                "codes": ["prompt_injection"],
                "question": "Is this answer safe?",
                "draft": "Draft.",
                "reasons": ["Guard found an instruction."],
                "checked_at": "2026-11-05T12:00:00+00:00",
                "audit": {"seq": 3, "hash": "c" * 64},
            }
        )
    )

    async def fake_event(event):
        return {
            "seq": 9,
            "record_hash": "d" * 64,
            "prev_hash": "c" * 64,
        }

    monkeypatch.setattr(module.ledger, "append_event", fake_event)
    headers = {"X-Docket-Admin": "test-admin"}

    listing = client.get("/api/reviews?status=open", headers=headers)
    assert listing.status_code == 200
    assert listing.json()["reviews"][0]["id"] == review["id"]
    assert "capability" not in listing.json()["reviews"][0]
    assert listing.json()["counts"]["open"] == 1

    assigned = client.post(
        f"/api/reviews/{review['id']}/assign",
        json={"assignee": "reviewer@example.com"},
        headers=headers,
    )
    assert assigned.status_code == 200
    assert assigned.json()["review"]["status"] == "assigned"

    resolved = client.post(
        f"/api/reviews/{review['id']}/resolve",
        json={
            "action": "reject",
            "note": "Remove the injected instruction and resubmit.",
            "resolved_by": "reviewer@example.com",
        },
        headers=headers,
    )
    assert resolved.status_code == 200
    body = resolved.json()
    assert body["review"]["status"] == "resolved"
    assert body["review"]["resolution"]["ledger"]["seq"] == 9
    assert body["audit"]["seq"] == 9

    assert client.get("/api/reviews", headers={"X-Docket-Admin": "wrong"}).status_code == 404


def test_review_capability_resolves_only_its_own_review(monkeypatch, tmp_path) -> None:
    import asyncio
    import importlib

    import reviews
    import storage

    module = importlib.import_module("app")
    monkeypatch.setattr(storage, "LOCAL_DIR", tmp_path)
    monkeypatch.delenv("DOCKET_ADMIN_TOKEN", raising=False)

    def make_review(question: str):
        return asyncio.run(
            reviews.create(
                {
                    "decision": "rewrite",
                    "codes": ["contradicted"],
                    "question": question,
                    "draft": "Draft.",
                    "reasons": ["A claim is contradicted."],
                    "checked_at": "2026-11-06T12:00:00+00:00",
                    "audit": {"seq": 4, "hash": "e" * 64},
                }
            )
        )

    first = make_review("First review")
    second = make_review("Second review")
    assert first["capability"]

    async def fake_event(event):
        return {"seq": 11, "record_hash": "f" * 64, "prev_hash": "e" * 64}

    monkeypatch.setattr(module.ledger, "append_event", fake_event)
    headers = {"X-Docket-Review": first["capability"]}

    assigned = client.post(
        f"/api/reviews/{first['id']}/assign",
        json={"assignee": "demo-reviewer"},
        headers=headers,
    )
    assert assigned.status_code == 200
    assert assigned.json()["review"]["status"] == "assigned"

    resolved = client.post(
        f"/api/reviews/{first['id']}/resolve",
        json={
            "action": "reject",
            "note": "Send this back to the author.",
            "resolved_by": "demo-reviewer",
        },
        headers=headers,
    )
    assert resolved.status_code == 200
    assert resolved.json()["review"]["status"] == "resolved"

    crossed = client.post(
        f"/api/reviews/{second['id']}/resolve",
        json={
            "action": "reject",
            "note": "This capability belongs to another review.",
            "resolved_by": "demo-reviewer",
        },
        headers=headers,
    )
    assert crossed.status_code == 404


def test_brand_nav_includes_the_judge_tour() -> None:
    response = client.get("/docket-brand.js")
    assert response.status_code == 200
    assert "Judge Tour" in response.text
    assert '"/tour"' in response.text
    assert "makeTourTab" in response.text
    assert "dk-tour-tab" in response.text
    assert "267.5px" in response.text


def test_tour_page_has_no_fixture_or_benchmark_copy() -> None:
    response = client.get("/tour")
    assert response.status_code == 200
    text = response.text.lower()
    assert "expected" not in text
    assert "fixture" not in text
    assert "benchmark" not in text
    assert 'class="tour-actions"' in response.text
