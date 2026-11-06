"""Proof cases for the endpoint necessity table.

Each proof is a real case, run once with the endpoint and once without it.
The aim is not a benchmark score. It is to show, on the surface a judge uses,
what each endpoint contributes to the result.

The seven decision levers are ablated. Protect and Rerank are measured, not
ablated: they change the audit record and the evidence set, not the verdict.
"""

from __future__ import annotations

from samples import SAMPLES


def sample_payload(sample_id: str) -> dict:
    sample = next(item for item in SAMPLES if item["id"] == sample_id)
    context = sample.get("context") or {}
    return {
        "question": sample["question"],
        "draft": sample["draft"],
        "country": context.get("country", ""),
        "role": context.get("role", ""),
        "plan": context.get("plan", ""),
        "documents": [
            {
                "title": document["title"],
                "text": document["text"],
                "jurisdiction": document.get("jurisdiction", "Global"),
                "effective_date": document.get("effective_date"),
                "expires_date": document.get("expires_date"),
                "precedence": int(document.get("precedence") or 0),
            }
            for document in sample["documents"]
        ],
    }


COVERAGE_PAYLOAD = {
    "question": "How many days per week can employees work remotely?",
    "draft": "Employees may work remotely two days per week.",
    "country": "Global",
    "role": "Employee",
    "plan": "Standard",
    "documents": [
        {
            "title": "Remote work policy — proof case",
            "text": (
                "Remote work policy — effective 1 January 2026.\n\n"
                "Employees may work remotely two days per week with manager approval.\n\n"
                "Employees in customer-facing roles must work on-site five days per week."
            ),
            "jurisdiction": "Global",
            "effective_date": "2026-01-01",
            "precedence": 0,
            "approved_by": "Docket proof corpus",
            "approval_reference": "PROOF-COVERAGE",
        }
    ],
}

PII_PAYLOAD = {
    "question": (
        "My email is jane.doe@example.com and my phone is +1 415 555 0132. "
        "Does an access request need manager approval?"
    ),
    "draft": "Access requests require manager approval and completion of security training.",
    "country": "Global",
    "role": "Employee",
    "plan": "Standard",
    "documents": [
        {
            "title": "Access request policy v2",
            "text": (
                "Access request policy — version 2, effective 1 January 2026.\n\n"
                "Access requests require manager approval.\n\n"
                "Requesters must complete security training before access is granted.\n\n"
                "Emergency access requires director approval and is reviewed within 24 hours."
            ),
            "jurisdiction": "Global",
            "effective_date": "2026-01-01",
            "precedence": 0,
            "approved_by": "Docket proof corpus",
            "approval_reference": "PROOF-PII",
        }
    ],
}

PROOFS = [
    {
        "endpoint": "guard",
        "label": "Guard",
        "role": "Injection gate",
        "proof_case": "Injected policy note",
        "sample": "injected-policy",
        "note": "The source contains instructions aimed at the assistant.",
    },
    {
        "endpoint": "inspect",
        "label": "Inspect",
        "role": "Script safety",
        "proof_case": "Unsafe runbook",
        "sample": "unsafe-runbook",
        "note": "The draft includes a command that disables endpoint protection.",
    },
    {
        "endpoint": "extract",
        "label": "Extract",
        "role": "Metadata integrity",
        "proof_case": "Metadata conflict",
        "sample": "metadata-conflict",
        "note": "The submitted effective date contradicts the policy text.",
    },
    {
        "endpoint": "decide",
        "label": "Decide",
        "role": "Triage and review routing",
        "proof_case": "Precedence over recency",
        "sample": "precedence-recency",
        "note": "The request is triaged as an approval decision that needs human review.",
    },
    {
        "endpoint": "compare",
        "label": "Compare",
        "role": "Superseded conflicts",
        "proof_case": "Precedence over recency",
        "sample": "precedence-recency",
        "note": "The draft conflicts with the governing country annex.",
    },
    {
        "endpoint": "coverage",
        "label": "Fill",
        "role": "Omission detection",
        "proof_case": "Omitted remote-work condition",
        "payload": COVERAGE_PAYLOAD,
        "note": "The draft leaves out the customer-facing on-site condition.",
    },
    {
        "endpoint": "verify",
        "label": "Verify",
        "role": "Claim grounding",
        "proof_case": "Clean access request",
        "sample": "access-request",
        "note": "The draft is supported and can publish only after grounding.",
    },
    {
        "endpoint": "protect",
        "label": "Protect",
        "role": "Audit redaction",
        "proof_case": "PII in the question",
        "payload": PII_PAYLOAD,
        "kind": "measure",
        "note": "Protect redacts personal data in the audit preview; it is not a verdict lever.",
    },
    {
        "endpoint": "rerank",
        "label": "Rerank",
        "role": "Evidence selection",
        "proof_case": "Precedence over recency",
        "sample": "precedence-recency",
        "kind": "measure",
        "note": "Rerank chooses the clauses Verify reads; it is not a verdict lever.",
    },
]


def proof_payload(proof: dict) -> dict:
    if "payload" in proof:
        return proof["payload"]
    return sample_payload(proof["sample"])
