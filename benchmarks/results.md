# Docket benchmark results

**Run:** 2026-11-05T12:21:44+00:00
**Mode:** live
**Cases:** 37

## Summary

- Decision accuracy: **100%**
- Governing-policy accuracy: **100%**
- Clean false-HOLD rate: **0%**
- Unsafe false-PUBLISH rate: **0%**
- Injection recall: **100%**
- Script recall: **100%**
- Omission recall: **75%**
- Average calls: 5.19
- Average credits: 13.16
- Average latency: 3142 ms

## By category

| Category | Passed | Cases |
|---|---:|---:|
| authority | 8 | 8 |
| clean | 5 | 5 |
| injection | 4 | 4 |
| integrity | 3 | 3 |
| malformed | 4 | 4 |
| omission | 5 | 5 |
| script | 3 | 3 |
| version | 5 | 5 |

## Failures

No failures in this run.

## Threshold calibration

Operating Guard threshold: `0.5` · Inspect: `0.5`

### Guard

| Threshold | TP | FP | Precision | Recall | F1 |
|---:|---:|---:|---:|---:|---:|
| 0.30 | 4 | 0 | 1.00 | 1.00 | 1.00 |
| 0.40 | 4 | 0 | 1.00 | 1.00 | 1.00 |
| 0.50 | 4 | 0 | 1.00 | 1.00 | 1.00 |
| 0.60 | 4 | 0 | 1.00 | 1.00 | 1.00 |
| 0.70 | 4 | 0 | 1.00 | 1.00 | 1.00 |
| 0.80 | 4 | 0 | 1.00 | 1.00 | 1.00 |

The Guard sweep is flat across the tested thresholds; the measured cases do not justify moving off the operating point. Selected Guard threshold: **0.50** (F1 1.00, FP 0).

### Inspect

| Threshold | TP | FP | Precision | Recall | F1 |
|---:|---:|---:|---:|---:|---:|
| 0.30 | 2 | 0 | 1.00 | 1.00 | 1.00 |
| 0.40 | 2 | 0 | 1.00 | 1.00 | 1.00 |
| 0.50 | 2 | 0 | 1.00 | 1.00 | 1.00 |
| 0.60 | 2 | 0 | 1.00 | 1.00 | 1.00 |
| 0.70 | 2 | 0 | 1.00 | 1.00 | 1.00 |
| 0.80 | 2 | 0 | 1.00 | 1.00 | 1.00 |

The Inspect sweep is flat across the tested thresholds; both malicious scripts score above 0.99 and the safe script below 0.01, so the corpus cannot calibrate a boundary. Selected Inspect threshold: **0.50** (F1 1.00, FP 0).

The sweep applies measured Guard/Inspect scores from this run. A clean false positive is a clean case that the endpoint would hold at that threshold. A flat sweep means the corpus does not distinguish the thresholds; Docket keeps its operating point and reports the limitation instead of claiming a calibration win.

## Limitations

- The corpus is synthetic and was authored by the Docket team. It is a regression suite, not a held-out test set. A perfect score on authored cases is not evidence of perfect accuracy on unseen policy sprawl.
- The corpus covers policy governance, not every domain. A live run measures one model at one point in time; model behavior can drift.
- Omission recall is measured strictly as `coverage_gap`. One omission case is caught by a contradiction instead, so the decision is still correct while strict omission recall is 75%.
- Clean false-HOLD and unsafe false-PUBLISH rates are reported from this corpus only.
- The threshold sweep reuses measured scores. It is flat across 0.3–0.8 because the measured cases are easy to separate; that is a limitation, not a calibration win.
