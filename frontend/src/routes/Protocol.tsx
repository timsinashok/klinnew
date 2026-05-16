import { useEffect, useState } from "react";
import { fetchProtocol } from "../api";
import { SkeletonGrid } from "../components/Skeleton";
import type { ProtocolResponse, ProtocolSection } from "../types";

export function Protocol() {
  const [data, setData] = useState<ProtocolResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = () => {
    setExtracting(true);
    fetchProtocol()
      .then((d) => {
        setData(d);
        setErr(null);
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setTimeout(() => setExtracting(false), 600));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-full bg-[#fafaf8]">
      <div className="border-b border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-8 py-5 flex items-end justify-between gap-6">
          <div>
            <div className="kicker mb-1">Study protocol</div>
            <h1 className="text-[26px] leading-tight serif font-medium">
              {data?.title ?? "Phase II Solid Tumour"}
            </h1>
            <div className="text-sm text-slate-600 mt-1 mono">
              {data?.study_id ?? "—"} ·{" "}
              <span className="text-slate-700">
                {data?.sections.length ?? 0} sections ·{" "}
                {data?.all_checks.length ?? 0} derived checks
              </span>
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={load}
            disabled={extracting}
          >
            {extracting ? "Extracting…" : "Re-extract"}
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-6 space-y-4">
        {err && (
          <div className="panel border-sev-critical-300 bg-sev-critical-50 text-sev-critical-800 text-sm p-3">
            {err}
          </div>
        )}
        {!data && !err && <SkeletonGrid cols={4} rows={6} />}
        {data && (
          <>
            <p className="text-sm text-slate-600 max-w-3xl leading-snug">
              Each protocol section was parsed to extract a deterministic
              check that the engine runs against the SDTM data. Click a
              section to see which checks it produced. Today the extraction
              is pre-baked from the workbook; the same pipeline will accept
              real protocol PDFs in v1.
            </p>
            {data.sections.map((s) => (
              <SectionCard
                key={s.section}
                section={s}
                open={expanded === s.section}
                onToggle={() =>
                  setExpanded((p) => (p === s.section ? null : s.section))
                }
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function SectionCard({
  section,
  open,
  onToggle,
}: {
  section: ProtocolSection;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="panel">
      <button
        onClick={onToggle}
        className="w-full text-left px-5 py-4 flex items-start gap-4 hover:bg-stone-50"
      >
        <span className="mono text-2xs font-semibold w-12 shrink-0 text-slate-500 mt-0.5">
          § {section.section}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            {section.title}
          </div>
          <div className="text-2xs text-slate-500 mt-0.5 mono">
            Impacts: {section.domains_impacted} · {section.checks.length} check
            {section.checks.length === 1 ? "" : "s"}
          </div>
        </div>
        <span className="text-2xs mono text-slate-400">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open && (
        <div className="border-t border-stone-200 px-5 py-4 space-y-4 bg-stone-50/40">
          <p className="text-sm text-slate-700 leading-snug max-w-3xl">
            {section.protocol_text}
          </p>
          <div className="text-2xs text-slate-500">
            <span className="kicker">Data needed</span>{" "}
            <span className="mono text-slate-700">{section.data_needed}</span>
          </div>
          {section.checks.length > 0 && (
            <div>
              <div className="kicker mb-2">Derived checks</div>
              <div className="space-y-2">
                {section.checks.map((c) => (
                  <CheckRow key={c.check_id} c={c} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CheckRow({ c }: { c: ProtocolResponse["all_checks"][number] }) {
  const sev = c.severity_when_failed;
  const cls =
    sev === "Critical"
      ? "border-sev-critical-300 bg-sev-critical-50 text-sev-critical-800"
      : sev.startsWith("Warning")
        ? "border-sev-warning-300 bg-sev-warning-50 text-sev-warning-800"
        : sev.startsWith("Suggested")
          ? "border-sev-suggested-300 bg-sev-suggested-50 text-sev-suggested-800"
          : "border-stone-300 bg-stone-100 text-slate-700";
  return (
    <div className="border border-stone-200 rounded p-3 bg-white">
      <div className="flex items-center gap-2 mb-1">
        <span className="mono text-2xs font-semibold text-slate-900">
          {c.check_id}
        </span>
        <span
          className={`text-2xs px-1.5 py-0.5 rounded border ${cls}`}
        >
          {sev}
        </span>
        <span className="ml-auto mono text-2xs text-slate-500">
          {c.domain_scope}
        </span>
      </div>
      <div className="text-sm text-slate-800 leading-snug">
        {c.plain_english_rule}
      </div>
      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2 text-2xs">
        <div className="mono text-slate-500">
          <span className="kicker mr-1.5">Logic</span>
          {c.logic_or_threshold}
        </div>
        <div className="text-slate-500">
          <span className="kicker mr-1.5">Action</span>
          {c.demo_action}
        </div>
      </div>
    </div>
  );
}
