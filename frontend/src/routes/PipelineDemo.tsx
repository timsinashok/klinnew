import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchCsv, parseCsv, runEngine } from "../api";
import { EvidenceTable } from "../components/EvidenceTable";
import { FindingCard } from "../components/FindingCard";
import { SeverityBadge } from "../components/SeverityBadge";
import { SkeletonGrid } from "../components/Skeleton";
import { Tooltip } from "../components/Tooltip";
import type { Finding } from "../types";

const STAGES = [
  { id: "ingest", name: "Ingest", blurb: "Read eCRF rows from the site." },
  { id: "map", name: "Map", blurb: "Transform to SDTM, attach lineage." },
  { id: "normalize", name: "Normalize", blurb: "Apply CDISC controlled terminology." },
  { id: "check", name: "Check", blurb: "Run the deterministic rule engine." },
  { id: "translate", name: "Translate", blurb: "Render findings in coordinator language." },
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
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="border-b bg-white px-6 py-3 flex items-center gap-4">
        <Link to="/" className="text-sm text-neutral-500 hover:text-neutral-900">
          ← Home
        </Link>
        <div className="text-sm font-semibold">Pipeline Demo</div>
        <div className="ml-auto text-xs text-neutral-500">
          Tracing&nbsp;
          <span className="mono text-neutral-900">{SUBJECT}</span>
          &nbsp;through five stages
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto p-6 w-full">
        <StageStrip active={stage} onSelect={setStage} />

        <div className="mt-6">
          {err && (
            <div className="text-sm text-red-600 border border-red-200 bg-red-50 rounded p-3">
              {err}
            </div>
          )}
          {!data && !err && (
            <div className="space-y-3">
              <div className="text-xs text-neutral-500">
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
      </main>
    </div>
  );
}

function StageStrip({
  active,
  onSelect,
}: {
  active: StageId;
  onSelect: (s: StageId) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {STAGES.map((s, i) => {
        const on = s.id === active;
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={`relative text-left border rounded p-3 transition ${
              on
                ? "border-neutral-900 bg-white shadow-sm"
                : "border-neutral-200 bg-white hover:border-neutral-400"
            }`}
          >
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">
              Stage {i + 1}
            </div>
            <div className="text-sm font-medium mt-0.5">{s.name}</div>
            <div className="text-xs text-neutral-500 mt-1">{s.blurb}</div>
          </button>
        );
      })}
    </div>
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
    <Section
      title="Stage 1 · Ingest"
      hint="Read eCRF rows as the coordinator entered them. Three forms feed the engine: Baseline Tumor Assessment, Follow-up Tumor Assessment, and Disease Response."
    >
      <EvidenceTable
        rows={ebSubj}
        title={`Baseline Tumor Assessment · ${SUBJECT}`}
      />
      <EvidenceTable
        rows={efSubj}
        title={`Follow-up Tumor Assessment · ${SUBJECT} (first 6 rows)`}
      />
      <EvidenceTable
        rows={edSubj}
        title={`Disease Response / RECIST Assessment · ${SUBJECT}`}
      />
    </Section>
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
    <Section
      title="Stage 2 · Map"
      hint="One eCRF row becomes one TU identity row plus one TR row per measurement. Every SDTM row carries the lineage columns source_ecrf_form / source_field / source_document_id so the back-translation in Stage 5 stays grounded."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <div>
          <Label>eCRF row</Label>
          <EvidenceTable rows={heroEcrf ? [heroEcrf] : []} />
        </div>
        <div>
          <Label>SDTM rows produced</Label>
          <div className="space-y-2">
            <EvidenceTable rows={heroTu ? [heroTu] : []} title="TU" />
            <EvidenceTable rows={heroTr} title="TR" />
          </div>
        </div>
      </div>
      <div className="text-xs text-neutral-600 border-l-2 border-neutral-300 pl-3 flex items-start gap-1">
        <span>
          Notice the lineage columns on the right: <span className="mono">source_ecrf_form</span>
          {" "}= "Baseline Tumor Assessment", <span className="mono">source_field</span> identifies
          the originating eCRF cell, and <span className="mono">source_document_id</span> threads
          back to the radiology report.
        </span>
        <Tooltip text="This is the lineage thread. It's how a finding produced at the SDTM layer (Stage 4) can be re-expressed in eCRF language at Stage 5 — the form name and field label come from these columns." />
      </div>
    </Section>
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
    <Section
      title="Stage 3 · Normalize"
      hint="Apply CDISC controlled terminology and unit conversion. The raw eCRF values stay readable to the coordinator; the standardized values feed the rule engine."
    >
      <Diff
        label="Imaging method"
        before={examples.subjBaseline?.assessment_method_raw || "—"}
        after={examples.tuT01?.TUMETHOD || "—"}
        scope={`SUBJ001 Baseline · ${examples.subjBaseline?.source_document_id || ""}`}
      />
      <Diff
        label="Target response"
        before={examples.dispW16?.target_lesion_response_raw || "—"}
        after={examples.rsW16?.RSSTRESC || "—"}
        scope={`SUBJ001 Week 16 · ${examples.dispW16?.source_document_id || ""}`}
      />
      <Diff
        label="Measurement unit"
        before={
          examples.cmRow
            ? `${examples.cmRow.measurement_value} ${examples.cmRow.measurement_unit_raw}`
            : "—"
        }
        after={
          examples.cmRow ? `${Number(examples.cmRow.measurement_value) * 10} mm` : "—"
        }
        scope={`SUBJ003 Week 8 · ${examples.cmRow?.source_document_id || ""}`}
      />
    </Section>
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
    <div className="border rounded p-3 bg-white">
      <div className="text-xs text-neutral-500 uppercase tracking-wide">
        {label}
      </div>
      <div className="flex items-center gap-3 mt-2">
        <div className="flex-1 mono text-sm bg-neutral-100 rounded px-2 py-1">
          {before}
        </div>
        <div className="text-neutral-400">→</div>
        <div className="flex-1 mono text-sm bg-emerald-50 text-emerald-800 rounded px-2 py-1">
          {after}
        </div>
      </div>
      <div className="text-xs text-neutral-500 mt-2">{scope}</div>
    </div>
  );
}

