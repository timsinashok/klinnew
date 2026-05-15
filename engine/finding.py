from dataclasses import asdict, dataclass, field
from typing import Any, Literal

import pandas as pd

Severity = Literal["Critical", "Warning", "Suggested Change"]


@dataclass
class Lineage:
    form: str
    field: str
    source_doc: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Finding:
    rule_id: str
    severity: Severity
    subject_id: str
    visit: str | None
    domain: str
    variable: str
    lineage: Lineage
    evidence_rows: dict[str, list[dict]]
    raw_message: str
    template_id: str
    template_params: dict[str, Any] = field(default_factory=dict)
    citation: str = ""
    user_message: str = ""
    suggested_actions: list[str] = field(default_factory=list)
    translator_source: str = ""  # "llm" or "template" once populated

    def to_dict(self) -> dict:
        d = asdict(self)
        d["lineage"] = self.lineage.to_dict()
        return d


def lineage_from_row(row: pd.Series) -> Lineage:
    """Build a Lineage object from any SDTM row carrying source_* columns."""
    return Lineage(
        form=str(row.get("source_ecrf_form") or "").strip(),
        field=str(row.get("source_field") or "").strip(),
        source_doc=str(row.get("source_document_id") or "").strip(),
    )


def rows_to_records(df: pd.DataFrame) -> list[dict]:
    if df.empty:
        return []
    sub = df.astype(object).where(df.notna(), None)
    return sub.to_dict(orient="records")
