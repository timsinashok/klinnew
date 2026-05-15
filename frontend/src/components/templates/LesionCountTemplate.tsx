import type { Finding } from "../../types";
import { EvidenceTables } from "./EvidenceTables";

type Params = {
  count: number;
  limit: number;
  by_organ?: Record<string, number>;
  organ?: string;
  mode: "per_subject" | "per_organ";
  lesion_ids?: string[];
};

export function LesionCountTemplate({ finding }: { finding: Finding }) {
  const p = finding.template_params as Params;
  const isPerOrgan = p.mode === "per_organ";

  const bars: { label: string; count: number; limit: number }[] = isPerOrgan
    ? [{ label: p.organ ?? "?", count: p.count, limit: p.limit }]
    : Object.entries(p.by_organ ?? {}).map(([organ, count]) => ({
        label: organ,
        count,
        limit: p.limit,
      }));
  const maxWidth = Math.max(p.limit, ...bars.map((b) => b.count)) + 1;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="border rounded p-2 bg-red-50 border-red-300">
          <div className="text-xs text-neutral-500">
            {isPerOrgan ? `Targets in ${p.organ}` : "Total targets"}
          </div>
          <div className="mono text-base font-medium text-red-700">
            {p.count}
          </div>
        </div>
        <div className="border rounded p-2 bg-white">
          <div className="text-xs text-neutral-500">RECIST limit</div>
          <div className="mono text-base font-medium">{p.limit}</div>
        </div>
      </div>

      <div className="space-y-2">
        {bars.map((b) => (
          <div key={b.label}>
            <div className="flex justify-between text-xs mb-1">
              <span className="mono">{b.label}</span>
              <span
                className={`mono ${
                  b.count > b.limit ? "text-red-700 font-semibold" : "text-neutral-600"
                }`}
              >
                {b.count} / {b.limit}
              </span>
            </div>
            <div className="relative h-6 bg-neutral-100 rounded overflow-hidden">
              <div
                className={`h-full ${
                  b.count > b.limit ? "bg-red-500" : "bg-neutral-700"
                }`}
                style={{ width: `${(b.count / maxWidth) * 100}%` }}
              />
              <div
                className="absolute top-0 h-full border-r-2 border-amber-500"
                style={{ width: `${(b.limit / maxWidth) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {p.lesion_ids && p.lesion_ids.length > 0 && (
        <div className="text-xs">
          <span className="text-neutral-500">Offending lesions:&nbsp;</span>
          <span className="mono">{p.lesion_ids.join(", ")}</span>
        </div>
      )}

      <EvidenceTables finding={finding} />
    </div>
  );
}
