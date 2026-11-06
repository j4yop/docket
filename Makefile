.PHONY: test preflight preflight-local evidence evidence-live

PYTHON ?= python3
BASE_URL ?= https://docket-clocked.vercel.app
LOCAL_URL ?= http://127.0.0.1:8000

test:
	$(PYTHON) -m pytest -q

preflight:
	$(PYTHON) scripts/preflight.py --base-url $(BASE_URL)

preflight-local:
	$(PYTHON) scripts/preflight.py --base-url $(LOCAL_URL)

# Deterministic replay: no Clocked key or credits required.
evidence:
	$(PYTHON) benchmarks/run.py --offline

# Live replay of every corpus. Costs Clocked credits; run before submission.
evidence-live:
	$(PYTHON) benchmarks/run.py --live --suite heldout
	$(PYTHON) benchmarks/run.py --live --suite adversarial
	$(PYTHON) benchmarks/run.py --live --sweep --suite calibration
	$(PYTHON) benchmarks/run.py --live --sweep