// --- Stage 4: Check --------------------------------------------------------

function Check({ data }: { data: PipelineData }) {
  const subj = data.findings.filter((f) => f.subject_id === SUBJECT);
  const counts = {
    Critical: subj.filter((f) => f.severity === "Critical").length,
    Warning: subj.filter((f) => f.severity === "Warning").length,
    "Suggested Change": subj.filter((f) => f.severity === "Suggested Change").length,
  };
  return (
    <Section
      title="Stage 4 · Check"
      hint="The deterministic engine runs every registered rule against the SDTM data and emits Finding objects with full lineage and evidence rows."
    >
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Tile label="Critical" value={counts.Critical} tone="red" />
        <Tile label="Warning" value={counts.Warning} tone="amber" />
        <Tile label="Suggested Change" value={counts["Suggested Change"]} tone="blue" />
      </div>
      <div>
        <Label>{SUBJECT}'s findings</Label>
        <div className="space-y-2">
          {subj.map((f, i) => (
            <div key={i} className="border rounded p-3 bg-white">
              <div className="flex items-center gap-2 text-xs">
                <SeverityBadge severity={f.severity} />
                <span className="mono text-neutral-500">{f.rule_id}</span>
                <span className="mono text-neutral-500">
                  · {f.visit || "—"}
                </span>
              </div>
              <div className="text-sm text-neutral-700 mt-1">
                {f.raw_message}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Tile({
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
    <div className={`border rounded p-3 ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-medium mono">{value}</div>
    </div>
  );
}

// --- Stage 5: Translate ----------------------------------------------------

function Translate({ data }: { data: PipelineData }) {
  const hero = data.findings.find(
    (f) =>
      f.subject_id === SUBJECT &&
      f.rule_id === "TR-RS-001",
  );
  if (!hero) return <div className="text-sm text-neutral-500">No PR-threshold finding.</div>;

  return (
    <Section
      title="Stage 5 · Translate"
      hint="The LLM (or the deterministic templater fallback) renders each Finding in eCRF terms for the coordinator. No SDTM variable names leak into the output."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded p-3 bg-neutral-100">
          <Label>Raw engine output</Label>
          <div className="text-sm text-neutral-800 mt-1">{hero.raw_message}</div>
          <div className="text-xs text-neutral-500 mt-2 mono">
            rule_id: {hero.rule_id} · template: {hero.template_id}
          </div>
        </div>
        <div className="border rounded p-3 bg-emerald-50 border-emerald-200">
          <Label>
            Coordinator-facing translation
            <span className="ml-2 text-[10px] mono text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
              {hero.translator_source || "—"}
            </span>
            <Tooltip text="This text is rendered by Claude Haiku 4.5 from the engine's structured Finding. If the LLM is unavailable, a deterministic template renders the same content." />
          </Label>
          <div className="text-sm text-emerald-900 mt-1">{hero.user_message}</div>
          {hero.suggested_actions.length > 0 && (
            <ul className="text-sm text-emerald-900 mt-3 list-disc list-inside space-y-1">
              {hero.suggested_actions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div>
        <Label>Full finding card</Label>
        <FindingCard finding={hero} />
      </div>
    </Section>
  );
}

// --- helpers ---------------------------------------------------------------

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-neutral-600 mt-1 max-w-3xl">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
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
