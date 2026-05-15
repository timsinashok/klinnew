import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchCsv, parseCsv, runEngine } from "../api";
import { ChartTemplate } from "../components/ChartTemplate";
import { SeverityChip } from "../components/SeverityBadge";
import {
  clearSubmissions,
  loadSubmissions,
  saveSubmissions,
} from "../lib/persistence";
import type { Finding } from "../types";
import { SEV_RANK } from "../ui/tokens";

const VISITS = [
  "Baseline",
  "Week 8",
  "Week 16",
  "Week 24",
  "Week 32",
  "Week 40",
  "Week 48",
] as const;
type Visit = (typeof VISITS)[number];

const SUBJECTS = ["SUBJ001", "SUBJ002", "SUBJ003", "SUBJ004", "SUBJ005"];

const RESPONSE_OPTIONS = [
  "Complete Response",
  "Partial Response",
  "Stable Disease",
  "Progressive Disease",
  "Not evaluable",
];
const NONTARGET_OPTIONS = [
  "Complete Response",
  "NON-CR/NON-PD",
  "Progressive Disease",
  "Not evaluable",
];
const NEW_LESION_OPTIONS = ["NO NEW LESIONS", "NEW LESIONS PRESENT"];

interface LesionRow {
  id: string;
  category: "TARGET" | "NON-TARGET" | "NEW";
  description: string;
  measurements: Record<string, string>; // visit -> mm
  units: Record<string, string>;
  status: Record<string, string>;
  firstSeenAt: Visit;
}

interface ResponseRecord {
  target: string;
  nontarget: string;
  newlesions: string;
  overall: string;
  date: string;
}

type Disposition = "resolved" | "flagged" | "acknowledged";

function findingKey(f: Finding): string {
  return `${f.rule_id}|${f.subject_id}|${f.visit ?? ""}|${f.lineage.field}`;
}

// ---------------------------------------------------------------------------

