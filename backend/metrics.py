"""Centralized Weights & Biases metrics for Doraemon.

wandb is an optional dependency. If not installed or not configured,
every public function in this module silently becomes a no-op.
"""

import asyncio
import logging
import os
import threading
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# --- Private state -----------------------------------------------------------

_enabled = False
_step = 0
_step_lock = threading.Lock()

try:
    import wandb
except ImportError:
    wandb = None  # type: ignore[assignment]


# --- Lifecycle ----------------------------------------------------------------

def init(
    project="doraemon",
    run_name=None,  # type: Optional[str]
    config=None,  # type: Optional[Dict]
):
    # type: () -> bool
    """Initialize a wandb run. Returns True if successful."""
    global _enabled
    if wandb is None:
        logger.info("wandb not installed, metrics disabled")
        return False
    try:
        wandb.init(
            project=project,
            name=run_name,
            config=config or {},
            resume="allow",
        )
        _enabled = True
        logger.info("wandb initialized: project=%s run=%s", project, run_name)
        return True
    except Exception as e:
        logger.warning("wandb init failed: %s", e)
        _enabled = False
        return False


def finish():
    """Finish the wandb run. Safe to call if not initialized."""
    global _enabled
    if not _enabled or wandb is None:
        return
    try:
        wandb.finish()
    except Exception as e:
        logger.warning("wandb finish error: %s", e)
    _enabled = False


def is_enabled():
    return _enabled


# --- Internal helpers ---------------------------------------------------------

def _log(data):
    # type: (dict) -> None
    """Synchronous log -- called from thread pool."""
    global _step
    if not _enabled or wandb is None:
        return
    with _step_lock:
        _step += 1
        step = _step
    try:
        wandb.log(data, step=step)
    except Exception as e:
        logger.warning("wandb.log error: %s", e)


async def _alog(data):
    # type: (dict) -> None
    """Async-safe log that delegates to thread pool."""
    if not _enabled:
        return
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _log, data)


# --- Public logging functions -------------------------------------------------

async def log_api_call(
    model,        # type: str
    latency,      # type: float
    prompt_tokens=0,       # type: int
    completion_tokens=0,   # type: int
    total_tokens=0,        # type: int
    status="success",      # type: str
    error_type=None,       # type: Optional[str]
    retries=0,             # type: int
):
    """Log a Mistral API call with latency, token usage, and error info."""
    data = {
        "api/{}/latency_s".format(model): latency,
        "api/{}/prompt_tokens".format(model): prompt_tokens,
        "api/{}/completion_tokens".format(model): completion_tokens,
        "api/{}/total_tokens".format(model): total_tokens,
        "api/{}/retries".format(model): retries,
        "api/{}/success".format(model): 1 if status == "success" else 0,
        "api/{}/error".format(model): 0 if status == "success" else 1,
    }
    if error_type:
        data["api/{}/error_type/{}".format(model, error_type)] = 1
    await _alog(data)


async def log_pipeline_tick(
    pipeline,         # type: str
    elapsed,          # type: float
    target_interval,  # type: float
):
    """Log a single pipeline loop iteration (OCR, vision, or classifier)."""
    actual_fps = 1.0 / elapsed if elapsed > 0 else 0.0
    target_fps = 1.0 / target_interval if target_interval > 0 else 0.0
    await _alog({
        "pipeline/{}/elapsed_s".format(pipeline): elapsed,
        "pipeline/{}/actual_fps".format(pipeline): actual_fps,
        "pipeline/{}/target_fps".format(pipeline): target_fps,
        "pipeline/{}/fps_ratio".format(pipeline): actual_fps / target_fps if target_fps > 0 else 0.0,
    })


async def log_intent(
    intent,              # type: str
    confidence,          # type: float
    previous_intent=None,  # type: Optional[str]
):
    """Log a classifier intent result."""
    data = {
        "intent/confidence": confidence,
        "intent/is_normal": 1 if intent == "normal" else 0,
        "intent/is_hesitant": 1 if intent == "hesitant" else 0,
        "intent/is_typo": 1 if intent == "typo" else 0,
    }
    if previous_intent and previous_intent != intent:
        data["intent/transition"] = 1
        data["intent/transition/{}_to_{}".format(previous_intent, intent)] = 1
    else:
        data["intent/transition"] = 0
    await _alog(data)


async def log_translation(
    text_count,    # type: int
    source_lang,   # type: str
    target_lang,   # type: str
    elapsed,       # type: float
):
    """Log a translation batch operation."""
    await _alog({
        "translation/batch_size": text_count,
        "translation/elapsed_s": elapsed,
        "translation/pair/{}_to_{}".format(source_lang, target_lang): 1,
    })
