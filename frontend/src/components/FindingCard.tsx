import { useState } from "react";
import type { Finding } from "../types";
import { SEV_STRIPE_CLASS } from "../ui/tokens";
import { ChartTemplate } from "./ChartTemplate";
import { EvidenceTable } from "./EvidenceTable";
import { SeverityBadge } from "./SeverityBadge";

export function FindingCard({ finding }: { finding: Finding }) {
  const [open, setOpen] = useState(false);
  const hasChart = finding.template_id === "RESPONSE_THRESHOLD";

  return (
    <div className="panel overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left flex items-stretch hover:bg-slate-50"
      >
        <div
          className={`w-1 shrink-0 ${SEV_STRIPE_CLASS[finding.severity]}`}
        />
        <div className="flex-1 p-3.5">
          <div className="flex items-center gap-2 mb-1">
            <SeverityBadge severity={finding.severity} />
            <span className="mono text-2xs text-slate-500">
              {finding.rule_id}
            </span>
            <span className="ml-auto text-2xs mono text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
              {finding.translator_source === "llm"
                ? "ai"
                : finding.translator_source === "template"
                  ? "fallback"
                  : "—"}
            </span>
          </div>
          <div className="text-sm">
            <span className="mono font-medium">{finding.subject_id}</span>
            {finding.visit && (
              <span className="mono text-slate-500"> · {finding.visit}</span>
            )}
          </div>
          <div className="text-sm text-slate-700 mt-1 leading-snug">
            {finding.user_message}
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-200 bg-slate-50 p-4 space-y-4">
          <div className="text-2xs text-slate-500">
            <span className="kicker">eCRF</span>{" "}
            <span className="mono text-slate-700">
              {finding.lineage.form}
            </span>{" "}
            /{" "}
            <span className="mono text-slate-700">
              {finding.lineage.field}
            </span>{" "}
            ·{" "}
            <span className="mono text-slate-500">
              {finding.lineage.source_doc}
            </span>
          </div>

          {finding.suggested_actions.length > 0 && (
            <div>
              <div className="kicker mb-1.5">Suggested actions</div>
              <ul className="text-sm space-y-1 list-disc list-inside text-slate-700">
                {finding.suggested_actions.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          {hasChart && <ChartTemplate finding={finding} />}

          {Object.entries(finding.evidence_rows).map(([d, rows]) => (
            <EvidenceTable key={d} title={d} rows={rows} compact />
          ))}

          {finding.citation && (
            <div className="text-2xs italic text-slate-500 border-t border-slate-200 pt-2">
              {finding.citation}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
