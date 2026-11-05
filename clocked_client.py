"""Async Clocked client with idempotency, bounded retries and error classes.

A failed check must never become a pass. Every call reuses its idempotency
key on retry, so a retry cannot be billed as a second request.
"""

from __future__ import annotations

import asyncio
import os
import random
from dataclasses import dataclass

import httpx

BASE_URL = os.environ.get("CLOCKED_BASE_URL", "https://clocked.rezolve.ai/clocked")
RETRY_STATUS = {429, 500, 502, 503, 504}


class ClockedError(Exception):
    def __init__(self, message: str, *, status: int | None = None, kind: str = "upstream"):
        super().__init__(message)
        self.message = message
        self.status = status
        self.kind = kind


@dataclass
class CallResult:
    data: dict
    credits: float
    cost_usd: float
    model_ms: float
    latency_ms: int
    status: int


def _number(headers: httpx.Headers, name: str) -> float:
    try:
        return float(headers.get(name, 0) or 0)
    except ValueError:
        return 0.0


class ClockedClient:
    def __init__(self, api_key: str, *, timeout: float = 120.0):
        if not api_key:
            raise ClockedError("CLOCKED_API_KEY is not set", kind="config")
        self._client = httpx.AsyncClient(
            base_url=BASE_URL,
            timeout=httpx.Timeout(timeout, connect=10.0),
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        )

    async def aclose(self) -> None:
        await self._client.aclose()

    async def _post(self, endpoint: str, payload: dict, idem_key: str, attempts: int = 3) -> CallResult:
        for attempt in range(attempts):
            try:
                response = await self._client.post(
                    f"/{endpoint}", json=payload, headers={"Idempotency-Key": idem_key}
                )
            except (httpx.TimeoutException, httpx.TransportError) as exc:
                if attempt == attempts - 1:
                    raise ClockedError(
                        "Clocked did not respond in time. The draft is held, not published.",
                        kind="timeout",
                    ) from exc
                await asyncio.sleep(min(4.0, 0.5 * 2**attempt) + random.uniform(0, 0.25))
                continue

            if response.status_code == 200:
                return CallResult(
                    data=response.json(),
                    credits=_number(response.headers, "x-clocked-credits"),
                    cost_usd=_number(response.headers, "x-clocked-cost-usd"),
                    model_ms=_number(response.headers, "x-clocked-model-ms"),
                    latency_ms=int(response.elapsed.total_seconds() * 1000),
                    status=200,
                )

            detail = self._detail(response)

            if response.status_code == 402:
                raise ClockedError("Clocked credits or the account spending limit are exhausted.", status=402, kind="credits")
            if response.status_code in (401, 403):
                raise ClockedError("Clocked rejected the API key.", status=response.status_code, kind="config")
            if response.status_code == 409:
                raise ClockedError(
                    "A request with this idempotency key is still running or used a different payload.",
                    status=409,
                    kind="conflict",
                )
            if response.status_code in RETRY_STATUS and attempt < attempts - 1:
                delay = min(4.0, 0.5 * 2**attempt) + random.uniform(0, 0.25)
                retry_after = response.headers.get("retry-after")
                if retry_after:
                    try:
                        delay = min(5.0, float(retry_after))
                    except ValueError:
                        pass
                await asyncio.sleep(delay)
                continue
            if response.status_code == 429:
                raise ClockedError("Clocked is rate limiting this account. The draft is held.", status=429, kind="rate_limit")
            raise ClockedError(f"{endpoint} rejected the request: {detail}", status=response.status_code, kind="upstream")

        raise ClockedError("Clocked call failed after retries.", kind="upstream")

    @staticmethod
    def _detail(response: httpx.Response) -> str:
        try:
            body = response.json()
        except ValueError:
            return response.text[:300] or f"HTTP {response.status_code}"
        if isinstance(body, dict):
            return str(body.get("detail") or body.get("error") or body)[:300]
        return str(body)[:300]

    async def guard(self, *, text: str, instructions: str, idem_key: str) -> CallResult:
        return await self._post(
            "injection",
            {
                "text": text[:60_000],
                "source": "content",
                "instructions": instructions,
                "evidence": True,
                "threshold": 0.5,
            },
            idem_key,
        )

    async def protect(self, *, text: str, idem_key: str) -> CallResult:
        return await self._post(
            "pii",
            {
                "text": text[:60_000],
                "anonymize": "replace",
                "threshold": 0.5,
            },
            idem_key,
        )

    async def fill(
        self, *, text: str, fields: dict, instructions: str, idem_key: str
    ) -> CallResult:
        return await self._post(
            "fill",
            {
                "text": text[:200_000],
                "fields": fields,
                "instructions": instructions,
            },
            idem_key,
        )

    async def inspect(self, *, script: str, instructions: str, idem_key: str) -> CallResult:
        return await self._post(
            "script",
            {
                "script": script[:60_000],
                "instructions": instructions,
                "threshold": 0.5,
                "evidence": True,
            },
            idem_key,
        )

    async def extract(
        self, *, text: str, fields: dict, instructions: str, idem_key: str
    ) -> CallResult:
        return await self._post(
            "extract",
            {
                "text": text[:200_000],
                "fields": fields,
                "instructions": instructions,
            },
            idem_key,
        )

    async def decide(
        self, *, state: str, questions: dict, instructions: str, idem_key: str
    ) -> CallResult:
        return await self._post(
            "decide",
            {
                "state": state[:200_000],
                "questions": questions,
                "instructions": instructions,
                "calibration_temperature": 4,
            },
            idem_key,
        )

    async def rerank(
        self, *, query: str, documents: list[dict], context: dict, instructions: str, idem_key: str
    ) -> CallResult:
        return await self._post(
            "rerank",
            {
                "query": query,
                "context": context,
                "instructions": instructions,
                "documents": documents,
                "top_n": 10,
            },
            idem_key,
        )

    async def compare(self, *, documents: list[dict], instructions: str, idem_key: str) -> CallResult:
        return await self._post(
            "compare",
            {"documents": documents, "instructions": instructions, "evidence": "all", "threshold": 0.5},
            idem_key,
        )

    async def verify(
        self,
        *,
        documents: list[dict],
        answer: str,
        question: str,
        instructions: str,
        idem_key: str,
        claims: list[str] | None = None,
    ) -> CallResult:
        payload = {
            "documents": documents,
            "answer": answer,
            "question": question,
            "instructions": instructions,
            "threshold": 0.5,
            "evidence": "all",
        }
        if claims:
            payload["claims"] = claims[:30]
        return await self._post("grounding", payload, idem_key)
