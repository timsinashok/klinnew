import { Link } from "react-router-dom";
import { DEMO_STUDY, getCurrentStudyId, getStudy } from "../../lib/studies";
import { Wordmark } from "./Wordmark";

interface Props {
  llmOn: boolean;
}

export function UtilityBar({ llmOn }: Props) {
  const sid = getCurrentStudyId() || DEMO_STUDY.id;
  const study = getStudy(sid) || DEMO_STUDY;
  return (
    <header className="h-12 border-b border-stone-200 bg-white flex items-center px-4 gap-3 shrink-0">
      <Link to="/" className="hover:opacity-80" title="Back to landing">
        <Wordmark />
      </Link>
      <Sep />
      <Link
        to="/studies"
        className="flex items-center text-xs gap-1.5 hover:text-accent-700 group"
        title="Switch study"
      >
        <span className="text-slate-500 group-hover:text-accent-700">
          Study
        </span>
        <span className="mono text-slate-900 group-hover:text-accent-800 px-1.5 py-0.5 bg-stone-100 rounded">
          {study.id}
        </span>
        <span className="text-slate-400 group-hover:text-accent-700 text-2xs">
          ▾
        </span>
      </Link>
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
