import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { runEngine } from "../api";
import type { Finding, Severity } from "../types";
import { SEV_BADGE_CLASS, SEV_LABEL_SHORT } from "../ui/tokens";

const DATA_FILES = [
  { name: "tu.csv", label: "Tumor Identification" },
  { name: "tr.csv", label: "Tumor Results" },
  { name: "rs.csv", label: "Disease Response" },
  { name: "ecrf_baseline.csv", label: "eCRF · Baseline" },
  { name: "ecrf_followup.csv", label: "eCRF · Follow-up" },
  { name: "ecrf_disease_response.csv", label: "eCRF · Disease Response" },
  { name: "expected_issues.csv", label: "Expected Issues" },
  { name: "checks_catalog.csv", label: "Checks Catalog" },
];
const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export function Workspace() {
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t0 = performance.now();
    runEngine(true)
      .then((r) => {
        setFindings(r.findings);
        setElapsedMs(Math.round(performance.now() - t0));
      })
      .catch((e) => setErr(String(e)));
  }, []);

  const counts: Record<Severity, number> = {
    Critical: 0,
    Warning: 0,
    "Suggested Change": 0,
  };
  for (const f of findings || []) counts[f.severity]++;
  const total = findings?.length ?? 0;

  return (
    <div className="px-8 py-6 max-w-6xl">
      <div className="flex items-baseline gap-3 mb-1">
        <h1 className="text-xl font-semibold">Workspace</h1>
        <span className="text-xs text-slate-500">
          KLIN-ONC-DEMO-001 · 5 subjects · 7 visits
        </span>
      </div>
      <p className="text-sm text-slate-600 mb-6 max-w-2xl">
        eCRF consistency checks for an oncology study. Run the engine, review
        findings in coordinator language, drill down to source evidence.
      </p>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <RunSummary
          counts={counts}
          total={total}
          loading={findings === null && !err}
          err={err}
          elapsedMs={elapsedMs}
        />
        <Tile
          to="/magic"
          eyebrow="Coordinator view"
          title="Magic Demo"
          body="eCRF entry with inline consistency indicators. Edit a value, run a check, resolve findings before submit."
          ctaStatus={total > 0 ? `${total} open findings` : "Ready"}
        />
        <Tile
          to="/pipeline"
          eyebrow="Technical view"
          title="Pipeline Demo"
          body="Follow SUBJ001 through Ingest → Map → Normalize → Check → Translate. Lineage thread visible at every step."
          ctaStatus="5 stages"
        />
      </section>

      <section className="panel p-5">
        <div className="kicker mb-3">Synthetic data</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1 text-sm">
          {DATA_FILES.map((d) => (
            <a
              key={d.name}
              href={`${API_BASE}/api/data/${d.name}`}
              target="_blank"
              rel="noreferrer"
              className="block px-2 py-1.5 rounded hover:bg-slate-50 text-slate-700"
            >
              <div className="text-xs text-slate-500">{d.label}</div>
              <div className="mono text-2xs text-slate-400">{d.name}</div>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}

function RunSummary({
  counts,
  total,
  loading,
  err,
  elapsedMs,
}: {
  counts: Record<Severity, number>;
  total: number;
  loading: boolean;
  err: string | null;
  elapsedMs: number | null;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="kicker">Last engine run</div>
        {elapsedMs !== null && (
          <span className="mono text-2xs text-slate-400">
            {elapsedMs} ms
          </span>
        )}
      </div>
      {loading && (
        <div className="space-y-2">
          <div className="h-6 w-20 bg-slate-100 rounded animate-pulse" />
          <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
        </div>
      )}
      {err && (
        <div className="text-xs text-sev-critical-700 bg-sev-critical-50 border border-sev-critical-300 rounded p-2">
          {err}
        </div>
      )}
      {!loading && !err && (
        <>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-semibold mono">{total}</div>
            <div className="text-xs text-slate-500">findings</div>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {(
              ["Critical", "Warning", "Suggested Change"] as const
            ).map((s) => (
              <span
                key={s}
                className={`text-2xs px-1.5 py-0.5 rounded border ${SEV_BADGE_CLASS[s]}`}
              >
                {SEV_LABEL_SHORT[s]} · {counts[s]}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Tile({
  to,
  eyebrow,
  title,
  body,
  ctaStatus,
}: {
  to: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaStatus: string;
}) {
  return (
    <Link
      to={to}
      className="panel p-5 hover:border-accent-300 transition group flex flex-col"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="kicker">{eyebrow}</div>
        <span className="text-2xs mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
          {ctaStatus}
        </span>
      </div>
      <div className="text-lg font-semibold mt-2 group-hover:text-accent-700">
        {title}
      </div>
      <p className="text-sm text-slate-600 mt-1.5 flex-1">{body}</p>
      <div className="text-sm text-accent-700 font-medium mt-3">
        Open&nbsp;→
      </div>
    </Link>
  );
}
