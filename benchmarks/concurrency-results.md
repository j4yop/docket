# Docket concurrency check

**Run:** 2026-11-05T18:31:11+00:00
**Checks:** 10 concurrent
**Case:** `expense-update`
**Storage:** `local`

## Result

| Metric | Result |
|---|---:|
| Checks completed | 10 |
| Decisions | rewrite |
| Audit records before / after | 0 / 10 |
| Unique audit sequences | 10 / 10 |
| Review records opened | 10 |
| Chain verified | **True** |
| Chain records / checks / events | 10 / 10 / 0 |
| Head sequence / hash | 10 / `2a74b1d5cf21d4b7ae59d8706c6c5cdd63472feb0b959aa58b793e7bdb0c2ff9` |
| Credits / elapsed | 271.0 / 13.33 s |

## Audit sequences

`1, 2, 3, 4, 5, 6, 7, 8, 9, 10`

## Interpretation

The local store uses the same `put_json(allow_overwrite=False)` / `claim()` path as Blob. Ten checks in one event loop exercise the per-loop lock; the two-event-loop unit test exercises the atomic sequence claim. Production Blob uses the same conditional create. A verified chain here means no duplicate or missing sequence was produced by the concurrent checks.
