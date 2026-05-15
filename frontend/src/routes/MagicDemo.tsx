import { useEffect, useMemo, useState } from "react";
import { fetchCsv, parseCsv, runEngine } from "../api";
import { ChartTemplate } from "../components/ChartTemplate";
import type { Finding } from "../types";

const SUBJECT = "SUBJ001";
const VISIT = "Week 16";
const VISIT_DATE = "2026-04-25";

const VISITS = [
  "Baseline",
  "Week 8",
  "Week 16",
  "Week 24",
  "Week 32",
  "Week 40",
  "Week 48",
] as const;

interface ResponseForm {
  target: string;
  nontarget: string;
  newlesions: string;
  overall: string;
}

interface PriorMeasure {
  baseline?: string;
  week8?: string;
}

interface LesionRow {
  id: string;
  category: "TARGET" | "NON-TARGET";
  description: string;
  prior: PriorMeasure;
  week16: string;
  unit: string;
  status: string;
}

type IssueState = "pristine" | "open" | "resolved" | "flagged";

// ---------------------------------------------------------------------------

export function MagicDemo() {
  const [lesions, setLesions] = useState<LesionRow[]>([]);
  const [response, setResponse] = useState<ResponseForm>({
    target: "",
    nontarget: "",
    newlesions: "",
    overall: "",
  });
  const [responseDate, setResponseDate] = useState<string>("");
  const [issueState, setIssueState] = useState<IssueState>("pristine");
  const [running, setRunning] = useState(false);
  const [flagRationale, setFlagRationale] = useState("");
  const [trajectoryOpen, setTrajectoryOpen] = useState(false);
  const [finding, setFinding] = useState<Finding | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const ef = await fetchCsv("ecrf_followup.csv").then(parseCsv);
        const ed = await fetchCsv("ecrf_disease_response.csv").then(parseCsv);
        const subjFollowup = ef.filter((r) => r.subject_id === SUBJECT);
        const lesionIds = Array.from(
          new Set(subjFollowup.map((r) => r.lesion_number)),
        );
        const next: LesionRow[] = lesionIds.map((id) => {
          const w16 = subjFollowup.find(
            (r) => r.lesion_number === id && r.visit === VISIT,
          );
          const w8 = subjFollowup.find(
            (r) => r.lesion_number === id && r.visit === "Week 8",
          );
          return {
            id,
            category: (w16?.lesion_category as "TARGET" | "NON-TARGET") ||
              (w8?.lesion_category as "TARGET" | "NON-TARGET") ||
              "TARGET",
            description: w16?.lesion_description || w8?.lesion_description || "",
            prior: {
              baseline: baselineFor(id),
              week8: w8?.measurement_value || undefined,
            },
            week16: w16?.measurement_value || "",
            unit: w16?.measurement_unit_raw || "mm",
            status: w16?.lesion_status || "PRESENT",
          };
        });
        setLesions(next);

        const dr = ed.find(
          (r) => r.subject_id === SUBJECT && r.visit === VISIT,
        );
        if (dr) {
          setResponse({
            target: dr.target_lesion_response_raw || "",
            nontarget: dr.non_target_lesion_response_raw || "",
            newlesions: dr.new_lesion_response_raw || "",
            overall: dr.overall_response_raw || "",
          });
          setResponseDate(dr.response_assessment_date || VISIT_DATE);
        }
      } catch (e) {
        setErr(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const runCheck = async () => {
    setRunning(true);
    try {
      const r = await runEngine(true);
      const f = r.findings.find(
        (x) =>
          x.subject_id === SUBJECT &&
          x.visit === VISIT &&
          x.rule_id === "TR-RS-001",
      );
      setFinding(f || null);
      if (response.target.toUpperCase().includes("PARTIAL") || response.target === "PR") {
        setIssueState("open");
      } else {
        setIssueState("resolved");
      }
      setErr(null);
    } catch (e) {
      setErr(String(e));
    } finally {
      setRunning(false);
    }
  };

  const updateW16Measurement = (id: string, value: string) => {
    setLesions((rows) =>
      rows.map((r) => (r.id === id ? { ...r, week16: value } : r)),
    );
    if (issueState === "resolved" || issueState === "flagged") {
      setIssueState("open");
    }
  };

  const updateResponse = (key: keyof ResponseForm, value: string) => {
    setResponse((p) => ({ ...p, [key]: value }));
    if (key === "target" || key === "overall") {
      const newTarget = key === "target" ? value : response.target;
      const newOverall = key === "overall" ? value : response.overall;
      const stillPR =
        looksPR(newTarget) || looksPR(newOverall);
      setIssueState(stillPR ? "open" : "resolved");
    }
  };

  const changeToSD = () => {
    setResponse((p) => ({
      ...p,
      target: "Stable Disease",
      overall: "Stable Disease",
    }));
    setIssueState("resolved");
  };

  const flagForReview = (rationale: string) => {
    setFlagRationale(rationale);
    setIssueState("flagged");
  };

  const targetSum = useMemo(() => {
    return lesions
      .filter((l) => l.category === "TARGET")
      .reduce((acc, l) => acc + (parseFloat(l.week16) || 0), 0);
  }, [lesions]);

  const baselineSum = useMemo(() => {
    return lesions
      .filter((l) => l.category === "TARGET")
      .reduce((acc, l) => acc + (parseFloat(l.prior.baseline || "") || 0), 0);
  }, [lesions]);

  const pctChange =
    baselineSum > 0 ? ((targetSum - baselineSum) / baselineSum) * 100 : 0;

  const submitBlocked = issueState === "open" || issueState === "pristine";

  return (
    <div className="flex flex-col h-full">
      <EdcChrome />

      <div className="flex-1 overflow-y-auto">
        <PatientHeader />

        <div className="max-w-5xl mx-auto px-8 py-6 space-y-8">
          {err && (
            <div className="text-sm text-sev-critical-800 bg-sev-critical-50 border border-sev-critical-300 rounded p-3">
              {err}
            </div>
          )}

          <RunBar
            ran={issueState !== "pristine"}
            running={running}
            onRun={runCheck}
          />

          {loading ? (
            <div className="space-y-3">
              <div className="h-32 bg-slate-100 rounded animate-pulse" />
              <div className="h-32 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : (
            <>
              <TumorAssessment
                lesions={lesions}
                onUpdate={updateW16Measurement}
                onUpdateStatus={(id, status) =>
                  setLesions((rs) =>
                    rs.map((r) => (r.id === id ? { ...r, status } : r)),
                  )
                }
                targetSum={targetSum}
                baselineSum={baselineSum}
                pctChange={pctChange}
              />

              <DiseaseResponse
                response={response}
                date={responseDate}
                onChange={updateResponse}
                onDateChange={setResponseDate}
                issueState={issueState}
              />

              {issueState === "open" && finding && (
                <IssueCallout
                  finding={finding}
                  targetSum={targetSum}
                  baselineSum={baselineSum}
                  pctChange={pctChange}
                  onChangeToSd={changeToSD}
                  onFlag={() => {
                    const rationale = prompt(
                      "Add a brief rationale for flagging this for investigator review:",
                      "",
                    );
                    if (rationale != null) flagForReview(rationale);
                  }}
                  onViewTrajectory={() => setTrajectoryOpen(true)}
                />
              )}
              {issueState === "flagged" && (
                <FlaggedCallout rationale={flagRationale} />
              )}
              {issueState === "resolved" && finding && (
                <ResolvedCallout />
              )}
            </>
          )}
        </div>
      </div>

      <SubmitFooter
        blocked={submitBlocked}
        state={issueState}
        onReset={() => window.location.reload()}
      />

      {trajectoryOpen && finding && (
        <TrajectoryDrawer
          finding={finding}
          onClose={() => setTrajectoryOpen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function EdcChrome() {
  return (
    <div className="bg-slate-900 text-slate-100 text-2xs px-6 h-8 flex items-center gap-4 shrink-0">
      <span className="font-semibold tracking-wide">SponsorCloud EDC</span>
      <span className="text-slate-400">/</span>
      <span>KLIN-ONC-DEMO-001 · Phase II Solid Tumour</span>
      <span className="text-slate-400">/</span>
      <span>Site 042 · Memorial Cancer Center</span>
      <span className="ml-auto mono text-slate-300">
        Coord. A. Patel · CRC
      </span>
    </div>
  );
}

function PatientHeader() {
  return (
    <div className="bg-white border-b border-slate-200">
      <div className="max-w-5xl mx-auto px-8 py-5 flex items-end gap-6">
        <div>
          <div className="text-2xs uppercase tracking-wider text-slate-500 font-medium">
            Subject
          </div>
          <div className="mono text-lg font-semibold text-slate-900 leading-none mt-1">
            {SUBJECT}
          </div>
          <div className="text-2xs text-slate-500 mt-1">
            Female · 64 · enrolled 2026-01-03
          </div>
        </div>
        <div className="border-l border-slate-200 pl-6">
          <div className="text-2xs uppercase tracking-wider text-slate-500 font-medium">
            Visit
          </div>
          <div className="text-sm font-medium text-slate-900 mt-1">
            {VISIT}
          </div>
          <div className="text-2xs text-slate-500 mt-0.5 mono">
            {VISIT_DATE}
          </div>
        </div>
        <Trajectory />
      </div>
    </div>
  );
}

function Trajectory() {
  return (
    <div className="ml-auto pb-1">
      <div className="text-2xs uppercase tracking-wider text-slate-500 font-medium mb-2">
        Visit history
      </div>
      <ol className="flex items-center gap-2.5">
        {VISITS.map((v) => {
          const idx = VISITS.indexOf(v);
          const cur = idx === 2;
          const done = idx < 2;
          return (
            <li key={v} className="flex flex-col items-center">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  cur
                    ? "bg-accent-700 ring-2 ring-accent-200"
                    : done
                      ? "bg-slate-700"
                      : "bg-slate-300"
                }`}
                title={v}
              />
              <span
                className={`text-[10px] mt-1 mono ${
                  cur
                    ? "text-accent-700 font-semibold"
                    : done
                      ? "text-slate-700"
                      : "text-slate-400"
                }`}
              >
                {v.replace("Week ", "W")}
              </span>
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
  onRun,
}: {
  ran: boolean;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <div
      className={`panel p-3 flex items-center gap-3 ${
        ran ? "" : "border-accent-300 bg-accent-50"
      }`}
    >
      <div className="flex-1">
        <div className="text-sm text-slate-900">
          {ran
            ? "Consistency check complete."
            : "Ready to submit? Run a consistency check first."}
        </div>
        <div className="text-2xs text-slate-500 mt-0.5">
          Checks this visit's data against prior visits and RECIST 1.1 rules.
        </div>
      </div>
      <button
        className="btn btn-primary"
        onClick={onRun}
        disabled={running}
      >
        {running ? "Running…" : ran ? "Re-check" : "Run consistency check"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TumorAssessment({
  lesions,
  onUpdate,
  onUpdateStatus,
  targetSum,
  baselineSum,
  pctChange,
}: {
  lesions: LesionRow[];
  onUpdate: (id: string, v: string) => void;
  onUpdateStatus: (id: string, status: string) => void;
  targetSum: number;
  baselineSum: number;
  pctChange: number;
}) {
  return (
    <section>
      <SectionHead
        title="Tumor Assessment"
        subtitle="Record this visit's lesion measurements. Prior visits shown for context."
      />
      <div className="panel overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left px-4 py-2 text-2xs font-medium text-slate-500 uppercase tracking-wider">
                Lesion
              </th>
              <th className="text-left px-4 py-2 text-2xs font-medium text-slate-500 uppercase tracking-wider">
                Description
              </th>
              <th className="text-right px-4 py-2 text-2xs font-medium text-slate-500 uppercase tracking-wider">
                Baseline
              </th>
              <th className="text-right px-4 py-2 text-2xs font-medium text-slate-500 uppercase tracking-wider">
                Week 8
              </th>
              <th className="text-right px-4 py-2 text-2xs font-medium text-accent-700 uppercase tracking-wider bg-accent-50">
                Week 16
              </th>
              <th className="text-left px-4 py-2 text-2xs font-medium text-slate-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {lesions.map((l) => (
              <tr
                key={l.id}
                className="border-b border-slate-100 last:border-b-0"
              >
                <td className="px-4 py-2 mono text-sm font-medium">
                  {l.id}
                  <span
                    className={`ml-2 text-[10px] px-1 py-0 rounded ${
                      l.category === "TARGET"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {l.category === "TARGET" ? "T" : "NT"}
                  </span>
                </td>
                <td className="px-4 py-2 text-sm text-slate-600">
                  {l.description}
                </td>
                <td className="px-4 py-2 text-right mono text-sm text-slate-400">
                  {l.prior.baseline ? `${l.prior.baseline} mm` : "—"}
                </td>
                <td className="px-4 py-2 text-right mono text-sm text-slate-400">
                  {l.prior.week8 ? `${l.prior.week8} mm` : "—"}
                </td>
                <td className="px-4 py-2 bg-accent-50/50">
                  {l.category === "TARGET" ? (
                    <div className="flex items-center gap-1 justify-end">
                      <input
                        type="number"
                        step="0.1"
                        value={l.week16}
                        onChange={(e) => onUpdate(l.id, e.target.value)}
                        className="field text-right w-20"
                      />
                      <span className="mono text-2xs text-slate-500">mm</span>
                    </div>
                  ) : (
                    <div className="text-right mono text-2xs text-slate-400">
                      —
                    </div>
                  )}
                </td>
                <td className="px-4 py-2">
                  <select
                    className="field w-32"
                    value={l.status}
                    onChange={(e) => onUpdateStatus(l.id, e.target.value)}
                  >
                    {["PRESENT", "ABSENT", "EQUIVOCAL"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5 flex items-baseline justify-between">
          <div className="text-2xs uppercase tracking-wider text-slate-500 font-medium">
            Sum of target diameters
          </div>
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
  date,
  onChange,
  onDateChange,
  issueState,
}: {
  response: ResponseForm;
  date: string;
  onChange: (k: keyof ResponseForm, v: string) => void;
  onDateChange: (v: string) => void;
  issueState: IssueState;
}) {
  const targetIsPR = looksPR(response.target);
  const overallIsPR = looksPR(response.overall);
  const targetFlagged =
    (issueState === "open" || issueState === "pristine") && targetIsPR;
  const overallFlagged =
    (issueState === "open" || issueState === "pristine") && overallIsPR;

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
            options={[
              "Complete Response",
              "Partial Response",
              "Stable Disease",
              "Progressive Disease",
              "Not evaluable",
            ]}
            onChange={(v) => onChange("target", v)}
            flagged={targetFlagged}
          />
          <ResponseField
            label="Non-target response"
            value={response.nontarget}
            options={[
              "Complete Response",
              "NON-CR/NON-PD",
              "Progressive Disease",
              "Not evaluable",
            ]}
            onChange={(v) => onChange("nontarget", v)}
          />
          <ResponseField
            label="New lesions"
            value={response.newlesions}
            options={["NO NEW LESIONS", "NEW LESIONS PRESENT"]}
            onChange={(v) => onChange("newlesions", v)}
          />
          <ResponseField
            label="Overall response"
            value={response.overall}
            options={[
              "Complete Response",
              "Partial Response",
              "Stable Disease",
              "Progressive Disease",
              "Not evaluable",
            ]}
            onChange={(v) => onChange("overall", v)}
            flagged={overallFlagged}
          />
          <div className="col-span-2 flex items-center gap-3 pt-3 border-t border-slate-100">
            <label className="text-2xs text-slate-500">
              Response assessment date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => onDateChange(e.target.value)}
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
          flagged ? "is-flagged-critical border-sev-critical-500 bg-sev-critical-50" : ""
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
  targetSum,
  baselineSum,
  pctChange,
  onChangeToSd,
  onFlag,
  onViewTrajectory,
}: {
  finding: Finding;
  targetSum: number;
  baselineSum: number;
  pctChange: number;
  onChangeToSd: () => void;
  onFlag: () => void;
  onViewTrajectory: () => void;
}) {
  return (
    <div className="border-l-[3px] border-sev-critical-600 bg-sev-critical-50/60 px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xs font-semibold tracking-wider px-1.5 py-0.5 bg-sev-critical-600 text-white">
          Critical
        </span>
        <span className="mono text-2xs text-sev-critical-700">
          {finding.rule_id}
        </span>
        <span className="ml-auto text-2xs text-slate-500 mono">
          {finding.translator_source === "llm" ? "ai" : "fallback"}
        </span>
      </div>
      <div className="text-sm font-medium text-slate-900 mb-1.5">
        Target response is not supported by the measurements at this visit.
      </div>
      <div className="text-sm text-slate-700 leading-snug max-w-2xl">
        Target response is recorded as{" "}
        <span className="mono">Partial Response</span>, but the sum of target
        diameters has decreased from{" "}
        <span className="mono">{baselineSum.toFixed(1)} mm</span> at baseline to{" "}
        <span className="mono">{targetSum.toFixed(1)} mm</span> at{" "}
        <span className="mono">Week 16</span> ({" "}
        <span className="mono font-medium">{Math.abs(pctChange).toFixed(1)}%</span>{" "}
        decrease). RECIST 1.1 requires at least a 30 % decrease from baseline
        to call PR; this visit is closer to Stable Disease.
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="btn btn-primary" onClick={onChangeToSd}>
          Change to Stable Disease
        </button>
        <button className="btn" onClick={onFlag}>
          Flag for investigator
        </button>
        <button className="btn" onClick={onViewTrajectory}>
          View trajectory
        </button>
      </div>
    </div>
  );
}

function ResolvedCallout() {
  return (
    <div className="border-l-[3px] border-emerald-600 bg-emerald-50/60 px-5 py-3 flex items-start gap-3">
      <span className="text-2xs font-semibold tracking-wider px-1.5 py-0.5 bg-emerald-600 text-white">
        Resolved
      </span>
      <div className="text-sm text-slate-800">
        The previously-flagged inconsistency has been resolved by your edit.
      </div>
    </div>
  );
}

function FlaggedCallout({ rationale }: { rationale: string }) {
  return (
    <div className="border-l-[3px] border-sev-warning-600 bg-sev-warning-50/60 px-5 py-3">
      <div className="flex items-center gap-2">
        <span className="text-2xs font-semibold tracking-wider px-1.5 py-0.5 bg-sev-warning-600 text-white">
          Flagged for investigator review
        </span>
        <span className="text-2xs text-slate-500">
          Submission allowed; the data manager will review.
        </span>
      </div>
      {rationale && (
        <div className="text-sm text-slate-700 mt-2 max-w-2xl leading-snug">
          <span className="text-2xs text-slate-500 uppercase tracking-wider mr-2">
            Rationale
          </span>
          {rationale}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SubmitFooter({
  blocked,
  state,
  onReset,
}: {
  blocked: boolean;
  state: IssueState;
  onReset: () => void;
}) {
  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-3 flex items-center gap-3 shrink-0">
      <div className="text-2xs text-slate-500">
        {state === "pristine" && "Run a consistency check before submitting."}
        {state === "open" && (
          <span className="text-sev-critical-700">
            1 critical issue must be resolved before submission.
          </span>
        )}
        {state === "resolved" &&
          "All issues resolved. This visit is ready to submit."}
        {state === "flagged" &&
          "1 issue flagged for review. Submission allowed with rationale."}
      </div>
      <button className="btn ml-auto" onClick={onReset}>
        Reset
      </button>
      <button
        className={`btn ${blocked ? "" : "btn-primary"}`}
        disabled={blocked}
      >
        Submit visit
      </button>
    </footer>
  );
}

// ---------------------------------------------------------------------------

function TrajectoryDrawer({
  finding,
  onClose,
}: {
  finding: Finding;
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
      className="fixed top-11 right-0 bottom-0 w-[560px] border-l border-slate-200 bg-white shadow-xl z-40 flex flex-col"
    >
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-200">
        <div className="text-sm font-semibold">
          Target sum trajectory · {SUBJECT}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="ml-auto text-slate-400 hover:text-slate-900 w-6 h-6 inline-flex items-center justify-center rounded hover:bg-slate-100"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div className="text-sm text-slate-600 leading-snug">
          Sum of target lesion diameters across visits, with the RECIST 1.1
          Partial Response threshold drawn at 70 % of baseline. PR is supported
          when the line dips below that threshold.
        </div>
        <ChartTemplate finding={finding} />
        <div className="text-2xs text-slate-500 border-t border-slate-200 pt-3">
          <span className="kicker">Citation</span> {finding.citation}
        </div>
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

function looksPR(s: string): boolean {
  const v = (s || "").trim().toUpperCase();
  return v === "PR" || v === "PARTIAL RESPONSE";
}

function baselineFor(lesionId: string): string | undefined {
  // Hardcoded from data/ecrf_baseline.csv for SUBJ001 — keeps the demo
  // self-contained without an extra fetch.
  return { T01: "35.0", T02: "28.0" }[lesionId];
}
