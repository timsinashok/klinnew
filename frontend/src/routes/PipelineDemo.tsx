import { useEffect, useMemo, useState } from "react";
import { fetchCsv, parseCsv, runEngine } from "../api";
import { EvidenceTable } from "../components/EvidenceTable";
import { FindingCard } from "../components/FindingCard";
import { SeverityChip } from "../components/SeverityBadge";
import { SkeletonGrid } from "../components/Skeleton";
import { Tooltip } from "../components/Tooltip";
import type { Finding, Severity } from "../types";
import { SEV_BADGE_CLASS } from "../ui/tokens";

const STAGES = [
  {
    id: "ingest",
    name: "Ingest",
    blurb: "Read eCRF rows from the site.",
    layer: "site",
  },
  {
    id: "map",
    name: "Map",
    blurb: "Transform to SDTM, attach lineage.",
    layer: "engine",
  },
  {
    id: "normalize",
    name: "Normalize",
    blurb: "Apply CDISC controlled terminology.",
    layer: "engine",
  },
  {
    id: "check",
    name: "Check",
    blurb: "Run the deterministic rule engine.",
    layer: "engine",
  },
  {
    id: "translate",
    name: "Translate",
    blurb: "Render findings in coordinator language.",
    layer: "LLM",
  },
] as const;
type StageId = (typeof STAGES)[number]["id"];

const SUBJECT = "SUBJ001";

interface PipelineData {
  ecrfBaseline: Record<string, string>[];
  ecrfFollowup: Record<string, string>[];
  ecrfDisease: Record<string, string>[];
  tu: Record<string, string>[];
  tr: Record<string, string>[];
  rs: Record<string, string>[];
  findings: Finding[];
}

export function PipelineDemo() {
  const [stage, setStage] = useState<StageId>("ingest");
  const [data, setData] = useState<PipelineData | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [eb, ef, ed, tu, tr, rs, run] = await Promise.all([
          fetchCsv("ecrf_baseline.csv").then(parseCsv),
          fetchCsv("ecrf_followup.csv").then(parseCsv),
          fetchCsv("ecrf_disease_response.csv").then(parseCsv),
          fetchCsv("tu.csv").then(parseCsv),
          fetchCsv("tr.csv").then(parseCsv),
          fetchCsv("rs.csv").then(parseCsv),
          runEngine(true),
        ]);
        if (cancelled) return;
        setData({
          ecrfBaseline: eb,
          ecrfFollowup: ef,
          ecrfDisease: ed,
          tu,
          tr,
          rs,
          findings: run.findings,
        });
      } catch (e) {
        if (!cancelled) setErr(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col h-full">
      <header className="border-b border-slate-200 bg-white px-6 h-12 flex items-center gap-3">
        <h1 className="text-sm font-semibold">Pipeline Demo</h1>
        <span className="text-2xs text-slate-500 mono">
          {SUBJECT} · KLIN-ONC-DEMO-001
        </span>
        <span className="ml-auto text-2xs text-slate-500">
          Stage{" "}
          <span className="mono text-slate-900">
            {STAGES.findIndex((s) => s.id === stage) + 1}
          </span>{" "}
          / 5
        </span>
      </header>

      <div className="flex-1 flex min-h-0">
        <Stepper active={stage} onSelect={setStage} />
        <div className="flex-1 overflow-y-auto px-8 py-6 min-w-0">
          {err && (
            <div className="text-sm text-sev-critical-800 bg-sev-critical-50 border border-sev-critical-300 rounded p-2 mb-3">
              {err}
            </div>
          )}
          {!data && !err && (
            <div className="space-y-3">
              <div className="text-2xs text-slate-500">
                Loading SUBJ001 from the API…
              </div>
              <SkeletonGrid cols={6} rows={5} />
            </div>
          )}
          {data && stage === "ingest" && <Ingest data={data} />}
          {data && stage === "map" && <Map data={data} />}
          {data && stage === "normalize" && <Normalize data={data} />}
          {data && stage === "check" && <Check data={data} />}
          {data && stage === "translate" && <Translate data={data} />}
        </div>
      </div>
    </div>
  );
}

