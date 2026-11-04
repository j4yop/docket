"""Clause segmentation and authority resolution.

Both are deterministic. This is deliberate: which policy governs an employee
is a business rule, not a model judgment. The app resolves authority, then
tells Rerank which document governs, then uses Compare and Verify to judge
the text. No model call can override a stated precedence rule.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import date

MAX_CLAUSES_PER_DOC = 60
MAX_CLAUSE_CHARS = 700

STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "is", "are",
    "was", "were", "be", "been", "with", "by", "at", "from", "that", "this",
    "it", "as", "if", "then", "than", "can", "may", "must", "should", "would",
    "could", "do", "does", "did", "not", "no", "yes", "what", "which", "who",
    "when", "where", "why", "how", "we", "you", "they", "i", "our", "your",
}


@dataclass
class Document:
    id: str
    title: str
    text: str
    jurisdiction: str = "Global"
    effective_date: str | None = None
    precedence: int = 0


@dataclass
class Clause:
    id: str
    doc_id: str
    text: str
    start: int
    order: int


@dataclass
class Authority:
    governing: Document | None
    superseded: list[Document] = field(default_factory=list)
    trace: list[dict] = field(default_factory=list)
    error: str | None = None


def parse_date(value: str | None) -> date | None:
    if not value:
        return None
    cleaned = value.strip()
    if not cleaned:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d-%m-%Y"):
        try:
            from datetime import datetime

            return datetime.strptime(cleaned, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Invalid date '{value}'. Use YYYY-MM-DD.")


def _is_global(jurisdiction: str) -> bool:
    return (jurisdiction or "").strip().lower() in {"", "global", "*", "all", "any"}


def resolve(documents: list[Document], country: str) -> Authority:
    """Pick the governing document from jurisdiction, precedence and date.

    Order: explicit precedence, then jurisdiction specificity, then latest
    effective date. A tie on all three is ambiguous and returns an error:
    the app holds rather than guessing which policy wins.
    """
    country_norm = (country or "").strip().upper()
    rows: list[dict] = []
    eligible: list[tuple[tuple, Document]] = []

    for doc in documents:
        if _is_global(doc.jurisdiction):
            specificity = 1
            applies = True
            why = "Global scope"
        elif country_norm and doc.jurisdiction.strip().upper() == country_norm:
            specificity = 2
            applies = True
            why = f"Matches {country_norm}"
        else:
            specificity = 0
            applies = False
            why = f"Out of scope for {country_norm or 'this employee'}"

        parsed = parse_date(doc.effective_date)
        key = (doc.precedence, specificity, parsed or date.min)
        rows.append(
            {
                "id": doc.id,
                "title": doc.title,
                "jurisdiction": doc.jurisdiction or "Global",
                "effective_date": doc.effective_date,
                "precedence": doc.precedence,
                "applies": applies,
                "specificity": specificity,
                "why": why,
            }
        )
        if applies:
            eligible.append((key, doc))

    if not eligible:
        return Authority(
            governing=None,
            trace=rows,
            error="No document applies to this employee's jurisdiction. Add a matching or global document.",
        )

    eligible.sort(key=lambda item: item[0], reverse=True)
    top_key, top_doc = eligible[0]
    tied = [doc for key, doc in eligible if key == top_key]

    if len(tied) > 1:
        names = ", ".join(doc.title for doc in tied)
        return Authority(
            governing=None,
            trace=rows,
            error=f"Authority is ambiguous: {names} have the same precedence, scope and date. Mark one as overriding.",
        )

    superseded = [doc for key, doc in eligible if doc.id != top_doc.id]
    for row in rows:
        if not row["applies"]:
            row["outcome"] = "out of scope"
        elif row["id"] == top_doc.id:
            row["outcome"] = "governing"
        else:
            row["outcome"] = "superseded"

    return Authority(governing=top_doc, superseded=superseded, trace=rows)


def _trimmed_blocks(text: str):
    """Yield (block_text, start_offset) for each blank-line-separated block."""
    pattern = re.compile(r"[^\n](?:[^\n]|\n(?!\s*\n))*")
    for match in pattern.finditer(text):
        raw = match.group(0)
        if not raw.strip():
            continue
        lead = len(raw) - len(raw.lstrip())
        yield raw.strip(), match.start() + lead


def segment_document(doc: Document) -> list[Clause]:
    """Split a document into short, displayable clauses with source offsets."""
    clauses: list[Clause] = []
    order = 0

    for block, base in _trimmed_blocks(doc.text):
        if len(block) <= MAX_CLAUSE_CHARS:
            pieces = [(block, base)]
        else:
            pieces = []
            cursor = 0
            buffer = ""
            buffer_start = 0
            for part in re.split(r"(?<=[.!?])\s+", block):
                if not part:
                    continue
                if not buffer:
                    buffer_start = cursor
                if len(buffer) + len(part) + 1 <= MAX_CLAUSE_CHARS:
                    buffer = f"{buffer} {part}".strip()
                else:
                    if buffer:
                        pieces.append((buffer, base + buffer_start))
                    buffer = part
                    buffer_start = cursor
                cursor += len(part) + 1
            if buffer:
                pieces.append((buffer, base + buffer_start))

        for text, start in pieces:
            if not text:
                continue
            clauses.append(
                Clause(
                    id=f"{doc.id}-c{order}",
                    doc_id=doc.id,
                    text=text,
                    start=start,
                    order=order,
                )
            )
            order += 1
            if order >= MAX_CLAUSES_PER_DOC:
                return clauses

    return clauses


def candidate_clauses(
    clauses: list[Clause],
    question: str,
    context_values: list[str],
    limit: int = 12,
    per_doc: int = 3,
) -> list[Clause]:
    """Cheap lexical pre-filter so Rerank reads a bounded set of clauses.

    This is a cost control, not a decision: Rerank still judges relevance and
    can skip anything selected here. It never removes a document entirely.
    """
    words = {
        w
        for w in re.findall(r"[a-z0-9$%]+", f"{question} {' '.join(context_values)}".lower())
        if len(w) > 2 and w not in STOPWORDS
    }

    by_doc: dict[str, list[tuple[float, Clause]]] = {}
    for clause in clauses:
        tokens = set(re.findall(r"[a-z0-9$%]+", clause.text.lower()))
        hits = len(words & tokens)
        score = hits / (len(clause.text.split()) ** 0.5 + 1)
        by_doc.setdefault(clause.doc_id, []).append((score, clause))

    picked: list[tuple[float, Clause]] = []
    for doc_clauses in by_doc.values():
        doc_clauses.sort(key=lambda item: item[0], reverse=True)
        picked.extend(doc_clauses[:per_doc])

    picked.sort(key=lambda item: item[0], reverse=True)
    return [clause for _, clause in picked[:limit]]


def _tokens(text: str) -> set[str]:
    return {
        word
        for word in re.findall(r"[a-z0-9$%]+", text.lower())
        if len(word) > 2 and word not in STOPWORDS
    }


def align_superseded(
    governing_clauses: list[Clause],
    superseded_clauses: list[Clause],
    limit: int = 2,
) -> list[tuple[Clause, Clause]]:
    """Pair each governing clause with the superseded clause about the same fact.

    Rerank scores superseded clauses near zero because they are not the answer,
    so ranking them by relevance picks headers and noise. Alignment uses
    content overlap and clause position instead, which is deterministic and
    keeps Compare focused on comparable passages.
    """
    pairs: list[tuple[Clause, Clause]] = []
    used: set[str] = set()

    for governing in governing_clauses[:limit]:
        g_tokens = _tokens(governing.text)
        best: tuple[float, Clause] | None = None
        for candidate in superseded_clauses:
            if candidate.id in used:
                continue
            c_tokens = _tokens(candidate.text)
            if not g_tokens or not c_tokens:
                continue
            overlap = len(g_tokens & c_tokens) / len(g_tokens | c_tokens)
            position_bonus = 0.15 if candidate.order == governing.order else 0.0
            score = overlap + position_bonus
            if best is None or score > best[0]:
                best = (score, candidate)

        if best and best[0] > 0.08:
            used.add(best[1].id)
            pairs.append((governing, best[1]))

    return pairs


def best_clause_for_text(text: str, clauses: list[Clause]) -> Clause | None:
    """Find the clause that most likely states the rule a claim is about.

    Used only to attach a governing quote to a claim when Verify returns no
    evidence (Verify returns passages for supported claims, not contradicted
    ones). The match is deterministic token overlap, not a model judgment.
    """
    tokens = _tokens(text)
    if not tokens:
        return None
    best: tuple[float, Clause] | None = None
    for clause in clauses:
        clause_tokens = _tokens(clause.text)
        if not clause_tokens:
            continue
        score = len(tokens & clause_tokens) / len(tokens | clause_tokens)
        if best is None or score > best[0]:
            best = (score, clause)
    return best[1] if best else None
