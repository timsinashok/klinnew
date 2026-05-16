"""Generate and organize demo upload files.

What it does:
  1. Renders the Study_Protocol sheet from the demo xlsx into a real PDF
     at demo_file_uploads/protocol/KLIN-ONC-DEMO-001_Study_Protocol.pdf.
  2. Moves the 80 bundled source-document PDFs from
     demo_file_uploads/source_documents/ into per-subject / per-visit
     folders under demo_file_uploads/subjects/.
  3. Rewrites demo_file_uploads/source_documents_manifest.csv with a
     `file_path` column pointing at the new layout.

Idempotent: re-runs cleanly.

Usage:
    .venv/bin/python scripts/generate_demo_files.py
"""

from __future__ import annotations

import csv
import re
import shutil
from pathlib import Path

import openpyxl
from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parent.parent
XLSX = ROOT / "data" / "klin_oncology_demo_complete_protocol_dm_lb.xlsx"
DEMO = ROOT / "demo_file_uploads"
PROTOCOL_DIR = DEMO / "protocol"
SUBJECTS_DIR = DEMO / "subjects"
LEGACY_DIR = DEMO / "source_documents"

VISIT_FROM_TOKEN = {
    "SCR": "Screening",
    "BL": "Baseline",
    "Week8": "Week 8",
    "Week16": "Week 16",
    "Week24": "Week 24",
    "Week32": "Week 32",
    "Week40": "Week 40",
    "Week48": "Week 48",
}

# Pattern: <TYPE>-<SUBJECT>-<VISITTOKEN>__<Document_Type>.pdf
NAME_RE = re.compile(
    r"^(?P<type>[A-Z]+)-(?P<subject>SUBJ\d+)-(?P<visit>[A-Za-z0-9]+)__(?P<doc>[A-Za-z0-9_]+)\.pdf$"
)


def build_protocol_pdf() -> Path:
    print(f"reading {XLSX.name}")
    wb = openpyxl.load_workbook(XLSX, read_only=True, data_only=True)
    ws = wb["Study_Protocol"]
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]
    data = [dict(zip(header, r)) for r in rows[1:] if r and r[0] is not None]

    out_dir = PROTOCOL_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "KLIN-ONC-DEMO-001_Study_Protocol.pdf"

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontName="Times-Bold",
        fontSize=18,
        leading=22,
        spaceAfter=6,
    )
    subtitle_style = ParagraphStyle(
        "Subtitle",
        parent=styles["Normal"],
        fontName="Times-Italic",
        fontSize=11,
        textColor=colors.HexColor("#6b7280"),
        spaceAfter=18,
    )
    section_style = ParagraphStyle(
        "Section",
        parent=styles["Heading2"],
        fontName="Times-Bold",
        fontSize=13,
        leading=16,
        spaceBefore=14,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Times-Roman",
        fontSize=10.5,
        leading=14,
        spaceAfter=8,
    )
    meta_style = ParagraphStyle(
        "Meta",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        textColor=colors.HexColor("#6b7280"),
        spaceAfter=14,
    )

    story = [
        Paragraph(
            "KLIN-ONC-DEMO-001 — Phase II Solid Tumour", title_style
        ),
        Paragraph(
            "Synthetic study protocol for the Klin AI demo dataset. No real PHI.",
            subtitle_style,
        ),
        Paragraph(
            "Sponsor: Klin AI · Synthetic Sponsor &nbsp;·&nbsp; "
            "Assessment criteria: RECIST 1.1 &nbsp;·&nbsp; "
            "Version 1.0 &nbsp;·&nbsp; Effective 03 Jan 2026",
            meta_style,
        ),
    ]

    for row in data:
        story.append(
            Paragraph(
                f"{row['section']} &nbsp; {row['title']}",
                section_style,
            )
        )
        story.append(Paragraph(str(row["protocol_text"] or ""), body_style))
        meta_lines = []
        if row.get("data_needed"):
            meta_lines.append(f"<b>Data needed.</b> {row['data_needed']}")
        if row.get("domains_impacted"):
            meta_lines.append(
                f"<b>Domains impacted.</b> {row['domains_impacted']}"
            )
        if row.get("demo_check_ids"):
            meta_lines.append(
                f"<b>Derived checks.</b> {row['demo_check_ids']}"
            )
        if meta_lines:
            story.append(
                Paragraph(
                    "<br/>".join(meta_lines),
                    ParagraphStyle(
                        "Meta2",
                        parent=meta_style,
                        textColor=colors.HexColor("#475569"),
                        fontSize=9,
                        leading=13,
                    ),
                )
            )

    story.append(Spacer(1, 0.3 * inch))
    story.append(
        Paragraph(
            "—— End of synthetic protocol ——",
            ParagraphStyle(
                "End",
                parent=styles["Normal"],
                alignment=1,
                fontSize=9,
                textColor=colors.HexColor("#9ca3af"),
            ),
        )
    )

    doc = SimpleDocTemplate(
        str(out_path),
        pagesize=LETTER,
        leftMargin=0.9 * inch,
        rightMargin=0.9 * inch,
        topMargin=0.9 * inch,
        bottomMargin=0.9 * inch,
        title="KLIN-ONC-DEMO-001 — Phase II Solid Tumour",
        author="Klin AI",
    )
    doc.build(story)
    print(f"  wrote {out_path.relative_to(ROOT)}")
    return out_path