export function MagicDemo() {
  const [params, setParams] = useSearchParams();
  const subject = params.get("subject") || "SUBJ001";
  const visitParam = params.get("visit") as Visit | null;

  const [lesions, setLesions] = useState<LesionRow[]>([]);
  const [responses, setResponses] = useState<Record<string, ResponseRecord>>({});
  const [allFindings, setAllFindings] = useState<Finding[] | null>(null);
  const [running, setRunning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispositions, setDispositions] = useState<
    Map<string, Disposition>
  >(new Map());
  const [flagRationale, setFlagRationale] = useState<Record<string, string>>(
    {},
  );
  const [chartFinding, setChartFinding] = useState<Finding | null>(null);
  const [allFindingsOpen, setAllFindingsOpen] = useState(false);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);
  const lastSubjectVisit = useRef<string>("");

  // Load data once.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [eb, ef, ed] = await Promise.all([
        fetchCsv("ecrf_baseline.csv").then(parseCsv),
        fetchCsv("ecrf_followup.csv").then(parseCsv),
        fetchCsv("ecrf_disease_response.csv").then(parseCsv),
      ]);
      const subj = subject;
      const baselineRows = eb.filter((r) => r.subject_id === subj);
      const followupRows = ef.filter((r) => r.subject_id === subj);
      const responseRows = ed.filter((r) => r.subject_id === subj);

      const lesionIds = new Set<string>();
      baselineRows.forEach((r) => lesionIds.add(r.lesion_number));
      followupRows.forEach((r) => lesionIds.add(r.lesion_number));

      const next: LesionRow[] = [];
      for (const id of lesionIds) {
        const bl = baselineRows.find((r) => r.lesion_number === id);
        const newAt = followupRows.find(
          (r) => r.lesion_number === id && r.lesion_category === "NEW",
        );
        const category = bl
          ? ((bl.lesion_category as "TARGET" | "NON-TARGET") ?? "TARGET")
          : newAt
            ? "NEW"
            : "TARGET";
        const description =
          bl?.lesion_description ||
          followupRows.find((r) => r.lesion_number === id)?.lesion_description ||
          "";
        const measurements: Record<string, string> = {};
        const units: Record<string, string> = {};
        const status: Record<string, string> = {};
        if (bl) {
          measurements["Baseline"] = bl.measurement_value || "";
          units["Baseline"] = bl.measurement_unit_raw || "mm";
          status["Baseline"] = bl.lesion_status || "PRESENT";
        }
        for (const r of followupRows.filter((r) => r.lesion_number === id)) {
          measurements[r.visit] = r.measurement_value || "";
          units[r.visit] = r.measurement_unit_raw || "mm";
          status[r.visit] = r.lesion_status || "PRESENT";
        }
        const firstSeen = bl
          ? "Baseline"
          : (followupRows.find((r) => r.lesion_number === id)?.visit as Visit) ||
            "Baseline";
        next.push({
          id,
          category,
          description,
          measurements,
          units,
          status,
          firstSeenAt: firstSeen as Visit,
        });
      }
      // Deterministic order: targets, then non-targets, then NEW; within each by id.
      next.sort((a, b) => {
        const rank = { TARGET: 0, "NON-TARGET": 1, NEW: 2 } as const;
        if (rank[a.category] !== rank[b.category])
          return rank[a.category] - rank[b.category];
        return a.id.localeCompare(b.id);
      });
      setLesions(next);

      const respMap: Record<string, ResponseRecord> = {};
      for (const r of responseRows) {
        respMap[r.visit] = {
          target: r.target_lesion_response_raw || "",
          nontarget: r.non_target_lesion_response_raw || "",
          newlesions: r.new_lesion_response_raw || "",
          overall: r.overall_response_raw || "",
          date: r.response_assessment_date || "",
        };
      }
      setResponses(respMap);

      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setLoading(false);
    }
  }, [subject]);

  useEffect(() => {
    load();
  }, [load]);

  // Load submission state for this subject from localStorage.
  useEffect(() => {
    setSubmitted(new Set(loadSubmissions(subject)));
    setJustSubmitted(null);
  }, [subject]);

  // Findings for this subject — used elsewhere for trajectory dots and the
  // workspace dashboard.
  const subjectFindings = useMemo(
    () =>
      (allFindings ?? []).filter((f) => f.subject_id === subject),
    [allFindings, subject],
  );

  // The first visit the coordinator hasn't submitted yet. That's where we
  // pick up from after a reload or subject switch.
  const nextVisit: Visit | null = useMemo(() => {
    for (const v of VISITS) if (!submitted.has(v)) return v as Visit;
    return null;
  }, [submitted]);

  // Resolve the active visit. The URL param wins only if it's a visit the
  // user is allowed to be on: either already submitted (read-only) or the
  // next one in line. Otherwise we drop the user at nextVisit.
  const visit: Visit = useMemo(() => {
    if (visitParam && (VISITS as readonly string[]).includes(visitParam)) {
      if (submitted.has(visitParam) || visitParam === nextVisit) {
        return visitParam as Visit;
      }
    }
    return (nextVisit ?? VISITS[VISITS.length - 1]) as Visit;
  }, [visitParam, submitted, nextVisit]);

  const visitSubmitted = submitted.has(visit);
  const endOfStudy = nextVisit === null;

  // Reset dispositions when subject/visit changes.
  useEffect(() => {
    const key = `${subject}|${visit}`;
    if (lastSubjectVisit.current !== key) {
      lastSubjectVisit.current = key;
      setChartFinding(null);
      setAllFindingsOpen(false);
    }
  }, [subject, visit]);

  // Sub-set of visits up to and including the current one (for the table).
  const visitsThroughCurrent = useMemo<Visit[]>(() => {
    const cur = VISITS.indexOf(visit);
    return VISITS.slice(0, cur + 1) as unknown as Visit[];
  }, [visit]);

  // Findings for the chosen subject + visit.
  const visitFindings = useMemo(() => {
    if (!allFindings) return [];
    return allFindings.filter(
      (f) => f.subject_id === subject && (f.visit || "") === visit,
    );
  }, [allFindings, subject, visit]);

  const openFindings = useMemo(
    () => visitFindings.filter((f) => !dispositions.has(findingKey(f))),
    [visitFindings, dispositions],
  );
  const dispositionedFindings = useMemo(
    () => visitFindings.filter((f) => dispositions.has(findingKey(f))),
    [visitFindings, dispositions],
  );

  const heroFinding = useMemo(() => {
    if (openFindings.length === 0) return null;
    return [...openFindings].sort(
      (a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity],
    )[0];
  }, [openFindings]);

  const hasOpenCritical = openFindings.some((f) => f.severity === "Critical");

  // Map of visit -> highest open severity for this subject (used by trajectory + RunBar hint).
  const findingsByVisit = useMemo(() => {
    const m = new Map<string, Finding["severity"]>();
    for (const f of subjectFindings) {
      const v = f.visit || "";
      const prev = m.get(v);
      if (
        !prev ||
        SEV_RANK[f.severity as keyof typeof SEV_RANK] >
          SEV_RANK[prev as keyof typeof SEV_RANK]
      )
        m.set(v, f.severity);
    }
    return m;
  }, [subjectFindings]);

  // Sum of target diameters at the current visit.
  const targetSum = useMemo(() => {
    return lesions
      .filter((l) => l.category === "TARGET")
      .reduce(
        (acc, l) => acc + (parseFloat(l.measurements[visit] || "") || 0),
        0,
      );
  }, [lesions, visit]);
  const baselineSum = useMemo(() => {
    return lesions
      .filter((l) => l.category === "TARGET")
      .reduce(
        (acc, l) => acc + (parseFloat(l.measurements["Baseline"] || "") || 0),
        0,
      );
  }, [lesions]);
  const pctChange =
    baselineSum > 0 ? ((targetSum - baselineSum) / baselineSum) * 100 : 0;

  const updateMeasurement = (id: string, value: string) => {
    setLesions((rows) =>
      rows.map((r) =>
        r.id === id
          ? { ...r, measurements: { ...r.measurements, [visit]: value } }
          : r,
      ),
    );
  };

  const updateStatus = (id: string, value: string) => {
    setLesions((rows) =>
      rows.map((r) =>
        r.id === id ? { ...r, status: { ...r.status, [visit]: value } } : r,
      ),
    );
  };

  const updateResponse = (key: keyof ResponseRecord, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [visit]: { ...(prev[visit] || empty()), [key]: value },
    }));
  };

  const disposeFinding = (f: Finding, d: Disposition) => {
    setDispositions((prev) => {
      const next = new Map(prev);
      next.set(findingKey(f), d);
      return next;
    });
  };

  const applyFix = (f: Finding) => {
    // Standardization: write canonical back into the form (visible follow-up).
    if (f.template_id === "STANDARDIZATION") {
      const canonical =
        (f.template_params as { canonical?: string }).canonical || "";
      if (canonical && f.lineage.field === "assessment_method_raw") {
        // (We don't currently surface method in the visit form; the action
        // is still meaningful from a queue-management perspective.)
      }
      if (canonical && f.lineage.field === "target_lesion_response_raw") {
        setResponses((prev) => ({
          ...prev,
          [visit]: { ...(prev[visit] || empty()), target: canonical },
        }));
      }
      if (canonical && f.lineage.field === "overall_response_raw") {
        setResponses((prev) => ({
          ...prev,
          [visit]: { ...(prev[visit] || empty()), overall: canonical },
        }));
      }
    }
    disposeFinding(f, "resolved");
  };

  const changeToSD = (f: Finding) => {
    setResponses((prev) => ({
      ...prev,
      [visit]: {
        ...(prev[visit] || empty()),
        target: "Stable Disease",
        overall: "Stable Disease",
      },
    }));
    disposeFinding(f, "resolved");
  };

  const flagForReview = (f: Finding, rationale: string) => {
    setFlagRationale((prev) => ({ ...prev, [findingKey(f)]: rationale }));
    disposeFinding(f, "flagged");
  };

  const acknowledge = (f: Finding) => disposeFinding(f, "acknowledged");

  const ran = allFindings !== null;
  const submitBlocked = visitSubmitted || !ran || hasOpenCritical;
  const responseRow = responses[visit] || empty();

  const runCheckForThisVisit = async () => {
    setRunning(true);
    try {
      const r = await runEngine(true);
      setAllFindings(r.findings);
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  };

  const submitVisit = () => {
    const next = new Set(submitted);
    next.add(visit);
    setSubmitted(next);
    saveSubmissions(subject, Array.from(next));
    setJustSubmitted(visit);
    setAllFindings(null);
    setDispositions(new Map());
    // Advance to the next visit in the trajectory.
    const idx = VISITS.indexOf(visit);
    for (let i = idx + 1; i < VISITS.length; i++) {
      if (!next.has(VISITS[i])) {
        setParams({ subject, visit: VISITS[i] });
        return;
      }
    }
    // No further visits — sit on the just-submitted visit; UI will render
    // the end-of-study state via `endOfStudy`.
    setParams({ subject, visit });
  };

  const resetSubject = () => {
    clearSubmissions(subject);
    setSubmitted(new Set());
    setAllFindings(null);
    setDispositions(new Map());
    setJustSubmitted(null);
    setParams({ subject });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <PatientHeader
          subject={subject}
          visit={visit}
          visitDate={responseRow.date || lesions[0]?.measurements[visit] ? "" : ""}
          completedVisits={
            Array.from(submitted) as Visit[]
          }
          activeVisit={visit}
          findingsByVisit={findingsByVisit}
          onSubject={(s) => setParams({ subject: s })}
          onVisit={(v) => setParams({ subject, visit: v })}
        />

        <div className="max-w-6xl mx-auto px-8 py-6 space-y-8">
          {err && (
            <div className="text-sm text-sev-critical-800 bg-sev-critical-50 border border-sev-critical-300 rounded p-3">
              {err}
            </div>
          )}

          {justSubmitted && (
            <div className="border-l-[3px] border-emerald-600 bg-emerald-50/70 px-5 py-3 flex items-start gap-3">
              <span className="text-2xs font-semibold tracking-wider px-1.5 py-0.5 bg-emerald-600 text-white">
                Submitted
              </span>
              <div className="text-sm text-slate-800">
                <span className="mono">{justSubmitted}</span> submitted for{" "}
                <span className="mono">{subject}</span>.{" "}
                {endOfStudy
                  ? "End of study reached."
                  : `Now entering ${visit}.`}
              </div>
            </div>
          )}

          {endOfStudy ? (
            <EndOfStudy subject={subject} onReset={resetSubject} />
          ) : visitSubmitted ? (
            <ReadOnlyVisitBanner visit={visit} />
          ) : (
            <RunBar
              ran={ran}
              running={running}
              findingCount={openFindings.length}
              onRun={runCheckForThisVisit}
              visit={visit}
            />
          )}

          {loading ? (
            <SkeletonTwo />
          ) : (
            <>
              <TumorAssessment
                lesions={lesions}
                visit={visit}
                visitsThrough={visitsThroughCurrent}
                onUpdate={updateMeasurement}
                onUpdateStatus={updateStatus}
                targetSum={targetSum}
                baselineSum={baselineSum}
                pctChange={pctChange}
                heroFinding={heroFinding}
              />

              {visit !== "Baseline" && (
                <DiseaseResponse
                  response={responseRow}
                  onChange={updateResponse}
                  heroFinding={heroFinding}
                />
              )}

              {heroFinding && (
                <IssueCallout
                  finding={heroFinding}
                  openCount={openFindings.length}
                  onChangeToSd={() => changeToSD(heroFinding)}
                  onApplyFix={() => applyFix(heroFinding)}
                  onAcknowledge={() => acknowledge(heroFinding)}
                  onFlag={() => {
                    const rationale = prompt(
                      "Add a brief rationale for flagging this for investigator review:",
                      "",
                    );
                    if (rationale != null)
                      flagForReview(heroFinding, rationale);
                  }}
                  onViewTrajectory={
                    heroFinding.template_id === "RESPONSE_THRESHOLD"
                      ? () => setChartFinding(heroFinding)
                      : null
                  }
                  onSeeAll={
                    openFindings.length + dispositionedFindings.length > 1
                      ? () => setAllFindingsOpen(true)
                      : null
                  }
                />
              )}

              {dispositionedFindings.length > 0 && (
                <DispositionedSummary
                  dispositionedFindings={dispositionedFindings}
                  dispositions={dispositions}
                  flagRationale={flagRationale}
                  onSeeAll={() => setAllFindingsOpen(true)}
                  hasOpen={openFindings.length > 0}
                />
              )}

              {ran && visitFindings.length === 0 && (
                <CleanVisit />
              )}
            </>
          )}
        </div>
      </div>

      <SubmitFooter
        blocked={submitBlocked}
        visit={visit}
        visitSubmitted={visitSubmitted}
        ran={ran}
        endOfStudy={endOfStudy}
        openCriticalCount={openFindings.filter(
          (f) => f.severity === "Critical",
        ).length}
        openOtherCount={openFindings.filter(
          (f) => f.severity !== "Critical",
        ).length}
        onSubmit={submitVisit}
        onReset={resetSubject}
      />

      {chartFinding && (
        <TrajectoryDrawer
          finding={chartFinding}
          subject={subject}
          onClose={() => setChartFinding(null)}
        />
      )}
      {allFindingsOpen && (
        <FindingsListDrawer
          findings={visitFindings}
          onClose={() => setAllFindingsOpen(false)}
          onOpenChart={(f) => {
            setAllFindingsOpen(false);
            setChartFinding(f);
          }}
        />
      )}
    </div>
  );
}

