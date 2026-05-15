import type { Finding } from "../../types";

export function EvidenceTables({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs uppercase tracking-wide text-neutral-500">
        Evidence
      </h3>
      {Object.entries(finding.evidence_rows).map(([domain, rows]) => (
        <EvidenceTable key={domain} domain={domain} rows={rows} />
      ))}
    </div>
  );
}

function EvidenceTable({
  domain,
  rows,
}: {
  domain: string;
  rows: Record<string, unknown>[];
}) {
  if (rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div>
      <div className="text-xs font-medium mb-1">
        {domain} · {rows.length} row(s)
      </div>
      <div className="overflow-x-auto border rounded">
        <table className="mono text-xs w-full">
          <thead className="bg-neutral-100">
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="text-left px-2 py-1 border-b font-medium"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="even:bg-neutral-50">
                {cols.map((c) => (
                  <td
                    key={c}
                    className="px-2 py-1 border-b border-neutral-100"
                  >
                    {r[c] === null || r[c] === undefined
                      ? ""
                      : String(r[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
