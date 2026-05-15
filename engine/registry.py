from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

import pandas as pd

from engine.finding import Finding, Severity

RuleFn = Callable[[dict[str, pd.DataFrame]], list[Finding]]


@dataclass
class RuleMeta:
    id: str
    severity: Severity
    layer: str
    fn: RuleFn


RULES: dict[str, RuleMeta] = {}


def rule(
    id: str, severity: Severity, layer: str
) -> Callable[[RuleFn], RuleFn]:
    def decorator(fn: RuleFn) -> RuleFn:
        if id in RULES:
            raise ValueError(f"rule {id} already registered")
        RULES[id] = RuleMeta(id=id, severity=severity, layer=layer, fn=fn)
        return fn

    return decorator


def run_all(data: dict[str, pd.DataFrame]) -> list[Finding]:
    findings: list[Finding] = []
    for meta in RULES.values():
        findings.extend(meta.fn(data))
    return findings
