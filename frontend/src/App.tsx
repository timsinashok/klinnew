import { useEffect, useMemo, useState } from "react";
import { fetchDemo } from "./api";
import { BenchmarkTab } from "./components/BenchmarkTab";
import { DrillDown } from "./components/DrillDown";
import { ALL_SEVS, applyFilters, FilterBar, type FilterState } from "./components/FilterBar";
import { FindingsList } from "./components/FindingsList";
import { UploadPage } from "./components/UploadPage";
import type { Finding, Severity } from "./types";

const SEV_RANK: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export default function App() {
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [demoMode, setDemoMode] = useState(true);
  const [tab, setTab] = useState<"findings" | "benchmark">("findings");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    severities: new Set(ALL_SEVS),
    rule_id: null,
    usubjid: null,
  });

  useEffect(() => {
    if (!demoMode) return;
    setLoading(true);
    fetchDemo()
      .then((f) => {
        setFindings(f);
        setSelected(f.length > 0 ? 0 : null);
        setErr(null);
      })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, [demoMode]);

  const visible = useMemo(() => {
    const v = applyFilters(findings, filters);
    return [...v].sort((a, b) => {
      const r = SEV_RANK[a.severity] - SEV_RANK[b.severity];
      if (r !== 0) return r;
      const s = a.usubjid.localeCompare(b.usubjid);
      if (s !== 0) return s;
      return a.rule_id.localeCompare(b.rule_id);
    });
  }, [findings, filters]);

  useEffect(() => {
    if (visible.length === 0) setSelected(null);
    else if (selected === null || selected >= visible.length) setSelected(0);
  }, [visible.length]);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white px-4 py-3 flex items-center gap-4">
        <h1 className="text-base font-semibold">
          SDTM Inconsistency Engine
        </h1>
        <span className="text-xs text-neutral-500 mono">v0</span>
        <nav className="flex gap-1 ml-4">
          {(["findings", "benchmark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`text-sm px-2.5 py-1 rounded ${
                tab === t
                  ? "bg-neutral-900 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {t === "findings" ? "Findings" : "Benchmark"}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={demoMode}
              onChange={(e) => setDemoMode(e.target.checked)}
            />
            <span>Demo mode</span>
          </label>
        </div>
      </header>

      {tab === "benchmark" ? (
        <main className="flex-1 overflow-y-auto bg-white">
          <BenchmarkTab />
        </main>
      ) : (
        <div className="flex-1 grid grid-cols-[420px_1fr] gap-0 min-h-0">
          <aside className="border-r p-3 overflow-y-auto bg-neutral-50 space-y-3">
            {!demoMode && (
              <div className="pb-3 border-b">
                <UploadPage
                  onFindings={(f) => {
                    setFindings(f);
                    setSelected(f.length > 0 ? 0 : null);
                  }}
                />
              </div>
            )}
            <FilterBar
              findings={findings}
              state={filters}
              setState={setFilters}
            />
            <div className="text-xs text-neutral-500 mono pt-1 border-t">
              {loading
                ? "loading…"
                : `${visible.length} of ${findings.length} finding(s)`}
            </div>
            {err && <div className="text-xs text-red-600">{err}</div>}
            <FindingsList
              findings={visible}
              selected={selected}
              onSelect={setSelected}
            />
          </aside>
          <main className="overflow-y-auto bg-white min-w-0">
            <DrillDown
              finding={
                selected !== null && visible[selected] ? visible[selected] : null
              }
            />
          </main>
        </div>
      )}
    </div>
  );
}
