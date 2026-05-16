import { useEffect, useState } from "react";
import type { SourceDocument } from "../types";

type Stage = "select" | "processing" | "done";

export function SourceUploadModal({
  subject,
  visit,
  docs,
  onClose,
  onComplete,
}: {
  subject: string;
  visit: string;
  docs: SourceDocument[];
  onClose: () => void;
  onComplete: () => void;
}) {
  const [stage, setStage] = useState<Stage>("select");
  const [progress, setProgress] = useState(0);
  const [statusLine, setStatusLine] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && stage !== "processing") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, onClose]);

  useEffect(() => {
    if (stage !== "processing") return;
    const start = performance.now();
    const lines = buildStatusLines(docs);
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(1, elapsed / 1500);
      setProgress(pct);
      setStatusLine(
        lines[Math.min(lines.length - 1, Math.floor(pct * lines.length))],
      );
      if (pct < 1) raf = requestAnimationFrame(tick);
      else {
        // Brief settle, then signal done to parent (which runs the cascade).
        setStage("done");
        setTimeout(onComplete, 80);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, docs, onComplete]);

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center px-4"
      onClick={() => stage !== "processing" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="panel w-full max-w-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-stone-200 flex items-center gap-2">
          <div className="text-sm font-semibold">
            Upload source documents
          </div>
          <span className="mono text-2xs text-slate-500">
            · {subject} · {visit}
          </span>
          {stage !== "processing" && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="ml-auto text-slate-400 hover:text-slate-900 w-6 h-6 inline-flex items-center justify-center rounded hover:bg-stone-100"
            >
              ✕
            </button>
          )}
        </div>

        {stage === "select" && (
          <div className="p-5 space-y-3">
            <p className="text-sm text-slate-600 leading-snug">
              Klin already has these documents for {subject} at {visit}. Click{" "}
              <strong>Process documents</strong> to extract the clinical facts
              and pre-fill the eCRF.
            </p>
            <ul className="space-y-2">
              {docs.map((d) => (
                <li
                  key={d.source_document_id}
                  className="border border-stone-200 rounded p-3 bg-white"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-2xs px-1.5 py-0.5 rounded border border-accent-200 bg-accent-50 text-accent-700">
                      {d.document_type}
                    </span>
                    <span className="mono text-2xs text-slate-500">
                      {d.source_document_id}
                    </span>
                    <span className="ml-auto mono text-2xs text-slate-400">
                      {d.document_date?.split("T")[0] || ""}
                    </span>
                  </div>
                  <div className="text-2xs text-slate-700 leading-snug line-clamp-2">
                    {d.source_text}
                  </div>
                  {d.mappings.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {d.mappings.map((m, i) => (
                        <span
                          key={i}
                          className="text-[10px] mono text-slate-600 bg-stone-100 rounded px-1.5 py-0.5"
                        >
                          → {m.target_domain}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              ))}
              {docs.length === 0 && (
                <li className="text-2xs italic text-slate-500 p-4">
                  No source documents pinned for this subject·visit. (You can
                  still proceed; the eCRF will populate from the demo data.)
                </li>
              )}
            </ul>
            <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
              <span className="text-2xs text-slate-500">
                Klin pre-fills, you review and submit.
              </span>
              <button
                className="btn btn-primary ml-auto"
                onClick={() => setStage("processing")}
              >
                Process documents
              </button>
            </div>
          </div>
        )}

        {stage === "processing" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 inline-flex items-center justify-center rounded bg-accent-50 text-accent-700">
                <svg viewBox="0 0 24 24" className="w-5 h-5 animate-spin-slow" fill="none" stroke="currentColor" strokeWidth="1.6">
                  <circle cx="12" cy="12" r="9" strokeDasharray="40 18" />
                </svg>
              </div>
              <div>
                <div className="text-sm font-medium">
                  Extracting clinical facts…
                </div>
                <div className="text-2xs text-slate-500">
                  Reading documents · matching SDTM fields · pre-filling eCRF
                </div>
              </div>
            </div>
            <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-600 transition-[width]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <div className="mono text-2xs text-slate-600 min-h-[1rem]">
              {statusLine}
            </div>
          </div>
        )}

        {stage === "done" && (
          <div className="p-6 text-center">
            <div className="text-sm text-emerald-700">
              ✓ Facts extracted · populating eCRF…
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function buildStatusLines(docs: SourceDocument[]): string[] {
  const lines: string[] = [];
  for (const d of docs) {
    lines.push(`Reading ${d.source_document_id}…`);
    const text = (d.source_text || "").slice(0, 100);
    if (text) lines.push(`  → ${text}…`);
    for (const m of d.mappings) {
      lines.push(`Mapping to ${m.target_domain} · ${m.target_fields}`);
    }
  }
  lines.push("Pre-filling eCRF fields…");
  return lines;
}
