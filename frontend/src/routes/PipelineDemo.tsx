import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchCsv, parseCsv, runEngine } from "../api";
import { SeverityChip } from "../components/SeverityBadge";
import { SkeletonGrid } from "../components/Skeleton";
import type { Finding } from "../types";
import { SEV_RANK } from "../ui/tokens";

interface CsvData {
  tu: Record<string, string>[];
  tr: Record<string, string>[];
  rs: Record<string, string>[];
  ecrfBaseline: Record<string, string>[];
  ecrfFollowup: Record<string, string>[];
  ecrfDisease: Record<string, string>[];
}

export function PipelineDemo() {
  const [params, setParams] = useSearchParams();
  const view: "trace" | "overview" =
    params.get("view") === "overview" ? "overview" : "trace";

  const [csv, setCsv] = useState<CsvData | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tu, tr, rs, eb, ef, ed, run] = await Promise.all([
          fetchCsv("tu.csv").then(parseCsv),
          fetchCsv("tr.csv").then(parseCsv),
          fetchCsv("rs.csv").then(parseCsv),
          fetchCsv("ecrf_baseline.csv").then(parseCsv),
          fetchCsv("ecrf_followup.csv").then(parseCsv),
          fetchCsv("ecrf_disease_response.csv").then(parseCsv),
          runEngine(true),
        ]);
        if (cancelled) return;
        setCsv({
          tu,
          tr,
          rs,
          ecrfBaseline: eb,
          ecrfFollowup: ef,
          ecrfDisease: ed,
        });
        setFindings(run.findings);
        const defaultId =
          run.findings.find(
            (f) =>
              f.rule_id === "TR-RS-001" &&
              f.subject_id === "SUBJ001" &&
              f.visit === "Week 16",
          )?.rule_id ?? run.findings[0]?.rule_id;
        const defaultKey = run.findings.find(
          (f) =>
            f.rule_id === "TR-RS-001" &&
            f.subject_id === "SUBJ001" &&
            f.visit === "Week 16",
        );
        setSelected(defaultKey ? findingKey(defaultKey) : keyAt(run.findings, 0));
        void defaultId;
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const orderedFindings = useMemo(
    () =>
      [...(findings || [])].sort((a, b) => {
        const r = SEV_RANK[b.severity] - SEV_RANK[a.severity];
        if (r !== 0) return r;
        const s = a.subject_id.localeCompare(b.subject_id);
        if (s !== 0) return s;
        return a.rule_id.localeCompare(b.rule_id);
      }),
    [findings],
  );

  const current = useMemo(
    () => orderedFindings.find((f) => findingKey(f) === selected) || null,
    [orderedFindings, selected],
  );

  const setView = (v: "trace" | "overview") => {
    const next = new URLSearchParams(params);
    if (v === "overview") next.set("view", "overview");
    else next.delete("view");
    setParams(next);
  };

  return (
    <div className="min-h-full bg-[#fafaf8]">
      <header className="border-b border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-8 py-5">
          <div className="kicker mb-1">How a finding gets caught</div>
          <h1 className="text-[24px] leading-tight serif font-medium">
            Pipeline
          </h1>
          <p className="text-sm text-slate-600 mt-1.5 max-w-2xl">
            {view === "trace"
              ? "Walk one finding from coordinator entry through SDTM mapping, through the deterministic rule that fired, to the plain-English message we showed the coordinator."
              : "The 6-step demo flow: protocol upload through actionable UI, with one subject traced end-to-end."}
          </p>
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <div className="inline-flex border border-stone-300 rounded overflow-hidden">
              {(["overview", "trace"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`text-sm px-3 py-1.5 border-r last:border-r-0 border-stone-300 ${
                    view === v
                      ? "bg-accent-50 text-accent-700 font-medium"
                      : "bg-white text-slate-600 hover:bg-stone-50"
                  }`}
                >
                  {v === "overview" ? "Overview" : "Single-finding trace"}
                </button>
              ))}
            </div>
            {view === "trace" && (
              <>
                <label className="text-2xs uppercase tracking-wider text-slate-500 font-medium">
                  Trace
                </label>
                <select
                  className="field w-[420px] h-9 text-sm"
                  value={selected ?? ""}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {orderedFindings.map((f) => (
                    <option key={findingKey(f)} value={findingKey(f)}>
                      [{f.severity[0]}] {f.rule_id} · {f.subject_id}{" "}
                      {f.visit ? `· ${f.visit}` : ""}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-8 py-8">
        {err && (
          <div className="panel border-sev-critical-300 bg-sev-critical-50 text-sev-critical-800 text-sm p-3 mb-4">
            {err}
          </div>
        )}
        {!csv || !current ? (
          <SkeletonGrid cols={6} rows={5} />
        ) : view === "overview" ? (
          <Overview findings={findings ?? []} />
        ) : (
          <Trace finding={current} csv={csv} />
        )}
      </div>
    </div>
  );
}

function Overview({ findings }: { findings: Finding[] }) {
  const subj = "SUBJ001";
  const heroForSubject = findings.find(
    (f) =>
      f.subject_id === subj &&
      f.rule_id === "TR-RS-001" &&
      f.visit === "Week 16",
  );
  const counts = {
    Critical: findings.filter((f) => f.severity === "Critical").length,
    Warning: findings.filter((f) => f.severity === "Warning").length,
    "Suggested Change": findings.filter(
      (f) => f.severity === "Suggested Change",
    ).length,
  };
  return (
    <div className="relative">
      <div className="absolute left-[18px] top-3 bottom-3 w-px bg-stone-200" />
      <OverviewStep
        n={1}
        title="Protocol upload"
        sub="Synthetic protocol KLIN-ONC-DEMO-001 is parsed; 12 deterministic checks are derived from its 7 sections."
        cta={{ to: "/protocol", label: "Open protocol view →" }}
      >
        <div className="mono text-2xs text-slate-600">
          DM-001 · DM-002 · TU-001 · TU-002 · TU-TR-001 · TR-002 · TR-003 ·
          TR-004 · TR-RS-001 · TU/TR-RS-002 · TR-RS-003 · LB-ADLB-001
        </div>
      </OverviewStep>
      <OverviewStep
        n={2}
        title="Source document upload"
        sub="80 radiology, lab, pathology, and clinic-note documents extracted with line-level traceability."
        cta={{ to: "/sources", label: "Browse 80 documents →" }}
      >
        <div className="grid grid-cols-4 gap-1.5 text-2xs">
          {["RAD · 35", "LAB · 35", "PATH · 5", "MD · 5"].map((s) => (
            <span
              key={s}
              className="mono text-slate-700 bg-stone-100 rounded px-2 py-1 text-center"
            >
              {s}
            </span>
          ))}
        </div>
      </OverviewStep>
      <OverviewStep
        n={3}
        title="eCRF fill"
        sub="Extracted facts populate eCRF_DM, eCRF_LB, eCRF_Baseline, eCRF_Followup, and eCRF_Disease_Response. Coordinator confirms each visit."
        cta={{ to: `/magic?subject=${subj}`, label: "Open coordinator view →" }}
      >
        <div className="text-2xs text-slate-600">
          eCRF rows fed by source docs · DM · LB · TU · TR · RS
        </div>
      </OverviewStep>
      <OverviewStep
        n={4}
        title="Standardize to SDTM"
        sub="Raw eCRF terms map to CDISC controlled terminology — units harmonized, response codes canonicalized, methods rolled up."
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-2xs">
          <Diff label="Method" before="computed tomography" after="CT SCAN" />
          <Diff label="Response" before="Partial Response" after="PR" />
          <Diff label="Unit" before="2.0 cm" after="20.0 mm" />
        </div>
      </OverviewStep>
      <OverviewStep
        n={5}
        title="Layered checks"
        sub="Engine runs across DM / LB / TU / TR / RS — basic, intra-domain, cross-domain, cross-visit, and medical-analysis layers."
      >
        <div className="flex items-center gap-2 flex-wrap">
          <SevTile tone="critical" n={counts.Critical} label="Critical" />
          <SevTile tone="warning" n={counts.Warning} label="Warning" />
          <SevTile
            tone="suggested"
            n={counts["Suggested Change"]}
            label="Suggested"
          />
        </div>
      </OverviewStep>
      <OverviewStep
        n={6}
        title="Actionable UI"
        sub="Findings translated to coordinator language; Critical blocks save, Warning queries, Suggested standardizes."
        last
      >
        {heroForSubject ? (
          <div className="panel border-accent-200 bg-accent-50/40 p-3">
            <div className="flex items-center gap-2 mb-1">
              <SeverityChip severity={heroForSubject.severity} />
              <span className="mono text-2xs text-slate-500">
                {heroForSubject.rule_id} · {heroForSubject.subject_id} ·{" "}
                {heroForSubject.visit}
              </span>
            </div>
            <div className="text-sm text-slate-800 leading-snug">
              {heroForSubject.user_message}
            </div>
            <div className="mt-2">
              <Link
                to={`/magic?subject=${subj}&visit=Week+16`}
                className="text-2xs text-accent-700 hover:text-accent-800"
              >
                See it in the eCRF →
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-2xs italic text-slate-500">
            Run the engine first to see the translated message.
          </div>
        )}
      </OverviewStep>
    </div>
  );
}

function OverviewStep({
  n,
  title,
  sub,
  cta,
  last,
  children,
}: {
  n: number;
  title: string;
  sub: string;
  cta?: { to: string; label: string };
  last?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className={`pl-12 relative ${last ? "" : "pb-8"}`}>
      <div className="absolute left-0 top-0 w-10 flex justify-center">
        <span className="w-9 h-9 inline-flex items-center justify-center bg-white border border-stone-300 rounded-full text-sm font-semibold mono text-slate-700 shadow-sm">
          {n}
        </span>
      </div>
      <div className="pb-3 flex items-baseline gap-3 flex-wrap">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {cta && (
          <Link
            to={cta.to}
            className="text-2xs text-accent-700 hover:text-accent-800 font-medium ml-auto"
          >
            {cta.label}
          </Link>
        )}
      </div>
      <p className="text-2xs text-slate-500 mb-3 leading-snug max-w-2xl">
        {sub}
      </p>
      {children && <div>{children}</div>}
    </section>
  );
}

function Diff({
  label,
  before,
  after,
}: {
  label: string;
  before: string;
  after: string;
}) {
  return (
    <div className="panel p-2">
      <div className="kicker mb-1">{label}</div>
      <div className="flex items-center gap-2">
        <span className="mono text-2xs bg-stone-100 text-slate-700 rounded px-1.5 py-0.5 flex-1 truncate">
          {before}
        </span>
        <span className="text-slate-400 text-2xs">→</span>
        <span className="mono text-2xs bg-accent-50 text-accent-800 rounded px-1.5 py-0.5 flex-1 truncate">
          {after}
        </span>
      </div>
    </div>
  );
}

function SevTile({
  tone,
  n,
  label,
}: {
  tone: "critical" | "warning" | "suggested";
  n: number;
  label: string;
}) {
  const cls = {
    critical:
      "border-sev-critical-300 bg-sev-critical-50 text-sev-critical-700",
    warning:
      "border-sev-warning-300 bg-sev-warning-50 text-sev-warning-700",
    suggested:
      "border-sev-suggested-300 bg-sev-suggested-50 text-sev-suggested-700",
  }[tone];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-2xs px-2 py-1 rounded border mono ${cls}`}
    >
      <span className="font-semibold">{n}</span>
      <span>{label}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------

function Trace({ finding, csv }: { finding: Finding; csv: CsvData }) {
  return (
    <div className="relative">
      <div className="absolute left-[18px] top-3 bottom-3 w-px bg-stone-200" />
      <Step
        n={1}
        title="Coordinator entry"
        sub="What the site coordinator typed into the eCRF for this visit."
      >
        <Step1 finding={finding} csv={csv} />
      </Step>
      <Step
        n={2}
        title="Mapping to SDTM"
        sub="Each eCRF entry becomes one or more SDTM rows. Lineage columns carry the form and field forward."
      >
        <Step2 finding={finding} csv={csv} />
      </Step>
      <Step
        n={3}
        title="Rule fired"
        sub="The deterministic engine executes; here's the math, exactly as written."
      >
        <Step3 finding={finding} />
      </Step>
      <Step
        n={4}
        title="Translated for the coordinator"
        sub="Stage 5 renders the Finding in plain English with concrete next steps."
        last
      >
        <Step4 finding={finding} />
      </Step>
    </div>
  );
}

function Step({
  n,
  title,
  sub,
  last,
  children,
}: {
  n: number;
  title: string;
  sub: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={`pl-12 relative ${last ? "" : "pb-10"}`}>
      <div className="absolute left-0 top-0 w-10 flex justify-center">
        <span className="w-9 h-9 inline-flex items-center justify-center bg-white border border-stone-300 rounded-full text-sm font-semibold mono text-slate-700 shadow-sm">
          {n}
        </span>
      </div>
      <div className="pb-3">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        <p className="text-2xs text-slate-500 mt-0.5 leading-snug max-w-2xl">
          {sub}
        </p>
      </div>
      <div>{children}</div>
    </section>
  );
}

// --- Step 1 — coordinator entry ------------------------------------------

function Step1({ finding, csv }: { finding: Finding; csv: CsvData }) {
  const rows = ecrfRowsForFinding(finding, csv);
  if (rows.length === 0)
    return (
      <div className="text-2xs text-slate-500 italic">
        No specific eCRF row pinned for this finding.
      </div>
    );

  const highlight = ecrfHighlightField(finding);

  return (
    <div className="panel p-4">
      <div className="text-2xs text-slate-600 mb-3">
        From <span className="mono text-slate-900">{finding.lineage.form}</span>{" "}
        for <span className="mono text-slate-900">{finding.subject_id}</span>{" "}
        {finding.visit && (
          <>
            at <span className="mono text-slate-900">{finding.visit}</span>
          </>
        )}
        .
      </div>
      <div className="border border-stone-200 rounded overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              {Object.keys(rows[0]).map((c) => (
                <th
                  key={c}
                  className={`text-left px-3 py-1.5 kicker ${
                    c === highlight ? "text-accent-700" : ""
                  }`}
                >
                  {fieldLabel(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-stone-100 last:border-b-0">
                {Object.entries(r).map(([k, v]) => (
                  <td
                    key={k}
                    className={`px-3 py-2 mono text-2xs ${
                      k === highlight
                        ? "bg-accent-50 text-accent-800 font-medium"
                        : "text-slate-700"
                    }`}
                  >
                    {String(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Step 2 — mapping -----------------------------------------------------

function Step2({ finding, csv }: { finding: Finding; csv: CsvData }) {
  const sdtm = sdtmRowsForFinding(finding, csv);
  if (sdtm.rows.length === 0)
    return (
      <div className="text-2xs text-slate-500 italic">
        No SDTM rows pinned for this finding.
      </div>
    );

  return (
    <div className="panel p-4">
      <div className="text-2xs text-slate-600 mb-3 max-w-2xl leading-snug">
        Lineage columns <span className="mono">source_ecrf_form</span> and{" "}
        <span className="mono">source_field</span> point back at exactly the
        form and field the coordinator touched. This is what lets Stage 5
        speak in eCRF terms even though the rule runs against SDTM.
      </div>
      <div className="border border-stone-200 rounded overflow-x-auto">
        <table className="w-full text-2xs">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              {sdtm.cols.map((c) => (
                <th
                  key={c}
                  className={`text-left px-3 py-1.5 mono font-medium ${
                    LINEAGE_COLS.has(c)
                      ? "text-accent-700 bg-accent-50/70"
                      : "text-slate-600"
                  }`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sdtm.rows.map((r, i) => (
              <tr key={i} className="border-b border-stone-100 last:border-b-0">
                {sdtm.cols.map((c) => (
                  <td
                    key={c}
                    className={`px-3 py-1.5 mono whitespace-nowrap ${
                      LINEAGE_COLS.has(c)
                        ? "bg-accent-50/70 text-accent-800"
                        : "text-slate-700"
                    }`}
                  >
                    {String(r[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Step 3 — rule fired (terminal block) ---------------------------------

function Step3({ finding }: { finding: Finding }) {
  return (
    <div>
      <div className="terminal">
        <div>
          <span className="prompt">$</span> klin check --rule{" "}
          <span className="key">{finding.rule_id}</span>
          {" "}--subject <span className="key">{finding.subject_id}</span>
          {finding.visit && (
            <>
              {" "}--visit <span className="key">"{finding.visit}"</span>
            </>
          )}
        </div>
        <div className="muted">loading engine…  ✓  loading data…  ✓</div>
        <div>
          <span className="key">rule</span>{" "}
          <span>{finding.rule_id}</span>{" "}
          <span className="muted">{ruleBlurb(finding.rule_id)}</span>
        </div>
        <div>
          <span className="key">severity</span>{" "}
          {finding.severity === "Critical" ? (
            <span className="bad">CRITICAL</span>
          ) : finding.severity === "Warning" ? (
            <span style={{ color: "#fbbf24" }}>WARNING</span>
          ) : (
            <span style={{ color: "#7dd3fc" }}>SUGGESTED CHANGE</span>
          )}
        </div>
        <div>
          <span className="key">evidence</span>
        </div>
        {evidenceLines(finding).map((l, i) => (
          <div key={i} className="pl-4">
            <span className="muted">·</span> {l[0]}{" "}
            <span className="muted">
              {".".repeat(Math.max(0, 26 - l[0].length))}
            </span>{" "}
            <span>{l[1]}</span>
          </div>
        ))}
        <div className="pt-1 border-t border-stone-700 mt-1">
          <span className="key">result</span>{" "}
          {finding.severity === "Critical" ? (
            <span className="bad">CRITICAL ✗</span>
          ) : (
            <span style={{ color: "#fbbf24" }}>FLAGGED ⚑</span>
          )}{" "}
          <span className="muted">— {finding.raw_message}</span>
        </div>
      </div>
      <p className="text-2xs text-slate-500 mt-2.5 leading-snug max-w-2xl">
        {finding.citation}
      </p>
    </div>
  );
}

function evidenceLines(f: Finding): [string, string][] {
  const p = f.template_params as Record<string, unknown>;
  const lines: [string, string][] = [];
  if (f.template_id === "RESPONSE_THRESHOLD") {
    if (p.baseline_sum !== undefined)
      lines.push([
        "baseline_sum",
        `${formatNum(p.baseline_sum)} mm`,
      ]);
    if (p.current_sum !== undefined)
      lines.push(["current_sum", `${formatNum(p.current_sum)} mm`]);
    if (p.pct_decrease !== undefined)
      lines.push([
        "pct_decrease",
        `${((p.pct_decrease as number) * 100).toFixed(1)}%`,
      ]);
    if (p.pct_increase !== undefined)
      lines.push([
        "pct_increase",
        `${((p.pct_increase as number) * 100).toFixed(1)}%`,
      ]);
    if (p.threshold !== undefined)
      lines.push([
        "threshold",
        `${((p.threshold as number) * 100).toFixed(1)}%`,
      ]);
    return lines;
  }
  if (f.template_id === "GHOST_REFERENCE") {
    return [
      ["ghost_id", String(p.ghost_id)],
      ["tu_ids", (p.tu_ids as string[]).join(", ")],
      ["tr_ids_at_visit", (p.tr_ids_at_visit as string[]).join(", ")],
    ];
  }
  if (f.template_id === "STANDARDIZATION") {
    return [
      ["raw_value", String(p.raw_value)],
      ["canonical", String(p.canonical)],
      ["field", String(p.field)],
    ];
  }
  if (f.template_id === "DUPLICATE_IDENTITY") {
    return [
      ["lesion_id", String(p.lesion_id)],
      [
        "conflicting_locations",
        (p.conflicting_locations as string[]).join(" / "),
      ],
      ["row_count", String(p.row_count)],
    ];
  }
  if (f.template_id === "METHOD_CHANGE") {
    return [
      ["baseline_method", String(p.baseline_method)],
      ["current_method", String(p.current_method)],
    ];
  }
  if (f.template_id === "LARGE_DROP") {
    const changes = p.changes as { lesion_id: string; prior_value: number; current_value: number; pct_drop: number }[];
    return changes.map((c) => [
      c.lesion_id,
      `${c.prior_value} → ${c.current_value} mm  (${(c.pct_drop * 100).toFixed(0)}% drop)`,
    ]);
  }
  if (f.template_id === "VISIT_WINDOW") {
    return [
      ["actual_date", String(p.actual_date)],
      ["expected_date", String(p.expected_date)],
      ["delta_days", `${p.delta_days} days`],
      ["window_days", `±${p.window_days}`],
    ];
  }
  if (f.template_id === "NEW_LESION_CONFLICT") {
    return [
      ["new_lesion_ids", (p.new_lesion_ids as string[]).join(", ")],
      ["rs_newlresp", String(p.rs_newlresp)],
      ["rs_ovrlresp", String(p.rs_ovrlresp)],
    ];
  }
  if (f.template_id === "CR_NON_TARGET") {
    return [
      ["ntrgresp", String(p.ntrgresp)],
      [
        "non_target_present_ids",
        (p.non_target_present_ids as string[]).join(", "),
      ],
    ];
  }
  return Object.entries(p).slice(0, 5).map(([k, v]) => [k, String(v)]);
}

function formatNum(n: unknown): string {
  if (typeof n !== "number") return String(n);
  return n.toFixed(1);
}

// --- Step 4 — translated ---------------------------------------------------

function Step4({ finding }: { finding: Finding }) {
  return (
    <div className="panel border-accent-200 bg-accent-50/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <SeverityChip severity={finding.severity} />
        <span className="mono text-2xs text-slate-500">
          {finding.rule_id}
        </span>
        <span className="ml-auto mono text-2xs text-accent-700 bg-white border border-accent-200 px-1.5 py-0.5 rounded">
          {finding.translator_source === "llm" ? "ai-rendered" : "templater"}
        </span>
      </div>
      <div className="text-sm text-slate-800 leading-snug">
        {finding.user_message}
      </div>
      {finding.suggested_actions.length > 0 && (
        <ul className="text-sm text-slate-700 mt-3 list-disc list-inside space-y-1">
          {finding.suggested_actions.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex items-center gap-3">
        <Link to="/magic" className="btn btn-primary">
          Open in coordinator view
        </Link>
        <span className="text-2xs text-slate-500">
          Same message lands as an inline callout on the eCRF.
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// data shaping

const LINEAGE_COLS = new Set([
  "source_ecrf_form",
  "source_field",
  "source_document_id",
]);

const TU_COLS = [
  "TULNKID",
  "TUORRES",
  "TULOC",
  "TUMETHOD",
  "VISIT",
  "source_ecrf_form",
  "source_field",
];
const TR_COLS = [
  "TRLNKID",
  "TRTESTCD",
  "TRORRES",
  "TRSTRESC",
  "TRSTRESU",
  "TRMETHOD",
  "VISIT",
  "source_ecrf_form",
  "source_field",
];
const RS_COLS = [
  "RSTESTCD",
  "RSORRES",
  "RSSTRESC",
  "VISIT",
  "source_ecrf_form",
  "source_field",
];

function findingKey(f: Finding): string {
  return `${f.rule_id}|${f.subject_id}|${f.visit ?? ""}|${f.lineage.field}`;
}

function keyAt(arr: Finding[], i: number): string | null {
  return arr[i] ? findingKey(arr[i]) : null;
}

function fieldLabel(k: string): string {
  return k
    .replace(/_raw$/, "")
    .replace(/_/g, " ")
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function ecrfHighlightField(f: Finding): string {
  if (f.rule_id === "TR-RS-001") return "target_lesion_response_raw";
  if (f.rule_id === "TR-RS-003") return "overall_response_raw";
  if (f.rule_id === "TU/TR-RS-002") return "new_lesion_response_raw";
  if (f.rule_id === "TR-003") return "assessment_method_raw";
  if (f.rule_id === "TR-002") return f.lineage.field;
  if (f.rule_id === "LARGE_DROP") return "measurement_value";
  if (f.rule_id === "VISIT_WINDOW") return "assessment_date";
  if (f.rule_id === "TU-TR-001") return "lesion_number";
  if (f.rule_id === "TU-002") return "lesion_site_raw";
  return f.lineage.field;
}

function ecrfRowsForFinding(
  f: Finding,
  csv: CsvData,
): Record<string, string>[] {
  const subj = f.subject_id;
  const visit = f.visit || "";
  if (f.lineage.form.startsWith("Disease")) {
    const row = csv.ecrfDisease.find(
      (r) => r.subject_id === subj && r.visit === visit,
    );
    return row ? [slimEcrf(row)] : [];
  }
  if (f.lineage.form.startsWith("Baseline")) {
    return csv.ecrfBaseline
      .filter((r) => r.subject_id === subj)
      .map(slimEcrf);
  }
  // Follow-up
  return csv.ecrfFollowup
    .filter((r) => r.subject_id === subj && r.visit === visit)
    .map(slimEcrf);
}

function slimEcrf(r: Record<string, string>): Record<string, string> {
  const drop = new Set([
    "demo_issue_tag",
    "source_document_id",
    "response_derived_by_system",
    "accepted_response_flag",
    "assessor_role",
    "response_criteria",
  ]);
  const out: Record<string, string> = {};
  for (const k of Object.keys(r)) if (!drop.has(k)) out[k] = r[k];
  return out;
}

function sdtmRowsForFinding(
  f: Finding,
  csv: CsvData,
): { cols: string[]; rows: Record<string, string>[] } {
  const subj = f.subject_id;
  const visit = f.visit || "";
  if (f.lineage.form.startsWith("Disease")) {
    const rows = csv.rs
      .filter((r) => r.USUBJID === subj && r.VISIT === visit)
      .map((r) => pick(r, RS_COLS));
    return { cols: RS_COLS, rows };
  }
  if (f.lineage.form.startsWith("Baseline")) {
    const rows = csv.tu
      .filter((r) => r.USUBJID === subj)
      .map((r) => pick(r, TU_COLS));
    return { cols: TU_COLS, rows };
  }
  // Follow-up assessments → TR rows for that visit.
  const rows = csv.tr
    .filter((r) => r.USUBJID === subj && r.VISIT === visit)
    .map((r) => pick(r, TR_COLS));
  return { cols: TR_COLS, rows };
}

function pick(
  r: Record<string, string>,
  cols: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const c of cols) out[c] = r[c] ?? "";
  return out;
}

function ruleBlurb(id: string): string {
  return {
    "TR-RS-001": "PR must be supported by ≥30% target sum decrease",
    "TR-RS-003": "Overall CR must not conflict with persistent non-target",
    "TU/TR-RS-002": "New lesion presence must agree with response",
    "TU-002": "Same lesion ID must denote one identity",
    "TU-TR-001": "Every TR.TRLNKID must exist in TU.TULNKID",
    "TR-003": "Imaging method should stay consistent across visits",
    "TR-002": "Raw eCRF terms standardize to controlled terminology",
    "LARGE_DROP": "Large single-interval drops should be verified",
    "VISIT_WINDOW": "Assessment date must fall within the visit window",
  }[id] ?? "";
}
