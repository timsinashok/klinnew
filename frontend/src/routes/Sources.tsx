import { useEffect, useMemo, useState } from "react";
import { fetchSources } from "../api";
import { SkeletonGrid } from "../components/Skeleton";
import type { SourceDocument, SourcesResponse } from "../types";

const TYPE_COLOR: Record<string, string> = {
  "Radiology Report": "bg-sev-suggested-50 text-sev-suggested-700 border-sev-suggested-300",
  "Central Lab Report": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "Pathology Report": "bg-violet-50 text-violet-700 border-violet-200",
  "Doctor Note": "bg-stone-50 text-stone-700 border-stone-300",
};

function typeShort(t: string): string {
  if (t.startsWith("Rad")) return "RAD";
  if (t.startsWith("Central Lab")) return "LAB";
  if (t.startsWith("Path")) return "PATH";
  if (t.startsWith("Doctor")) return "MD";
  return t;
}

export function Sources() {
  const [data, setData] = useState<SourcesResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  useEffect(() => {
    fetchSources()
      .then((d) => {
        setData(d);
        setErr(null);
        if (d.documents.length > 0) setSelectedId(d.documents[0].source_document_id);
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const subjects = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.documents.map((d) => d.subject_id))).sort();
  }, [data]);

  const types = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.documents.map((d) => d.document_type))).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.documents.filter(
      (d) =>
        (subjectFilter === "all" || d.subject_id === subjectFilter) &&
        (typeFilter === "all" || d.document_type === typeFilter),
    );
  }, [data, subjectFilter, typeFilter]);

  const selected = useMemo(() => {
    if (!data || !selectedId) return null;
    return data.documents.find((d) => d.source_document_id === selectedId) || null;
  }, [data, selectedId]);

  return (
    <div className="min-h-full bg-[#fafaf8]">
      <div className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-end justify-between gap-6">
          <div>
            <div className="kicker mb-1">Source documents</div>
            <h1 className="text-[22px] leading-tight serif font-medium">
              Radiology, lab, pathology, and clinic notes
            </h1>
            <div className="text-sm text-slate-600 mt-1">
              {data?.documents.length ?? 0} documents · extracted text feeds
              the eCRF; field mappings carry lineage all the way to SDTM.
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-4">
        {err && (
          <div className="panel border-sev-critical-300 bg-sev-critical-50 text-sev-critical-800 text-sm p-3">
            {err}
          </div>
        )}
        {!data && !err && <SkeletonGrid cols={6} rows={6} />}
        {data && (
          <>
            <div className="flex items-center gap-3 flex-wrap text-sm">
              <label className="flex items-center gap-1.5">
                <span className="kicker">Subject</span>
                <select
                  value={subjectFilter}
                  onChange={(e) => setSubjectFilter(e.target.value)}
                  className="field h-8 text-sm w-32"
                >
                  <option value="all">All</option>
                  {subjects.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1.5">
                <span className="kicker">Type</span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="field h-8 text-sm w-44"
                >
                  <option value="all">All</option>
                  {types.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <span className="ml-auto text-2xs text-slate-500 mono">
                {filtered.length} of {data.documents.length}
              </span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
              <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
                {filtered.map((d) => (
                  <DocRow
                    key={d.source_document_id}
                    doc={d}
                    selected={d.source_document_id === selectedId}
                    onClick={() => setSelectedId(d.source_document_id)}
                  />
                ))}
                {filtered.length === 0 && (
                  <div className="text-2xs italic text-slate-500 p-4">
                    No documents match these filters.
                  </div>
                )}
              </div>
              <div className="lg:sticky lg:top-4 self-start">
                {selected ? (
                  <DocDetail doc={selected} />
                ) : (
                  <div className="panel p-6 text-sm text-slate-500">
                    Select a document on the left.
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DocRow({
  doc,
  selected,
  onClick,
}: {
  doc: SourceDocument;
  selected: boolean;
  onClick: () => void;
}) {
  const colour =
    TYPE_COLOR[doc.document_type] || "bg-stone-50 text-stone-700 border-stone-300";
  return (
    <button
      onClick={onClick}
      className={`panel w-full text-left p-3 transition ${
        selected
          ? "border-accent-300 bg-accent-50/40"
          : "hover:border-stone-300"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-2xs px-1.5 py-0.5 rounded border ${colour}`}>
          {typeShort(doc.document_type)}
        </span>
        <span className="mono text-2xs text-slate-700 font-medium">
          {doc.subject_id}
        </span>
        <span className="mono text-2xs text-slate-500">· {doc.visit}</span>
        <span className="ml-auto mono text-2xs text-slate-400">
          {doc.document_date?.split("T")[0] ?? ""}
        </span>
      </div>
      <div className="text-sm text-slate-700 leading-snug line-clamp-2">
        {doc.source_text}
      </div>
    </button>
  );
}

function DocDetail({ doc }: { doc: SourceDocument }) {
  const colour =
    TYPE_COLOR[doc.document_type] || "bg-stone-50 text-stone-700 border-stone-300";
  return (
    <div className="panel">
      <div className="px-5 py-4 border-b border-stone-200 flex items-start gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-2xs font-medium px-1.5 py-0.5 rounded border ${colour}`}
            >
              {doc.document_type}
            </span>
            <span className="mono text-2xs text-slate-500">
              {doc.source_document_id}
            </span>
          </div>
          <div className="text-base font-semibold">{doc.page_title}</div>
          <div className="text-2xs text-slate-500 mt-0.5 mono">
            {doc.subject_id} · {doc.visit} ·{" "}
            {doc.document_date?.split("T")[0] ?? ""}
          </div>
        </div>
      </div>
      <div className="px-5 py-4 space-y-4">
        <div>
          <div className="kicker mb-1.5">Extracted text</div>
          <div className="bg-stone-50 border border-stone-200 rounded p-3 text-sm leading-relaxed text-slate-800 whitespace-pre-wrap">
            {doc.source_text}
          </div>
        </div>
        <div>
          <div className="kicker mb-1.5">Maps to SDTM</div>
          {doc.mappings.length === 0 ? (
            <div className="text-2xs text-slate-500 italic">
              No explicit mapping recorded for this document.
            </div>
          ) : (
            <div className="space-y-1.5">
              {doc.mappings.map((m, i) => (
                <div
                  key={i}
                  className="border border-accent-200 bg-accent-50/50 rounded px-3 py-2 text-2xs"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="mono font-semibold text-accent-800">
                      → {m.target_domain}
                    </span>
                    <span className="mono text-accent-700">
                      {m.target_fields}
                    </span>
                  </div>
                  <div className="text-slate-700">{m.source_fields}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="text-2xs text-slate-500 border-t border-stone-200 pt-3">
          <span className="kicker">Consumers</span> This document populated{" "}
          <span className="mono text-slate-900">{doc.ecrf_consumer_rows}</span>{" "}
          eCRF row{doc.ecrf_consumer_rows === 1 ? "" : "s"}.
        </div>
      </div>
    </div>
  );
}
