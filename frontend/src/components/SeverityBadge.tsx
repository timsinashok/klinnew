import type { Severity } from "../types";

const CLASS: Record<Severity, string> = {
  Critical: "bg-red-100 text-red-800 border-red-300",
  Warning: "bg-amber-100 text-amber-800 border-amber-300",
  "Suggested Change": "bg-blue-100 text-blue-800 border-blue-300",
};

const SHORT: Record<Severity, string> = {
  Critical: "CRITICAL",
  Warning: "WARNING",
  "Suggested Change": "SUGGESTED",
};

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded border ${CLASS[severity]}`}
    >
      {SHORT[severity]}
    </span>
  );
}
