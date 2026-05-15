interface Props {
  rows: Record<string, unknown>[];
  title?: string;
  compact?: boolean;
  highlight?: (row: Record<string, unknown>, col: string) => boolean;
}

export function EvidenceTable({ rows, title, compact, highlight }: Props) {
  if (!rows || rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div>
      {title && (
        <div className="flex items-baseline gap-2 mb-1.5">
          <div className="text-2xs font-medium text-slate-600 uppercase tracking-wider">
            {title}
          </div>
          <div className="text-2xs text-slate-400 mono">
            {rows.length} {rows.length === 1 ? "row" : "rows"}
          </div>
        </div>
      )}
      <div className="border border-slate-200 rounded overflow-x-auto bg-white">
        <table className="mono text-2xs w-full">
          <thead className="bg-slate-50">
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className={`text-left ${
                    compact ? "px-1.5 py-0.5" : "px-2 py-1"
                  } border-b border-slate-200 font-medium text-slate-600 whitespace-nowrap`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-b border-slate-100 last:border-b-0"
              >
                {cols.map((c) => {
                  const hl = highlight?.(r, c);
                  return (
                    <td
                      key={c}
                      className={`${
                        compact ? "px-1.5 py-0.5" : "px-2 py-1"
                      } whitespace-nowrap text-slate-700 ${
                        hl
                          ? "bg-sev-critical-50 text-sev-critical-700 font-medium"
                          : ""
                      }`}
                    >
                      {r[c] === null || r[c] === undefined
                        ? ""
                        : String(r[c])}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
