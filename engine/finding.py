from dataclasses import asdict, dataclass, field
from typing import Any, Literal

Severity = Literal["LOW", "MEDIUM", "HIGH"]


@dataclass
class Finding:
    rule_id: str
    severity: Severity
    usubjid: str
    visit: str | None
    message: str
    template_id: str
    template_params: dict[str, Any]
    evidence_rows: dict[str, list[dict]]
    citation: str

    def to_dict(self) -> dict:
        return asdict(self)
