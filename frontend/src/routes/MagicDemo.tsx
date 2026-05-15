import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCsv, parseCsv, runEngine } from "../api";
import { ChartTemplate } from "../components/ChartTemplate";
import { EvidenceTable } from "../components/EvidenceTable";
import { SeverityBadge } from "../components/SeverityBadge";
import { SkeletonGrid } from "../components/Skeleton";
import { Tooltip } from "../components/Tooltip";
import type { Finding, Severity } from "../types";

const SUBJECT = "SUBJ001";
type TabId = "baseline" | "followup" | "disease";

const TABS: { id: TabId; label: string; form: string }[] = [
  { id: "baseline", label: "Baseline", form: "Baseline Tumor Assessment" },
  { id: "followup", label: "Follow-up", form: "Follow-up Tumor Assessment" },
  {
    id: "disease",
    label: "Disease Response",
    form: "Disease Response / RECIST Assessment",
  },
];

const VISIT_ORDER = [
  "Baseline",
  "Week 8",
  "Week 16",
  "Week 24",
  "Week 32",
  "Week 40",
  "Week 48",
] as const;

// Which eCRF columns appear in each tab's grid, and their human labels.
const BASELINE_COLS: { key: string; label: string; w?: string }[] = [
  { key: "lesion_number", label: "Lesion #", w: "w-20" },
  { key: "lesion_category", label: "Category", w: "w-28" },
  { key: "lesion_site_raw", label: "Site" },
  { key: "lesion_location_detail", label: "Detail" },
  { key: "measurement_value", label: "Measurement", w: "w-24" },
  { key: "measurement_unit_raw", label: "Unit", w: "w-16" },
  { key: "lesion_status", label: "Status", w: "w-24" },
  { key: "assessment_method_raw", label: "Method", w: "w-40" },
];
const FOLLOWUP_COLS: { key: string; label: string; w?: string }[] = [
  { key: "lesion_number", label: "Lesion #", w: "w-20" },
  { key: "lesion_category", label: "Category", w: "w-28" },
  { key: "measurement_value", label: "Measurement", w: "w-24" },
  { key: "measurement_unit_raw", label: "Unit", w: "w-16" },
  { key: "lesion_status", label: "Status", w: "w-24" },
  { key: "assessment_method_raw", label: "Method", w: "w-32" },
  { key: "assessment_date", label: "Date", w: "w-32" },
  { key: "new_lesions_present", label: "New lesions?", w: "w-24" },
];
const DISEASE_COLS: { key: string; label: string; w?: string }[] = [
  { key: "response_assessment_date", label: "Date", w: "w-32" },
  {
    key: "target_lesion_response_raw",
    label: "Target response",
    w: "w-44",
  },
  {
    key: "non_target_lesion_response_raw",
    label: "Non-target response",
    w: "w-44",
  },
  { key: "new_lesion_response_raw", label: "New lesion response", w: "w-44" },
  { key: "overall_response_raw", label: "Overall response", w: "w-44" },
];

// Map a rule_id to the eCRF column(s) where its inline indicator should land.
const RULE_TO_FIELDS: Record<string, string[]> = {
  "TR-RS-001": ["target_lesion_response_raw", "overall_response_raw"],
  "TR-RS-003": ["overall_response_raw", "non_target_lesion_response_raw"],
  "TU/TR-RS-002": ["new_lesions_present", "overall_response_raw"],
  "TU-002": ["lesion_site_raw", "lesion_number"],
  "TU-TR-001": ["lesion_number"],
  "TR-003": ["assessment_method_raw"],
  "TR-001": ["measurement_value"],
  "TU-001": ["lesion_number"],
  "LARGE_DROP": ["measurement_value"],
  "VISIT_WINDOW": ["assessment_date", "response_assessment_date"],
};

function fieldsForRule(f: Finding): string[] {
  // Standardization findings know their own field from lineage; trust it.
  if (f.rule_id === "TR-002") return [f.lineage.field];
  return RULE_TO_FIELDS[f.rule_id] || [f.lineage.field];
}

function severityRank(s: Severity): number {
  return s === "Critical" ? 3 : s === "Warning" ? 2 : 1;
}

// ---------------------------------------------------------------------------

