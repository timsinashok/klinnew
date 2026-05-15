import { useState } from "react";
import type { Finding } from "../types";
import { ChartTemplate } from "./ChartTemplate";
import { EvidenceTable } from "./EvidenceTable";
import { SeverityBadge } from "./SeverityBadge";

export function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const hasChart = finding.template_id === "RESPONSE_THRESHOLD";

  return (
    <div className="border rounded bg-white">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left p-3 flex flex-col gap-1 hover:bg-neutral-50"
      >
        <div className="flex items-center gap-2 text-xs">
          <SeverityBadge severity={finding.severity} />
          <span className="mono text-neutral-500">{finding.rule_id}</span>
          <span className="ml-auto mono text-neutral-400">
            {finding.translator_source || "—"}
          </span>
        </div>
        <div className="text-sm font-medium">
          <span className="mono">{finding.subject_id}</span>
          {finding.visit && (
            <span className="mono text-neutral-500"> · {finding.visit}</span>
          )}
        </div>
        <div className="text-sm text-neutral-700">{finding.user_message}</div>
      </button>

      {open && (
        <div className="border-t bg-neutral-50 p-3 space-y-4">
          <div className="text-xs">
            <span className="text-neutral-500">eCRF: </span>
            <span className="mono">
              {finding.lineage.form} / {finding.lineage.field}
            </span>
            <span className="text-neutral-500 ml-2">source: </span>
            <span className="mono">{finding.lineage.source_doc}</span>
          </div>

          {finding.suggested_actions.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">
                Suggested actions
              </div>
              <ul className="text-sm space-y-1 list-disc list-inside text-neutral-700">
                {finding.suggested_actions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {hasChart && <ChartTemplate finding={finding} />}

          {Object.entries(finding.evidence_rows).map(([domain, rows]) => (
            <EvidenceTable
              key={domain}
              title={domain}
              rows={rows}
            />
          ))}

          {finding.citation && (
            <div className="text-xs italic text-neutral-500">
              {finding.citation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
