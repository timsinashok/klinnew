interface Props {
  rows: Record<string, unknown>[];
  title?: string;
  highlight?: (row: Record<string, unknown>, col: string) => boolean;
}

export function EvidenceTable({ rows, title, highlight }: Props) {
  if (!rows || rows.length === 0) return null;
  const cols = Object.keys(rows[0]);
  return (
    <div>
      {title && (
        <div className="text-xs font-medium text-neutral-700 mb-1">
          {title} · {rows.length} row(s)
        </div>
      )}
      <div className="overflow-x-auto border rounded">
        <table className="mono text-[11px] w-full">
          <thead className="bg-neutral-100">
            <tr>
              {cols.map((c) => (
                <th
                  key={c}
                  className="text-left px-2 py-1 border-b font-medium whitespace-nowrap"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="even:bg-neutral-50">
                {cols.map((c) => {
                  const hl = highlight?.(r, c);
                  return (
                    <td
                      key={c}
                      className={`px-2 py-1 border-b border-neutral-100 whitespace-nowrap ${
                        hl ? "bg-red-100 text-red-800 font-medium" : ""
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