export function MagicDemo() {
  const [tab, setTab] = useState<TabId>("disease");
  const [baseline, setBaseline] = useState<Record<string, string>[]>([]);
  const [followup, setFollowup] = useState<Record<string, string>[]>([]);
  const [disease, setDisease] = useState<Record<string, string>[]>([]);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<Finding | null>(null);
  const [acknowledged, setAcknowledged] = useState<Set<string>>(new Set());
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const reset = async () => {
    setLoading(true);
    setFindings(null);
    setAcknowledged(new Set());
    setResolved(new Set());
    try {
      const [eb, ef, ed] = await Promise.all([
        fetchCsv("ecrf_baseline.csv").then(parseCsv),
        fetchCsv("ecrf_followup.csv").then(parseCsv),
        fetchCsv("ecrf_disease_response.csv").then(parseCsv),
      ]);
      setBaseline(eb.filter((r) => r.subject_id === SUBJECT));
      setFollowup(ef.filter((r) => r.subject_id === SUBJECT));
      setDisease(ed.filter((r) => r.subject_id === SUBJECT));
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reset();
  }, []);

  const subjectFindings = useMemo(() => {
    if (!findings) return [];
    return findings
      .filter((f) => f.subject_id === SUBJECT)
      .filter((f) => !resolved.has(findingKey(f)));
  }, [findings, resolved]);

  const counts = {
    Critical: subjectFindings.filter((f) => f.severity === "Critical").length,
    Warning: subjectFindings.filter((f) => f.severity === "Warning").length,
    "Suggested Change": subjectFindings.filter(
      (f) => f.severity === "Suggested Change",
    ).length,
  };

  const unresolvedCritical = subjectFindings.filter(
    (f) => f.severity === "Critical" && !acknowledged.has(findingKey(f)),
  ).length;

  const runChecks = async () => {
    setRunning(true);
    try {
      const r = await runEngine(true);
      setFindings(r.findings);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  };

  const autoFix = (f: Finding) => {
    const visit = f.visit;
    const field = f.lineage.field;
    const canonical = (f.template_params?.canonical as string) || "";
    const apply = (rows: Record<string, string>[]) =>
      rows.map((r) =>
        r.subject_id === SUBJECT && r.visit === visit && r[field] !== undefined
          ? { ...r, [field]: canonical }
          : r,
      );
    if (f.lineage.form.startsWith("Baseline")) setBaseline(apply);
    else if (f.lineage.form.startsWith("Follow-up")) setFollowup(apply);
    else if (f.lineage.form.startsWith("Disease")) setDisease(apply);
    setResolved((prev) => new Set(prev).add(findingKey(f)));
    setSelectedFinding(null);
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <Header
        unresolvedCritical={unresolvedCritical}
        running={running}
        onRun={runChecks}
        onReset={reset}
        hasFindings={findings !== null}
      />
      <main className="flex-1 max-w-7xl mx-auto p-6 w-full grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <div>
          <TabStrip active={tab} onSelect={setTab} />
          {loading && (
            <div className="mt-4 space-y-3">
              <div className="text-xs text-neutral-500">Loading SUBJ001…</div>
              <SkeletonGrid cols={8} rows={4} />
            </div>
          )}
          {err && (
            <div className="text-sm text-red-600 mt-6 border border-red-200 bg-red-50 rounded p-3">
              {err}
            </div>
          )}
          {!loading && tab === "baseline" && (
            <BaselineForm
              rows={baseline}
              findings={subjectFindings}
              onSelect={setSelectedFinding}
            />
          )}
          {!loading && tab === "followup" && (
            <VisitGroupedForm
              rows={followup}
              cols={FOLLOWUP_COLS}
              findings={subjectFindings.filter((f) =>
                f.lineage.form.startsWith("Follow-up"),
              )}
              onSelect={setSelectedFinding}
            />
          )}
          {!loading && tab === "disease" && (
            <VisitGroupedForm
              rows={disease}
              cols={DISEASE_COLS}
              findings={subjectFindings.filter((f) =>
                f.lineage.form.startsWith("Disease"),
              )}
              onSelect={setSelectedFinding}
              singleRowPerVisit
            />
          )}
        </div>
        <Sidebar
          counts={counts}
          findings={subjectFindings}
          onSelect={setSelectedFinding}
          ran={findings !== null}
        />
      </main>

      {selectedFinding && (
        <Drawer
          finding={selectedFinding}
          onClose={() => setSelectedFinding(null)}
          onAcknowledge={() => {
            setAcknowledged((p) =>
              new Set(p).add(findingKey(selectedFinding)),
            );
            setSelectedFinding(null);
          }}
          onAutoFix={() => autoFix(selectedFinding)}
          onResolve={() => {
            setResolved((p) => new Set(p).add(findingKey(selectedFinding)));
            setSelectedFinding(null);
          }}
          acknowledged={acknowledged.has(findingKey(selectedFinding))}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Header({
  unresolvedCritical,
  running,
  onRun,
  onReset,
  hasFindings,
}: {
  unresolvedCritical: number;
  running: boolean;
  onRun: () => void;
  onReset: () => void;
  hasFindings: boolean;
}) {
  const blocked = unresolvedCritical > 0;
  return (
    <header className="border-b bg-white px-6 py-3 flex items-center gap-4">
      <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
        ← Home
      </Link>
      <div className="text-sm font-semibold">Magic Demo</div>
      <div className="text-xs text-neutral-500 mono">
        Subject:&nbsp;<span className="text-neutral-900">SUBJ001</span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Tooltip text="LLM-generated messages and suggested actions are produced by Claude Haiku 4.5 from the deterministic engine output. Deterministic templates render the same content if the API is unavailable." />
        <button
          onClick={onReset}
          className="text-sm text-neutral-600 hover:text-neutral-900 px-2 py-1.5"
        >
          Reset
        </button>
        <button
          onClick={onRun}
          disabled={running}
          className="text-sm bg-neutral-900 text-white px-3 py-1.5 rounded hover:bg-neutral-700 disabled:opacity-50"
        >
          {running ? "Running…" : "Run consistency check"}
        </button>
        <button
          disabled={blocked || !hasFindings}
          title={
            blocked
              ? `${unresolvedCritical} critical finding(s) must be flagged or fixed first.`
              : ""
          }
          className={`text-sm px-3 py-1.5 rounded ${
            blocked || !hasFindings
              ? "bg-neutral-200 text-neutral-400 cursor-not-allowed"
              : "bg-emerald-600 text-white hover:bg-emerald-700"
          }`}
        >
          Submit
        </button>
      </div>
    </header>
  );
}

function TabStrip({
  active,
  onSelect,
}: {
  active: TabId;
  onSelect: (t: TabId) => void;
}) {
  return (
    <div className="flex gap-1 border-b">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onSelect(t.id)}
          className={`text-sm px-4 py-2 -mb-px border-b-2 ${
            t.id === active
              ? "border-neutral-900 text-neutral-900 font-medium"
              : "border-transparent text-neutral-500 hover:text-neutral-900"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------

function BaselineForm({
  rows,
  findings,
  onSelect,
}: {
  rows: Record<string, string>[];
  findings: Finding[];
  onSelect: (f: Finding) => void;
}) {
  const baselineFindings = findings.filter((f) =>
    f.lineage.form.startsWith("Baseline"),
  );

  return (
    <div className="mt-4 space-y-3">
      <SectionHeader
        title="Baseline Tumor Assessment"
        date={rows[0]?.assessment_date}
        method={rows[0]?.assessment_method_raw}
      />
      <FieldGrid
        cols={BASELINE_COLS}
        rows={rows}
        findings={baselineFindings}
        onSelect={onSelect}
        rowKey={(r) => `${r.lesion_number}`}
      />
    </div>
  );
}

function VisitGroupedForm({
  rows,
  cols,
  findings,
  onSelect,
  singleRowPerVisit,
}: {
  rows: Record<string, string>[];
  cols: { key: string; label: string; w?: string }[];
  findings: Finding[];
  onSelect: (f: Finding) => void;
  singleRowPerVisit?: boolean;
}) {
  const byVisit = new Map<string, Record<string, string>[]>();
  for (const r of rows) {
    const v = r.visit || "(unknown)";
    if (!byVisit.has(v)) byVisit.set(v, []);
    byVisit.get(v)!.push(r);
  }
  const visits = Array.from(byVisit.keys()).sort(
    (a, b) =>
      (VISIT_ORDER.indexOf(a as (typeof VISIT_ORDER)[number]) + 1 || 99) -
      (VISIT_ORDER.indexOf(b as (typeof VISIT_ORDER)[number]) + 1 || 99),
  );

  return (
    <div className="mt-4 space-y-4">
      {visits.map((v) => {
        const visitRows = byVisit.get(v)!;
        const visitFindings = findings.filter(
          (f) => (f.visit || "") === v,
        );
        return (
          <div key={v}>
            <SectionHeader
              title={v}
              date={
                visitRows[0]?.assessment_date ||
                visitRows[0]?.response_assessment_date
              }
              method={visitRows[0]?.assessment_method_raw}
              flagCount={visitFindings.length}
            />
            <FieldGrid
              cols={cols}
              rows={singleRowPerVisit ? visitRows.slice(0, 1) : visitRows}
              findings={visitFindings}
              onSelect={onSelect}
              rowKey={(r) =>
                singleRowPerVisit
                  ? `${r.visit}`
                  : `${r.visit}|${r.lesion_number}`
              }
            />
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({
  title,
  date,
  method,
  flagCount,
}: {
  title: string;
  date?: string;
  method?: string;
  flagCount?: number;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <div className="text-sm font-medium">{title}</div>
      {date && (
        <div className="text-xs text-neutral-500 mono">{date}</div>
      )}
      {method && (
        <div className="text-xs text-neutral-500">{method}</div>
      )}
      {flagCount && flagCount > 0 ? (
        <div className="ml-auto text-xs text-red-700">
          {flagCount} finding{flagCount === 1 ? "" : "s"}
        </div>
      ) : null}
    </div>
  );
}

function FieldGrid({
  cols,
  rows,
  findings,
  onSelect,
  rowKey,
}: {
  cols: { key: string; label: string; w?: string }[];
  rows: Record<string, string>[];
  findings: Finding[];
  onSelect: (f: Finding) => void;
  rowKey: (r: Record<string, string>) => string;
}) {
  return (
    <div className="border rounded bg-white overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-neutral-50 border-b">
          <tr>
            {cols.map((c) => (
              <th
                key={c.key}
                className={`text-left px-3 py-2 font-medium text-xs text-neutral-600 ${c.w || ""}`}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)} className="border-b last:border-b-0">
              {cols.map((c) => {
                const cellFindings = findings.filter((f) => {
                  if ((f.visit || "") !== (r.visit || "")) return false;
                  if (r.lesion_number && f.template_params) {
                    // For Baseline, only show on the matching lesion when known.
                    const lf =
                      (f.template_params as { lesion_id?: string })?.lesion_id;
                    if (lf && lf !== r.lesion_number) return false;
                  }
                  return fieldsForRule(f).includes(c.key);
                });
                return (
                  <td key={c.key} className="px-3 py-2 align-top">
                    <FieldInput value={r[c.key] ?? ""} />
                    {cellFindings.length > 0 && (
                      <FieldFlags findings={cellFindings} onSelect={onSelect} />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FieldInput({ value }: { value: string }) {
  return (
    <input
      readOnly
      value={value}
      className="mono text-xs w-full bg-neutral-50 border border-neutral-200 rounded px-2 py-1"
    />
  );
}

function FieldFlags({
  findings,
  onSelect,
}: {
  findings: Finding[];
  onSelect: (f: Finding) => void;
}) {
  const top = [...findings].sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {top.map((f, i) => (
        <button
          key={i}
          onClick={() => onSelect(f)}
          className={`text-[10px] mono px-1.5 py-0.5 rounded border ${flagClass(
            f.severity,
          )}`}
          title={f.user_message}
        >
          {f.severity === "Critical"
            ? "!"
            : f.severity === "Warning"
              ? "⚑"
              : "↻"}
          &nbsp;{f.rule_id}
        </button>
      ))}
    </div>
  );
}

function flagClass(s: Severity): string {
  return s === "Critical"
    ? "bg-red-100 border-red-300 text-red-800 hover:bg-red-200"
    : s === "Warning"
      ? "bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200"
      : "bg-blue-100 border-blue-300 text-blue-800 hover:bg-blue-200";
}

// ---------------------------------------------------------------------------

function Sidebar({
  counts,
  findings,
  onSelect,
  ran,
}: {
  counts: Record<Severity, number>;
  findings: Finding[];
  onSelect: (f: Finding) => void;
  ran: boolean;
}) {
  return (
    <aside className="space-y-4">
      <div className="border rounded bg-white p-3">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
          Consistency summary
        </div>
        {!ran ? (
          <div className="text-sm text-neutral-500">
            Click <strong>Run consistency check</strong> to evaluate this form.
          </div>
        ) : (
          <div className="space-y-2">
            <CountRow label="Critical" value={counts.Critical} tone="red" />
            <CountRow label="Warning" value={counts.Warning} tone="amber" />
            <CountRow
              label="Suggested"
              value={counts["Suggested Change"]}
              tone="blue"
            />
          </div>
        )}
      </div>
      {ran && findings.length > 0 && (
        <div className="border rounded bg-white p-3">
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
            All findings
          </div>
          <ul className="space-y-1.5">
            {[...findings]
              .sort(
                (a, b) => severityRank(b.severity) - severityRank(a.severity),
              )
              .map((f, i) => (
                <li key={i}>
                  <button
                    onClick={() => onSelect(f)}
                    className="w-full text-left text-xs hover:bg-neutral-50 rounded px-2 py-1.5 border"
                  >
                    <div className="flex items-center gap-1.5">
                      <SeverityBadge severity={f.severity} />
                      <span className="mono text-neutral-500">{f.rule_id}</span>
                    </div>
                    <div className="text-neutral-700 mt-0.5">
                      {f.visit ? `${f.visit} · ` : ""}
                      {f.user_message.slice(0, 70)}
                      {f.user_message.length > 70 ? "…" : ""}
                    </div>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </aside>
  );
}

function CountRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "red" | "amber" | "blue";
}) {
  const cls = {
    red: "bg-red-50 border-red-200 text-red-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
  }[tone];
  return (
    <div className={`flex items-center justify-between border rounded px-2 py-1 ${cls}`}>
      <span className="text-xs uppercase tracking-wide">{label}</span>
      <span className="mono text-base font-medium">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Drawer({
  finding,
  onClose,
  onAcknowledge,
  onAutoFix,
  onResolve,
  acknowledged,
}: {
  finding: Finding;
  onClose: () => void;
  onAcknowledge: () => void;
  onAutoFix: () => void;
  onResolve: () => void;
  acknowledged: boolean;
}) {
  const sev = finding.severity;
  return (
    <div
      className="fixed inset-0 bg-black/40 z-40 flex justify-end"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl h-full overflow-y-auto p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          <SeverityBadge severity={sev} />
          <span className="mono text-xs text-neutral-500">
            {finding.rule_id}
          </span>
          <button
            onClick={onClose}
            className="ml-auto text-sm text-neutral-500 hover:text-neutral-900"
          >
            close
          </button>
        </div>
        <div>
          <div className="text-sm font-medium">
            <span className="mono">{finding.subject_id}</span>
            {finding.visit && (
              <span className="mono text-neutral-500">
                {" · "}
                {finding.visit}
              </span>
            )}
          </div>
          <div className="text-xs text-neutral-500 mt-0.5">
            eCRF: <span className="mono">{finding.lineage.form}</span>
            {" / "}
            <span className="mono">{finding.lineage.field}</span>
          </div>
        </div>

        <div className="bg-neutral-50 border rounded p-3 text-sm text-neutral-800">
          {finding.user_message}
        </div>

        {finding.suggested_actions.length > 0 && (
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
              Suggested actions
            </div>
            <ul className="text-sm text-neutral-700 space-y-1 list-disc list-inside">
              {finding.suggested_actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {finding.template_id === "RESPONSE_THRESHOLD" && (
          <ChartTemplate finding={finding} />
        )}

        {Object.entries(finding.evidence_rows).map(([d, rows]) => (
          <EvidenceTable key={d} title={d} rows={rows} />
        ))}

        <div className="flex gap-2 pt-2 border-t">
          {sev === "Suggested Change" ? (
            <button
              onClick={onAutoFix}
              className="bg-blue-600 text-white text-sm px-3 py-1.5 rounded hover:bg-blue-700"
            >
              Auto-fix
            </button>
          ) : sev === "Warning" ? (
            <button
              onClick={onAcknowledge}
              disabled={acknowledged}
              className="bg-amber-600 text-white text-sm px-3 py-1.5 rounded hover:bg-amber-700 disabled:opacity-50"
            >
              {acknowledged ? "Acknowledged" : "Acknowledge"}
            </button>
          ) : (
            <>
              <button
                onClick={onAcknowledge}
                disabled={acknowledged}
                className="bg-red-600 text-white text-sm px-3 py-1.5 rounded hover:bg-red-700 disabled:opacity-50"
              >
                {acknowledged ? "Flagged" : "Flag for investigator"}
              </button>
              <button
                onClick={onResolve}
                className="border text-sm px-3 py-1.5 rounded hover:bg-neutral-50"
              >
                Mark resolved
              </button>
            </>
          )}
        </div>
        {finding.citation && (
          <div className="text-xs italic text-neutral-500">
            {finding.citation}
          </div>
        )}
      </div>
    </div>
  );
}

function findingKey(f: Finding): string {
  return `${f.rule_id}|${f.subject_id}|${f.visit ?? ""}|${f.lineage.field}`;
}
