import { useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { fetchSourceAnnotations, sourcePdfUrl } from "../api";
import type { SourceAnnotation, SourceDocument } from "../types";

// Bundle the pdf.js worker via Vite so we don't depend on a CDN being up
// (and so the worker version stays in lockstep with pdfjs-dist).
pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

interface Props {
  subject: string;
  visit: string;
  docs: SourceDocument[];
  focusedFieldKey: string | null;
  onHoverAnnotation: (key: string | null) => void;
  open: boolean;
  onToggle: () => void;
}

const PANEL_PAGE_WIDTH = 410;

export function SourcePdfPanel({
  subject,
  visit,
  docs,
  focusedFieldKey,
  onHoverAnnotation,
  open,
  onToggle,
}: Props) {
  // Order docs: RAD, LAB, PATH, MDNOTE (the order coordinators expect).
  const orderedDocs = useMemo(() => {
    const rank: Record<string, number> = {
      "Radiology Report": 0,
      "Central Lab Report": 1,
      "Pathology Report": 2,
      "Doctor Note": 3,
    };
    return [...docs].sort(
      (a, b) => (rank[a.document_type] ?? 9) - (rank[b.document_type] ?? 9),
    );
  }, [docs]);

  const [activeId, setActiveId] = useState<string>(
    orderedDocs[0]?.source_document_id || "",
  );
  useEffect(() => {
    if (
      orderedDocs.length > 0 &&
      !orderedDocs.find((d) => d.source_document_id === activeId)
    ) {
      setActiveId(orderedDocs[0].source_document_id);
    }
  }, [orderedDocs, activeId]);

  const activeDoc = orderedDocs.find((d) => d.source_document_id === activeId);

  if (!open) {
    return (
      <aside className="w-[32px] border-l border-stone-200 bg-white flex flex-col items-center pt-3">
        <button
          onClick={onToggle}
          className="text-2xs text-slate-500 hover:text-accent-700 [writing-mode:vertical-rl] tracking-wider uppercase font-semibold py-2"
          title="Show source PDF"
        >
          Source ↑
        </button>
      </aside>
    );
  }

  return (
    <aside className="w-[440px] border-l border-stone-200 bg-stone-50 flex flex-col">
      <div className="px-3 py-2 border-b border-stone-200 bg-white flex items-center gap-2 shrink-0">
        <div>
          <div className="text-2xs uppercase tracking-wider text-slate-500 font-semibold">
            Source document
          </div>
          <div className="mono text-2xs text-slate-700 truncate max-w-[260px]">
            {activeDoc ? activeDoc.source_document_id : "—"}
          </div>
        </div>
        <button
          onClick={onToggle}
          className="ml-auto text-slate-400 hover:text-slate-900 w-6 h-6 inline-flex items-center justify-center rounded hover:bg-stone-100"
          title="Hide panel"
          aria-label="Hide panel"
        >
          →
        </button>
      </div>
      <DocTabs
        docs={orderedDocs}
        activeId={activeId}
        onChange={setActiveId}
      />
      {activeDoc ? (
        <PdfViewer
          key={activeDoc.source_document_id}
          doc={activeDoc}
          focusedFieldKey={focusedFieldKey}
          onHoverAnnotation={onHoverAnnotation}
        />
      ) : (
        <div className="p-6 text-2xs text-slate-500 italic">
          No source documents for {subject} · {visit}.
        </div>
      )}
    </aside>
  );
}

function DocTabs({
  docs,
  activeId,
  onChange,
}: {
  docs: SourceDocument[];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex border-b border-stone-200 bg-white shrink-0 overflow-x-auto">
      {docs.map((d) => {
        const active = d.source_document_id === activeId;
        return (
          <button
            key={d.source_document_id}
            onClick={() => onChange(d.source_document_id)}
            className={`px-3 py-2 text-2xs font-medium border-b-2 -mb-[1px] whitespace-nowrap ${
              active
                ? "border-accent-600 text-accent-700"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {shortType(d.document_type)}
          </button>
        );
      })}
    </div>
  );
}

function shortType(t: string): string {
  if (t.startsWith("Radiology")) return "Radiology";
  if (t.includes("Lab")) return "Lab";
  if (t.startsWith("Pathology")) return "Pathology";
  if (t.startsWith("Doctor")) return "MD note";
  return t;
}

function PdfViewer({
  doc,
  focusedFieldKey,
  onHoverAnnotation,
}: {
  doc: SourceDocument;
  focusedFieldKey: string | null;
  onHoverAnnotation: (key: string | null) => void;
}) {
  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [annotations, setAnnotations] = useState<SourceAnnotation[]>([]);
  const [pageBaseWidth, setPageBaseWidth] = useState<number>(612);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSourceAnnotations(doc.source_document_id)
      .then((a) => {
        if (cancelled) return;
        setAnnotations(a.annotations || []);
        if (a.pages?.[0]?.width) setPageBaseWidth(a.pages[0].width);
      })
      .catch(() => !cancelled && setAnnotations([]));
    setPageNum(1);
    return () => {
      cancelled = true;
    };
  }, [doc.source_document_id]);

  // When a field is focused on the eCRF, scroll to its page and into view.
  useEffect(() => {
    if (!focusedFieldKey) return;
    const match = annotations.find((a) => a.field_key === focusedFieldKey);
    if (!match) return;
    if (match.page !== pageNum) setPageNum(match.page);
    // After the page swap renders, scroll the highlight into view.
    const t = window.setTimeout(() => {
      const el = containerRef.current?.querySelector(
        `[data-anno-key="${cssEscape(focusedFieldKey)}"]`,
      ) as HTMLElement | null;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => window.clearTimeout(t);
  }, [focusedFieldKey, annotations, pageNum]);

  const scale = PANEL_PAGE_WIDTH / pageBaseWidth;
  const pageAnnotations = annotations.filter((a) => a.page === pageNum);

  return (
    <div className="flex-1 overflow-y-auto" ref={containerRef}>
      <div className="px-3 py-2 flex items-center gap-2 text-2xs text-slate-500 border-b border-stone-100 bg-white">
        <button
          className="btn btn-xs"
          disabled={pageNum <= 1}
          onClick={() => setPageNum((p) => Math.max(1, p - 1))}
        >
          ←
        </button>
        <span className="mono">
          page {pageNum} of {numPages || "—"}
        </span>
        <button
          className="btn btn-xs"
          disabled={pageNum >= numPages}
          onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
        >
          →
        </button>
        <span className="ml-auto">
          <span className="mono">{annotations.length}</span> linked field
          {annotations.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="p-3 flex justify-center">
        <div className="relative inline-block shadow-sm">
          <Document
            file={sourcePdfUrl(doc.source_document_id)}
            onLoadSuccess={({ numPages: n }) => setNumPages(n)}
            loading={<PdfLoading />}
            error={<PdfError />}
          >
            <Page
              pageNumber={pageNum}
              width={PANEL_PAGE_WIDTH}
              renderTextLayer={false}
              renderAnnotationLayer={false}
            />
          </Document>
          <div className="absolute inset-0 pointer-events-none">
            {pageAnnotations.map((a, i) => (
              <Highlight
                key={`${a.field_key}-${i}`}
                anno={a}
                scale={scale}
                focused={a.field_key === focusedFieldKey}
                onHover={onHoverAnnotation}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Highlight({
  anno,
  scale,
  focused,
  onHover,
}: {
  anno: SourceAnnotation;
  scale: number;
  focused: boolean;
  onHover: (key: string | null) => void;
}) {
  const [x0, y0, x1, y1] = anno.bbox;
  // Inflate a touch so the box hugs the line, not the glyph centers.
  const pad = 2;
  const style: React.CSSProperties = {
    left: x0 * scale - pad,
    top: y0 * scale - pad,
    width: (x1 - x0) * scale + pad * 2,
    height: (y1 - y0) * scale + pad * 2,
  };
  const colour = formColour(anno.form);
  return (
    <div
      data-anno-key={anno.field_key}
      className={`absolute pointer-events-auto cursor-pointer rounded-sm transition ${
        focused
          ? `${colour.focused} ring-2 ring-offset-1`
          : `${colour.idle} hover:${colour.hover}`
      }`}
      style={style}
      title={`${anno.field_label}: ${anno.snippet}`}
      onMouseEnter={() => onHover(anno.field_key)}
      onMouseLeave={() => onHover(null)}
    />
  );
}

function formColour(form: string): {
  idle: string;
  hover: string;
  focused: string;
} {
  if (form === "Tumor Assessment") {
    return {
      idle: "bg-accent-400/20 ring-1 ring-accent-400/40",
      hover: "bg-accent-400/40",
      focused: "bg-accent-400/50 ring-accent-600 animate-pulse",
    };
  }
  if (form === "Lab Values") {
    return {
      idle: "bg-emerald-400/20 ring-1 ring-emerald-400/40",
      hover: "bg-emerald-400/40",
      focused: "bg-emerald-400/50 ring-emerald-600 animate-pulse",
    };
  }
  return {
    idle: "bg-amber-300/20 ring-1 ring-amber-400/40",
    hover: "bg-amber-300/40",
    focused: "bg-amber-300/50 ring-amber-600 animate-pulse",
  };
}

function PdfLoading() {
  return (
    <div
      className="bg-white border border-stone-200 flex items-center justify-center text-2xs text-slate-400"
      style={{ width: PANEL_PAGE_WIDTH, height: PANEL_PAGE_WIDTH * 1.29 }}
    >
      Loading PDF…
    </div>
  );
}

function PdfError() {
  return (
    <div
      className="bg-white border border-sev-critical-200 flex items-center justify-center text-2xs text-sev-critical-700"
      style={{ width: PANEL_PAGE_WIDTH, height: PANEL_PAGE_WIDTH * 1.29 }}
    >
      Could not load PDF.
    </div>
  );
}

function cssEscape(s: string): string {
  if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(s);
  return s.replace(/(["\\:])/g, "\\$1");
}
