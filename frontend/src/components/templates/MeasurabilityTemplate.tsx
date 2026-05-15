import type { Finding } from "../../types";
import { EvidenceTables } from "./EvidenceTables";

type Params = {
  actual: number | null;
  threshold: number | null;
  unit?: string;
  measure?: string;
  lesion_id?: string;
  violation?: string;
  visitnum?: number;
  baseline_visitnum?: number;
};

export function MeasurabilityTemplate({ finding }: { finding: Finding }) {
  const p = finding.template_params as Params;
  const hasNumeric = p.actual !== null && p.actual !== undefined;
  const hasThreshold = p.threshold !== null && p.threshold !== undefined;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="border rounded p-3 bg-red-50 border-red-300">
          <div className="text-xs text-neutral-500">
            {p.measure ? `Recorded ${p.measure}` : "Recorded value"}
          </div>
          <div className="mono text-2xl font-medium text-red-700">
            {hasNumeric ? `${p.actual}${p.unit ?? "mm"}` : "—"}
          </div>
          {p.lesion_id && (
            <div className="text-xs text-neutral-500 mt-1 mono">
              lesion {p.lesion_id}
            </div>
          )}
        </div>
        <div className="border rounded p-3 bg-white">
          <div className="text-xs text-neutral-500">
            {hasThreshold ? "RECIST threshold" : "Violation"}
          </div>
          <div className="mono text-2xl font-medium">
            {hasThreshold ? `≥ ${p.threshold}${p.unit ?? "mm"}` : "—"}
          </div>
          {p.violation && (
            <div className="text-xs text-neutral-700 mt-1">{p.violation}</div>
          )}
          {p.visitnum !== undefined && p.baseline_visitnum !== undefined && (
            <div className="text-xs text-neutral-500 mt-1 mono">
              VISITNUM {p.visitnum} ≤ baseline {p.baseline_visitnum}
            </div>
          )}
        </div>
      </div>

      <EvidenceTables finding={finding} />
    </div>
  );
}
