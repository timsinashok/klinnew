import { useEffect, useState } from "react";
import { fetchCsv, parseCsv } from "../api";

const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

type DatasetDef = {
  name: string;
  filename: string;
  description: string;
  group: "SDTM" | "eCRF" | "Reference";
};

const DATASETS: DatasetDef[] = [
  {
    name: "DM — Demographics",
    filename: "dm.csv",
    description:
      "One row per subject. Age, sex, race, eligibility, diagnosis, ECOG, treatment start.",
    group: "SDTM",
  },
  {
    name: "TU — Tumor Identification",
    filename: "tu.csv",
    description:
      "Target / non-target / new lesions identified at baseline and across visits.",
    group: "SDTM",
  },
  {
    name: "TR — Tumor Results",
    filename: "tr.csv",
    description:
      "Per-lesion measurements at every visit. Diameter, unit, method, status.",
    group: "SDTM",
  },
  {
    name: "RS — Disease Response",
    filename: "rs.csv",
    description:
      "RECIST 1.1 response codes per visit: target, non-target, new lesions, overall.",
    group: "SDTM",
  },
  {
    name: "LB — Lab Values",
    filename: "lb.csv",
    description:
      "Central lab results. Test code, result, unit, reference range, abnormal flag.",
    group: "SDTM",
  },
  {
    name: "Baseline tumor eCRF",
    filename: "ecrf_baseline.csv",
    description: "Coordinator-entered baseline tumor assessment form rows.",
    group: "eCRF",
  },
  {
    name: "Follow-up tumor eCRF",
    filename: "ecrf_followup.csv",
    description: "Coordinator-entered follow-up tumor assessment form rows.",
    group: "eCRF",
  },
  {
    name: "Disease response eCRF",
    filename: "ecrf_disease_response.csv",
    description: "RECIST disease response form rows.",
    group: "eCRF",
  },
  {
    name: "Demographics eCRF",
    filename: "ecrf_dm.csv",
    description: "Screening / demographics form rows.",
    group: "eCRF",
  },
  {
    name: "Lab values eCRF",
    filename: "ecrf_lb.csv",
    description: "Central lab form rows.",
    group: "eCRF",
  },
  {
    name: "Checks catalog",
    filename: "checks_catalog.csv",
    description:
      "Every deterministic rule the engine runs: id, layer, severity, citation.",
    group: "Reference",
  },
  {
    name: "Expected issues",
    filename: "final_issue_log.csv",
    description:
      "Seeded ground-truth findings for benchmarking the engine against the dataset.",
    group: "Reference",
  },
];

export function Datasets() {
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      DATASETS.map(async (d) => {
        try {
          const text = await fetchCsv(d.filename);
          const rows = parseCsv(text);
          return [d.filename, rows.length] as const;
        } catch {
          return [d.filename, -1] as const;
        }
      }),
    ).then((entries) => {
      if (cancelled) return;
      const m: Record<string, number> = {};
      for (const [k, v] of entries) m[k] = v;
      setCounts(m);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const download = (filename: string) => {
    // Open a regular GET — the server returns the raw CSV.
    const url = `${BASE}/api/data/${filename}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const groups: DatasetDef["group"][] = ["SDTM", "eCRF", "Reference"];

  return (
    <div className="min-h-full bg-[#fafaf8]">
      <div className="border-b border-stone-200 bg-white">
        <div className="max-w-6xl mx-auto px-8 py-5">
          <div className="kicker mb-1">Deliverables</div>
          <h1 className="text-[24px] leading-tight serif font-medium">
            Datasets
          </h1>
          <div className="text-sm text-slate-600 mt-1 max-w-3xl">
            Every dataset the pipeline has produced so far for this study —
            SDTM domains, the raw eCRF rows that fed them, and the reference
            catalogs. Download any file as CSV.
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-8 py-6 space-y-6">
        {groups.map((g) => (
          <section key={g}>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-slate-600">
                {g}
              </h2>
              <div className="text-2xs text-slate-500">
                {g === "SDTM"
                  ? "CDISC SDTM IG · current version"
                  : g === "eCRF"
                    ? "Coordinator-entered source forms"
                    : "Engine reference"}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {DATASETS.filter((d) => d.group === g).map((d) => (
                <DatasetCard
                  key={d.filename}
                  def={d}
                  rowCount={counts[d.filename]}
                  onDownload={() => download(d.filename)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function DatasetCard({
  def,
  rowCount,
  onDownload,
}: {
  def: DatasetDef;
  rowCount: number | undefined;
  onDownload: () => void;
}) {
  return (
    <div className="panel p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="mono text-2xs px-1.5 py-0.5 rounded border border-stone-300 bg-stone-50 text-slate-700">
          {def.filename}
        </span>
        {rowCount !== undefined && rowCount >= 0 && (
          <span className="text-2xs text-slate-500 mono">
            {rowCount.toLocaleString()} rows
          </span>
        )}
        {rowCount === -1 && (
          <span className="text-2xs text-sev-critical-600">unavailable</span>
        )}
      </div>
      <div className="text-sm font-semibold leading-tight">{def.name}</div>
      <div className="text-2xs text-slate-600 mt-1 leading-snug flex-1">
        {def.description}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          className="btn btn-primary"
          onClick={onDownload}
          disabled={rowCount === -1}
        >
          Download CSV
        </button>
        <a
          href={`${BASE}/api/data/${def.filename}`}
          target="_blank"
          rel="noreferrer"
          className="text-2xs text-slate-500 hover:text-accent-700"
        >
          preview →
        </a>
      </div>
    </div>
  );
}
