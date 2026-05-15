import {
  CartesianGrid,
  Dot,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Finding } from "../../types";
import { EvidenceTables } from "./EvidenceTables";

type Params = {
  baseline_sum?: number;
  nadir_sum?: number;
  current_sum: number;
  pct_decrease?: number;
  pct_increase?: number;
  abs_increase?: number;
  threshold?: number;
  pct_threshold?: number;
  abs_threshold?: number;
  claimed_response: "PR" | "PD";
  sums_by_visit: Record<string, number>;
  flagged_visit: string;
  baseline_visit?: string;
  nadir_visit?: string;
};

export function ResponseThresholdTemplate({ finding }: { finding: Finding }) {
  const p = finding.template_params as Params;
  const isPR = p.claimed_response === "PR";

  const data = Object.entries(p.sums_by_visit).map(([visit, sum]) => ({
    visit,
    sum,
    flagged: visit === p.flagged_visit,
  }));

  const baseline = p.baseline_sum;
  const nadir = p.nadir_sum;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 text-sm">
        <Stat
          label={isPR ? "Baseline sum" : "Nadir sum"}
          value={`${(isPR ? baseline : nadir)?.toFixed(0)} mm`}
          sub={isPR ? p.baseline_visit : p.nadir_visit}
        />
        <Stat
          label={`Sum at ${p.flagged_visit}`}
          value={`${p.current_sum.toFixed(0)} mm`}
          highlight
        />
        <Stat
          label={isPR ? "Decrease vs baseline" : "Increase vs nadir"}
          value={
            isPR
              ? `${((p.pct_decrease ?? 0) * 100).toFixed(1)}%`
              : `${((p.pct_increase ?? 0) * 100).toFixed(1)}% / ${(p.abs_increase ?? 0).toFixed(1)} mm`
          }
          sub={
            isPR
              ? `≥${((p.threshold ?? 0.3) * 100).toFixed(0)}% required for PR`
              : `≥${((p.pct_threshold ?? 0.2) * 100).toFixed(0)}% AND ≥${p.abs_threshold ?? 5}mm required for PD`
          }
          highlight
        />
      </div>

      <div className="h-64 border rounded p-2 bg-white">
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="visit" tick={{ fontSize: 12 }} />
            <YAxis
              tick={{ fontSize: 12 }}
              label={{
                value: "Sum of diameters (mm)",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 11, fill: "#666" },
              }}
            />
            <Tooltip />
            {isPR && baseline !== undefined && (
              <ReferenceLine
                y={baseline * (1 - (p.threshold ?? 0.3))}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{
                  value: `PR threshold (${(baseline * (1 - (p.threshold ?? 0.3))).toFixed(0)}mm)`,
                  fontSize: 10,
                  fill: "#b45309",
                  position: "insideBottomRight",
                }}
              />
            )}
            {!isPR && nadir !== undefined && (
              <>
                <ReferenceLine
                  y={nadir * (1 + (p.pct_threshold ?? 0.2))}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: `PD %-threshold (${(nadir * (1 + (p.pct_threshold ?? 0.2))).toFixed(0)}mm)`,
                    fontSize: 10,
                    fill: "#b45309",
                    position: "insideTopRight",
                  }}
                />
                <ReferenceLine
                  y={nadir + (p.abs_threshold ?? 5)}
                  stroke="#fb923c"
                  strokeDasharray="2 4"
                  label={{
                    value: `PD abs-threshold (${(nadir + (p.abs_threshold ?? 5)).toFixed(0)}mm)`,
                    fontSize: 10,
                    fill: "#9a3412",
                    position: "insideTopLeft",
                  }}
                />
              </>
            )}
            <Line
              type="monotone"
              dataKey="sum"
              stroke="#111"
              strokeWidth={2}
              dot={(props: {
                cx?: number;
                cy?: number;
                payload?: { flagged?: boolean };
                index?: number;
              }) => {
                const { cx, cy, payload, index } = props;
                if (cx === undefined || cy === undefined)
                  return <g key={`dot-${index}`} />;
                const flagged = !!payload?.flagged;
                return (
                  <Dot
                    key={`dot-${index}`}
                    cx={cx}
                    cy={cy}
                    r={flagged ? 6 : 4}
                    fill={flagged ? "#dc2626" : "#111"}
                    stroke={flagged ? "#7f1d1d" : "#111"}
                  />
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <EvidenceTables finding={finding} />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`border rounded p-2 ${
        highlight ? "border-red-300 bg-red-50" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="text-xs text-neutral-500">{label}</div>
      <div
        className={`mono text-base font-medium ${
          highlight ? "text-red-700" : "text-neutral-900"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-xs text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}
