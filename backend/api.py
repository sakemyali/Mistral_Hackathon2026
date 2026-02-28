import asyncio
import time
import httpx
from config import MISTRAL_API_BASE, MISTRAL_API_KEY
from metrics import log_api_call

MAX_RETRIES = 5

# Global semaphore to limit concurrent Mistral API calls
_sem = asyncio.Semaphore(1)


async def mistral_chat(json_body: dict, timeout: float = 30.0) -> dict:
    """Send a chat completion request to Mistral API with retry on 429.

    Uses a semaphore so only one request is in-flight at a time,
    preventing concurrent calls from burning through rate limits.
    """
    model = json_body.get("model", "unknown")
    async with _sem:
        async with httpx.AsyncClient(timeout=timeout) as client:
            retries = 0
            for attempt in range(MAX_RETRIES):
                t0 = time.monotonic()
                try:
                    response = await client.post(
                        f"{MISTRAL_API_BASE}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {MISTRAL_API_KEY}",
                            "Content-Type": "application/json",
                        },
                        json=json_body,
                    )
                    latency = time.monotonic() - t0

                    if response.status_code == 429:
                        retries += 1
                        await log_api_call(
                            model=model,
                            latency=latency,
                            status="rate_limited",
                            error_type="429",
                            retries=retries,
                        )
                        retry_after = response.headers.get("retry-after")
                        if retry_after:
                            wait = float(retry_after)
                        else:
                            wait = 2 ** (attempt + 1)
                        print(f"[API] Rate limited, retrying in {wait}s...")
                        await asyncio.sleep(wait)
                        continue

                    response.raise_for_status()
                    result = response.json()

                    usage = result.get("usage", {})
                    await log_api_call(
                        model=model,
                        latency=latency,
                        prompt_tokens=usage.get("prompt_tokens", 0),
                        completion_tokens=usage.get("completion_tokens", 0),
                        total_tokens=usage.get("total_tokens", 0),
                        status="success",
                        retries=retries,
                    )
                    return result

                except httpx.HTTPStatusError:
                    raise
                except Exception as e:
                    latency = time.monotonic() - t0
                    await log_api_call(
                        model=model,
                        latency=latency,
                        status="error",
                        error_type=type(e).__name__,
                        retries=retries,
                    )
                    raise

        response.raise_for_status()
