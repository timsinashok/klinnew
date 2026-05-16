import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { runEngine } from "../api";
import { SeverityChip } from "../components/SeverityBadge";
import { studyPath } from "../lib/studies";
import type { Finding, Severity } from "../types";
import { SEV_RANK } from "../ui/tokens";

const SEVERITIES: Severity[] = ["Critical", "Warning", "Suggested Change"];

export function IssueTracker() {
  const { studyId = "" } = useParams<{ studyId: string }>();
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [sev, setSev] = useState<Severity | "All">("All");
  const [subject, setSubject] = useState<string>("All");
  const [rule, setRule] = useState<string>("All");

  const run = () => {
    setRunning(true);
    runEngine(true)
      .then((r) => {
        setFindings(r.findings);
        setErr(null);
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setRunning(false));
  };

  useEffect(() => {
    run();
  }, []);

  const subjects = useMemo(() => {
    const s = new Set<string>();
    for (const f of findings || []) s.add(f.subject_id);
    return Array.from(s).sort();
  }, [findings]);

  const rules = useMemo(() => {
    const s = new Set<string>();
    for (const f of findings || []) s.add(f.rule_id);
    return Array.from(s).sort();
  }, [findings]);

  const filtered = useMemo(() => {
    return (findings || [])
      .filter((f) => sev === "All" || f.severity === sev)
      .filter((f) => subject === "All" || f.subject_id === subject)
      .filter((f) => rule === "All" || f.rule_id === rule)
      .sort((a, b) => {
        const r = SEV_RANK[b.severity] - SEV_RANK[a.severity];
        if (r !== 0) return r;
        return a.subject_id.localeCompare(b.subject_id);
      });
  }, [findings, sev, subject, rule]);

  const counts: Record<Severity, number> = {
    Critical: 0,
    Warning: 0,
    "Suggested Change": 0,
  };
  for (const f of findings || []) counts[f.severity]++;

  return (
    <div className="min-h-full bg-[#fafaf8]">
      <div className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-end justify-between gap-6">
          <div>
            <div className="kicker mb-1">Data manager view</div>
            <h1 className="text-[24px] leading-tight serif font-medium">
              Issue tracker
            </h1>
            <div className="text-sm text-slate-600 mt-1">
              Every finding the engine has raised across all subjects and
              visits. Filter by severity, subject, or rule to triage.
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={run}
            disabled={running}
          >
            {running ? "Running…" : "Re-run engine"}
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-5">
        {err && (
          <div className="panel border-sev-critical-300 bg-sev-critical-50 text-sev-critical-800 text-sm p-3">
            {err}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Open" value={String((findings || []).length)} tone="all" />
          <Kpi label="Critical" value={String(counts.Critical)} tone="critical" />
          <Kpi label="Warning" value={String(counts.Warning)} tone="warning" />
          <Kpi
            label="Suggested"
            value={String(counts["Suggested Change"])}
            tone="suggested"
          />
        </div>

        <div className="panel p-4 flex flex-wrap items-end gap-4">
          <Filter
            label="Severity"
            value={sev}
            onChange={(v) => setSev(v as Severity | "All")}
            options={["All", ...SEVERITIES]}
          />
          <Filter
            label="Subject"
            value={subject}
            onChange={setSubject}
            options={["All", ...subjects]}
          />
          <Filter
            label="Rule"
            value={rule}
            onChange={setRule}
            options={["All", ...rules]}
          />
          <div className="ml-auto text-2xs text-slate-500">
            <span className="mono text-slate-900">{filtered.length}</span> /{" "}
            {(findings || []).length} shown
          </div>
        </div>

        <section className="panel overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="text-left px-4 py-2 kicker">Severity</th>
                <th className="text-left px-4 py-2 kicker">Rule</th>
                <th className="text-left px-4 py-2 kicker">Subject</th>
                <th className="text-left px-4 py-2 kicker">Visit</th>
                <th className="text-left px-4 py-2 kicker">Form · field</th>
                <th className="text-left px-4 py-2 kicker">Message</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {findings === null &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-stone-100">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-stone-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))}
              {findings !== null && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-2xs text-slate-500"
                  >
                    No findings match the current filters.
                  </td>
                </tr>
              )}
              {findings !== null &&
                filtered.map((f, i) => (
                  <tr
                    key={i}
                    className="border-b border-stone-100 last:border-b-0 hover:bg-stone-50/60 align-top"
                  >
                    <td className="px-4 py-3">
                      <SeverityChip severity={f.severity} />
                    </td>
                    <td className="px-4 py-3 mono text-2xs text-slate-700">
                      {f.rule_id}
                    </td>
                    <td className="px-4 py-3 mono text-sm">{f.subject_id}</td>
                    <td className="px-4 py-3 mono text-2xs text-slate-600">
                      {f.visit || "—"}
                    </td>
                    <td className="px-4 py-3 text-2xs text-slate-600 leading-snug">
                      <div>{f.lineage.form || "—"}</div>
                      <div className="mono text-slate-400">
                        {f.lineage.field || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 leading-snug max-w-md">
                      {f.user_message}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link
                        to={{
                          pathname: studyPath(studyId, "/visit"),
                          search: `?subject=${f.subject_id}${
                            f.visit
                              ? `&visit=${encodeURIComponent(f.visit)}`
                              : ""
                          }`,
                        }}
                        className="text-2xs text-accent-700 hover:text-accent-800 mono"
                      >
                        open visit →
                      </Link>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "all" | "critical" | "warning" | "suggested";
}) {
  const accent = {
    all: "text-slate-900",
    critical: "text-sev-critical-700",
    warning: "text-sev-warning-700",
    suggested: "text-sev-suggested-700",
  }[tone];
  return (
    <div className="panel p-4">
      <div className="kicker">{label}</div>
      <div
        className={`text-[26px] font-semibold mono mt-1 leading-none ${accent}`}
      >
        {value}
      </div>
    </div>
  );
}

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <div className="kicker mb-1">{label}</div>
      <select
        className="field h-9 text-sm min-w-[10rem]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
