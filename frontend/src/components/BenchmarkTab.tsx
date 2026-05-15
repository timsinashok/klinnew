import { useEffect, useState } from "react";
import { fetchBenchmarkDemo } from "../api";
import type { BenchmarkReport } from "../types";

export function BenchmarkTab() {
  const [report, setReport] = useState<BenchmarkReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchBenchmarkDemo()
      .then((d) => {
        setReport(d.report);
        setErr(null);
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-sm text-neutral-500">Loading…</div>;
  if (err) return <div className="p-6 text-sm text-red-600">{err}</div>;
  if (!report) return null;

  const recallPct = (report.recall * 100).toFixed(0);
  const precPct = (report.precision * 100).toFixed(0);
  const allGreen = report.recall === 1 && report.false_positives.length === 0;

  return (
    <div className="p-4 space-y-5 max-w-3xl">
      <div className="grid grid-cols-3 gap-3">
        <Stat
          label="Recall"
          value={`${recallPct}%`}
          sub={`${report.covered_count} / ${report.total_truth} truth errors`}
          good={report.recall === 1}
        />
        <Stat
          label="Precision"
          value={`${precPct}%`}
          sub={`${report.matched_findings} / ${report.total_findings} findings`}
          good={report.false_positives.length === 0}
        />
        <Stat
          label="Status"
          value={allGreen ? "All green" : "Issues"}
          sub={
            allGreen
              ? "demo dataset fully reconciled"
              : `${report.missing.length} missing · ${report.false_positives.length} false-positive`
          }
          good={allGreen}
        />
      </div>

      {report.missing.length > 0 && (
        <div className="border border-red-300 bg-red-50 rounded p-3 text-sm">
          <div className="font-medium text-red-800">Uncaught truth errors</div>
          <div className="mono text-xs text-red-700 mt-1">
            {report.missing.join(", ")}
          </div>
        </div>
      )}

      {report.false_positives.length > 0 && (
        <div className="border border-amber-300 bg-amber-50 rounded p-3 text-sm">
          <div className="font-medium text-amber-800">False positives</div>
          <ul className="mono text-xs text-amber-900 mt-1 space-y-0.5">
            {report.false_positives.map((fp, i) => (
              <li key={i}>
                {fp.rule_id} · {fp.usubjid}
                {fp.visit ? ` · ${fp.visit}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
          Per-error mapping
        </div>
        <div className="border rounded overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-neutral-100">
              <tr>
                <th className="text-left px-3 py-2 border-b">Error</th>
                <th className="text-left px-3 py-2 border-b">Caught by</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(report.per_error)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([err, rules]) => (
                  <tr key={err} className="even:bg-neutral-50">
                    <td className="px-3 py-1.5 mono border-b border-neutral-100">
                      {err}
                    </td>
                    <td
                      className={`px-3 py-1.5 mono border-b border-neutral-100 ${
                        rules.length === 0 ? "text-red-700" : ""
                      }`}
                    >
                      {rules.length === 0 ? "(missing)" : rules.join(", ")}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  good,
}: {
  label: string;
  value: string;
  sub: string;
  good: boolean;
}) {
  return (
    <div
      className={`border rounded p-3 ${
        good ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"
      }`}
    >
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={`mono text-2xl font-medium ${
          good ? "text-emerald-700" : "text-amber-800"
        }`}
      >
        {value}
      </div>
      <div className="text-xs text-neutral-600 mt-1">{sub}</div>
    </div>
  );
}