function Stepper({
  active,
  onSelect,
}: {
  active: StageId;
  onSelect: (s: StageId) => void;
}) {
  return (
    <aside className="w-60 border-r border-slate-200 bg-white shrink-0 overflow-y-auto py-3">
      <ol className="px-2 space-y-0.5">
        {STAGES.map((s, i) => {
          const on = s.id === active;
          return (
            <li key={s.id}>
              <button
                onClick={() => onSelect(s.id)}
                className={`w-full text-left rounded px-3 py-2 flex items-start gap-3 ${
                  on
                    ? "bg-accent-50 border border-accent-200"
                    : "border border-transparent hover:bg-slate-50"
                }`}
              >
                <span
                  className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-2xs font-semibold mono ${
                    on
                      ? "bg-accent-700 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block text-sm font-medium ${
                      on ? "text-accent-800" : "text-slate-900"
                    }`}
                  >
                    {s.name}
                  </span>
                  <span className="block text-2xs text-slate-500 mt-0.5 leading-snug">
                    {s.blurb}
                  </span>
                  <span className="block text-2xs mono text-slate-400 mt-1">
                    {s.layer}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

// --- Stage 1: Ingest -------------------------------------------------------

function Ingest({ data }: { data: PipelineData }) {
  const ebSubj = data.ecrfBaseline
    .filter((r) => r.subject_id === SUBJECT)
    .map((r) => slim(r, ["demo_issue_tag", "source_document_id"]));
  const efSubj = data.ecrfFollowup
    .filter((r) => r.subject_id === SUBJECT)
    .slice(0, 6)
    .map((r) => slim(r, ["demo_issue_tag", "source_document_id"]));
  const edSubj = data.ecrfDisease
    .filter((r) => r.subject_id === SUBJECT)
    .map((r) => slim(r, ["demo_issue_tag", "source_document_id"]));

  return (
    <StageBody
      title="Ingest"
      hint="Read eCRF rows as the coordinator entered them. Three forms feed the engine."
    >
      <EvidenceTable
        rows={ebSubj}
        title="Baseline Tumor Assessment"
        compact
      />
      <EvidenceTable
        rows={efSubj}
        title="Follow-up Tumor Assessment (first 6 rows)"
        compact
      />
      <EvidenceTable
        rows={edSubj}
        title="Disease Response / RECIST Assessment"
        compact
      />
    </StageBody>
  );
}

// --- Stage 2: Map ----------------------------------------------------------

function Map({ data }: { data: PipelineData }) {
  const heroEcrf = data.ecrfBaseline.find(
    (r) =>
      r.subject_id === SUBJECT &&
      r.lesion_category === "TARGET" &&
      r.lesion_number === "T01",
  );
  const heroTu = data.tu.find(
    (r) => r.USUBJID === SUBJECT && r.TULNKID === "T01",
  );
  const heroTr = data.tr.filter(
    (r) =>
      r.USUBJID === SUBJECT &&
      r.TRLNKID === "T01" &&
      r.VISIT === "Baseline",
  );

  return (
    <StageBody
      title="Map"
      hint="One eCRF row becomes one TU identity row plus one TR row per measurement. Every SDTM row carries the lineage columns so the back-translation in Stage 5 stays grounded."
      breadcrumb={`${SUBJECT} / Baseline / T01`}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div>
          <div className="kicker mb-2">eCRF row</div>
          <EvidenceTable rows={heroEcrf ? [heroEcrf] : []} compact />
        </div>
        <div>
          <div className="kicker mb-2">SDTM rows produced</div>
          <div className="space-y-3">
            <EvidenceTable
              rows={heroTu ? [heroTu] : []}
              title="TU"
              compact
            />
            <EvidenceTable rows={heroTr} title="TR" compact />
          </div>
        </div>
      </div>
      <div className="text-2xs text-slate-600 border-l-2 border-accent-300 pl-3 flex items-start gap-1">
        <span className="leading-snug">
          Notice the lineage columns on the right —{" "}
          <span className="mono">source_ecrf_form</span>,{" "}
          <span className="mono">source_field</span>,{" "}
          <span className="mono">source_document_id</span>. Every Finding
          inherits this so coordinator-facing text can address the right form
          and field by name.
        </span>
        <Tooltip text="This is the lineage thread. It's how a finding produced at the SDTM layer can be re-expressed in eCRF language at Stage 5." />
      </div>
    </StageBody>
  );
}

// --- Stage 3: Normalize ----------------------------------------------------

function Normalize({ data }: { data: PipelineData }) {
  const examples = useMemo(() => {
    const subjBaseline = data.ecrfBaseline.find(
      (r) =>
        r.subject_id === SUBJECT &&
        r.lesion_number === "T01" &&
        r.assessment_method_raw &&
        r.assessment_method_raw.toLowerCase() !== "ct scan",
    );
    const tuT01 = data.tu.find(
      (r) => r.USUBJID === SUBJECT && r.TULNKID === "T01",
    );
    const dispW16 = data.ecrfDisease.find(
      (r) => r.subject_id === SUBJECT && r.visit === "Week 16",
    );
    const rsW16 = data.rs.find(
      (r) =>
        r.USUBJID === SUBJECT &&
        r.VISIT === "Week 16" &&
        r.RSTESTCD === "TRGRESP",
    );
    const cmRow = data.ecrfFollowup.find(
      (r) =>
        r.measurement_unit_raw &&
        r.measurement_unit_raw.toLowerCase() === "cm",
    );
    return { subjBaseline, tuT01, dispW16, rsW16, cmRow };
  }, [data]);

  return (
    <StageBody
      title="Normalize"
      hint="Apply CDISC controlled terminology. The raw eCRF values stay readable; the standardized values feed the rule engine."
    >
      <Diff
        label="Imaging method"
        before={examples.subjBaseline?.assessment_method_raw || "—"}
        after={examples.tuT01?.TUMETHOD || "—"}
        scope={`${SUBJECT} · Baseline · ${examples.subjBaseline?.source_document_id || ""}`}
      />
      <Diff
        label="Target response"
        before={examples.dispW16?.target_lesion_response_raw || "—"}
        after={examples.rsW16?.RSSTRESC || "—"}
        scope={`${SUBJECT} · Week 16 · ${examples.dispW16?.source_document_id || ""}`}
      />
      <Diff
        label="Measurement unit"
        before={
          examples.cmRow
            ? `${examples.cmRow.measurement_value} ${examples.cmRow.measurement_unit_raw}`
            : "—"
        }
        after={
          examples.cmRow
            ? `${Number(examples.cmRow.measurement_value) * 10} mm`
            : "—"
        }
        scope={`SUBJ003 · Week 8 · ${examples.cmRow?.source_document_id || ""}`}
      />
    </StageBody>
  );
}

function Diff({
  label,
  before,
  after,
  scope,
}: {
  label: string;
  before: string;
  after: string;
  scope: string;
}) {
  return (
    <div className="panel p-3">
      <div className="kicker">{label}</div>
      <div className="flex items-center gap-3 mt-2">
        <div className="flex-1 mono text-2xs bg-slate-100 text-slate-700 rounded px-2 py-1.5">
          {before}
        </div>
        <div className="text-slate-400 text-xs">→</div>
        <div className="flex-1 mono text-2xs bg-accent-50 text-accent-800 rounded px-2 py-1.5">
          {after}
        </div>
      </div>
      <div className="text-2xs text-slate-500 mt-2 mono">{scope}</div>
    </div>
  );
}

// --- Stage 4: Check --------------------------------------------------------

function Check({ data }: { data: PipelineData }) {
  const subj = data.findings.filter((f) => f.subject_id === SUBJECT);
  const counts: Record<Severity, number> = {
    Critical: subj.filter((f) => f.severity === "Critical").length,
    Warning: subj.filter((f) => f.severity === "Warning").length,
    "Suggested Change": subj.filter((f) => f.severity === "Suggested Change")
      .length,
  };
  return (
    <StageBody
      title="Check"
      hint="The deterministic engine runs every registered rule and emits Finding objects with full lineage and evidence rows."
    >
      <div className="grid grid-cols-3 gap-3">
        <Tile label="Critical" value={counts.Critical} tone="Critical" />
        <Tile label="Warning" value={counts.Warning} tone="Warning" />
        <Tile
          label="Suggested"
          value={counts["Suggested Change"]}
          tone="Suggested Change"
        />
      </div>
      <div>
        <div className="kicker mb-2">{SUBJECT} findings</div>
        <div className="space-y-2">
          {subj.map((f, i) => (
            <div key={i} className="panel p-3">
              <div className="flex items-center gap-2">
                <SeverityChip severity={f.severity} />
                <span className="mono text-2xs text-slate-500">
                  {f.rule_id}
                </span>
                <span className="mono text-2xs text-slate-500">
                  · {f.visit || "—"}
                </span>
              </div>
              <div className="text-sm text-slate-700 mt-1.5 leading-snug">
                {f.raw_message}
              </div>
            </div>
          ))}
        </div>
      </div>
    </StageBody>
  );
}

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: Severity;
}) {
  return (
    <div className={`panel p-3 ${SEV_BADGE_CLASS[tone]}`}>
      <div className="kicker">{label}</div>
      <div className="text-2xl font-semibold mono mt-1">{value}</div>
    </div>
  );
}

// --- Stage 5: Translate ----------------------------------------------------

function Translate({ data }: { data: PipelineData }) {
  const hero = data.findings.find(
    (f) => f.subject_id === SUBJECT && f.rule_id === "TR-RS-001",
  );
  if (!hero)
    return (
      <div className="text-sm text-slate-500">
        No PR-threshold finding.
      </div>
    );

  return (
    <StageBody
      title="Translate"
      hint="The LLM (or the deterministic templater fallback) renders each Finding in eCRF terms. No SDTM variable names leak into the output."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-4">
          <div className="kicker mb-1.5">Raw engine output</div>
          <div className="text-sm text-slate-800">{hero.raw_message}</div>
          <div className="text-2xs text-slate-500 mt-2 mono">
            rule_id: {hero.rule_id} · template: {hero.template_id}
          </div>
        </div>
        <div className="panel p-4 border-accent-200 bg-accent-50">
          <div className="flex items-center kicker mb-1.5">
            <span>Coordinator-facing translation</span>
            <span className="ml-2 text-2xs mono text-accent-700 bg-white px-1.5 py-0.5 rounded">
              {hero.translator_source || "—"}
            </span>
            <Tooltip text="This text is rendered by Claude Haiku 4.5 from the engine's structured Finding. If the LLM is unavailable, a deterministic template renders the same content." />
          </div>
          <div className="text-sm text-accent-900">{hero.user_message}</div>
          {hero.suggested_actions.length > 0 && (
            <ul className="text-sm text-accent-900 mt-3 list-disc list-inside space-y-1">
              {hero.suggested_actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div>
        <div className="kicker mb-2">Full finding card</div>
        <FindingCard finding={hero} />
      </div>
    </StageBody>
  );
}

// --- helpers ---------------------------------------------------------------

function StageBody({
  title,
  hint,
  breadcrumb,
  children,
}: {
  title: string;
  hint: string;
  breadcrumb?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        {breadcrumb && (
          <div className="text-2xs text-slate-500 mono mt-0.5">
            {breadcrumb}
          </div>
        )}
        <p className="text-sm text-slate-600 mt-1 max-w-3xl leading-snug">
          {hint}
        </p>
      </div>
      {children}
    </div>
  );
}

function slim(
  row: Record<string, string>,
  drop: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(row)) if (!drop.includes(k)) out[k] = row[k];
  return out;
}
