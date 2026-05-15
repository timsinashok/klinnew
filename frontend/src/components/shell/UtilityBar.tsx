interface Props {
  llmOn: boolean;
}

export function UtilityBar({ llmOn }: Props) {
  return (
    <header className="h-11 border-b border-slate-200 bg-white flex items-center px-4 gap-3 shrink-0">
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-sm bg-accent-600" />
        <span className="font-semibold tracking-tight text-[15px]">Klin</span>
      </div>
      <Sep />
      <Pill label="Study">KLIN-ONC-DEMO-001</Pill>
      <Pill label="Subject">SUBJ001</Pill>
      <div className="ml-auto flex items-center gap-3 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              llmOn ? "bg-emerald-500" : "bg-slate-400"
            }`}
            title={llmOn ? "LLM translation on" : "LLM translation off"}
          />
          <span>LLM&nbsp;{llmOn ? "on" : "off"}</span>
        </span>
        <Sep />
        <span className="mono">v0 · dev</span>
      </div>
    </header>
  );
}

function Sep() {
  return <span className="w-px h-4 bg-slate-200" />;
}

function Pill({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center text-xs gap-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="mono text-slate-900 px-1.5 py-0.5 bg-slate-100 rounded">
        {children}
      </span>
    </div>
  );
}
