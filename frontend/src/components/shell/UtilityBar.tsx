import { Wordmark } from "./Wordmark";

interface Props {
  llmOn: boolean;
}

export function UtilityBar({ llmOn }: Props) {
  return (
    <header className="h-12 border-b border-stone-200 bg-white flex items-center px-4 gap-3 shrink-0">
      <Wordmark />
      <Sep />
      <Pill label="Study">KLIN-ONC-DEMO-001</Pill>
      <Pill label="Site">042 · Memorial Cancer Center</Pill>
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
        <Pill label="Coord">A. Patel</Pill>
      </div>
    </header>
  );
}

function Sep() {
  return <span className="w-px h-4 bg-stone-200" />;
}

function Pill({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center text-xs gap-1.5">
      <span className="text-slate-500">{label}</span>
      <span className="mono text-slate-900 px-1.5 py-0.5 bg-stone-100 rounded">
        {children}
      </span>
    </div>
  );
}
