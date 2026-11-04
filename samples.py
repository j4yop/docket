"""Example inputs. Realistic, synthetic, and fully editable in the UI.

The app does not depend on these. They exist so a judge can see the product
in one click; every field can be replaced with the judge's own documents.
"""

SAMPLES = [
    {
        "id": "france-monitor",
        "label": "France monitor policy",
        "blurb": "A global rule and a regional annex disagree. The draft follows the wrong one.",
        "question": "Does an employee in France need prior manager approval to expense a monitor?",
        "draft": (
            "Monitor reimbursement requires prior manager approval. "
            "Delivery is expected within 5 business days."
        ),
        "context": {"country": "FR", "role": "Employee", "plan": "Standard"},
        "documents": [
            {
                "title": "Global equipment policy v3.2",
                "jurisdiction": "Global",
                "effective_date": "2026-01-01",
                "precedence": 0,
                "text": (
                    "Global equipment policy — version 3.2, effective 1 January 2026.\n\n"
                    "Monitor reimbursement requires prior manager approval submitted through the expense portal. "
                    "Requests without approval are rejected.\n\n"
                    "Delivery is expected within 5 business days of approval."
                ),
            },
            {
                "title": "France annex",
                "jurisdiction": "FR",
                "effective_date": "2026-03-01",
                "precedence": 1,
                "text": (
                    "France annex — effective 1 March 2026. This annex governs employees employed by the French entity "
                    "and takes precedence over the global equipment policy where the two differ.\n\n"
                    "For employees in France, monitor reimbursement does not require prior manager approval.\n\n"
                    "Delivery is arranged by the local facilities provider within 10 business days."
                ),
            },
            {
                "title": "United States addendum",
                "jurisdiction": "US",
                "effective_date": "2026-01-01",
                "precedence": 0,
                "text": (
                    "United States addendum — effective 1 January 2026.\n\n"
                    "Monitor reimbursement requires prior manager approval. Delivery is expected within 5 business days."
                ),
            },
        ],
    },
    {
        "id": "access-request",
        "label": "Clean access request",
        "blurb": "One governing source, a draft that matches it. The gate publishes.",
        "question": "Does an access request need manager approval and security training?",
        "draft": "Access requests require manager approval and completion of security training.",
        "context": {"country": "Global", "role": "Employee", "plan": "Standard"},
        "documents": [
            {
                "title": "Access request policy v2",
                "jurisdiction": "Global",
                "effective_date": "2026-01-01",
                "precedence": 0,
                "text": (
                    "Access request policy — version 2, effective 1 January 2026.\n\n"
                    "Access requests require manager approval.\n\n"
                    "Requesters must complete security training before access is granted.\n\n"
                    "Emergency access requires director approval and is reviewed within 24 hours."
                ),
            }
        ],
    },
    {
        "id": "expense-update",
        "label": "Expense policy update",
        "blurb": "A new version changes two numbers. The draft still uses the old ones.",
        "question": "What is the deadline and receipt threshold for submitting an expense?",
        "draft": (
            "Expenses must be submitted within 30 days of the purchase date. "
            "Receipts are required for amounts over $75."
        ),
        "context": {"country": "Global", "role": "Employee", "plan": "Standard"},
        "documents": [
            {
                "title": "Travel & expense policy v4",
                "jurisdiction": "Global",
                "effective_date": "2024-01-01",
                "precedence": 0,
                "text": (
                    "Travel and expense policy — version 4, effective 1 January 2024.\n\n"
                    "Expenses must be submitted within 30 days of the purchase date. "
                    "Receipts are required for amounts over $75.\n\n"
                    "Late submissions require director approval."
                ),
            },
            {
                "title": "Travel & expense policy v5",
                "jurisdiction": "Global",
                "effective_date": "2026-01-01",
                "precedence": 0,
                "text": (
                    "Travel and expense policy — version 5, effective 1 January 2026.\n\n"
                    "Expenses must be submitted within 60 days of the purchase date. "
                    "Receipts are required for amounts over $50.\n\n"
                    "Late submissions require director approval."
                ),
            },
        ],
    },
]
