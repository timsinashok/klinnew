"""Anthropic SDK client for finding translation."""

from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from translator.prompts import SYSTEM, build_user_prompt

DEFAULT_MODEL = "claude-haiku-4-5"
MAX_TOKENS = 400
TEMPERATURE = 0.2
TIMEOUT_S = 5.0

logger = logging.getLogger(__name__)


class LLMUnavailable(Exception):
    """Raised when the LLM can't or shouldn't be invoked."""


def _client(model: str):  # pragma: no cover — thin wrapper
    if not os.environ.get("ANTHROPIC_API_KEY"):
        raise LLMUnavailable("ANTHROPIC_API_KEY not set")
    try:
        import anthropic
    except ImportError as e:
        raise LLMUnavailable(f"anthropic SDK not installed: {e}") from e
    return anthropic.Anthropic(timeout=TIMEOUT_S)


def _extract_json(text: str) -> dict:
    text = text.strip()
    # tolerate ```json fences just in case the model adds them
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    return json.loads(text)


def call_llm(
    finding: dict[str, Any],
    model: str = DEFAULT_MODEL,
) -> tuple[str, list[str]]:
    """Returns (user_message, suggested_actions) from the LLM.

    Raises LLMUnavailable if the key is missing or the SDK is not installed.
    On a transient API error, retries once; on a second failure, raises.
    """
    client = _client(model)
    user = build_user_prompt(finding)

    last_err: Exception | None = None
    for attempt in (1, 2):
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=MAX_TOKENS,
                temperature=TEMPERATURE,
                system=SYSTEM,
                messages=[{"role": "user", "content": user}],
            )
            text = resp.content[0].text  # type: ignore[attr-defined]
            parsed = _extract_json(text)
            msg = str(parsed.get("user_message") or "").strip()
            actions_raw = parsed.get("suggested_actions") or []
            if not isinstance(actions_raw, list):
                actions_raw = [str(actions_raw)]
            actions = [str(a).strip() for a in actions_raw if str(a).strip()]
            if not msg:
                raise ValueError("LLM returned empty user_message")
            return msg, actions
        except Exception as e:  # noqa: BLE001
            last_err = e
            logger.warning(
                "LLM attempt %d failed for %s: %s",
                attempt,
                finding.get("rule_id"),
                e,
            )

    raise LLMUnavailable(f"LLM failed after retry: {last_err}")
