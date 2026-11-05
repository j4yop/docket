from authority import (
    Document,
    candidate_clauses,
    parse_date,
    resolve,
    segment_document,
)


def doc(id, title, text, jurisdiction="Global", date=None, precedence=0, expires_date=None):
    return Document(
        id=id,
        title=title,
        text=text,
        jurisdiction=jurisdiction,
        effective_date=date,
        expires_date=expires_date,
        precedence=precedence,
    )


def test_regional_annex_beats_global_policy():
    documents = [
        doc("g", "Global policy", "Requires approval.", "Global", "2026-01-01"),
        doc("f", "France annex", "No approval.", "FR", "2026-03-01", 1),
    ]
    result = resolve(documents, "FR")
    assert result.error is None
    assert result.governing.id == "f"
    assert [d.id for d in result.superseded] == ["g"]


def test_later_version_wins_without_precedence():
    documents = [
        doc("v4", "Policy v4", "30 days.", "Global", "2024-01-01"),
        doc("v5", "Policy v5", "60 days.", "Global", "2026-01-01"),
    ]
    result = resolve(documents, "US")
    assert result.error is None
    assert result.governing.id == "v5"


def test_tie_is_ambiguous_and_holds():
    documents = [
        doc("a", "Policy A", "Rule A.", "Global", "2026-01-01"),
        doc("b", "Policy B", "Rule B.", "Global", "2026-01-01"),
    ]
    result = resolve(documents, "US")
    assert result.governing is None
    assert "ambiguous" in result.error.lower()


def test_out_of_scope_document_does_not_govern():
    documents = [doc("us", "US addendum", "Rule.", "US", "2026-01-01")]
    result = resolve(documents, "FR")
    assert result.governing is None
    assert "No document applies" in result.error


def test_single_document_governs():
    result = resolve([doc("only", "Only policy", "Rule.")], "FR")
    assert result.error is None
    assert result.governing.id == "only"
    assert result.superseded == []


def test_trace_explains_each_document():
    documents = [
        doc("g", "Global", "Rule.", "Global", "2026-01-01"),
        doc("u", "US", "Rule.", "US", "2026-01-01"),
    ]
    result = resolve(documents, "FR")
    outcomes = {row["id"]: row["outcome"] for row in result.trace}
    assert outcomes["g"] == "governing"
    assert outcomes["u"] == "out of scope"


def test_segmentation_offsets_match_source():
    text = "First clause here.\n\nSecond clause here."
    paragraphs = segment_document(doc("d", "Doc", text))
    assert len(paragraphs) == 2
    for clause in paragraphs:
        assert text[clause.start : clause.start + len(clause.text)] == clause.text


def test_long_paragraph_splits_into_clauses():
    text = ("This is a sentence. " * 60).strip()
    clauses = segment_document(doc("d", "Doc", text))
    assert len(clauses) > 1
    assert all(len(c.text) <= 700 for c in clauses)


def test_candidate_selection_keeps_each_document():
    documents = [
        doc("g", "Global", "Monitor approval required for all equipment requests."),
        doc("f", "France", "Monitor reimbursement in France does not require approval."),
    ]
    clauses = [clause for d in documents for clause in segment_document(d)]
    picked = candidate_clauses(clauses, "Does a monitor need approval in France?", ["FR"])
    assert {c.doc_id for c in picked} == {"g", "f"}


def test_parse_date_is_strict_enough():
    assert parse_date("2026-03-01").isoformat() == "2026-03-01"
    assert parse_date("") is None
    try:
        parse_date("March 2026")
    except ValueError:
        pass
    else:
        raise AssertionError("expected ValueError")


def test_future_dated_policy_does_not_govern():
    documents = [
        doc("now", "Current policy", "Rule.", "Global", "2026-01-01"),
        doc("later", "Future policy", "Rule.", "Global", "2027-01-01"),
    ]
    result = resolve(documents, "FR")
    assert result.error is None
    assert result.governing.id == "now"
    outcomes = {row["id"]: row["outcome"] for row in result.trace}
    assert outcomes["later"] == "not in force"


def test_expired_policy_does_not_govern():
    documents = [
        doc("old", "Old policy", "Rule.", "Global", "2024-01-01", expires_date="2026-01-01"),
        doc("new", "New policy", "Rule.", "Global", "2026-02-01"),
    ]
    result = resolve(documents, "FR")
    assert result.governing.id == "new"
    outcomes = {row["id"]: row["outcome"] for row in result.trace}
    assert outcomes["old"] == "not in force"
