import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchStats, runEngine } from "../api";
import { SeverityChip } from "../components/SeverityBadge";
import {
  clearAllDemoState,
  loadIngested,
  loadSubmissions,
} from "../lib/persistence";
import {
  DEMO_STUDY,
  getCurrentStudyId,
  getStudy,
} from "../lib/studies";
import type { Finding, Severity, Stats, SubjectStat } from "../types";
import { SEV_BADGE_CLASS, SEV_RANK } from "../ui/tokens";

export function Workspace() {
  const currentId = getCurrentStudyId() || DEMO_STUDY.id;
  const currentStudy = getStudy(currentId) || DEMO_STUDY;
  const isDemoStudy = currentStudy.is_demo;

  if (!isDemoStudy) return <EmptyStudy study={currentStudy} />;

  return <DemoStudyWorkspace />;
}

function DemoStudyWorkspace() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    fetchStats()
      .then(setStats)
      .catch((e) => setErr(String(e)));
    runStudy();
  }, []);

  const runStudy = () => {
    setRunning(true);
    const t0 = performance.now();
    runEngine(true)
      .then((r) => {
        setFindings(r.findings);
        setElapsedMs(Math.round(performance.now() - t0));
        setErr(null);
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setRunning(false));
  };

  const counts: Record<Severity, number> = {
    Critical: 0,
    Warning: 0,
    "Suggested Change": 0,
  };
  for (const f of findings || []) counts[f.severity]++;

  const findingsBySubject = useMemo(() => {
    const m = new Map<string, Finding[]>();
    for (const f of findings || []) {
      if (!m.has(f.subject_id)) m.set(f.subject_id, []);
      m.get(f.subject_id)!.push(f);
    }
    return m;
  }, [findings]);

  // Demo state: what visits have actually been submitted in this browser?
  const localState = useMemo(() => {
    const m = new Map<
      string,
      { submitted: Set<string>; ingested: Set<string> }
    >();
    for (const s of stats?.subjects ?? []) {
      m.set(s.subject_id, {
        submitted: new Set(loadSubmissions(s.subject_id)),
        ingested: new Set(loadIngested(s.subject_id)),
      });
    }
    return m;
  }, [stats]);

  const localVisitsSubmitted = useMemo(() => {
    let n = 0;
    for (const v of localState.values()) n += v.submitted.size;
    return n;
  }, [localState]);

  const findingsStream = useMemo(() => {
    return [...(findings || [])]
      .sort((a, b) => {
        const r = SEV_RANK[b.severity] - SEV_RANK[a.severity];
        if (r !== 0) return r;
        return a.subject_id.localeCompare(b.subject_id);
      })
      .slice(0, 8);
  }, [findings]);

  return (
    <div className="min-h-full bg-[#fafaf8]">
      <StudyHeader
        study={stats?.study}
        onRun={runStudy}
        running={running}
        elapsedMs={elapsedMs}
      />

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {err && (
          <div className="panel border-sev-critical-300 bg-sev-critical-50 text-sev-critical-800 text-sm p-3">
            {err}
          </div>
        )}

        <KpiStrip
          totalSubjects={stats?.total_subjects ?? 0}
          visitsDone={
            localVisitsSubmitted > 0
              ? localVisitsSubmitted
              : (stats?.total_visits_completed ?? 0)
          }
          visitsPlanned={stats?.total_visits_planned ?? 0}
          counts={counts}
          loading={findings === null}
          elapsedMs={elapsedMs}
          labRows={stats?.lab_rows ?? 0}
          abnormalLabRows={stats?.abnormal_lab_rows ?? 0}
          sourceDocs={stats?.source_doc_count ?? 0}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-5">
          <SubjectRoster
            subjects={stats?.subjects}
            findingsBySubject={findingsBySubject}
            localState={localState}
            loading={stats === null}
          />
          <FindingsStream
            findings={findingsStream}
            loading={findings === null}
            total={(findings || []).length}
          />
        </div>

        <ActionTiles />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function StudyHeader({
  study,
  onRun,
  running,
  elapsedMs,
}: {
  study: Stats["study"] | undefined;
  onRun: () => void;
  running: boolean;
  elapsedMs: number | null;
}) {
  return (
    <div className="border-b border-stone-200 bg-white">
      <div className="max-w-7xl mx-auto px-8 py-5 flex items-end justify-between gap-6">
        <div>
          <div className="kicker mb-1">Active study</div>
          <h1 className="text-[26px] leading-tight serif font-medium">
            {study?.title ?? "Phase II Solid Tumour"}
          </h1>
          <div className="text-sm text-slate-600 mt-1 mono">
            {study?.study_id ?? "—"} · {study?.site ?? "—"} ·{" "}
            {study?.criteria ?? "—"}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {elapsedMs !== null && (
            <span className="text-2xs mono text-slate-500">
              last run {elapsedMs} ms
            </span>
          )}
          <button
            className="btn"
            onClick={() => {
              if (
                window.confirm(
                  "Reset the demo? This clears all submissions, edits, and resets to the protocol-upload splash.",
                )
              ) {
                clearAllDemoState();
                window.location.assign("/");
              }
            }}
            title="Clear all demo state and return to the protocol upload splash"
          >
            Reset demo
          </button>
          <button
            className="btn btn-primary"
            onClick={onRun}
            disabled={running}
          >
            {running ? "Running…" : "Run study check"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function KpiStrip({
  totalSubjects,
  visitsDone,
  visitsPlanned,
  counts,
  loading,
  labRows,
  abnormalLabRows,
  sourceDocs,
}: {
  totalSubjects: number;
  visitsDone: number;
  visitsPlanned: number;
  counts: Record<Severity, number>;
  loading: boolean;
  elapsedMs: number | null;
  labRows: number;
  abnormalLabRows: number;
  sourceDocs: number;
}) {
  const total = counts.Critical + counts.Warning + counts["Suggested Change"];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      <Kpi
        label="Subjects enrolled"
        value={String(totalSubjects)}
        sub={`${totalSubjects} active`}
      />
      <Kpi
        label="Visits captured"
        value={`${visitsDone}`}
        sub={`of ${visitsPlanned} planned`}
        bar={visitsPlanned > 0 ? visitsDone / visitsPlanned : 0}
      />
      <Kpi
        label="Lab rows"
        value={`${labRows}`}
        sub={`${abnormalLabRows} abnormal`}
      />
      <Kpi
        label="Source documents"
        value={`${sourceDocs}`}
        sub="rad / lab / path / md"
      />
      <Kpi
        label="Open findings"
        value={loading ? "—" : String(total)}
        sub={
          <span className="inline-flex gap-1.5 items-center">
            <Dot tone="critical" /> {counts.Critical}
            <Dot tone="warning" /> {counts.Warning}
            <Dot tone="suggested" /> {counts["Suggested Change"]}
          </span>
        }
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  sub,
  bar,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  bar?: number;
}) {
  return (
    <div className="panel p-4">
      <div className="kicker">{label}</div>
      <div className="text-[26px] font-semibold mono mt-1 leading-none">
        {value}
      </div>
      <div className="text-2xs text-slate-500 mt-2">{sub}</div>
      {bar !== undefined && (
        <div className="mt-2.5 h-1 bg-stone-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent-600"
            style={{ width: `${Math.round(bar * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}

function Dot({ tone }: { tone: "critical" | "warning" | "suggested" }) {
  const cls = {
    critical: "bg-sev-critical-600",
    warning: "bg-sev-warning-600",
    suggested: "bg-sev-suggested-600",
  }[tone];
  return (
    <span className={`inline-block w-1.5 h-1.5 rounded-full ${cls}`} />
  );
}

// ---------------------------------------------------------------------------

function SubjectRoster({
  subjects,
  findingsBySubject,
  localState,
  loading,
}: {
  subjects: SubjectStat[] | undefined;
  findingsBySubject: Map<string, Finding[]>;
  localState: Map<string, { submitted: Set<string>; ingested: Set<string> }>;
  loading: boolean;
}) {
  return (
    <section className="panel overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-200 flex items-baseline justify-between">
        <div>
          <div className="text-sm font-semibold">Subject roster</div>
          <div className="text-2xs text-slate-500 mt-0.5">
            Per-subject visit progress and open findings.
          </div>
        </div>
        <Link
          to="/platform/visit"
          className="text-2xs text-accent-700 hover:text-accent-800 font-medium"
        >
          Open SUBJ001 →
        </Link>
      </div>
      <table className="w-full text-sm" role="grid">
        <thead>
          <tr className="bg-stone-50 border-b border-stone-200">
            <th className="text-left px-4 py-2 kicker">Subject</th>
            <th className="text-left px-4 py-2 kicker">Status</th>
            <th className="text-left px-4 py-2 kicker">Eligibility</th>
            <th className="text-left px-4 py-2 kicker">Visit progress</th>
            <th className="text-left px-4 py-2 kicker">Open findings</th>
            <th className="text-left px-4 py-2 kicker">Last visit</th>
            <th className="text-right px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-stone-100">
                {Array.from({ length: 7 }).map((__, j) => (
                  <td key={j} className="px-4 py-3">
                    <div className="h-3 bg-stone-100 rounded animate-pulse" />
                  </td>
                ))}
              </tr>
            ))}
          {!loading &&
            subjects?.map((s) => {
              const fs = findingsBySubject.get(s.subject_id) || [];
              const crit = fs.filter((f) => f.severity === "Critical").length;
              const warn = fs.filter((f) => f.severity === "Warning").length;
              const sug = fs.filter(
                (f) => f.severity === "Suggested Change",
              ).length;
              const eligibilityIssues = fs.filter(
                (f) => f.rule_id === "DM-001" || f.rule_id === "DM-002",
              );
              const eligible = eligibilityIssues.length === 0;
              return (
                <tr
                  key={s.subject_id}
                  className="border-b border-stone-100 last:border-b-0 hover:bg-stone-50/60"
                >
                  <td className="px-4 py-3 mono text-sm font-medium">
                    {s.subject_id}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-2xs px-1.5 py-0.5 rounded border ${
                        s.status === "Active"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-stone-300 bg-stone-50 text-slate-600"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      title={
                        eligible
                          ? "DM-001 + DM-002 pass"
                          : eligibilityIssues
                              .map((f) => f.rule_id)
                              .join(", ")
                      }
                      className={`text-2xs px-1.5 py-0.5 rounded border ${
                        eligible
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-sev-critical-300 bg-sev-critical-50 text-sev-critical-700"
                      }`}
                    >
                      {eligible ? "✓ Eligible" : `✗ ${eligibilityIssues.length}`}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <VisitDots
                      planned={s.visits_planned}
                      completed={
                        Array.from(
                          localState.get(s.subject_id)?.submitted ?? new Set(),
                        )
                      }
                    />
                    {(() => {
                      const sub = localState.get(s.subject_id);
                      const awaitingCount =
                        s.visits_planned.length - (sub?.submitted.size ?? 0);
                      if (!sub || awaitingCount === 0) return null;
                      const ingested = sub.ingested.size - sub.submitted.size;
                      return (
                        <div className="mt-1">
                          <span className="text-2xs px-1.5 py-0.5 rounded border border-accent-200 bg-accent-50 text-accent-700">
                            {ingested > 0
                              ? "Awaiting submission"
                              : "Awaiting documents"}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {crit > 0 && (
                        <span className={`text-2xs mono px-1.5 py-0.5 rounded border ${SEV_BADGE_CLASS.Critical}`}>
                          C · {crit}
                        </span>
                      )}
                      {warn > 0 && (
                        <span className={`text-2xs mono px-1.5 py-0.5 rounded border ${SEV_BADGE_CLASS.Warning}`}>
                          W · {warn}
                        </span>
                      )}
                      {sug > 0 && (
                        <span className={`text-2xs mono px-1.5 py-0.5 rounded border ${SEV_BADGE_CLASS["Suggested Change"]}`}>
                          S · {sug}
                        </span>
                      )}
                      {fs.length === 0 && (
                        <span className="text-2xs text-slate-400">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 mono text-2xs text-slate-600">
                    {s.last_visit_date || "—"}{" "}
                    <span className="text-slate-400">
                      · {s.latest_visit || ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={{
                        pathname: "/platform/visit",
                        search: `?subject=${s.subject_id}${
                          s.latest_visit
                            ? `&visit=${encodeURIComponent(s.latest_visit)}`
                            : ""
                        }`,
                      }}
                      className="text-2xs text-accent-700 hover:text-accent-800 mono"
                    >
                      open →
                    </Link>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
      <div className="px-4 py-2 bg-stone-50/60 border-t border-stone-200 text-2xs text-slate-500">
        Open any subject to enter their visit; the form adapts to that
        subject's lesions and history.
      </div>
    </section>
  );
}

function VisitDots({
  planned,
  completed,
}: {
  planned: string[];
  completed: string[];
}) {
  return (
    <div className="flex items-center gap-1">
      {planned.map((v) => {
        const done = completed.includes(v);
        return (
          <span
            key={v}
            title={v}
            className={`w-1.5 h-1.5 rounded-full ${
              done ? "bg-slate-700" : "bg-stone-200"
            }`}
          />
        );
      })}
      <span className="text-2xs mono text-slate-500 ml-1.5">
        {completed.length}/{planned.length}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FindingsStream({
  findings,
  loading,
  total,
}: {
  findings: Finding[];
  loading: boolean;
  total: number;
}) {
  return (
    <section className="panel">
      <div className="px-4 py-3 border-b border-stone-200 flex items-baseline justify-between">
        <div>
          <div className="text-sm font-semibold">Recent findings</div>
          <div className="text-2xs text-slate-500 mt-0.5">
            {loading
              ? "Running…"
              : `${findings.length} of ${total} shown · sorted by severity`}
          </div>
        </div>
        <Link
          to="/platform/pipeline"
          className="text-2xs text-accent-700 hover:text-accent-800 font-medium"
        >
          Trace →
        </Link>
      </div>
      <ul>
        {loading &&
          Array.from({ length: 5 }).map((_, i) => (
            <li
              key={i}
              className="border-b border-stone-100 last:border-b-0 px-4 py-3"
            >
              <div className="h-3 bg-stone-100 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-stone-100 rounded animate-pulse w-1/2 mt-2" />
            </li>
          ))}
        {!loading &&
          findings.map((f, i) => (
            <li
              key={i}
              className="border-b border-stone-100 last:border-b-0 px-4 py-3 hover:bg-stone-50/60"
            >
              <div className="flex items-center gap-2 mb-1">
                <SeverityChip severity={f.severity} />
                <span className="mono text-2xs text-slate-500">
                  {f.rule_id}
                </span>
                <span className="mono text-2xs text-slate-500">
                  · {f.subject_id} {f.visit ? `· ${f.visit}` : ""}
                </span>
              </div>
              <div className="text-sm text-slate-700 leading-snug">
                {f.user_message.slice(0, 120)}
                {f.user_message.length > 120 ? "…" : ""}
              </div>
            </li>
          ))}
        {!loading && findings.length === 0 && (
          <li className="px-4 py-6 text-center text-2xs text-slate-500">
            No findings yet. Run a study check.
          </li>
        )}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

function ActionTiles() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Link
        to="/platform/visit"
        className="panel p-5 hover:border-accent-300 transition group"
      >
        <div className="kicker">Coordinator view</div>
        <div className="text-base font-semibold mt-1.5 group-hover:text-accent-700">
          Visit entry
        </div>
        <p className="text-sm text-slate-600 mt-1.5 leading-snug">
          Open the eCRF as a site coordinator would: pre-filled with this
          visit's data, with inline consistency indicators on the fields
          that don't reconcile with prior visits.
        </p>
        <div className="text-sm text-accent-700 mt-3 font-medium">
          Enter the form →
        </div>
      </Link>
      <Link
        to="/platform/pipeline"
        className="panel p-5 hover:border-accent-300 transition group"
      >
        <div className="kicker">How a finding gets caught</div>
        <div className="text-base font-semibold mt-1.5 group-hover:text-accent-700">
          Pipeline trace
        </div>
        <p className="text-sm text-slate-600 mt-1.5 leading-snug">
          Walk one finding from coordinator entry, through SDTM with
          lineage, through the rule that fired, to the message we showed
          the coordinator.
        </p>
        <div className="text-sm text-accent-700 mt-3 font-medium">
          Open the trace →
        </div>
      </Link>
      <Link
        to="/platform/sources"
        className="panel p-5 hover:border-accent-300 transition group"
      >
        <div className="kicker">What fed the eCRF</div>
        <div className="text-base font-semibold mt-1.5 group-hover:text-accent-700">
          Source documents
        </div>
        <p className="text-sm text-slate-600 mt-1.5 leading-snug">
          Radiology, central lab, pathology, and clinic notes. See the
          extracted text and the SDTM fields each document populated.
        </p>
        <div className="text-sm text-accent-700 mt-3 font-medium">
          Browse 80 documents →
        </div>
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------

function EmptyStudy({
  study,
}: {
  study: { id: string; name: string; sponsor: string; criteria: string; protocol_name: string };
}) {
  return (
    <div className="min-h-full bg-[#fafaf8]">
      <div className="border-b border-stone-200 bg-white">
        <div className="max-w-7xl mx-auto px-8 py-5 flex items-end justify-between gap-6">
          <div>
            <div className="kicker mb-1">Active study</div>
            <h1 className="text-[26px] leading-tight serif font-medium">
              {study.name}
            </h1>
            <div className="text-sm text-slate-600 mt-1 mono">
              {study.id} · {study.sponsor} · {study.criteria}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/studies"
              className="btn"
            >
              Switch study
            </Link>
          </div>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-8 py-12 space-y-6">
        <div className="panel p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-3 inline-flex items-center justify-center rounded-full bg-accent-50 text-accent-700">
            <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M16 4v4M8 4v4M3 10h18M5 6h14a2 2 0 012 2v11a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2z" strokeLinecap="round" />
            </svg>
          </div>
          <div className="serif text-[22px] font-medium leading-tight mb-2">
            No subjects enrolled yet
          </div>
          <p className="text-sm text-slate-600 max-w-xl mx-auto leading-snug">
            Klin has parsed{" "}
            <span className="mono">{study.protocol_name}</span> and derived
            the deterministic checks for this study. Subjects will appear
            here as your sites enroll them and capture their first visits.
          </p>
          <div className="text-2xs text-slate-500 mt-6 max-w-xl mx-auto leading-snug">
            Want to see Klin running against a populated study right now?{" "}
            <Link
              to="/studies"
              className="text-accent-700 hover:text-accent-800 underline-offset-2 hover:underline"
            >
              Open the demo study
            </Link>{" "}
            — five subjects, eighty source documents, twelve seeded findings
            covering DM, LB, TU, TR, and RS.
          </div>
        </div>
        <div className="panel p-5">
          <div className="kicker mb-2">What's next</div>
          <ol className="text-sm text-slate-700 space-y-2 list-decimal list-inside leading-snug">
            <li>Enrol the first subject and capture screening data.</li>
            <li>
              At each visit, upload the radiology and central-lab PDFs into the
              eCRF. Klin pre-fills the form fields and runs the consistency
              check.
            </li>
            <li>
              The data manager queue surfaces every Critical / Warning /
              Suggested finding with one-click actions.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
