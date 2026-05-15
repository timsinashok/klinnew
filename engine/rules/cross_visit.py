from datetime import timedelta

import pandas as pd

from engine.finding import Finding, lineage_from_row, rows_to_records
from engine.registry import rule

VISIT_WEEKS = {
    "Baseline": 0,
    "Week 8": 8,
    "Week 16": 16,
    "Week 24": 24,
    "Week 32": 32,
    "Week 40": 40,
    "Week 48": 48,
}
VISIT_WINDOW_DAYS = 7
LARGE_DROP_PCT = 0.65

CITATION_METHOD = "Protocol: imaging method should remain consistent across visits."
CITATION_DROP = (
    "Clinical review: a >65% single-interval drop in a target lesion should be "
    "verified against source imaging."
)
CITATION_WINDOW = (
    "Protocol: assessment dates should fall within ±7 days of the nominal visit."
)


def _ordered_visits(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["__week"] = df["VISIT"].map(VISIT_WEEKS)
    return df.sort_values("__week")


@rule("TR-003", severity="Warning", layer="Cross-visit")
def method_change(data: dict[str, pd.DataFrame]) -> list[Finding]:
    tr = data["tr"]
    findings: list[Finding] = []

    for usubjid, sub in tr.groupby("USUBJID"):
        per_visit = (
            sub[["VISIT", "TRMETHOD"]].drop_duplicates().assign(
                __week=lambda d: d["VISIT"].map(VISIT_WEEKS)
            ).sort_values("__week")
        )
        baseline_method = None
        for _, row in per_visit.iterrows():
            method = row["TRMETHOD"]
            if baseline_method is None and method:
                baseline_method = method
                continue
            if method and baseline_method and method != baseline_method:
                visit = row["VISIT"]
                evidence = tr[
                    (tr["USUBJID"] == usubjid) & (tr["VISIT"] == visit)
                ]
                first = evidence.iloc[0]
                findings.append(
                    Finding(
                        rule_id="TR-003",
                        severity="Warning",
                        subject_id=usubjid,
                        visit=visit,
                        domain="TR",
                        variable="TRMETHOD",
                        lineage=lineage_from_row(first),
                        evidence_rows={"TR": rows_to_records(evidence)},
                        raw_message=(
                            f"Imaging method changed from baseline "
                            f"{baseline_method} to {method} at {visit}."
                        ),
                        template_id="METHOD_CHANGE",
                        template_params={
                            "baseline_method": baseline_method,
                            "current_method": method,
                        },
                        citation=CITATION_METHOD,
                    )
                )

    return findings


@rule("LARGE_DROP", severity="Warning", layer="Cross-visit")
def large_drop(data: dict[str, pd.DataFrame]) -> list[Finding]:
    tu, tr = data["tu"], data["tr"]
    findings: list[Finding] = []

    for usubjid in sorted(tr["USUBJID"].unique()):
        targets = set(
            tu.loc[
                (tu["USUBJID"] == usubjid) & (tu["TUORRES"] == "TARGET"),
                "TULNKID",
            ].astype(str)
        )
        diam = tr[
            (tr["USUBJID"] == usubjid)
            & (tr["TRTESTCD"] == "DIAMETER")
            & (tr["TRLNKID"].astype(str).isin(targets))
        ]
        flagged_visits: dict[str, list[dict]] = {}

        for lnkid, g in diam.groupby("TRLNKID"):
            g = _ordered_visits(g)
            prev_val = None
            prev_visit = None
            for _, row in g.iterrows():
                val = pd.to_numeric(row["TRSTRESN"], errors="coerce")
                if pd.isna(val):
                    continue
                if prev_val is not None and prev_val > 0 and val > 0:
                    pct_drop = (prev_val - val) / prev_val
                    if pct_drop >= LARGE_DROP_PCT:
                        flagged_visits.setdefault(row["VISIT"], []).append(
                            {
                                "lesion_id": lnkid,
                                "prior_visit": prev_visit,
                                "prior_value": float(prev_val),
                                "current_value": float(val),
                                "pct_drop": pct_drop,
                            }
                        )
                prev_val, prev_visit = float(val), row["VISIT"]

        for visit, entries in flagged_visits.items():
            evidence = tr[
                (tr["USUBJID"] == usubjid)
                & (tr["VISIT"] == visit)
                & (tr["TRTESTCD"] == "DIAMETER")
            ]
            first = evidence.iloc[0]
            findings.append(
                Finding(
                    rule_id="LARGE_DROP",
                    severity="Warning",
                    subject_id=usubjid,
                    visit=visit,
                    domain="TR",
                    variable="TRSTRESN",
                    lineage=lineage_from_row(first),
                    evidence_rows={"TR": rows_to_records(evidence)},
                    raw_message=(
                        f"Target sum dropped sharply at {visit}: "
                        + ", ".join(
                            f"{e['lesion_id']} {e['prior_value']:g}→{e['current_value']:g}mm "
                            f"({e['pct_drop'] * 100:.0f}% from {e['prior_visit']})"
                            for e in entries
                        )
                    ),
                    template_id="LARGE_DROP",
                    template_params={"changes": entries},
                    citation=CITATION_DROP,
                )
            )

    return findings


@rule("VISIT_WINDOW", severity="Warning", layer="Visit/date logic")
def visit_window(data: dict[str, pd.DataFrame]) -> list[Finding]:
    tr = data["tr"]
    findings: list[Finding] = []

    for usubjid, sub in tr.groupby("USUBJID"):
        dates = (
            sub[sub["VISIT"].isin(VISIT_WEEKS)][["VISIT", "TRDTC"]]
            .drop_duplicates()
            .assign(__week=lambda d: d["VISIT"].map(VISIT_WEEKS))
            .sort_values("__week")
        )
        if dates.empty:
            continue
        try:
            baseline_date = pd.to_datetime(dates.iloc[0]["TRDTC"])
        except (ValueError, TypeError):
            continue

        for _, row in dates.iloc[1:].iterrows():
            try:
                actual = pd.to_datetime(row["TRDTC"])
            except (ValueError, TypeError):
                continue
            expected = baseline_date + timedelta(days=int(row["__week"]) * 7)
            delta = (actual - expected).days
            if abs(delta) <= VISIT_WINDOW_DAYS:
                continue
            visit = row["VISIT"]
            evidence = tr[
                (tr["USUBJID"] == usubjid) & (tr["VISIT"] == visit)
            ].head(3)
            first = evidence.iloc[0]
            findings.append(
                Finding(
                    rule_id="VISIT_WINDOW",
                    severity="Warning",
                    subject_id=usubjid,
                    visit=visit,
                    domain="TR",
                    variable="TRDTC",
                    lineage=lineage_from_row(first),
                    evidence_rows={"TR": rows_to_records(evidence)},
                    raw_message=(
                        f"{visit} assessment on {actual.date()} is {delta:+d} days "
                        f"from the expected window (target {expected.date()})."
                    ),
                    template_id="VISIT_WINDOW",
                    template_params={
                        "actual_date": str(actual.date()),
                        "expected_date": str(expected.date()),
                        "delta_days": int(delta),
                        "window_days": VISIT_WINDOW_DAYS,
                    },
                    citation=CITATION_WINDOW,
                )
            )

    return findings
