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
