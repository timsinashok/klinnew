import { useEffect, useState } from "react";
import { fetchProtocol } from "../api";
import { Wordmark } from "../components/shell/Wordmark";
import { markProtocolUploaded } from "../lib/persistence";
import { DEMO_STUDY, setCurrentStudy, studyPath } from "../lib/studies";
import type { ProtocolResponse } from "../types";

type Stage = "idle" | "extracting" | "ready";

const PROGRESS_LINES = [
  "Reading section 1.0 — Study synopsis…",
  "Reading section 2.0 — Key eligibility…",
  "Reading section 3.0 — Tumor assessment schedule…",
  "Reading section 4.0 — Lesion rules…",
  "Reading section 5.0 — RECIST response rules…",
  "Reading section 6.0 — Safety laboratory assessments…",
  "Compiling deterministic checks…",
];

export function Onboarding() {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [statusLine, setStatusLine] = useState(PROGRESS_LINES[0]);
  const [protocol, setProtocol] = useState<ProtocolResponse | null>(null);
  const [filename, setFilename] = useState<string>("");

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
      else {
        fetchProtocol()
          .then((p) => {
            setProtocol(p);
            setStage("ready");
          })
          .catch(() => setStage("ready"));
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage]);

  const onFile = (file: File | null) => {
    if (!file) return;
    setFilename(file.name);
    setStage("extracting");
    setProgress(0);
  };

  const onContinue = () => {
    markProtocolUploaded();
    setCurrentStudy(DEMO_STUDY.id);
    window.location.assign(studyPath(DEMO_STUDY.id));
  };

  return (
    <div className="min-h-screen bg-[#fafaf8] flex flex-col">
      <header className="bg-white border-b border-stone-200 px-6 h-14 flex items-center">
        <a href="/" className="hover:opacity-80" title="Back to landing">
          <Wordmark />
        </a>
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-2xl">
          <div className="kicker mb-2">Set up your study</div>
          <h1 className="text-[28px] serif font-medium leading-tight mb-2">
            Upload the study protocol to begin
          </h1>
          <p className="text-sm text-slate-600 max-w-xl mb-6 leading-snug">
            Klin reads the protocol PDF and derives the deterministic checks
            we'll run against every visit. For this demo we ship a synthetic
            protocol — drop any file to simulate the upload.
          </p>

          {stage === "idle" && <DropZone onFile={onFile} />}
          {stage === "extracting" && (
            <Extracting
              filename={filename}
              progress={progress}
              statusLine={statusLine}
            />
          )}
          {stage === "ready" && protocol && (
            <ReadyPanel protocol={protocol} onContinue={onContinue} />
          )}
        </div>
      </main>
      <footer className="text-center text-2xs text-slate-400 py-4">
        Synthetic data only · KLIN-ONC-DEMO-001
      </footer>
    </div>
  );
}

function DropZone({ onFile }: { onFile: (f: File | null) => void }) {
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
        const f = e.dataTransfer?.files?.[0] || null;
        onFile(f);
      }}
      className={`block panel p-10 text-center cursor-pointer transition border-2 ${
        drag
          ? "border-accent-500 bg-accent-50"
          : "border-stone-300 border-dashed hover:border-accent-300 hover:bg-stone-50"
      }`}
      style={{ borderStyle: "dashed" }}
    >
      <div className="w-12 h-12 mx-auto mb-3 inline-flex items-center justify-center rounded-full bg-stone-100 text-slate-500">
        <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M12 4v12m0 0l-4-4m4 4l4-4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 18h16" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="text-sm font-medium text-slate-800">
        Drop a protocol PDF here, or click to select
      </div>
      <div className="text-2xs text-slate-500 mt-1">
        Any file works — we'll use the synthetic protocol bundled with the
        demo.
      </div>
      <input
        type="file"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
      <div className="text-2xs text-slate-400 mt-4">
        Or{" "}
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            // Synthesize a "click" by handing in a placeholder File.
            const fake = new File(["synthetic"], "KLIN-ONC-DEMO-001.pdf");
            onFile(fake);
          }}
          className="underline text-accent-700 hover:text-accent-800"
        >
          use the demo protocol
        </button>
      </div>
    </label>
  );
}

function Extracting({
  filename,
  progress,
  statusLine,
}: {
  filename: string;
  progress: number;
  statusLine: string;
}) {
  return (
    <div className="panel p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 inline-flex items-center justify-center rounded bg-accent-50 text-accent-700">
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="5" y="3" width="14" height="18" rx="2" />
            <path d="M9 9h6M9 13h6M9 17h4" strokeLinecap="round" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-medium">
            Extracting checks from <span className="mono">{filename}</span>
          </div>
          <div className="text-2xs text-slate-500">
            Reading sections · deriving rules · classifying severity
          </div>
        </div>
      </div>
      <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-600 transition-[width]"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className="mono text-2xs text-slate-500 mt-3">{statusLine}</div>
    </div>
  );
}

function ReadyPanel({
  protocol,
  onContinue,
}: {
  protocol: ProtocolResponse;
  onContinue: () => void;
}) {
  const byLayer = new Map<string, typeof protocol.all_checks>();
  for (const c of protocol.all_checks) {
    const k = c.layer || "Other";
    if (!byLayer.has(k)) byLayer.set(k, []);
    byLayer.get(k)!.push(c);
  }
  return (
    <div className="panel p-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xs font-semibold tracking-wider px-1.5 py-0.5 bg-emerald-600 text-white">
          Ready
        </span>
        <div className="text-sm">
          Extracted{" "}
          <span className="mono font-semibold">
            {protocol.all_checks.length}
          </span>{" "}
          checks across {byLayer.size} layers from{" "}
          {protocol.sections.length} protocol sections.
        </div>
      </div>
      <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
        {Array.from(byLayer.entries()).map(([layer, checks]) => (
          <div key={layer}>
            <div className="kicker mb-1.5">{layer}</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {checks.map((c) => (
                <div
                  key={c.check_id}
                  className="border border-stone-200 rounded px-2.5 py-1.5 text-2xs bg-white"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="mono font-semibold">{c.check_id}</span>
                    <span
                      className={`text-[10px] px-1 py-0 rounded border ${
                        c.severity_when_failed === "Critical"
                          ? "border-sev-critical-300 bg-sev-critical-50 text-sev-critical-700"
                          : c.severity_when_failed.startsWith("Warning")
                            ? "border-sev-warning-300 bg-sev-warning-50 text-sev-warning-700"
                            : c.severity_when_failed.startsWith("Suggested")
                              ? "border-sev-suggested-300 bg-sev-suggested-50 text-sev-suggested-700"
                              : "border-stone-300 bg-stone-100 text-slate-600"
                      }`}
                    >
                      {c.severity_when_failed}
                    </span>
                  </div>
                  <div className="text-slate-700 leading-snug">
                    {c.plain_english_rule}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-3">
        <button className="btn btn-primary" onClick={onContinue}>
          Continue to study
        </button>
        <span className="text-2xs text-slate-500">
          Five subjects are already enrolled with prior visit data; you'll
          land in their workspace.
        </span>
      </div>
    </div>
  );
}
