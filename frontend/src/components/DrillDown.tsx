import type { Finding } from "../types";
import { renderTemplate } from "./templates";

export function DrillDown({ finding }: { finding: Finding | null }) {
  if (!finding) {
    return (
      <div className="text-sm text-neutral-500 italic p-6">
        Select a finding to see evidence.
      </div>
    );
  }
  return (
    <div className="p-4 space-y-4">
      <div>
        <div className="text-xs text-neutral-500 uppercase tracking-wide">
          {finding.rule_id} · {finding.severity}
        </div>
        <h2 className="text-lg font-medium mt-1">
          <span className="mono">{finding.usubjid}</span>
          {finding.visit && (
            <span className="mono text-neutral-500"> · {finding.visit}</span>
          )}
        </h2>
        <p className="text-sm text-neutral-700 mt-2">{finding.message}</p>
        <p className="text-xs text-neutral-500 italic mt-2">
          {finding.citation}
        </p>
      </div>
      {renderTemplate(finding)}
    </div>
  );
}
