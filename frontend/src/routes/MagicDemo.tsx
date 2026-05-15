import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchCsv, parseCsv, runEngine } from "../api";
import { ChartTemplate } from "../components/ChartTemplate";
import { EvidenceTable } from "../components/EvidenceTable";
import { SeverityBadge, SeverityChip } from "../components/SeverityBadge";
import { SkeletonGrid } from "../components/Skeleton";
import { Tooltip } from "../components/Tooltip";
import {
  clearSubject,
  editKey,
  loadSubject,
  saveSubject,
  type Persisted,
} from "../lib/persistence";
import type { Finding, Severity } from "../types";
import { SEV_FIELD_CLASS, SEV_RANK } from "../ui/tokens";

const SUBJECT = "SUBJ001";
type TabId = "baseline" | "followup" | "disease";

const TABS: { id: TabId; label: string; form: string }[] = [
  { id: "baseline", label: "Baseline Tumor Assessment", form: "Baseline Tumor Assessment" },
  { id: "followup", label: "Follow-up Tumor Assessment", form: "Follow-up Tumor Assessment" },
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

type ColType = "text" | "number" | "date" | "select";
interface Col {
  key: string;
  label: string;
  type: ColType;
  options?: string[];
  w?: string;
  mono?: boolean;
}

const BASELINE_COLS: Col[] = [
  { key: "lesion_number", label: "Lesion", type: "text", w: "w-20", mono: true },
  {
    key: "lesion_category",
    label: "Category",
    type: "select",
    w: "w-32",
    options: ["TARGET", "NON-TARGET"],
  },
  {
    key: "lesion_site_raw",
    label: "Site",
    type: "select",
    w: "w-40",
    options: [
      "LUNG",
      "LIVER",
      "LYMPH NODE",
      "ADRENAL GLAND",
      "BONE",
      "PERITONEUM",
      "PLEURA",
      "BRAIN",
      "OTHER",
    ],
  },
  { key: "lesion_location_detail", label: "Detail", type: "text", w: "w-44" },
  { key: "measurement_value", label: "mm", type: "number", w: "w-20" },
  {
    key: "measurement_unit_raw",
    label: "Unit",
    type: "select",
    w: "w-16",
    options: ["mm", "cm"],
  },
  {
    key: "lesion_status",
    label: "Status",
    type: "select",
    w: "w-28",
    options: ["PRESENT", "ABSENT", "EQUIVOCAL"],
  },
  {
    key: "assessment_method_raw",
    label: "Method",
    type: "select",
    w: "w-40",
    options: ["CT SCAN", "MRI", "PET", "computed tomography"],
  },
];
const FOLLOWUP_COLS: Col[] = [
  { key: "lesion_number", label: "Lesion", type: "text", w: "w-20", mono: true },
  {
    key: "lesion_category",
    label: "Category",
    type: "select",
    w: "w-32",
    options: ["TARGET", "NON-TARGET", "NEW"],
  },
  { key: "measurement_value", label: "mm", type: "number", w: "w-20" },
  {
    key: "measurement_unit_raw",
    label: "Unit",
    type: "select",
    w: "w-16",
    options: ["mm", "cm"],
  },
  {
    key: "lesion_status",
    label: "Status",
    type: "select",
    w: "w-28",
    options: ["PRESENT", "ABSENT", "EQUIVOCAL"],
  },
  {
    key: "assessment_method_raw",
    label: "Method",
    type: "select",
    w: "w-32",
    options: ["CT SCAN", "MRI", "PET", "computed tomography"],
  },
  { key: "assessment_date", label: "Date", type: "date", w: "w-36" },
  {
    key: "new_lesions_present",
    label: "New?",
    type: "select",
    w: "w-20",
    options: ["No", "Yes"],
  },
];
const DISEASE_COLS: Col[] = [
  {
    key: "response_assessment_date",
    label: "Date",
    type: "date",
    w: "w-36",
  },
  {
    key: "target_lesion_response_raw",
    label: "Target response",
    type: "select",
    w: "w-44",
    options: ["CR", "PR", "SD", "PD", "NE", "Partial Response"],
  },
  {
    key: "non_target_lesion_response_raw",
    label: "Non-target response",
    type: "select",
    w: "w-44",
    options: ["CR", "NON-CR/NON-PD", "PD", "NE"],
  },
  {
    key: "new_lesion_response_raw",
    label: "New lesion response",
    type: "select",
    w: "w-44",
    options: ["NO NEW LESIONS", "NEW LESIONS PRESENT"],
  },
  {
    key: "overall_response_raw",
    label: "Overall response",
    type: "select",
    w: "w-44",
    options: ["CR", "PR", "SD", "PD", "NE", "Partial Response"],
  },
];

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
  if (f.rule_id === "TR-002") return [f.lineage.field];
  return RULE_TO_FIELDS[f.rule_id] || [f.lineage.field];
}

