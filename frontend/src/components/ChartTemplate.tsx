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
import type { Finding } from "../types";

interface PrParams {
  baseline_sum: number;
  current_sum: number;
  pct_decrease: number;
  threshold: number;
  claimed_response: string;
  sums_by_visit: Record<string, number>;
  flagged_visit: string;
  baseline_visit: string;
}

const VISIT_ORDER = [
  "Baseline",
  "Week 8",
  "Week 16",
  "Week 24",
  "Week 32",
  "Week 40",
  "Week 48",
];

export function ChartTemplate({ finding }: { finding: Finding }) {
  const p = finding.template_params as unknown as PrParams;
  if (!p?.sums_by_visit) return null;

  const data = Object.entries(p.sums_by_visit)
    .map(([visit, sum]) => ({
      visit,
      sum,
      order: VISIT_ORDER.indexOf(visit),
      flagged: visit === p.flagged_visit,
    }))
    .sort((a, b) => a.order - b.order);

  const threshold = p.baseline_sum * (1 - p.threshold);

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 text-xs mb-2">
        <Stat
          label="Baseline sum"
          value={`${p.baseline_sum.toFixed(1)} mm`}
          sub={p.baseline_visit}
        />
        <Stat
          label={`Sum at ${p.flagged_visit}`}
          value={`${p.current_sum.toFixed(1)} mm`}
          highlight
        />
        <Stat
          label="Decrease vs baseline"
          value={`${(p.pct_decrease * 100).toFixed(1)}%`}
          sub={`≥${(p.threshold * 100).toFixed(0)}% required for PR`}
          highlight
        />
      </div>
      <div className="h-56 border rounded bg-white p-1">
        <ResponsiveContainer>
          <LineChart
            data={data}
            margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="visit" tick={{ fontSize: 11 }} />
            <YAxis
              tick={{ fontSize: 11 }}
              label={{
                value: "Sum (mm)",
                angle: -90,
                position: "insideLeft",
                style: { fontSize: 10, fill: "#666" },
              }}
            />
            <Tooltip />
            <ReferenceLine
              y={threshold}
              stroke="#f59e0b"
              strokeDasharray="4 4"
              label={{
                value: `PR threshold ${threshold.toFixed(1)} mm`,
                fontSize: 10,
                fill: "#b45309",
                position: "insideBottomRight",
              }}
            />
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
                  return <g key={`d-${index}`} />;
                const flagged = !!payload?.flagged;
                return (
                  <Dot
                    key={`d-${index}`}
                    cx={cx}
                    cy={cy}
                    r={flagged ? 5 : 3}
                    fill={flagged ? "#dc2626" : "#111"}
                    stroke={flagged ? "#7f1d1d" : "#111"}
                  />
                );
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
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
        highlight
          ? "border-red-300 bg-red-50"
          : "border-neutral-200 bg-white"
      }`}
    >
      <div className="text-neutral-500">{label}</div>
      <div
        className={`mono text-sm font-medium ${
          highlight ? "text-red-700" : "text-neutral-900"
        }`}
      >
        {value}
      </div>
      {sub && <div className="text-neutral-500 mt-0.5">{sub}</div>}
    </div>
  );
}
