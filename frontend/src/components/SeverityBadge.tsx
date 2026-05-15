import type { Severity } from "../types";
import { SEV_BADGE_CLASS, SEV_LABEL_SHORT, SEV_LETTER } from "../ui/tokens";

/** Compact square (letter only) — for dense table flags. */
export function SeverityChip({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded text-2xs font-semibold border ${SEV_BADGE_CLASS[severity]}`}
      aria-label={severity}
      title={severity}
    >
      {SEV_LETTER[severity]}
    </span>
  );
}

/** Letter + short label — for card headers and sidebars. */
export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded border ${SEV_BADGE_CLASS[severity]}`}
    >
      <span className="w-3.5 h-3.5 rounded-sm border border-current/30 inline-flex items-center justify-center text-[10px] font-semibold">
        {SEV_LETTER[severity]}
      </span>
      <span className="uppercase tracking-wider">
        {SEV_LABEL_SHORT[severity]}
      </span>
    </span>
  );
}
