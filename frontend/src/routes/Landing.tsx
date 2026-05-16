import { Link, useNavigate } from "react-router-dom";
import { Wordmark } from "../components/shell/Wordmark";
import { markVisitedApp } from "../lib/studies";

export function Landing() {
  const navigate = useNavigate();
  const onOpen = () => {
    markVisitedApp();
    navigate("/studies");
  };
  return (
    <div className="min-h-screen bg-[#fafaf8] text-slate-900 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-6 h-16 flex items-center">
        <Link to="/" className="hover:opacity-80">
          <Wordmark size="lg" />
        </Link>
        <nav className="ml-auto flex items-center gap-2 text-sm">
          <a
            href="#how-it-works"
            className="text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded"
          >
            How it works
          </a>
          <a
            href="#pipeline"
            className="text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded"
          >
            Pipeline
          </a>
          <button onClick={onOpen} className="btn btn-primary ml-2">
            Open app
          </button>
        </nav>
      </header>

      <main className="flex-1">
        <section className="max-w-5xl mx-auto px-6 pt-16 pb-12 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 items-center">
          <div>
            <div className="kicker mb-3">
              Built with pharma and CRO partners · private beta
            </div>
            <h1 className="serif font-medium leading-[1.04] text-[56px] tracking-tight">
              Six months of SAS programming, done before lunch.
            </h1>
            <p className="text-base text-slate-600 max-w-xl mt-6 leading-relaxed">
              Klin ingests your EDC export and produces CDISC-compliant SDTM,
              ADaM, and TFL deliverables — auditable, validated, and
              FDA-ready. Every finding traces back to the source line that
              produced it.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button onClick={onOpen} className="btn btn-primary h-10 px-5">
                Run a sample study →
              </button>
              <a
                href="#how-it-works"
                className="btn h-10 px-5"
              >
                Watch 90s demo
              </a>
            </div>
            <div className="mt-10 flex items-center gap-10 text-sm">
              <Stat top="6 mo → 4 hr" bottom="study turnaround" />
              <Stat top="100%" bottom="CDISC compliant" />
              <Stat top="$0" bottom="SAS licenses needed" />
            </div>
          </div>
          <TerminalCard />
        </section>

        <section
          id="how-it-works"
          className="border-t border-stone-200 bg-white"
        >
          <div className="max-w-5xl mx-auto px-6 py-14">
            <div className="kicker mb-3">The problem</div>
            <h2 className="serif font-medium text-[36px] leading-tight tracking-tight max-w-2xl">
              Clinical data engineering hasn't changed since 1998.
            </h2>
            <p className="text-base text-slate-600 max-w-3xl mt-4 leading-relaxed">
              Every Phase II study still consumes 6+ months of SAS programming,
              custom mapping, and manual reconciliation. We replaced all of
              it with one pipeline.
            </p>
          </div>
        </section>

        <section
          id="pipeline"
          className="border-t border-stone-200"
        >
          <div className="max-w-5xl mx-auto px-6 py-14">
            <div className="kicker mb-3">The pipeline</div>
            <h2 className="serif font-medium text-[36px] leading-tight tracking-tight">
              Protocol → SDTM → findings, in six deterministic steps.
            </h2>
            <ol className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                ["Protocol upload", "Klin parses the PDF and derives checks."],
                ["Source documents", "Radiology, lab, pathology, MD notes."],
                ["eCRF fill", "Mapped fields land in eCRF-style forms."],
                ["SDTM standardize", "Controlled terminology applied."],
                ["Layered checks", "Cross-domain medical analysis runs."],
                ["Actionable UI", "Critical blocks · Warning queries · Suggested fixes."],
              ].map(([t, b], i) => (
                <li
                  key={t}
                  className="panel p-5"
                >
                  <div className="mono text-2xs text-slate-400">
                    Step {i + 1}
                  </div>
                  <div className="text-base font-semibold mt-1">{t}</div>
                  <div className="text-sm text-slate-600 mt-1 leading-snug">
                    {b}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex items-center gap-3">
              <button onClick={onOpen} className="btn btn-primary h-10 px-5">
                Open the demo study →
              </button>
              <Link
                to="/studies"
                className="text-sm text-slate-600 hover:text-slate-900"
              >
                Or browse studies
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 bg-white text-2xs text-slate-500 py-6 px-6 text-center">
        Synthetic data only · KLIN-ONC-DEMO-001 · klin AI
      </footer>
    </div>
  );
}

function Stat({ top, bottom }: { top: string; bottom: string }) {
  return (
    <div>
      <div className="serif font-medium text-[28px] leading-none">{top}</div>
      <div className="text-2xs text-slate-500 mt-1 uppercase tracking-wider">
        {bottom}
      </div>
    </div>
  );
}

function TerminalCard() {
  return (
    <div className="terminal text-2xs">
      <div className="flex items-center gap-2 mb-3 -mx-1">
        <span className="w-2 h-2 rounded-full bg-rose-400" />
        <span className="w-2 h-2 rounded-full bg-amber-400" />
        <span className="w-2 h-2 rounded-full bg-emerald-400" />
        <span className="ml-2 muted">study-ONCD-2451 · run.log</span>
        <span className="ml-auto bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded text-[10px]">
          live
        </span>
      </div>
      <div>
        <span className="prompt">$</span> klin run --study{" "}
        <span className="key">ONCD-2451</span>
      </div>
      <div className="muted">– ingesting EDC export (Medidata Rave)</div>
      <div>
        <span className="muted">– </span>1,247 subjects · 18,331 records
      </div>
      <div>
        <span className="ok">✓</span> SDTM mapping · 24 domains generated
        <span className="ok ml-2">+1.8s</span>
      </div>
      <div>
        <span className="ok">✓</span> ADaM derivations · ADSL · ADAE · ADLB ·
        ADVS{" "}
        <span className="ok ml-2">+2.4s</span>
      </div>
      <div>
        <span className="ok">✓</span> Pinnacle 21 validation · 0 errors · 3
        warnings <span className="ok ml-2">+0.4s</span>
      </div>
      <div>
        <span className="ok">✓</span> TFL output · 14 tables · 6 figures · 8
        listings <span className="ok ml-2">+2.1s</span>
      </div>
      <div className="mt-2">
        <span className="prompt">$</span> done in 3h 41s
      </div>
    </div>
  );
}
