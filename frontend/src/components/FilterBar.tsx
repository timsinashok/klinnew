import type { Finding, Severity } from "../types";

export interface FilterState {
  severities: Set<Severity>;
  rule_id: string | null;
  usubjid: string | null;
}

export const ALL_SEVS: Severity[] = ["HIGH", "MEDIUM", "LOW"];

export function applyFilters(findings: Finding[], f: FilterState): Finding[] {
  return findings.filter((x) => {
    if (!f.severities.has(x.severity)) return false;
    if (f.rule_id && x.rule_id !== f.rule_id) return false;
    if (f.usubjid && x.usubjid !== f.usubjid) return false;
    return true;
  });
}

export function FilterBar({
  findings,
  state,
  setState,
}: {
  findings: Finding[];
  state: FilterState;
  setState: (s: FilterState) => void;
}) {
  const ruleIds = Array.from(new Set(findings.map((f) => f.rule_id))).sort();
  const subjects = Array.from(new Set(findings.map((f) => f.usubjid))).sort();

  const toggleSev = (s: Severity) => {
    const next = new Set(state.severities);
    if (next.has(s)) next.delete(s);
    else next.add(s);
    setState({ ...state, severities: next });
  };

  return (
    <div className="space-y-2 text-xs">
      <div>
        <div className="text-neutral-500 uppercase tracking-wide mb-1">
          Severity
        </div>
        <div className="flex gap-1">
          {ALL_SEVS.map((s) => {
            const on = state.severities.has(s);
            return (
              <button
                key={s}
                onClick={() => toggleSev(s)}
                className={`mono px-2 py-0.5 rounded border ${
                  on
                    ? s === "HIGH"
                      ? "bg-red-100 border-red-300 text-red-800"
                      : s === "MEDIUM"
                      ? "bg-amber-100 border-amber-300 text-amber-800"
                      : "bg-neutral-200 border-neutral-300 text-neutral-700"
                    : "bg-white border-neutral-200 text-neutral-400 line-through"
                }`}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label>
          <div className="text-neutral-500 uppercase tracking-wide mb-1">
            Rule
          </div>
          <select
            value={state.rule_id ?? ""}
            onChange={(e) =>
              setState({ ...state, rule_id: e.target.value || null })
            }
            className="mono w-full border rounded px-1 py-0.5 bg-white"
          >
            <option value="">all</option>
            {ruleIds.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label>
          <div className="text-neutral-500 uppercase tracking-wide mb-1">
            Subject
          </div>
          <select
            value={state.usubjid ?? ""}
            onChange={(e) =>
              setState({ ...state, usubjid: e.target.value || null })
            }
            className="mono w-full border rounded px-1 py-0.5 bg-white"
          >
            <option value="">all</option>
            {subjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
