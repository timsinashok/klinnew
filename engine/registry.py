from collections.abc import Callable
from typing import Any

import pandas as pd

from engine.finding import Finding

RuleFn = Callable[[pd.DataFrame, pd.DataFrame, pd.DataFrame], list[Finding]]
RULES: dict[str, RuleFn] = {}


def rule(rule_id: str) -> Callable[[RuleFn], RuleFn]:
    def decorator(fn: RuleFn) -> RuleFn:
        if rule_id in RULES:
            raise ValueError(f"rule {rule_id} already registered")
        RULES[rule_id] = fn
        return fn

    return decorator


def run_all(
    tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame
) -> list[Finding]:
    findings: list[Finding] = []
    for fn in RULES.values():
        findings.extend(fn(tu, tr, rs))
    return findings
