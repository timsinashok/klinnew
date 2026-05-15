import { useEffect, useMemo, useState } from "react";
import { fetchCsv, parseCsv, runEngine } from "../api";
import { ChartTemplate } from "../components/ChartTemplate";
import { SeverityChip } from "../components/SeverityBadge";
import { SkeletonGrid } from "../components/Skeleton";
import type { Finding } from "../types";

const SUBJECT = "SUBJ001";
const VISIT = "Week 16";
const VISIT_DATE = "2026-04-25";

interface PipelineData {
  ecrfFollowup: Record<string, string>[];
  ecrfDisease: Record<string, string>[];
  tu: Record<string, string>[];
  tr: Record<string, string>[];
  rs: Record<string, string>[];
  findings: Finding[];
}

export function PipelineDemo() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [drilldown, setDrilldown] = useState<Finding | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ef, ed, tu, tr, rs, run] = await Promise.all([
          fetchCsv("ecrf_followup.csv").then(parseCsv),
          fetchCsv("ecrf_disease_response.csv").then(parseCsv),
          fetchCsv("tu.csv").then(parseCsv),
          fetchCsv("tr.csv").then(parseCsv),
          fetchCsv("rs.csv").then(parseCsv),
          runEngine(true),
        ]);
        if (cancelled) return;
        setData({
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
      <header className="border-b border-slate-200 bg-white px-6 h-12 flex items-center gap-3 shrink-0">
        <h1 className="text-sm font-semibold">Pipeline</h1>
        <span className="text-2xs text-slate-500">
          End-to-end view of one visit
        </span>
        <span className="ml-auto text-2xs mono text-slate-500">
          <span className="text-slate-900">{SUBJECT}</span>
          {" / "}
          <span className="text-slate-900">{VISIT}</span>
          {" / "}
          <span className="text-slate-700">{VISIT_DATE}</span>
        </span>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-5xl mx-auto px-8 py-8 space-y-12">
          {err && (
            <div className="text-sm text-sev-critical-800 bg-sev-critical-50 border border-sev-critical-300 rounded p-2">
              {err}
            </div>
          )}
          {!data && !err && (
            <div className="space-y-3">
              <div className="text-2xs text-slate-500">
                Loading SUBJ001 Week 16 from the API…
              </div>
              <SkeletonGrid cols={6} rows={5} />
            </div>
          )}
          {data && (
            <>
              <PanelEcrf data={data} />
              <PanelConversion data={data} />
              <PanelCheck data={data} onDrill={setDrilldown} />
            </>
          )}
        </div>
      </div>

      {drilldown && (
        <DrilldownDrawer
          finding={drilldown}
          onClose={() => setDrilldown(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function PanelHeader({
  step,
  title,
  hint,
}: {
  step: 1 | 2 | 3;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="mono text-2xs font-semibold w-6 h-6 inline-flex items-center justify-center rounded-full bg-accent-700 text-white shrink-0 mt-0.5">
        {step}
      </div>
      <div>
        <h2 className="text-base font-semibold leading-snug">{title}</h2>
        <p className="text-sm text-slate-600 mt-0.5 leading-snug max-w-2xl">
          {hint}
        </p>
      </div>
    </div>
  );
}

// --- Panel 1: eCRF data ---------------------------------------------------

function PanelEcrf({ data }: { data: PipelineData }) {
  const tumorRows = data.ecrfFollowup
    .filter((r) => r.subject_id === SUBJECT && r.visit === VISIT)
    .map((r) => ({
      Lesion: r.lesion_number,
      Category: r.lesion_category,
      Description: r.lesion_description,
      Diameter:
        r.measurement_value && r.measurement_unit_raw
          ? `${r.measurement_value} ${r.measurement_unit_raw}`
          : "—",
      Status: r.lesion_status,
      Method: r.assessment_method_raw,
    }));
  const responseRow = data.ecrfDisease.find(
    (r) => r.subject_id === SUBJECT && r.visit === VISIT,
  );
  const responseTable = responseRow
    ? [
        {
          "Target response": responseRow.target_lesion_response_raw,
          "Non-target response": responseRow.non_target_lesion_response_raw,
          "New lesions": responseRow.new_lesion_response_raw,
          "Overall response": responseRow.overall_response_raw,
        },
      ]
    : [];

  return (
    <section>
      <PanelHeader
        step={1}
        title="eCRF data"
        hint="What the coordinator entered for this visit. Two forms: Tumor Assessment and Disease Response."
      />
      <div className="space-y-4">
        <CleanTable
          caption="Tumor Assessment · Follow-up Tumor Assessment"
          rows={tumorRows}
        />
        <CleanTable
          caption="Disease Response · Disease Response / RECIST Assessment"
          rows={responseTable}
        />
      </div>
    </section>
  );
}

function CleanTable({
  caption,
  rows,
}: {
  caption: string;
  rows: Record<string, string>[];
}) {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div className="panel overflow-hidden">
      <div className="px-4 py-2 border-b border-slate-200 bg-slate-50">
        <div className="text-2xs font-medium text-slate-600">{caption}</div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {cols.map((c) => (
              <th
                key={c}
                className="text-left px-4 py-2 text-2xs font-medium text-slate-500 uppercase tracking-wider"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className="border-b border-slate-100 last:border-b-0"
            >
              {cols.map((c) => (
                <td key={c} className="px-4 py-2.5 mono text-2xs text-slate-700">
                  {r[c]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// --- Panel 2: Conversion to SDTM ------------------------------------------

function PanelConversion({ data }: { data: PipelineData }) {
  const tumorEcrf = data.ecrfFollowup.find(
    (r) =>
      r.subject_id === SUBJECT && r.visit === VISIT && r.lesion_number === "T01",
  );
  const tumorTr = data.tr
    .filter(
      (r) =>
        r.USUBJID === SUBJECT && r.VISIT === VISIT && r.TRLNKID === "T01",
    )
    .map((r) => ({
      record: r.record_id,
      domain: r.DOMAIN,
      lesion: r.TRLNKID,
      test: r.TRTESTCD,
      result: r.TRSTRESC || r.TRORRES,
      unit: r.TRSTRESU || "",
      source_ecrf_form: r.source_ecrf_form,
      source_field: r.source_field,
    }));

  const responseEcrf = data.ecrfDisease.find(
    (r) => r.subject_id === SUBJECT && r.visit === VISIT,
  );
  const responseRs = data.rs
    .filter((r) => r.USUBJID === SUBJECT && r.VISIT === VISIT)
    .map((r) => ({
      record: r.record_id,
      domain: r.DOMAIN,
      test: r.RSTESTCD,
      raw: r.RSORRES,
      std: r.RSSTRESC,
      source_ecrf_form: r.source_ecrf_form,
      source_field: r.source_field,
    }));

  return (
    <section>
      <PanelHeader
        step={2}
        title="Conversion to SDTM"
        hint="Each coordinator entry becomes one or more SDTM rows. Every row carries its lineage back to the form and field it came from — that's how findings later speak the coordinator's language."
      />

      <ConversionPair
        heading="Tumor measurement"
        note="One T01 measurement on the Follow-up form becomes a DIAMETER row plus a TUMSTATE row in the TR domain."
        ecrfLabel="Follow-up Tumor Assessment"
        ecrfFields={
          tumorEcrf
            ? [
                ["Lesion", tumorEcrf.lesion_number],
                [
                  "Diameter",
                  `${tumorEcrf.measurement_value} ${tumorEcrf.measurement_unit_raw}`,
                ],
                ["Status", tumorEcrf.lesion_status],
                ["Method", tumorEcrf.assessment_method_raw],
              ]
            : []
        }
        sdtmLabel="TR · Tumor Results"
        sdtmRows={tumorTr.map((r) => ({
          record_id: r.record,
          TRLNKID: r.lesion,
          TRTESTCD: r.test,
          TRSTRESC: `${r.result}${r.unit ? " " + r.unit : ""}`,
          source_ecrf_form: r.source_ecrf_form,
          source_field: r.source_field,
        }))}
        lineageKeys={["source_ecrf_form", "source_field"]}
      />

      <div className="h-4" />

      <ConversionPair
        heading="Disease response"
        note="Four dropdown picks on the Disease Response form become four RS rows. Standardization (Partial Response → PR) happens at the same step."
        ecrfLabel="Disease Response / RECIST Assessment"
        ecrfFields={
          responseEcrf
            ? [
                ["Target response", responseEcrf.target_lesion_response_raw],
                ["Non-target response", responseEcrf.non_target_lesion_response_raw],
                ["New lesions", responseEcrf.new_lesion_response_raw],
                ["Overall response", responseEcrf.overall_response_raw],
              ]
            : []
        }
        sdtmLabel="RS · Disease Response"
        sdtmRows={responseRs.map((r) => ({
          record_id: r.record,
          RSTESTCD: r.test,
          RSORRES: r.raw,
          RSSTRESC: r.std,
          source_ecrf_form: r.source_ecrf_form,
          source_field: r.source_field,
        }))}
        lineageKeys={["source_ecrf_form", "source_field"]}
      />
    </section>
  );
}

function ConversionPair({
  heading,
  note,
  ecrfLabel,
  ecrfFields,
  sdtmLabel,
  sdtmRows,
  lineageKeys,
}: {
  heading: string;
  note: string;
  ecrfLabel: string;
  ecrfFields: [string, string][];
  sdtmLabel: string;
  sdtmRows: Record<string, string>[];
  lineageKeys: string[];
}) {
  return (
    <div className="panel p-5">
      <div className="text-sm font-medium mb-1">{heading}</div>
      <div className="text-2xs text-slate-600 mb-4 max-w-2xl leading-snug">
        {note}
      </div>

      <div className="grid grid-cols-[1fr_auto_2fr] gap-4 items-start">
        <div>
          <div className="text-2xs uppercase tracking-wider text-slate-500 font-medium mb-2">
            {ecrfLabel}
          </div>
          <dl className="border border-slate-200 rounded bg-white">
            {ecrfFields.map(([k, v], i) => (
              <div
                key={k}
                className={`flex justify-between items-baseline px-3 py-2 ${
                  i > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <dt className="text-2xs text-slate-500">{k}</dt>
                <dd className="mono text-2xs text-slate-900">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="flex flex-col items-center justify-center self-stretch text-slate-400">
          <svg viewBox="0 0 40 12" className="w-10 h-3">
            <path
              d="M0 6 H32 M28 2 L34 6 L28 10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
          <div className="text-2xs mono mt-1 text-slate-500">map</div>
        </div>

        <div>
          <div className="text-2xs uppercase tracking-wider text-slate-500 font-medium mb-2">
            {sdtmLabel}
          </div>
          <div className="border border-slate-200 rounded bg-white overflow-x-auto">
            <table className="w-full mono text-2xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  {Object.keys(sdtmRows[0] || {}).map((c) => (
                    <th
                      key={c}
                      className={`text-left px-2 py-1.5 font-medium ${
                        lineageKeys.includes(c)
                          ? "text-accent-700 bg-accent-50"
                          : "text-slate-600"
                      }`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sdtmRows.map((r, i) => (
                  <tr
                    key={i}
                    className="border-b border-slate-100 last:border-b-0"
                  >
                    {Object.entries(r).map(([k, v]) => (
                      <td
                        key={k}
                        className={`px-2 py-1.5 whitespace-nowrap ${
                          lineageKeys.includes(k)
                            ? "bg-accent-50 text-accent-800"
                            : "text-slate-700"
                        }`}
                      >
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="text-2xs text-accent-700 mt-2 leading-snug max-w-md">
            <span className="font-medium">Lineage:</span> every SDTM row carries
            the eCRF form and field it came from. Findings later use these to
            address the coordinator at the right form, in the right language.
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Panel 3: Consistency check -------------------------------------------

function PanelCheck({
  data,
  onDrill,
}: {
  data: PipelineData;
  onDrill: (f: Finding) => void;
}) {
  const visible = useMemo(() => {
    return data.findings.filter(
      (f) =>
        f.subject_id === SUBJECT &&
        (f.visit === VISIT || (f.visit === "Baseline" && f.rule_id === "TR-002")),
    );
  }, [data.findings]);
  const total = data.findings.length;
  const otherCount = total - visible.length;

  return (
    <section>
      <PanelHeader
        step={3}
        title="Consistency check"
        hint="Rules run against the SDTM data. Each finding carries severity, lineage, evidence rows, and an LLM-translated message."
      />
      <div className="space-y-2">
        {visible.map((f) => (
          <button
            key={`${f.rule_id}|${f.subject_id}|${f.visit}|${f.lineage.field}`}
            onClick={() => onDrill(f)}
            className="w-full panel p-3 text-left hover:border-accent-300 transition flex items-start gap-3"
          >
            <SeverityChip severity={f.severity} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-2xs">
                <span className="mono text-slate-500">{f.rule_id}</span>
                <span className="mono text-slate-500">
                  · {f.subject_id} {f.visit ? `· ${f.visit}` : ""}
                </span>
                <span className="ml-auto mono text-slate-400">
                  {f.translator_source === "llm" ? "ai" : "fallback"}
                </span>
              </div>
              <div className="text-sm text-slate-800 mt-1 leading-snug">
                {f.user_message}
              </div>
            </div>
            <div className="text-2xs text-accent-700 mono mt-0.5 shrink-0">
              open →
            </div>
          </button>
        ))}
      </div>
      <div className="text-2xs text-slate-500 mt-3">
        {otherCount} other findings exist across the rest of the study; this
        panel shows only the ones touching SUBJ001 Week 16.
      </div>
    </section>
  );
}

// --- Drilldown drawer (right panel) ---------------------------------------

function DrilldownDrawer({
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
        <SeverityChip severity={finding.severity} />
        <span className="mono text-2xs text-slate-500">{finding.rule_id}</span>
        <span className="mono text-2xs text-slate-500">
          · {finding.subject_id} {finding.visit ? `· ${finding.visit}` : ""}
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="ml-auto text-slate-400 hover:text-slate-900 w-6 h-6 inline-flex items-center justify-center rounded hover:bg-slate-100"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
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
        <div className="text-2xs text-slate-500 border-t border-slate-200 pt-3">
          <span className="kicker">Lineage</span>{" "}
          <span className="mono text-slate-700">{finding.lineage.form}</span> ·{" "}
          <span className="mono text-slate-700">{finding.lineage.field}</span> ·{" "}
          <span className="mono text-slate-500">
            {finding.lineage.source_doc}
          </span>
        </div>
        {finding.citation && (
          <div className="text-2xs italic text-slate-500">
            {finding.citation}
          </div>
        )}
      </div>
    </aside>
  );
}
