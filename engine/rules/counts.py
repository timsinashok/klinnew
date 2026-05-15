import pandas as pd

from engine.finding import Finding
from engine.registry import rule

MAX_TARGETS_PER_SUBJECT = 5
MAX_TARGETS_PER_ORGAN = 2
CITATION = "RECIST 1.1 § 3.1 (max 5 target lesions per subject, max 2 per organ)"


def _evidence_rows(df: pd.DataFrame, mask: pd.Series) -> list[dict]:
    sub = df.loc[mask]
    return sub.astype(object).where(sub.notna(), None).to_dict(orient="records")


def _targets(tu: pd.DataFrame) -> pd.DataFrame:
    return tu[tu["TUSTRESC"] == "TARGET"]


@rule("MAX_TARGETS")
def max_targets(
    tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame
) -> list[Finding]:
    findings: list[Finding] = []
    targets = _targets(tu)

    for usubjid, sub in targets.groupby("USUBJID"):
        count = len(sub)
        if count <= MAX_TARGETS_PER_SUBJECT:
            continue

        by_organ = sub.groupby("TULOC").size().to_dict()

        findings.append(
            Finding(
                rule_id="MAX_TARGETS",
                severity="HIGH",
                usubjid=usubjid,
                visit=None,
                message=(
                    f"Subject has {count} target lesions, exceeding RECIST 1.1 "
                    f"maximum of {MAX_TARGETS_PER_SUBJECT}."
                ),
                template_id="LESION_COUNT",
                template_params={
                    "count": count,
                    "limit": MAX_TARGETS_PER_SUBJECT,
                    "by_organ": by_organ,
                    "mode": "per_subject",
                },
                evidence_rows={
                    "TU": _evidence_rows(
                        tu, (tu["USUBJID"] == usubjid) & (tu["TUSTRESC"] == "TARGET")
                    ),
                },
                citation=CITATION,
            )
        )

    return findings


@rule("MAX_PER_ORGAN")
def max_per_organ(
    tu: pd.DataFrame, tr: pd.DataFrame, rs: pd.DataFrame
) -> list[Finding]:
    findings: list[Finding] = []
    targets = _targets(tu)

    for (usubjid, organ), sub in targets.groupby(["USUBJID", "TULOC"]):
        count = len(sub)
        if count <= MAX_TARGETS_PER_ORGAN:
            continue

        findings.append(
            Finding(
                rule_id="MAX_PER_ORGAN",
                severity="HIGH",
                usubjid=usubjid,
                visit=None,
                message=(
                    f"Subject has {count} target lesions in {organ}, exceeding "
                    f"the RECIST 1.1 per-organ maximum of {MAX_TARGETS_PER_ORGAN}."
                ),
                template_id="LESION_COUNT",
                template_params={
                    "count": count,
                    "limit": MAX_TARGETS_PER_ORGAN,
                    "organ": organ,
                    "mode": "per_organ",
                    "lesion_ids": sorted(sub["TULNKID"].astype(str).tolist()),
                },
                evidence_rows={
                    "TU": _evidence_rows(
                        tu,
                        (tu["USUBJID"] == usubjid)
                        & (tu["TUSTRESC"] == "TARGET")
                        & (tu["TULOC"] == organ),
                    ),
                },
                citation=CITATION,
            )
        )

    return findings
