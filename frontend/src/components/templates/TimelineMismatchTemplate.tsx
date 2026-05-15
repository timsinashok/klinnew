import type { Finding } from "../../types";
import { EvidenceTables } from "./EvidenceTables";

type Params = {
  claim: string;
  flagged_visit: string;
  per_visit?: { visit: string; response: string }[];
  claimed_bor?: string;
  ntrgresp?: string;
  non_target_present_ids?: string[];
  rs_newlpres?: string;
  tu_new_lesions?: string[];
};

const RESP_COLOR: Record<string, string> = {
  CR: "bg-emerald-100 border-emerald-300 text-emerald-800",
  PR: "bg-green-100 border-green-300 text-green-800",
  SD: "bg-neutral-100 border-neutral-300 text-neutral-800",
  PD: "bg-orange-100 border-orange-300 text-orange-800",
  NE: "bg-neutral-100 border-neutral-300 text-neutral-500",
};

export function TimelineMismatchTemplate({ finding }: { finding: Finding }) {
  const p = finding.template_params as Params;

  return (
    <div className="space-y-5">
      <div className="border rounded p-3 bg-red-50 border-red-300">
        <div className="text-xs text-neutral-500 uppercase tracking-wide">
          Disputed claim
        </div>
        <div className="text-sm mt-1">
          <span className="mono font-medium">{p.claim}</span>
          {p.claimed_bor && (
            <span className="ml-2 mono text-red-700">= {p.claimed_bor}</span>
          )}
          {p.rs_newlpres !== undefined && (
            <span className="ml-2 mono text-red-700">
              RS.NEWLPRES = {p.rs_newlpres}
            </span>
          )}
          {p.ntrgresp !== undefined && (
            <span className="ml-2 mono text-red-700">
              NTRGRESP = {p.ntrgresp}
            </span>
          )}
        </div>
        <div className="text-xs text-neutral-500 mt-1">
          at {p.flagged_visit} · {finding.usubjid}
        </div>
      </div>

      {p.per_visit && p.per_visit.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
            Per-visit Overall Response
          </div>
          <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
            {p.per_visit.map((v) => (
              <div
                key={v.visit}
                className={`flex-1 min-w-[80px] border rounded p-2 text-center ${
                  RESP_COLOR[v.response] ?? "bg-neutral-100"
                } ${v.visit === p.flagged_visit ? "ring-2 ring-red-500" : ""}`}
              >
                <div className="text-xs mono text-neutral-600">{v.visit}</div>
                <div className="mono text-base font-medium mt-0.5">
                  {v.response}
                </div>
              </div>
            ))}
            {p.claimed_bor && (
              <div className="flex-1 min-w-[80px] border-2 border-red-500 rounded p-2 text-center bg-red-50">
                <div className="text-xs mono text-neutral-600">BOR</div>
                <div className="mono text-base font-semibold text-red-700 mt-0.5">
                  {p.claimed_bor}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {p.tu_new_lesions && p.tu_new_lesions.length > 0 && (
        <div className="text-xs">
          <span className="text-neutral-500">TU NEW lesions at this visit:&nbsp;</span>
          <span className="mono text-red-700">
            {p.tu_new_lesions.join(", ")}
          </span>
        </div>
      )}
      {p.non_target_present_ids && p.non_target_present_ids.length > 0 && (
        <div className="text-xs">
          <span className="text-neutral-500">
            Non-targets still PRESENT:&nbsp;
          </span>
          <span className="mono text-red-700">
            {p.non_target_present_ids.join(", ")}
          </span>
        </div>
      )}

      <EvidenceTables finding={finding} />
    </div>
  );
}
