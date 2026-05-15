import type { Finding } from "../types";

const SEV_CLASS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-800 border-red-300",
  MEDIUM: "bg-amber-100 text-amber-800 border-amber-300",
  LOW: "bg-neutral-100 text-neutral-800 border-neutral-300",
};

export function FindingCard({
  finding,
  selected,
  onClick,
}: {
  finding: Finding;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left border rounded p-3 mb-2 hover:bg-neutral-100 transition ${
        selected ? "border-neutral-900 bg-white" : "border-neutral-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${
            SEV_CLASS[finding.severity]
          }`}
        >
          {finding.severity}
        </span>
        <span className="mono text-xs text-neutral-600">
          {finding.rule_id}
        </span>
      </div>
      <div className="text-sm font-medium">
        <span className="mono">{finding.usubjid}</span>
        {finding.visit && (
          <span className="mono text-neutral-500"> · {finding.visit}</span>
        )}
      </div>
      <div className="text-sm text-neutral-700 mt-1 line-clamp-2">
        {finding.message}
      </div>
    </button>
  );
}
