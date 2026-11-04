"""Audit log. Stores decisions and previews, never full policy documents."""

from __future__ import annotations

import json
import os
import sqlite3
import threading
from datetime import datetime, timezone

DB_PATH = os.environ.get("DOCKET_DB", "./docket.db")
_lock = threading.Lock()


def _connect() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH, timeout=5)
    connection.row_factory = sqlite3.Row
    return connection


def init() -> None:
    with _lock, _connect() as connection:
        connection.execute("PRAGMA journal_mode=WAL")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS checks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                question TEXT NOT NULL,
                decision TEXT NOT NULL,
                governing_title TEXT,
                doc_count INTEGER NOT NULL DEFAULT 0,
                claim_count INTEGER NOT NULL DEFAULT 0,
                contradicted INTEGER NOT NULL DEFAULT 0,
                credits REAL NOT NULL DEFAULT 0,
                latency_ms INTEGER NOT NULL DEFAULT 0,
                draft_preview TEXT,
                reasons TEXT
            )
            """
        )


def record(
    *,
    question: str,
    decision: str,
    governing_title: str | None,
    doc_count: int,
    claim_count: int,
    contradicted: int,
    credits: float,
    latency_ms: int,
    draft: str,
    reasons: list[str],
) -> int:
    with _lock, _connect() as connection:
        cursor = connection.execute(
            """
            INSERT INTO checks (created_at, question, decision, governing_title, doc_count,
                                claim_count, contradicted, credits, latency_ms, draft_preview, reasons)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                datetime.now(timezone.utc).isoformat(timespec="seconds"),
                question[:240],
                decision,
                (governing_title or "")[:120],
                doc_count,
                claim_count,
                contradicted,
                credits,
                latency_ms,
                draft[:180].replace("\n", " "),
                json.dumps(reasons[:4]),
            ),
        )
        return int(cursor.lastrowid)


def recent(limit: int = 12) -> list[dict]:
    with _lock, _connect() as connection:
        rows = connection.execute(
            "SELECT * FROM checks ORDER BY id DESC LIMIT ?", (max(1, min(limit, 50)),)
        ).fetchall()
    return [dict(row) for row in rows]


def totals() -> dict:
    with _lock, _connect() as connection:
        row = connection.execute(
            """
            SELECT COUNT(*) AS checks,
                   COALESCE(SUM(credits), 0) AS credits,
                   COALESCE(SUM(CASE WHEN decision = 'publish' THEN 1 ELSE 0 END), 0) AS published,
                   COALESCE(SUM(CASE WHEN decision = 'rewrite' THEN 1 ELSE 0 END), 0) AS rewritten,
                   COALESCE(SUM(CASE WHEN decision = 'hold' THEN 1 ELSE 0 END), 0) AS held
            FROM checks
            """
        ).fetchone()
    return dict(row)