function findingKey(f: Finding): string {
  return `${f.rule_id}|${f.subject_id}|${f.visit ?? ""}|${f.lineage.field}`;
}

function isResolvedByEdit(
  f: Finding,
  edits: Record<string, string>,
): boolean {
  if (f.rule_id !== "TR-002") return false;
  const canonical = (f.template_params as { canonical?: string }).canonical;
  if (!canonical) return false;
  const v = edits[editKey(f.visit, f.lineage.field)];
  return v != null && v.trim() === canonical.trim();
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
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [showSubmit, setShowSubmit] = useState(false);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async (fresh = false) => {
    setLoading(true);
    setFindings(null);
    setShowSubmit(false);
    try {
      const [eb, ef, ed] = await Promise.all([
        fetchCsv("ecrf_baseline.csv").then(parseCsv),
        fetchCsv("ecrf_followup.csv").then(parseCsv),
        fetchCsv("ecrf_disease_response.csv").then(parseCsv),
      ]);
      let ebRows = eb.filter((r) => r.subject_id === SUBJECT);
      let efRows = ef.filter((r) => r.subject_id === SUBJECT);
      let edRows = ed.filter((r) => r.subject_id === SUBJECT);

      const persisted: Persisted = fresh
        ? { edits: {}, acknowledged: [], resolved: [] }
        : loadSubject(SUBJECT);
      ebRows = applyEdits(ebRows, persisted.edits);
      efRows = applyEdits(efRows, persisted.edits);
      edRows = applyEdits(edRows, persisted.edits);
      setBaseline(ebRows);
      setFollowup(efRows);
      setDisease(edRows);
      setEdits(persisted.edits);
      setAcknowledged(new Set(persisted.acknowledged));
      setResolved(new Set(persisted.resolved));
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Persist on every state change.
  useEffect(() => {
    saveSubject(SUBJECT, {
      edits,
      acknowledged: Array.from(acknowledged),
      resolved: Array.from(resolved),
    });
  }, [edits, acknowledged, resolved]);

  // Auto-resolve when an edit matches the canonical value for a TR-002 finding.
  useEffect(() => {
    if (!findings) return;
    setResolved((prev) => {
      const next = new Set(prev);
      for (const f of findings) {
        if (isResolvedByEdit(f, edits)) next.add(findingKey(f));
      }
      return next;
    });
  }, [edits, findings]);

  const subjectFindings = useMemo(() => {
    if (!findings) return [];
    return findings
      .filter((f) => f.subject_id === SUBJECT)
      .filter((f) => !resolved.has(findingKey(f)));
  }, [findings, resolved]);

  const counts: Record<Severity, number> = {
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
    lastTriggerRef.current = document.activeElement as HTMLElement | null;
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

  const writeField = (
    form: TabId,
    visit: string,
    lesionNumber: string | null,
    field: string,
    value: string,
  ) => {
    const setter =
      form === "baseline"
        ? setBaseline
        : form === "followup"
          ? setFollowup
          : setDisease;
    setter((rows) =>
      rows.map((r) => {
        if (r.visit !== visit) return r;
        if (lesionNumber && r.lesion_number !== lesionNumber) return r;
        return { ...r, [field]: value };
      }),
    );
    setEdits((prev) => ({ ...prev, [editKey(visit, field)]: value }));
  };

  const autoFix = (f: Finding) => {
    const canonical = (f.template_params as { canonical?: string }).canonical;
    if (!canonical) return;
    const form: TabId = f.lineage.form.startsWith("Baseline")
      ? "baseline"
      : f.lineage.form.startsWith("Follow-up")
        ? "followup"
        : "disease";
    writeField(form, f.visit || "", null, f.lineage.field, canonical);
    setResolved((p) => new Set(p).add(findingKey(f)));
    closeDrawer();
  };

  const openDrawer = (f: Finding, trigger?: HTMLElement | null) => {
    lastTriggerRef.current = trigger || null;
    setSelectedFinding(f);
  };
  const closeDrawer = () => {
    setSelectedFinding(null);
    setTimeout(() => lastTriggerRef.current?.focus(), 0);
  };

  const reset = async () => {
    clearSubject(SUBJECT);
    await load(true);
  };

  return (
    <div className="flex flex-col h-full">
      <SubHeader
        tab={tab}
        onTab={setTab}
        running={running}
        onRun={runChecks}
        onReset={reset}
        onSubmit={() => setShowSubmit(true)}
        hasFindings={findings !== null}
        unresolvedCritical={unresolvedCritical}
        counts={counts}
        editCount={Object.keys(edits).length}
      />

      <div className="flex-1 overflow-y-auto px-6 pb-8 pt-4">
        {err && (
          <div className="mb-4 text-sm text-sev-critical-800 bg-sev-critical-50 border border-sev-critical-300 rounded p-2">
            {err}
          </div>
        )}
        {loading && (
          <div className="space-y-3">
            <div className="text-2xs text-slate-500">Loading SUBJ001…</div>
            <SkeletonGrid cols={8} rows={5} />
          </div>
        )}
        {!loading && tab === "baseline" && (
          <FormTable
            heading="Baseline Tumor Assessment"
            subheading={`Subject ${SUBJECT} · ${baseline[0]?.assessment_date || ""}`}
            cols={BASELINE_COLS}
            rows={baseline}
            findings={subjectFindings.filter((f) =>
              f.lineage.form.startsWith("Baseline"),
            )}
            edits={edits}
            visit={(r) => r.visit || ""}
            onEdit={(r, col, v) =>
              writeField("baseline", r.visit, r.lesion_number, col.key, v)
            }
            onSelect={openDrawer}
          />
        )}
        {!loading && tab === "followup" && (
          <VisitGroupedTable
            cols={FOLLOWUP_COLS}
            rows={followup}
            findings={subjectFindings.filter((f) =>
              f.lineage.form.startsWith("Follow-up"),
            )}
            edits={edits}
            onEdit={(r, col, v) =>
              writeField("followup", r.visit, r.lesion_number, col.key, v)
            }
            onSelect={openDrawer}
          />
        )}
        {!loading && tab === "disease" && (
          <VisitGroupedTable
            cols={DISEASE_COLS}
            rows={disease}
            findings={subjectFindings.filter((f) =>
              f.lineage.form.startsWith("Disease"),
            )}
            edits={edits}
            singleRowPerVisit
            onEdit={(r, col, v) =>
              writeField("disease", r.visit, null, col.key, v)
            }
            onSelect={openDrawer}
          />
        )}
      </div>

      {selectedFinding && (
        <Drawer
          finding={selectedFinding}
          onClose={closeDrawer}
          onAcknowledge={() => {
            setAcknowledged((p) =>
              new Set(p).add(findingKey(selectedFinding)),
            );
            closeDrawer();
          }}
          onAutoFix={() => autoFix(selectedFinding)}
          onResolve={() => {
            setResolved((p) => new Set(p).add(findingKey(selectedFinding)));
            closeDrawer();
          }}
          acknowledged={acknowledged.has(findingKey(selectedFinding))}
        />
      )}

      {showSubmit && (
        <SubmitModal
          counts={counts}
          editCount={Object.keys(edits).length}
          acknowledgedCount={acknowledged.size}
          resolvedCount={resolved.size}
          onClose={() => setShowSubmit(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SubHeader({
  tab,
  onTab,
  running,
  onRun,
  onReset,
  onSubmit,
  hasFindings,
  unresolvedCritical,
  counts,
  editCount,
}: {
  tab: TabId;
  onTab: (t: TabId) => void;
  running: boolean;
  onRun: () => void;
  onReset: () => void;
  onSubmit: () => void;
  hasFindings: boolean;
  unresolvedCritical: number;
  counts: Record<Severity, number>;
  editCount: number;
}) {
  const submitBlocked = unresolvedCritical > 0 || !hasFindings;
  return (
    <div className="border-b border-slate-200 bg-white">
      <div className="flex items-center px-6 h-12 gap-4">
        <div className="text-sm font-semibold">Magic Demo</div>
        <span className="text-2xs text-slate-500 mono">
          SUBJ001 · KLIN-ONC-DEMO-001
        </span>
        <div className="ml-auto flex items-center gap-3">
          {hasFindings && (
            <div className="hidden md:flex items-center gap-1.5 text-2xs text-slate-500 mr-2">
              <Counter
                label="C"
                count={counts.Critical}
                tone="critical"
              />
              <Counter label="W" count={counts.Warning} tone="warning" />
              <Counter
                label="S"
                count={counts["Suggested Change"]}
                tone="suggested"
              />
              {editCount > 0 && (
                <span className="ml-2 text-2xs text-accent-700 bg-accent-50 border border-accent-200 px-1.5 py-0.5 rounded mono">
                  {editCount} edits
                </span>
              )}
            </div>
          )}
          <Tooltip text="Translations are generated by Claude Haiku 4.5 with a deterministic fallback. The deterministic engine is unaffected." />
          <button className="btn" onClick={onReset}>
            Reset
          </button>
          <button
            className="btn btn-primary"
            onClick={onRun}
            disabled={running}
          >
            {running ? "Running…" : "Run consistency check"}
          </button>
          <button
            className={`btn ${submitBlocked ? "" : "btn-primary"}`}
            disabled={submitBlocked}
            onClick={onSubmit}
            title={
              unresolvedCritical
                ? `${unresolvedCritical} critical finding(s) must be acknowledged or resolved.`
                : ""
            }
          >
            Submit
          </button>
        </div>
      </div>
      <div className="flex gap-0 px-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className={`text-sm px-3 py-2 -mb-px border-b-2 ${
              t.id === tab
                ? "border-accent-700 text-accent-700 font-medium"
                : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function Counter({
  label,
  count,
  tone,
}: {
  label: string;
  count: number;
  tone: "critical" | "warning" | "suggested";
}) {
  const cls = {
    critical:
      "bg-sev-critical-50 text-sev-critical-700 border-sev-critical-300",
    warning: "bg-sev-warning-50 text-sev-warning-700 border-sev-warning-300",
    suggested:
      "bg-sev-suggested-50 text-sev-suggested-700 border-sev-suggested-300",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1 text-2xs mono px-1.5 py-0.5 rounded border ${cls}`}
    >
      <span className="font-semibold">{label}</span>
      {count}
    </span>
  );
}

// ---------------------------------------------------------------------------

function VisitGroupedTable({
  cols,
  rows,
  findings,
  edits,
  singleRowPerVisit,
  onEdit,
  onSelect,
}: {
  cols: Col[];
  rows: Record<string, string>[];
  findings: Finding[];
  edits: Record<string, string>;
  singleRowPerVisit?: boolean;
  onEdit: (r: Record<string, string>, col: Col, v: string) => void;
  onSelect: (f: Finding, trigger?: HTMLElement | null) => void;
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
    <div className="space-y-5">
      {visits.map((v) => {
        const visitRows = byVisit.get(v)!;
        const visitFindings = findings.filter((f) => (f.visit || "") === v);
        const flagged = visitFindings.length > 0;
        return (
          <FormTable
            key={v}
            heading={v}
            subheading={`${visitRows[0]?.assessment_date || visitRows[0]?.response_assessment_date || ""} · ${visitRows[0]?.assessment_method_raw || ""}`}
            cols={cols}
            rows={singleRowPerVisit ? visitRows.slice(0, 1) : visitRows}
            findings={visitFindings}
            edits={edits}
            visit={() => v}
            onEdit={onEdit}
            onSelect={onSelect}
            flagged={flagged}
          />
        );
      })}
    </div>
  );
}

function FormTable({
  heading,
  subheading,
  cols,
  rows,
  findings,
  edits,
  visit,
  onEdit,
  onSelect,
  flagged,
}: {
  heading: string;
  subheading?: string;
  cols: Col[];
  rows: Record<string, string>[];
  findings: Finding[];
  edits: Record<string, string>;
  visit: (r: Record<string, string>) => string;
  onEdit: (r: Record<string, string>, col: Col, v: string) => void;
  onSelect: (f: Finding, trigger?: HTMLElement | null) => void;
  flagged?: boolean;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3 mb-2">
        <h2 className="text-sm font-semibold">{heading}</h2>
        {subheading && (
          <span className="text-2xs text-slate-500 mono">{subheading}</span>
        )}
        {flagged && (
          <span className="ml-auto text-2xs text-sev-critical-700">
            {findings.length} finding{findings.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              {cols.map((c) => (
                <th
                  key={c.key}
                  className={`text-left px-3 py-1.5 font-medium kicker ${c.w || ""}`}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const v = visit(r);
              return (
                <tr
                  key={`${v}|${r.lesion_number || ""}|${r.response_assessment_date || ""}`}
                  className="border-b border-slate-100 last:border-b-0 align-top"
                >
                  {cols.map((c) => {
                    const cellFindings = findings.filter((f) => {
                      if ((f.visit || "") !== v) return false;
                      const lf = (
                        f.template_params as { lesion_id?: string }
                      ).lesion_id;
                      if (lf && r.lesion_number && lf !== r.lesion_number)
                        return false;
                      return fieldsForRule(f).includes(c.key);
                    });
                    const topSev = topSeverity(cellFindings);
                    const isEdited =
                      edits[editKey(v, c.key)] !== undefined;
                    return (
                      <td key={c.key} className="px-3 py-2">
                        <Field
                          col={c}
                          value={r[c.key] ?? ""}
                          edited={isEdited}
                          severity={topSev}
                          onChange={(val) => onEdit(r, c, val)}
                        />
                        {cellFindings.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {cellFindings.map((f, i) => (
                              <button
                                key={i}
                                onClick={(e) =>
                                  onSelect(f, e.currentTarget)
                                }
                                className="inline-flex items-center gap-1 text-2xs hover:opacity-80"
                                title={f.user_message}
                              >
                                <SeverityChip severity={f.severity} />
                                <span className="mono text-slate-500">
                                  {f.rule_id}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function topSeverity(fs: Finding[]): Severity | null {
  if (fs.length === 0) return null;
  return [...fs].sort(
    (a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity],
  )[0].severity;
}

function Field({
  col,
  value,
  edited,
  severity,
  onChange,
}: {
  col: Col;
  value: string;
  edited: boolean;
  severity: Severity | null;
  onChange: (v: string) => void;
}) {
  const classes = [
    "field",
    col.mono ? "" : "font-sans",
    edited ? "is-edited" : "",
    severity ? SEV_FIELD_CLASS[severity] : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (col.type === "select" && col.options) {
    const options = col.options.includes(value) || !value
      ? col.options
      : [...col.options, value];
    return (
      <select
        className={classes}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      type={col.type}
      className={classes}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
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
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Move focus into the drawer.
    const first = ref.current?.querySelector<HTMLElement>(
      "button, [href], input, select, textarea",
    );
    first?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sev = finding.severity;
  return (
    <aside
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={`${sev} finding ${finding.rule_id}`}
      className="fixed top-11 right-0 bottom-0 w-[480px] border-l border-slate-200 bg-white shadow-xl z-40 flex flex-col"
    >
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-200">
        <SeverityBadge severity={sev} />
        <span className="mono text-2xs text-slate-500">
          {finding.rule_id}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="ml-auto text-slate-400 hover:text-slate-900 text-sm w-6 h-6 inline-flex items-center justify-center rounded hover:bg-slate-100"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <div className="text-sm font-medium">
            <span className="mono">{finding.subject_id}</span>
            {finding.visit && (
              <span className="mono text-slate-500"> · {finding.visit}</span>
            )}
          </div>
          <div className="text-2xs text-slate-500 mt-0.5">
            <span className="kicker">eCRF</span>{" "}
            <span className="mono text-slate-700">
              {finding.lineage.form}
            </span>{" "}
            ·{" "}
            <span className="mono text-slate-700">
              {finding.lineage.field}
            </span>{" "}
            ·{" "}
            <span className="mono text-slate-500">
              {finding.lineage.source_doc}
            </span>
          </div>
        </div>

        <div className="text-sm text-slate-800 leading-snug">
          {finding.user_message}
        </div>

        {finding.suggested_actions.length > 0 && (
          <div>
            <div className="kicker mb-1.5">Suggested actions</div>
            <ul className="text-sm text-slate-700 space-y-1 list-disc list-inside">
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
          <EvidenceTable key={d} title={d} rows={rows} compact />
        ))}

        {finding.citation && (
          <div className="text-2xs italic text-slate-500 border-t border-slate-200 pt-3">
            {finding.citation}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 px-5 py-3 flex flex-wrap gap-2 bg-slate-50">
        {sev === "Suggested Change" && (
          <button className="btn btn-primary" onClick={onAutoFix}>
            Auto-fix and resolve
          </button>
        )}
        {sev === "Warning" && (
          <button
            className="btn btn-primary"
            disabled={acknowledged}
            onClick={onAcknowledge}
          >
            {acknowledged ? "Acknowledged" : "Acknowledge"}
          </button>
        )}
        {sev === "Critical" && (
          <>
            <button
              className="btn btn-danger"
              disabled={acknowledged}
              onClick={onAcknowledge}
            >
              {acknowledged ? "Flagged" : "Flag for investigator"}
            </button>
            <button className="btn" onClick={onResolve}>
              Mark resolved
            </button>
          </>
        )}
        <button className="btn ml-auto" onClick={onClose}>
          Close
        </button>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------

function SubmitModal({
  counts,
  editCount,
  acknowledgedCount,
  resolvedCount,
  onClose,
}: {
  counts: Record<Severity, number>;
  editCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center">
      <div className="panel max-w-md w-full p-5 space-y-3">
        <div className="text-sm font-semibold">Submit visit data</div>
        <div className="text-sm text-slate-600">
          Review the changes before submission. In production this would post
          to the EDC.
        </div>
        <dl className="text-sm space-y-1 mono">
          <Row k="Edits applied" v={editCount} />
          <Row k="Findings resolved" v={resolvedCount} />
          <Row k="Findings acknowledged" v={acknowledgedCount} />
          <Row k="Open Critical" v={counts.Critical} />
          <Row k="Open Warning" v={counts.Warning} />
          <Row k="Open Suggested" v={counts["Suggested Change"]} />
        </dl>
        <div className="flex justify-end gap-2 pt-2">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Confirm submit
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex justify-between">
      <dt className="text-slate-500">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------

function applyEdits(
  rows: Record<string, string>[],
  edits: Record<string, string>,
): Record<string, string>[] {
  if (!edits || Object.keys(edits).length === 0) return rows;
  return rows.map((r) => {
    const v = r.visit || "";
    const next: Record<string, string> = { ...r };
    for (const [k, val] of Object.entries(edits)) {
      const [evisit, field] = k.split("|");
      if (evisit !== v) continue;
      if (field in next) next[field] = val;
    }
    return next;
  });
}
