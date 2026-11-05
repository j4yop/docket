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