function empty(): ResponseRecord {
  return { target: "", nontarget: "", newlesions: "", overall: "", date: "" };
}

// ---------------------------------------------------------------------------

function PatientHeader({
  subject,
  visit,
  completedVisits,
  activeVisit,
  findingsByVisit,
  onSubject,
  onVisit,
}: {
  subject: string;
  visit: Visit;
  visitDate: string;
  completedVisits: Visit[];
  activeVisit: Visit;
  findingsByVisit: Map<string, Finding["severity"]>;
  onSubject: (s: string) => void;
  onVisit: (v: Visit) => void;
}) {
  return (
    <div className="bg-white border-b border-stone-200">
      <div className="max-w-6xl mx-auto px-8 py-5 flex items-end gap-6 flex-wrap">
        <Link
          to="/"
          className="text-2xs text-slate-500 hover:text-accent-700 mono"
        >
          ← Workspace
        </Link>
        <div>
          <div className="kicker mb-1">Subject</div>
          <PickerSelect
            value={subject}
            onChange={onSubject}
            options={SUBJECTS}
            mono
            big
          />
        </div>
        <div className="border-l border-stone-200 pl-6">
          <div className="kicker mb-1">Visit</div>
          <PickerSelect
            value={visit}
            onChange={(v) => onVisit(v as Visit)}
            options={VISITS.filter(
              (v) =>
                completedVisits.includes(v as Visit) || v === activeVisit,
            )}
          />
        </div>
        <Trajectory
          current={visit}
          activeVisit={activeVisit}
          completed={completedVisits}
          findingsByVisit={findingsByVisit}
          onJump={(v) => onVisit(v)}
        />
      </div>
    </div>
  );
}

