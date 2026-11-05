import db


def test_default_db_path_uses_tmp_on_vercel(monkeypatch) -> None:
    monkeypatch.delenv("DOCKET_DB", raising=False)
    monkeypatch.setenv("VERCEL", "1")
    assert db._default_db_path() == "/tmp/docket.db"


def test_default_db_path_stays_local_off_vercel(monkeypatch) -> None:
    monkeypatch.delenv("DOCKET_DB", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    assert db._default_db_path() == "./docket.db"


def test_explicit_db_path_wins(monkeypatch) -> None:
    monkeypatch.setenv("DOCKET_DB", "/var/data/docket.db")
    monkeypatch.setenv("VERCEL", "1")
    assert db._default_db_path() == "/var/data/docket.db"
