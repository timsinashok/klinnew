"""Extract field-level bounding-box annotations from the demo source PDFs.

Writes a sibling `<pdfname>.annotations.json` next to each PDF.

Field key schema (the contract between this script and the React eCRF):

    assessment:date                  Radiology — exam date
    assessment:method                Radiology — imaging modality
    lesion:<id>:measurement          Radiology — target lesion diameter
    lesion:<id>:status               Radiology — target/non-target status
    nontarget:<id>:status            Radiology — non-target lesion status
    lab:<test_code>:result           Lab — numeric result

Strategy: pdfplumber gives us per-word bboxes. For each known field value
(loaded from data/tu.csv / data/tr.csv / data/lb.csv / data/source_documents.csv)
we anchor on a stable token (lesion id, test code) and pick the same-row
numeric or date token. Confidence < 0.5 is dropped.
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path
from typing import Iterable

import pdfplumber

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PDF_ROOT = ROOT / "demo_file_uploads" / "subjects"

# Visit token in the filename → canonical visit label used in CSVs.
VISIT_TOKEN_TO_LABEL = {
    "SCR": "Screening",
    "BL": "Baseline",
    "Week8": "Week 8",
    "Week16": "Week 16",
    "Week24": "Week 24",
    "Week32": "Week 32",
    "Week40": "Week 40",
    "Week48": "Week 48",
}

NUMERIC_RE = re.compile(r"^-?\d+(?:\.\d+)?$")


def load_csv(name: str) -> list[dict]:
    with (DATA / name).open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def same_row(a: dict, b: dict, tol: float = 4.0) -> bool:
    return abs(a["top"] - b["top"]) <= tol


def words_on_page(page) -> list[dict]:
    return page.extract_words(use_text_flow=True, keep_blank_chars=False)


def annotation(field_key, form, label, page, word_or_bbox, snippet, confidence):
    if isinstance(word_or_bbox, dict):
        bbox = [
            float(word_or_bbox["x0"]),
            float(word_or_bbox["top"]),
            float(word_or_bbox["x1"]),
            float(word_or_bbox["bottom"]),
        ]
    else:
        bbox = [float(x) for x in word_or_bbox]
    return {
        "field_key": field_key,
        "form": form,
        "field_label": label,
        "page": page,
        "bbox": bbox,
        "snippet": snippet,
        "confidence": confidence,
    }


def parse_filename(pdf_path: Path) -> tuple[str, str, str] | None:
    """Returns (doc_id, subject_id, visit_label) or None if unparseable."""
    m = re.match(r"(RAD|LAB|PATH|MDNOTE)-(SUBJ\d+)-([A-Za-z0-9]+)__", pdf_path.name)
    if not m:
        return None
    prefix, subj, token = m.groups()
    visit = VISIT_TOKEN_TO_LABEL.get(token)
    if not visit:
        return None
    return f"{prefix}-{subj}-{token}", subj, visit


# ---------------------------------------------------------------------------
# Per-doc-type extractors
# ---------------------------------------------------------------------------


def extract_radiology(
    pdf, subject: str, visit: str, tu_rows: list[dict]
) -> list[dict]:
    """Annotates assessment date/method + each lesion measurement/status."""
    out: list[dict] = []
    lesion_ids = {
        r["TULNKID"]
        for r in tu_rows
        if r["USUBJID"] == subject and r["TULNKID"]
    }

    for page_idx, page in enumerate(pdf.pages, start=1):
        words = words_on_page(page)
        by_top = defaultdict(list)
        for w in words:
            by_top[round(w["top"])].append(w)

        # Assessment date — "Exam date" label, value to the right on same row.
        for w in words:
            if w["text"] == "Exam" and page_idx == 1:
                next_w = next(
                    (x for x in words if same_row(x, w) and x["x0"] > w["x1"]),
                    None,
                )
                if next_w and next_w["text"].lower() == "date":
                    # The actual date is to the right of "date".
                    date_w = next(
                        (
                            x
                            for x in words
                            if same_row(x, next_w)
                            and x["x0"] > next_w["x1"] + 30
                            and re.match(r"\d{1,2}-[A-Za-z]+-\d{4}", x["text"])
                        ),
                        None,
                    )
                    if date_w:
                        out.append(
                            annotation(
                                "assessment:date",
                                "Tumor Assessment",
                                "Assessment date",
                                page_idx,
                                date_w,
                                date_w["text"],
                                0.95,
                            )
                        )
                        break

        # Imaging method — "Exam" label (not "Exam date") row's value.
        for w in words:
            if w["text"] == "Exam" and page_idx == 1:
                row = sorted(
                    [x for x in words if same_row(x, w) and x["x0"] > w["x1"] + 80],
                    key=lambda x: x["x0"],
                )
                if row and row[0]["text"] in {"CT", "MRI", "PET", "X-RAY"}:
                    out.append(
                        annotation(
                            "assessment:method",
                            "Tumor Assessment",
                            "Imaging method",
                            page_idx,
                            row[0],
                            row[0]["text"],
                            0.9,
                        )
                    )
                    break

        # Per-lesion: anchor on the lesion id token in the "Lesion ID" column.
        for w in words:
            text = w["text"].strip()
            if text not in lesion_ids:
                continue
            # Only treat as anchor if it sits in the leftmost column area.
            if not (40 < w["x0"] < 80):
                continue
            row = [x for x in words if same_row(x, w, tol=3)]
            row_sorted = sorted(row, key=lambda x: x["x0"])
            # Find the first pure-numeric token (the diameter).
            measure = next(
                (
                    x
                    for x in row_sorted
                    if NUMERIC_RE.match(x["text"]) and x["x0"] > w["x1"] + 100
                ),
                None,
            )
            if measure:
                # Combine with the unit token if present.
                unit = next(
                    (
                        x
                        for x in row_sorted
                        if x["x0"] > measure["x1"]
                        and x["text"].lower() in {"mm", "cm"}
                    ),
                    None,
                )
                bbox = [
                    measure["x0"],
                    measure["top"],
                    (unit or measure)["x1"],
                    measure["bottom"],
                ]
                snippet = f"{measure['text']}{' ' + unit['text'] if unit else ''}"
                key = (
                    f"nontarget:{text}:measurement"
                    if text.startswith("NT")
                    else f"lesion:{text}:measurement"
                )
                out.append(
                    annotation(
                        key,
                        "Tumor Assessment",
                        f"{text} diameter",
                        page_idx,
                        bbox,
                        snippet,
                        0.9,
                    )
                )
            # Status token (PRESENT / ABSENT / EQUIVOCAL) on same row.
            status = next(
                (
                    x
                    for x in row_sorted
                    if x["text"] in {"PRESENT", "ABSENT", "EQUIVOCAL"}
                ),
                None,
            )
            if status:
                key = (
                    f"nontarget:{text}:status"
                    if text.startswith("NT")
                    else f"lesion:{text}:status"
                )
                out.append(
                    annotation(
                        key,
                        "Tumor Assessment",
                        f"{text} status",
                        page_idx,
                        status,
                        status["text"],
                        0.9,
                    )
                )
    return out


def extract_lab(
    pdf, subject: str, visit: str, lb_rows: list[dict]
) -> list[dict]:
    """Annotates one row per lab result, anchored on the test code."""
    out: list[dict] = []
    test_codes = {
        r["LBTESTCD"]
        for r in lb_rows
        if r["USUBJID"] == subject and r["VISIT"] == visit and r["LBTESTCD"]
    }

    for page_idx, page in enumerate(pdf.pages, start=1):
        words = words_on_page(page)
        for w in words:
            if w["text"] not in test_codes:
                continue
            # Test code lives in its own column around x ~ 170-200.
            if not (160 < w["x0"] < 220):
                continue
            row = sorted(
                [x for x in words if same_row(x, w, tol=3) and x["x0"] > w["x1"]],
                key=lambda x: x["x0"],
            )
            # Result: first numeric or numeric-with-decimal on the row.
            result = next(
                (x for x in row if NUMERIC_RE.match(x["text"])),
                None,
            )
            if result:
                out.append(
                    annotation(
                        f"lab:{w['text']}:result",
                        "Lab Values",
                        f"{w['text']} result",
                        page_idx,
                        result,
                        result["text"],
                        0.92,
                    )
                )
    return out


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: list[str]) -> int:
    tu_rows = load_csv("tu.csv")
    lb_rows = load_csv("lb.csv")

    # Group by subject for radiology (lesions accumulate across visits).
    tu_by_subject_visit: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for r in tu_rows:
        tu_by_subject_visit[(r["USUBJID"], r["VISIT"])].append(r)

    pdfs = sorted(PDF_ROOT.rglob("*.pdf"))
    if not pdfs:
        print(f"no pdfs under {PDF_ROOT}", file=sys.stderr)
        return 1

    total = 0
    annotated = 0
    skipped: list[str] = []

    for pdf_path in pdfs:
        meta = parse_filename(pdf_path)
        if not meta:
            skipped.append(pdf_path.name)
            continue
        doc_id, subject, visit = meta
        annotations: list[dict] = []
        pages_meta: list[dict] = []
        with pdfplumber.open(pdf_path) as pdf:
            for p in pdf.pages:
                pages_meta.append({"width": float(p.width), "height": float(p.height)})
            kind = pdf_path.name.split("-", 1)[0]
            if kind == "RAD":
                # Radiology references TU rows for *all* visits up through current
                # (so prior-visit lesions still appear). Use everything for the subject.
                tu_for_subject = [
                    r for r in tu_rows if r["USUBJID"] == subject
                ]
                annotations = extract_radiology(pdf, subject, visit, tu_for_subject)
            elif kind == "LAB":
                annotations = extract_lab(pdf, subject, visit, lb_rows)
            else:
                # PATH / MDNOTE — no annotations; just emit empty file so the
                # frontend knows the doc exists and is renderable.
                annotations = []

        doc_type = {
            "RAD": "Radiology Report",
            "LAB": "Central Lab Report",
            "PATH": "Pathology Report",
            "MDNOTE": "Doctor Note",
        }.get(kind, "Source Document")

        payload = {
            "pdf": pdf_path.name,
            "doc_id": doc_id,
            "doc_type": doc_type,
            "subject_id": subject,
            "visit": visit,
            "pages": pages_meta,
            "annotations": annotations,
        }
        out_path = pdf_path.with_name(pdf_path.name + ".annotations.json")
        out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        total += 1
        if annotations:
            annotated += 1
        print(
            f"  {pdf_path.relative_to(ROOT)} → {len(annotations):>2} annotations"
        )

    print()
    print(f"wrote {total} annotation files ({annotated} with ≥1 annotation)")
    if skipped:
        print(f"skipped (unparseable names): {len(skipped)}")
        for n in skipped[:5]:
            print(f"  · {n}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