function PickerSelect({
  value,
  onChange,
  options,
  mono,
  big,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  mono?: boolean;
  big?: boolean;
}) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none cursor-pointer bg-stone-50 border border-stone-200 rounded px-3 pr-7 py-1.5 hover:border-stone-300 hover:bg-white focus:outline-none focus:border-accent-500 focus:bg-white transition ${
          big ? "text-lg font-semibold" : "text-sm font-medium"
        } ${mono ? "mono" : ""} text-slate-900`}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <svg
        viewBox="0 0 10 10"
        className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 text-slate-500"
      >
        <path
          d="M2 4l3 3 3-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function Trajectory({
  current,
  activeVisit,
  completed,
  findingsByVisit,
  onJump,
}: {
  current: Visit;
  activeVisit: Visit;
  completed: Visit[];
  findingsByVisit: Map<string, Finding["severity"]>;
  onJump: (v: Visit) => void;
}) {
  const sevDotClass = (s: Finding["severity"] | undefined) => {
    if (s === "Critical") return "bg-sev-critical-600";
    if (s === "Warning") return "bg-sev-warning-600";
    if (s === "Suggested Change") return "bg-sev-suggested-600";
    return "";
  };

  return (
    <div className="ml-auto pb-1">
      <div className="kicker mb-2">Visit history</div>
      <ol className="flex items-end gap-3">
        {VISITS.map((v) => {
          const isSubmitted = completed.includes(v as Visit);
          const isActive = v === activeVisit;
          const isViewing = v === current;
          const sev = isViewing ? findingsByVisit.get(v) : undefined;
          // Coordinator can jump back to a submitted visit (read-only) or
          // to the active visit they are entering.
          const clickable = isSubmitted || isActive;
          return (
            <li key={v} className="flex flex-col items-center">
              <button
                disabled={!clickable}
                onClick={() => clickable && onJump(v as Visit)}
                className="flex flex-col items-center gap-1 disabled:cursor-default"
                title={
                  isSubmitted
                    ? `${v} — submitted`
                    : isActive
                      ? `${v} — entering now`
                      : `${v} — locked until prior visits submitted`
                }
              >
                <div
                  className={`w-2.5 h-2.5 rounded-full ${
                    isViewing
                      ? isActive
                        ? "bg-accent-600 ring-2 ring-accent-200"
                        : "bg-slate-700 ring-2 ring-stone-300"
                      : isSubmitted
                        ? "bg-slate-700"
                        : isActive
                          ? "bg-accent-600"
                          : "bg-stone-300"
                  }`}
                />
                <span
                  className={`text-[10px] mono ${
                    isViewing
                      ? isActive
                        ? "text-accent-700 font-semibold"
                        : "text-slate-900 font-semibold"
                      : isSubmitted
                        ? "text-slate-700"
                        : isActive
                          ? "text-accent-700"
                          : "text-slate-400"
                  }`}
                >
                  {v.replace("Week ", "W")}
                </span>
                <span
                  className={`block w-1.5 h-1.5 rounded-full ${
                    sev ? sevDotClass(sev) : "bg-transparent"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RunBar({
  ran,
  running,
  findingCount,
  onRun,
  visit,
}: {
  ran: boolean;
  running: boolean;
  findingCount: number;
  onRun: () => void;
  visit: Visit;
}) {
  return (
    <div
      className={`panel p-3 flex items-center gap-3 ${
        ran ? "" : "border-accent-300 bg-accent-50/60"
      }`}
    >
      <div className="flex-1">
        <div className="text-sm text-slate-900">
          {ran
            ? findingCount > 0
              ? `Consistency check found ${findingCount} ${
                  findingCount === 1 ? "finding" : "findings"
                } for ${visit}.`
              : `${visit} entry is clean. Ready to submit.`
            : `Review the entries for ${visit}, then run the consistency check.`}
        </div>
        <div className="text-2xs text-slate-500 mt-0.5">
          Each visit is validated against its own entries plus everything
          submitted before it.
        </div>
      </div>
      <button className="btn btn-primary" onClick={onRun} disabled={running}>
        {running ? "Running…" : ran ? "Re-check" : "Run consistency check"}
      </button>
    </div>
  );
}

function ReadOnlyVisitBanner({ visit }: { visit: Visit }) {
  return (
    <div className="panel p-3 flex items-center gap-3 bg-stone-50">
      <span className="text-2xs font-semibold tracking-wider px-1.5 py-0.5 bg-stone-500 text-white">
        Submitted
      </span>
      <div className="text-sm text-slate-700">
        <span className="mono">{visit}</span> has already been submitted.
        Switch to the active visit to enter new data, or use Reset to start
        over.
      </div>
    </div>
  );
}

function EndOfStudy({
  subject,
  onReset,
}: {
  subject: string;
  onReset: () => void;
}) {
  return (
    <div className="panel p-5 bg-emerald-50 border-emerald-200">
      <div className="kicker mb-1">End of study</div>
      <div className="text-base font-semibold text-slate-900 mb-1">
        Every planned visit has been submitted for{" "}
        <span className="mono">{subject}</span>.
      </div>
      <p className="text-sm text-slate-700 leading-snug max-w-2xl">
        In production this hands off to the data manager for query
        reconciliation. For demo purposes you can reset this subject and walk
        through the workflow again, or switch subject from the picker above.
      </p>
      <button className="btn mt-3" onClick={onReset}>
        Reset subject
      </button>
    </div>
  );
}

function SkeletonTwo() {
  return (
    <div className="space-y-3">
      <div className="h-32 bg-stone-100 rounded animate-pulse" />
      <div className="h-32 bg-stone-100 rounded animate-pulse" />
    </div>
  );
}

// ---------------------------------------------------------------------------

function TumorAssessment({
  lesions,
  visit,
  visitsThrough,
  onUpdate,
  onUpdateStatus,
  targetSum,
  baselineSum,
  pctChange,
  heroFinding,
}: {
  lesions: LesionRow[];
  visit: Visit;
  visitsThrough: Visit[];
  onUpdate: (id: string, v: string) => void;
  onUpdateStatus: (id: string, v: string) => void;
  targetSum: number;
  baselineSum: number;
  pctChange: number;
  heroFinding: Finding | null;
}) {
  const flagLesion = (heroFinding?.template_params as { lesion_id?: string } | undefined)
    ?.lesion_id;
  const ghostId =
    heroFinding?.rule_id === "TU-TR-001"
      ? ((heroFinding.template_params as { ghost_id?: string }).ghost_id ?? null)
      : null;
  return (
    <section>
      <SectionHead
        title="Tumor Assessment"
        subtitle="Record this visit's lesion measurements. Prior visits shown for context."
      />
      <div className="panel overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-4 py-2 kicker">Lesion</th>
              <th className="text-left px-4 py-2 kicker">Description</th>
              {visitsThrough.map((v) => (
                <th
                  key={v}
                  className={`text-right px-4 py-2 kicker ${
                    v === visit ? "text-accent-700 bg-accent-50" : ""
                  }`}
                >
                  {v === "Baseline" ? "Baseline" : v.replace("Week ", "W")}
                </th>
              ))}
              <th className="text-left px-4 py-2 kicker">Status</th>
            </tr>
          </thead>
          <tbody>
            {lesions.map((l) => {
              const seenIdx = VISITS.indexOf(l.firstSeenAt);
              const curIdx = VISITS.indexOf(visit);
              const visibleAtCurrent = seenIdx <= curIdx;
              const isFlaggedRow = flagLesion && l.id === flagLesion;
              const isGhost = ghostId && l.id === ghostId;
              return (
                <tr
                  key={l.id}
                  className="border-b border-stone-100 last:border-b-0"
                >
                  <td
                    className={`px-4 py-2 mono text-sm font-medium ${
                      isGhost
                        ? "text-sev-critical-700 bg-sev-critical-50/60"
                        : ""
                    }`}
                  >
                    {l.id}
                    <span
                      className={`ml-2 text-[10px] px-1 py-0 rounded ${
                        l.category === "TARGET"
                          ? "bg-stone-100 text-slate-600"
                          : l.category === "NEW"
                            ? "bg-sev-critical-50 text-sev-critical-700 border border-sev-critical-200"
                            : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {l.category === "TARGET"
                        ? "T"
                        : l.category === "NEW"
                          ? "NEW"
                          : "NT"}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm text-slate-600">
                    {l.description}
                  </td>
                  {visitsThrough.map((v) => {
                    const isCur = v === visit;
                    const value = l.measurements[v] || "";
                    return (
                      <td
                        key={v}
                        className={`px-4 py-2 ${
                          isCur ? "bg-accent-50/50" : ""
                        }`}
                      >
                        {l.category !== "NON-TARGET" && visibleAtCurrent ? (
                          isCur ? (
                            <div className="flex items-center gap-1 justify-end">
                              <input
                                type="number"
                                step="0.1"
                                value={value}
                                onChange={(e) =>
                                  onUpdate(l.id, e.target.value)
                                }
                                className={`field text-right w-20 ${
                                  isFlaggedRow
                                    ? "is-flagged-critical"
                                    : ""
                                }`}
                              />
                              <span className="mono text-2xs text-slate-500">
                                mm
                              </span>
                            </div>
                          ) : (
                            <div className="text-right mono text-sm text-slate-400">
                              {value ? `${value} mm` : "—"}
                            </div>
                          )
                        ) : (
                          <div className="text-right mono text-2xs text-slate-300">
                            —
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-4 py-2">
                    {visibleAtCurrent ? (
                      <select
                        className="field w-32"
                        value={l.status[visit] || "PRESENT"}
                        onChange={(e) => onUpdateStatus(l.id, e.target.value)}
                      >
                        {["PRESENT", "ABSENT", "EQUIVOCAL"].map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-2xs text-slate-400 mono">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="border-t border-stone-200 bg-stone-50 px-4 py-2.5 flex items-baseline justify-between">
          <div className="kicker">Sum of target diameters</div>
          <div className="flex items-baseline gap-3">
            <span className="mono text-sm font-semibold">
              {targetSum.toFixed(1)} mm
            </span>
            <span className="text-2xs text-slate-500">
              baseline {baselineSum.toFixed(1)} mm
            </span>
            <span
              className={`text-2xs mono font-medium ${
                pctChange < -30
                  ? "text-emerald-700"
                  : pctChange > 20
                    ? "text-sev-critical-700"
                    : "text-slate-500"
              }`}
            >
              {pctChange >= 0 ? "+" : ""}
              {pctChange.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function DiseaseResponse({
  response,
  onChange,
  heroFinding,
}: {
  response: ResponseRecord;
  onChange: (k: keyof ResponseRecord, v: string) => void;
  heroFinding: Finding | null;
}) {
  const flagFields = new Set(
    heroFinding ? heroFindingFields(heroFinding) : [],
  );

  return (
    <section>
      <SectionHead
        title="Disease Response"
        subtitle="Investigator's RECIST 1.1 response judgment for this visit."
      />
      <div className="panel p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <ResponseField
            label="Target response"
            value={response.target}
            options={RESPONSE_OPTIONS}
            onChange={(v) => onChange("target", v)}
            flagged={flagFields.has("target")}
          />
          <ResponseField
            label="Non-target response"
            value={response.nontarget}
            options={NONTARGET_OPTIONS}
            onChange={(v) => onChange("nontarget", v)}
            flagged={flagFields.has("nontarget")}
          />
          <ResponseField
            label="New lesions"
            value={response.newlesions}
            options={NEW_LESION_OPTIONS}
            onChange={(v) => onChange("newlesions", v)}
            flagged={flagFields.has("newlesions")}
          />
          <ResponseField
            label="Overall response"
            value={response.overall}
            options={RESPONSE_OPTIONS}
            onChange={(v) => onChange("overall", v)}
            flagged={flagFields.has("overall")}
          />
          <div className="col-span-2 flex items-center gap-3 pt-3 border-t border-stone-100">
            <label className="text-2xs text-slate-500">
              Response assessment date
            </label>
            <input
              type="date"
              value={response.date}
              onChange={(e) => onChange("date", e.target.value)}
              className="field w-40"
            />
            <span className="text-2xs text-slate-400 ml-auto mono">
              RECIST 1.1 · Investigator-derived
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function heroFindingFields(f: Finding): string[] {
  const map: Record<string, string[]> = {
    "TR-RS-001": ["target", "overall"],
    "TR-RS-003": ["overall", "nontarget"],
    "TU/TR-RS-002": ["newlesions", "overall"],
  };
  return map[f.rule_id] || [];
}

function ResponseField({
  label,
  value,
  options,
  onChange,
  flagged,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  flagged?: boolean;
}) {
  const all = options.includes(value) || !value ? options : [...options, value];
  return (
    <label className="block">
      <div className="flex items-center gap-1.5 text-2xs text-slate-600 mb-1">
        <span className="font-medium">{label}</span>
        {flagged && (
          <span
            aria-label="critical"
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-sev-critical-600 text-white text-[9px] font-bold"
          >
            !
          </span>
        )}
      </div>
      <select
        className={`field w-full h-9 text-sm ${
          flagged
            ? "is-flagged-critical border-sev-critical-500 bg-sev-critical-50"
            : ""
        }`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value=""></option>
        {all.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

// ---------------------------------------------------------------------------

function IssueCallout({
  finding,
  openCount,
  onChangeToSd,
  onApplyFix,
  onAcknowledge,
  onFlag,
  onViewTrajectory,
  onSeeAll,
}: {
  finding: Finding;
  openCount: number;
  onChangeToSd: () => void;
  onApplyFix: () => void;
  onAcknowledge: () => void;
  onFlag: () => void;
  onViewTrajectory: (() => void) | null;
  onSeeAll: (() => void) | null;
}) {
  const sev = finding.severity;
  const borderTone =
    sev === "Critical"
      ? "border-sev-critical-600"
      : sev === "Warning"
        ? "border-sev-warning-600"
        : "border-sev-suggested-600";
  const bg =
    sev === "Critical"
      ? "bg-sev-critical-50/60"
      : sev === "Warning"
        ? "bg-sev-warning-50/60"
        : "bg-sev-suggested-50/60";
  const chip =
    sev === "Critical"
      ? "bg-sev-critical-600"
      : sev === "Warning"
        ? "bg-sev-warning-600"
        : "bg-sev-suggested-600";
  return (
    <div className={`border-l-[3px] ${borderTone} ${bg} px-5 py-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-2xs font-semibold tracking-wider px-1.5 py-0.5 ${chip} text-white`}
        >
          {sev}
        </span>
        <span className="mono text-2xs text-slate-700">{finding.rule_id}</span>
        <span className="ml-auto text-2xs text-slate-500 mono">
          {finding.translator_source === "llm" ? "ai-rendered" : "fallback"}
        </span>
      </div>
      <div className="text-sm font-medium text-slate-900 mb-1.5">
        {ruleHeadline(finding)}
      </div>
      <div className="text-sm text-slate-700 leading-snug max-w-3xl">
        {finding.user_message}
      </div>
      {finding.suggested_actions.length > 0 && (
        <ul className="text-sm text-slate-700 mt-2 list-disc list-inside space-y-1 max-w-3xl">
          {finding.suggested_actions.slice(0, 2).map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {/* Primary action varies by rule/severity */}
        {finding.rule_id === "TR-RS-001" && (
          <button className="btn btn-primary" onClick={onChangeToSd}>
            Change to Stable Disease
          </button>
        )}
        {finding.template_id === "STANDARDIZATION" && (
          <button className="btn btn-primary" onClick={onApplyFix}>
            Apply standardization
          </button>
        )}
        {sev === "Critical" &&
          finding.rule_id !== "TR-RS-001" && (
            <button className="btn btn-danger" onClick={onFlag}>
              Flag for investigator
            </button>
          )}
        {sev === "Critical" && finding.rule_id === "TR-RS-001" && (
          <button className="btn" onClick={onFlag}>
            Flag for investigator
          </button>
        )}
        {sev !== "Critical" && finding.template_id !== "STANDARDIZATION" && (
          <button className="btn" onClick={onAcknowledge}>
            Acknowledge
          </button>
        )}
        {onViewTrajectory && (
          <button className="btn" onClick={onViewTrajectory}>
            View trajectory
          </button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {openCount > 1 && (
            <span className="text-2xs text-slate-500">
              {openCount - 1} more open
            </span>
          )}
          {onSeeAll && (
            <button className="btn" onClick={onSeeAll}>
              See all
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DispositionedSummary({
  dispositionedFindings,
  dispositions,
  flagRationale,
  onSeeAll,
  hasOpen,
}: {
  dispositionedFindings: Finding[];
  dispositions: Map<string, Disposition>;
  flagRationale: Record<string, string>;
  onSeeAll: () => void;
  hasOpen: boolean;
}) {
  const counts = { resolved: 0, flagged: 0, acknowledged: 0 };
  for (const f of dispositionedFindings) {
    const d = dispositions.get(findingKey(f));
    if (d) counts[d] += 1;
  }
  const allHandled = !hasOpen;
  return (
    <div
      className={`border-l-[3px] ${
        allHandled
          ? "border-emerald-600 bg-emerald-50/60"
          : "border-stone-300 bg-stone-50"
      } px-5 py-3 flex items-start gap-3`}
    >
      <span
        className={`text-2xs font-semibold tracking-wider px-1.5 py-0.5 text-white ${
          allHandled ? "bg-emerald-600" : "bg-stone-500"
        }`}
      >
        {allHandled ? "All findings handled" : "Already handled"}
      </span>
      <div className="text-sm text-slate-700">
        {allHandled
          ? "Every finding on this visit has been resolved, flagged, or acknowledged."
          : `${dispositionedFindings.length} of this visit's findings already handled.`}{" "}
        <span className="text-slate-500 mono text-2xs">
          {counts.resolved} resolved · {counts.flagged} flagged ·{" "}
          {counts.acknowledged} acknowledged
        </span>
      </div>
      {dispositionedFindings.some(
        (f) => dispositions.get(findingKey(f)) === "flagged",
      ) && (
        <div className="ml-auto text-2xs">
          <button
            onClick={onSeeAll}
            className="text-accent-700 hover:text-accent-800"
          >
            View rationale →
          </button>
        </div>
      )}
      {/* Render flag rationales inline (max 1 here) */}
      {Object.values(flagRationale).slice(0, 0)}
    </div>
  );
}

function CleanVisit() {
  return (
    <div className="border-l-[3px] border-emerald-600 bg-emerald-50/60 px-5 py-3 flex items-start gap-3">
      <span className="text-2xs font-semibold tracking-wider px-1.5 py-0.5 bg-emerald-600 text-white">
        Clean
      </span>
      <div className="text-sm text-slate-700">
        No findings raised on this visit. Submit when ready.
      </div>
    </div>
  );
}

function ruleHeadline(f: Finding): string {
  return {
    "TR-RS-001": "Target response is not supported by the measurements.",
    "TR-RS-003": "Overall CR conflicts with persistent non-target disease.",
    "TU/TR-RS-002": "New lesion conflicts with this visit's response.",
    "TU-002": "Duplicate lesion identity at baseline.",
    "TU-TR-001": "Measurement references a lesion that doesn't exist in TU.",
    "TR-003": "Imaging method changed from baseline.",
    "TR-002": "Raw term not in controlled vocabulary.",
    LARGE_DROP: "Unusually large drop in a target lesion.",
    VISIT_WINDOW: "Assessment date is outside the visit window.",
  }[f.rule_id] || "Finding raised by the consistency engine.";
}

// ---------------------------------------------------------------------------

function SubmitFooter({
  blocked,
  visit,
  visitSubmitted,
  ran,
  endOfStudy,
  openCriticalCount,
  openOtherCount,
  onSubmit,
  onReset,
}: {
  blocked: boolean;
  visit: Visit;
  visitSubmitted: boolean;
  ran: boolean;
  endOfStudy: boolean;
  openCriticalCount: number;
  openOtherCount: number;
  onSubmit: () => void;
  onReset: () => void;
}) {
  let msg: React.ReactNode = `${visit} ready to submit.`;
  if (endOfStudy) msg = "All visits submitted for this subject.";
  else if (visitSubmitted) msg = `${visit} already submitted.`;
  else if (!ran) msg = `Run a consistency check on ${visit} before submitting.`;
  else if (openCriticalCount > 0)
    msg = (
      <span className="text-sev-critical-700">
        {openCriticalCount} critical finding{openCriticalCount === 1 ? "" : "s"}
        {" "}
        must be resolved or flagged before submitting {visit}.
      </span>
    );
  else if (openOtherCount > 0)
    msg = `${openOtherCount} non-critical finding${
      openOtherCount === 1 ? "" : "s"
    } open on ${visit}. You can submit, or handle them first.`;
  return (
    <footer className="border-t border-stone-200 bg-white px-6 py-3 flex items-center gap-3 shrink-0">
      <div className="text-2xs text-slate-500">{msg}</div>
      <button className="btn ml-auto" onClick={onReset}>
        Reset subject
      </button>
      <button
        className={`btn ${blocked ? "" : "btn-primary"}`}
        disabled={blocked}
        onClick={onSubmit}
      >
        Submit {visit}
      </button>
    </footer>
  );
}

// ---------------------------------------------------------------------------

function TrajectoryDrawer({
  finding,
  subject,
  onClose,
}: {
  finding: Finding;
  subject: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <aside
      role="dialog"
      aria-modal="true"
      className="fixed top-12 right-0 bottom-0 w-[560px] border-l border-stone-200 bg-white shadow-xl z-40 flex flex-col"
    >
      <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-200">
        <div className="text-sm font-semibold">
          Target sum trajectory · {subject}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="ml-auto text-slate-400 hover:text-slate-900 w-6 h-6 inline-flex items-center justify-center rounded hover:bg-stone-100"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="text-sm text-slate-600 leading-snug">
          Sum of target lesion diameters across visits, with the RECIST 1.1
          PR threshold drawn at 70% of baseline.
        </div>
        <ChartTemplate finding={finding} />
        <div className="text-2xs text-slate-500 border-t border-stone-200 pt-3">
          <span className="kicker">Citation</span> {finding.citation}
        </div>
      </div>
    </aside>
  );
}

function FindingsListDrawer({
  findings,
  onClose,
  onOpenChart,
}: {
  findings: Finding[];
  onClose: () => void;
  onOpenChart: (f: Finding) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <aside
      role="dialog"
      aria-modal="true"
      className="fixed top-12 right-0 bottom-0 w-[480px] border-l border-stone-200 bg-white shadow-xl z-40 flex flex-col"
    >
      <div className="flex items-center gap-2 px-5 py-3 border-b border-stone-200">
        <div className="text-sm font-semibold">
          All findings on this visit
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="ml-auto text-slate-400 hover:text-slate-900 w-6 h-6 inline-flex items-center justify-center rounded hover:bg-stone-100"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2">
        {findings.map((f, i) => (
          <div key={i} className="panel p-3">
            <div className="flex items-center gap-2 mb-1">
              <SeverityChip severity={f.severity} />
              <span className="mono text-2xs text-slate-500">
                {f.rule_id}
              </span>
              {f.template_id === "RESPONSE_THRESHOLD" && (
                <button
                  className="ml-auto text-2xs text-accent-700 hover:text-accent-800"
                  onClick={() => onOpenChart(f)}
                >
                  trajectory →
                </button>
              )}
            </div>
            <div className="text-sm text-slate-800 leading-snug">
              {f.user_message}
            </div>
          </div>
        ))}
        {findings.length === 0 && (
          <div className="text-2xs text-slate-500 italic">No findings.</div>
        )}
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------

function SectionHead({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <div className="text-2xs text-slate-500 mt-0.5">{subtitle}</div>
    </div>
  );
}