def reorganize_sources() -> dict[str, str]:
    """Move PDFs from source_documents/ into subjects/<S>/<V>/.
    Returns a dict mapping filename → new relative file_path."""
    SUBJECTS_DIR.mkdir(parents=True, exist_ok=True)
    moved: dict[str, str] = {}

    # Find source PDFs: prefer the new flat folder, fall back to the
    # original package folder if the user hasn't run the earlier copy.
    candidates = []
    if LEGACY_DIR.exists():
        candidates.extend(sorted(LEGACY_DIR.glob("*.pdf")))
    pkg_dir = (
        ROOT
        / "klin_oncology_source_documents_full_package"
        / "all_source_documents"
    )
    if pkg_dir.exists() and not candidates:
        candidates.extend(sorted(pkg_dir.glob("*.pdf")))

    for src in candidates:
        m = NAME_RE.match(src.name)
        if not m:
            print(f"  skip (unmatched): {src.name}")
            continue
        subject = m.group("subject")
        visit_token = m.group("visit")
        visit = VISIT_FROM_TOKEN.get(visit_token)
        if visit is None:
            print(f"  skip (unknown visit token {visit_token}): {src.name}")
            continue
        target_dir = SUBJECTS_DIR / subject / visit
        target_dir.mkdir(parents=True, exist_ok=True)
        dst = target_dir / src.name
        if dst.exists() and dst.samefile(src):
            pass  # already in place
        else:
            shutil.copy2(src, dst)
        rel = dst.relative_to(DEMO)
        moved[src.name] = str(rel)

    # Tidy: if the legacy flat folder still has files AND we successfully
    # copied them, delete the flat duplicates so the layout is clean.
    if LEGACY_DIR.exists():
        for p in LEGACY_DIR.glob("*.pdf"):
            if p.name in moved:
                p.unlink()
        # Remove the empty flat dir.
        try:
            LEGACY_DIR.rmdir()
        except OSError:
            pass

    print(f"  organised {len(moved)} PDFs into subjects/<S>/<Visit>/")
    return moved


def rewrite_manifest(moved: dict[str, str]) -> None:
    """Rewrite the manifest copy under demo_file_uploads/ to include a
    file_path column pointing at the new layout."""
    pkg_manifest = (
        ROOT
        / "klin_oncology_source_documents_full_package"
        / "source_documents_manifest.csv"
    )
    if not pkg_manifest.exists():
        print("  skip manifest rewrite (no source manifest)")
        return
    with open(pkg_manifest) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = list(reader.fieldnames or [])
    if "file_path" not in fieldnames:
        fieldnames.append("file_path")
    for r in rows:
        fn = r.get("file_name", "")
        r["file_path"] = moved.get(fn, "")
    out = DEMO / "source_documents_manifest.csv"
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)
    print(f"  rewrote {out.relative_to(ROOT)}")


def main() -> int:
    if not XLSX.exists():
        raise SystemExit(f"missing xlsx: {XLSX}")
    DEMO.mkdir(parents=True, exist_ok=True)
    build_protocol_pdf()
    moved = reorganize_sources()
    rewrite_manifest(moved)
    print("done.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
