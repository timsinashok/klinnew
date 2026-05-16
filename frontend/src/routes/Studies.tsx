import { useState } from "react";
import { Link } from "react-router-dom";
import { Wordmark } from "../components/shell/Wordmark";
import {
  deleteStudy,
  listStudies,
  setCurrentStudy,
  type Study,
} from "../lib/studies";

export function Studies() {
  const [studies, setStudies] = useState<Study[]>(() => listStudies());

  const open = (s: Study) => {
    setCurrentStudy(s.id);
    window.location.assign("/platform");
  };

  const remove = (s: Study) => {
    if (!window.confirm(`Delete ${s.name}? This can't be undone.`)) return;
    deleteStudy(s.id);
    setStudies(listStudies());
  };

  return (
    <div className="min-h-screen bg-[#fafaf8]">
      <header className="bg-white border-b border-stone-200 px-6 h-14 flex items-center">
        <Link to="/" className="hover:opacity-80" title="Back to landing">
          <Wordmark />
        </Link>
        <span className="ml-3 text-2xs text-slate-500 mono">/ Studies</span>
        <Link
          to="/welcome"
          className="ml-auto text-sm text-slate-500 hover:text-slate-900"
        >
          About
        </Link>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <div className="flex items-end justify-between gap-6 mb-8">
          <div>
            <div className="kicker mb-1">Workspace</div>
            <h1 className="serif text-[32px] font-medium leading-tight">
              Your studies
            </h1>
            <p className="text-sm text-slate-600 mt-1.5 max-w-2xl">
              Open the demo study to see the engine in action, or create a
              new study from a protocol PDF.
            </p>
          </div>
          <Link to="/studies/new" className="btn btn-primary">
            + Create study
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {studies.map((s) => (
            <StudyCard
              key={s.id}
              study={s}
              onOpen={() => open(s)}
              onRemove={() => remove(s)}
            />
          ))}
          <CreateTile />
        </div>
      </main>
    </div>
  );
}

function StudyCard({
  study,
  onOpen,
  onRemove,
}: {
  study: Study;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const statusClass =
    study.status === "active"
      ? "bg-emerald-50 text-emerald-700 border-emerald-300"
      : study.status === "setup"
        ? "bg-amber-50 text-amber-700 border-amber-300"
        : "bg-stone-100 text-slate-600 border-stone-300";
  return (
    <div className="panel p-5 flex flex-col">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {study.is_demo && (
            <div className="text-2xs uppercase tracking-wider text-accent-700 font-semibold mb-1">
              Demo study
            </div>
          )}
          <div className="text-base font-semibold leading-tight">
            {study.name}
          </div>
          <div className="mono text-2xs text-slate-500 mt-1 truncate">
            {study.id}
          </div>
        </div>
        <span
          className={`text-2xs px-1.5 py-0.5 rounded border ${statusClass} mono`}
        >
          {study.status}
        </span>
      </div>
      <div className="text-2xs text-slate-600 mt-3 space-y-0.5">
        <div>
          <span className="kicker mr-1.5">Sponsor</span>
          {study.sponsor}
        </div>
        <div>
          <span className="kicker mr-1.5">Criteria</span>
          {study.criteria}
        </div>
        <div>
          <span className="kicker mr-1.5">Protocol</span>
          <span className="mono">{study.protocol_name}</span>
        </div>
      </div>
      <div className="flex items-baseline gap-4 mt-4 text-2xs text-slate-500">
        <span>
          <span className="mono text-slate-900 font-medium">
            {study.subject_count}
          </span>{" "}
          subjects
        </span>
        <span>
          <span className="mono text-slate-900 font-medium">
            {study.source_doc_count}
          </span>{" "}
          source docs
        </span>
      </div>
      <div className="mt-5 flex items-center gap-2">
        <button className="btn btn-primary flex-1" onClick={onOpen}>
          Open study →
        </button>
        {!study.is_demo && (
          <button
            className="btn"
            onClick={onRemove}
            title="Delete study"
            aria-label="Delete study"
          >
            ⌫
          </button>
        )}
      </div>
    </div>
  );
}

function CreateTile() {
  return (
    <Link
      to="/studies/new"
      className="panel p-5 flex flex-col items-center justify-center text-center border-dashed border-2 border-stone-300 hover:border-accent-300 hover:bg-stone-50 transition"
    >
      <div className="w-10 h-10 rounded-full bg-accent-50 text-accent-700 inline-flex items-center justify-center mb-3">
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </div>
      <div className="text-base font-semibold">Create new study</div>
      <div className="text-2xs text-slate-500 mt-1.5 leading-snug max-w-[18ch]">
        Upload a protocol PDF · Klin derives the checks · subjects enroll over
        time.
      </div>
    </Link>
  );
}
