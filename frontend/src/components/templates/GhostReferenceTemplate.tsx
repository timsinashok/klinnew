import type { Finding } from "../../types";
import { EvidenceTables } from "./EvidenceTables";

type Params = {
  ghost_id: string;
  tu_ids: string[];
  tr_ids_at_visit: string[];
};

export function GhostReferenceTemplate({ finding }: { finding: Finding }) {
  const p = finding.template_params as Params;
  const tuSet = new Set(p.tu_ids);

  return (
    <div className="space-y-5">
      <div className="border rounded p-3 bg-red-50 border-red-300">
        <div className="text-xs text-neutral-500 uppercase tracking-wide">
          Orphan TR.TRLNKID
        </div>
        <div className="mono text-lg font-medium text-red-700">{p.ghost_id}</div>
        <div className="text-xs text-neutral-500 mt-1">
          referenced at {finding.visit} but not identified in TU for{" "}
          <span className="mono">{finding.usubjid}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Column title={`TU lesion IDs (${p.tu_ids.length})`}>
          {p.tu_ids.map((id) => (
            <li key={id} className="mono text-sm">
              {id}
            </li>
          ))}
        </Column>
        <Column title={`TR IDs at ${finding.visit} (${p.tr_ids_at_visit.length})`}>
          {p.tr_ids_at_visit.map((id) => {
            const orphan = !tuSet.has(id);
            return (
              <li
                key={id}
                className={`mono text-sm ${
                  orphan
                    ? "text-red-700 font-semibold bg-red-50 px-1 rounded"
                    : ""
                }`}
              >
                {id}
                {orphan && " ← no match"}
              </li>
            );
          })}
        </Column>
      </div>

      <EvidenceTables finding={finding} />
    </div>
  );
}

function Column({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded p-3 bg-white">
      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
        {title}
      </div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}
