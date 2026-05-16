import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchProtocol } from "../api";
import { Wordmark } from "../components/shell/Wordmark";
import {
  newStudyId,
  saveStudy,
  setCurrentStudy,
  type Study,
} from "../lib/studies";
import type { ProtocolResponse } from "../types";

type Stage = "form" | "extracting" | "ready";

const PROGRESS_LINES = [
  "Reading section 1.0 — Study synopsis…",
  "Reading section 2.0 — Key eligibility…",
  "Reading section 3.0 — Tumor assessment schedule…",
  "Reading section 4.0 — Lesion rules…",
  "Reading section 5.0 — RECIST response rules…",
  "Reading section 6.0 — Safety laboratory assessments…",
  "Compiling deterministic checks…",
];

export function CreateStudy() {
  const navigate = useNavigate();
  const [stage, setStage] = useState<Stage>("form");
  const [name, setName] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [criteria, setCriteria] = useState("RECIST 1.1");
  const [filename, setFilename] = useState("");
  const [progress, setProgress] = useState(0);
  const [statusLine, setStatusLine] = useState(PROGRESS_LINES[0]);
  const [protocol, setProtocol] = useState<ProtocolResponse | null>(null);
  const [studyId, setStudyId] = useState<string>("");

  useEffect(() => {
    if (stage !== "extracting") return;
    const start = performance.now();
    let raf = 0;
    const tick = () => {
      const elapsed = performance.now() - start;
      const pct = Math.min(1, elapsed / 1500);
      setProgress(pct);
      setStatusLine(
        PROGRESS_LINES[
          Math.min(
            PROGRESS_LINES.length - 1,
            Math.floor(pct * PROGRESS_LINES.length),
          )
        ],
      );
      if (pct < 1) raf = requestAnimationFrame(tick);
      else fetchProtocol().then((p) => {
        setProtocol(p);
        setStage("ready");
      }).catch(() => setStage("ready"));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  const onFile = (file: File | null) => {
    if (!file) return;
    setFilename(file.name);
    if (!name) {
      // Default study name from filename if user hasn't typed one.
      setName(file.name.replace(/\.pdf$/i, "").slice(0, 80));
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !filename) return;
    const id = newStudyId(name);
    setStudyId(id);
    setStage("extracting");
  };

  const finish = () => {
    const study: Study = {
      id: studyId,
      name: name.trim(),
      sponsor: sponsor.trim() || "Unspecified",
      criteria,
      protocol_name: filename,
      status: "setup",
      is_demo: false,
      subject_count: 0,
      source_doc_count: 0,
      created_at: new Date().toISOString(),
      owner: "demo",
    };
    saveStudy(study);
    setCurrentStudy(study.id);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#fafaf8] flex flex-col">
      <header className="bg-white border-b border-stone-200 px-6 h-14 flex items-center">
        <Wordmark />
        <span className="ml-3 text-2xs text-slate-500 mono">
          / Studies / New
        </span>
        <Link
          to="/studies"
          className="ml-auto text-sm text-slate-500 hover:text-slate-900"
        >
          ← Back to studies
        </Link>
      </header>

      <main className="flex-1 max-w-2xl mx-auto px-6 py-10 w-full">
        {stage === "form" && (
          <>
            <div className="kicker mb-2">Create study</div>
            <h1 className="serif text-[28px] font-medium leading-tight mb-2">
              Set up a new study
            </h1>
            <p className="text-sm text-slate-600 mb-6 max-w-xl">
              Name the study and upload your protocol PDF. Klin parses it and
              derives the deterministic checks before you enroll any subject.
            </p>
            <form className="panel p-6 space-y-5" onSubmit={onSubmit}>
              <Field
                label="Study name"
                value={name}
                onChange={setName}
                placeholder="e.g. PEMBRO-002 Phase II NSCLC"
                required
              />
              <Field
                label="Sponsor"
                value={sponsor}
                onChange={setSponsor}
                placeholder="Sponsor or CRO name"
              />
              <div>
                <label className="block">
                  <div className="kicker mb-1">Assessment criteria</div>
                  <select
                    value={criteria}
                    onChange={(e) => setCriteria(e.target.value)}
                    className="field w-full h-9 text-sm"
                  >
                    {["RECIST 1.1", "iRECIST", "Cheson 2014", "Other"].map(
                      (c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              </div>
              <div>
                <div className="kicker mb-1.5">Protocol PDF</div>
                <DropField filename={filename} onFile={onFile} />
              </div>
              <div className="flex items-center gap-3 pt-3 border-t border-stone-100">
                <Link
                  to="/studies"
                  className="text-2xs text-slate-500 hover:text-slate-900"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  className="btn btn-primary ml-auto"
                  disabled={!name.trim() || !filename}
                >
                  Create study & extract checks
                </button>
              </div>
            </form>
          </>
        )}

        {stage === "extracting" && (
          <div className="panel p-6">
            <div className="kicker mb-2">Setting up study</div>
            <h2 className="text-base font-semibold mb-3">
              Extracting checks from{" "}
              <span className="mono">{filename}</span>
            </h2>
            <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-600 transition-[width]"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
            <div className="mono text-2xs text-slate-500 mt-3 min-h-[1rem]">
              {statusLine}
            </div>
          </div>
        )}

        {stage === "ready" && (
          <div className="panel p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xs font-semibold tracking-wider px-1.5 py-0.5 bg-emerald-600 text-white">
                Ready
              </span>
              <div className="text-sm">
                <span className="font-semibold">{name.trim()}</span> created ·{" "}
                <span className="mono">{studyId}</span> ·{" "}
                <span className="mono">
                  {protocol?.all_checks.length ?? 0}
                </span>{" "}
                checks derived from {filename}.
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-4 leading-snug">
              No subjects are enrolled yet. You'll add them as the study
              opens. Klin will run the checks automatically against every
              new visit.
            </p>
            <button className="btn btn-primary" onClick={finish}>
              Enter study →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div className="kicker mb-1">
        {label}
        {required && <span className="text-sev-critical-600 ml-1">*</span>}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="field w-full h-9 text-sm font-sans"
      />
    </label>
  );
}

function DropField({
  filename,
  onFile,
}: {
  filename: string;
  onFile: (f: File | null) => void;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        onFile(e.dataTransfer?.files?.[0] || null);
      }}
      className={`block border-2 border-dashed rounded p-5 text-center cursor-pointer transition ${
        drag
          ? "border-accent-500 bg-accent-50"
          : filename
            ? "border-emerald-300 bg-emerald-50/50"
            : "border-stone-300 hover:border-accent-300 hover:bg-stone-50"
      }`}
    >
      {filename ? (
        <div className="text-sm text-emerald-800 mono">📄 {filename}</div>
      ) : (
        <div className="text-sm text-slate-700">
          Drop a protocol PDF here, or click to select
        </div>
      )}
      <div className="text-2xs text-slate-500 mt-1">
        Any file works for the demo —{" "}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            onFile(new File(["synthetic"], "study_protocol.pdf"));
          }}
          className="underline text-accent-700 hover:text-accent-800"
        >
          use a sample protocol
        </button>
      </div>
      <input
        type="file"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
    </label>
  );
}
