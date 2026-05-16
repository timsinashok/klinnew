import { Link, useNavigate } from "react-router-dom";
import { Wordmark } from "../components/shell/Wordmark";
import { markVisitedApp } from "../lib/studies";

export function Landing() {
  const navigate = useNavigate();
  const onOpen = () => {
    markVisitedApp();
    navigate("/platform");
  };
  return (
    <div className="min-h-screen bg-[#fafaf8] text-slate-900 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-6 h-16 flex items-center">
        <Link to="/" className="hover:opacity-80">
          <Wordmark size="lg" />
        </Link>
        <nav className="ml-auto flex items-center gap-2 text-sm">
          <a
            href="#insight"
            className="text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded"
          >
            The insight
          </a>
          <a
            href="#checks"
            className="text-slate-600 hover:text-slate-900 px-3 py-1.5 rounded"
          >
            What we check
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
              Catch the inconsistency before it enters the database.
            </h1>
            <p className="text-base text-slate-600 max-w-xl mt-6 leading-relaxed">
              Klin runs protocol, cross-domain, and medical-plausibility
              checks the moment a site coordinator fills in an eCRF —
              against this visit's data and the patient's history. The
              query gets resolved at the source, in plain language, not
              six weeks later in a data manager's queue.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button onClick={onOpen} className="btn btn-primary h-10 px-5">
                Open the demo →
              </button>
              <a
                href="#insight"
                className="btn h-10 px-5"
              >
                Read the insight
              </a>
            </div>
            <div className="mt-10 flex items-center gap-10 text-sm">
              <Stat top="≈90%" bottom="queries resolved at source" />
              <Stat top="3 layers" bottom="protocol · cross-domain · medical" />
              <Stat top="raw → ADaM" bottom="end-to-end pipeline" />
            </div>
          </div>
          <TerminalCard />
        </section>

        <section
          id="insight"
          className="border-t border-stone-200 bg-white"
        >
          <div className="max-w-5xl mx-auto px-6 py-14">
            <div className="kicker mb-3">The insight</div>
            <h2 className="serif font-medium text-[36px] leading-tight tracking-tight max-w-3xl">
              Fix the data when it's typed, not when a data manager finds it
              weeks later.
            </h2>
            <p className="text-base text-slate-600 max-w-3xl mt-5 leading-relaxed">
              Existing validators — Pinnacle 21, custom SAS programs — sit at
              the sponsor and only run after the EDC export. By then the
              visit is over, the imaging report is filed, and resolving a
              query takes days of back-and-forth between the data manager,
              the site coordinator, and the investigator.
            </p>
            <p className="text-base text-slate-600 max-w-3xl mt-4 leading-relaxed">
              We moved the checks to the moment of entry. When the site
              coordinator fills in the eCRF, Klin compares the new values
              against the protocol, the historical record across every
              domain, and basic medical plausibility — and either auto-fixes
              the suggestion or routes the query to the investigator while
              the patient is still in the clinic.
            </p>
            <p className="text-base text-slate-700 max-w-3xl mt-5 leading-relaxed font-medium">
              ~90% of the queries that would normally land in the data
              manager's queue are rectified before they ever leave the site.
            </p>
          </div>
        </section>

        <section
          id="checks"
          className="border-t border-stone-200"
        >
          <div className="max-w-5xl mx-auto px-6 py-14">
            <div className="kicker mb-3">What we check</div>
            <h2 className="serif font-medium text-[36px] leading-tight tracking-tight">
              Three layers, one engine, every visit.
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <CheckCard
                tag="Layer 1"
                title="Protocol checks"
                body="Klin parses the study protocol PDF and derives the deterministic eligibility, visit-window, and assessment rules. Every rule is auditable back to the section that produced it."
                example="ECOG ≤ 1 at screening · imaging method consistent with baseline"
              />
              <CheckCard
                tag="Layer 2"
                title="Cross-domain inconsistency"
                body="Each new value is checked against the patient's history across every domain we hold — TU, TR, RS, DM, LB. Ghost lesions, math that doesn't reconcile, term drift get caught."
                example="Target response = PR, but measurements show only 11% decrease"
              />
              <CheckCard
                tag="Layer 3"
                title="Medical plausibility"
                body="Domain-knowledge checks the engine can run before a human ever sees the form. Severity is tri-banded: Critical blocks submit, Warning queries the investigator, Suggested offers a one-click fix."
                example="Overall CR conflicts with a non-target lesion still recorded as present"
              />
            </div>
            <p className="text-sm text-slate-600 mt-8 max-w-3xl leading-relaxed">
              The findings are auditable artifacts — every one carries the
              rule id, the protocol citation, and the exact eCRF + source
              document lineage that produced it. The site sees plain
              English; the regulator sees the trace.
            </p>
          </div>
        </section>

        <section
          id="pipeline"
          className="border-t border-stone-200 bg-white"
        >
          <div className="max-w-5xl mx-auto px-6 py-14">
            <div className="kicker mb-3">The pipeline</div>
            <h2 className="serif font-medium text-[36px] leading-tight tracking-tight">
              Raw data → SDTM → ADaM, with the queries cleaned up in place.
            </h2>
            <ol className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {[
                ["Protocol upload", "Klin parses the PDF and derives the deterministic rule catalog."],
                ["Source documents", "Radiology, central lab, pathology, and clinic notes drop in side-by-side."],
                ["eCRF fill", "Extracted facts pre-populate the form; coordinator reviews and edits."],
                ["Run consistency check", "Protocol + cross-domain + medical plausibility, against current and historical data."],
                ["Resolve at source", "Critical blocks submit · Warning sends an investigator query · Suggested auto-fixes."],
                ["SDTM + ADaM out", "Clean data lands as CDISC-compliant deliverables — no post-hoc reconciliation."],
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
                to="/platform"
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

function CheckCard({
  tag,
  title,
  body,
  example,
}: {
  tag: string;
  title: string;
  body: string;
  example: string;
}) {
  return (
    <div className="panel p-5 flex flex-col h-full">
      <div className="mono text-2xs text-accent-700 font-semibold uppercase tracking-wider">
        {tag}
      </div>
      <div className="text-base font-semibold mt-1.5">{title}</div>
      <p className="text-sm text-slate-600 mt-2 leading-snug flex-1">
        {body}
      </p>
      <div className="mt-3 pt-3 border-t border-stone-100">
        <div className="kicker mb-1">Example</div>
        <div className="text-2xs text-slate-700 mono leading-snug">
          {example}
        </div>
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
        <span className="ml-2 muted">SUBJ001 · Week 16 · run.log</span>
        <span className="ml-auto bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded text-[10px]">
          live
        </span>
      </div>
      <div>
        <span className="prompt">$</span> klin check --visit{" "}
        <span className="key">"Week 16"</span>
      </div>
      <div className="muted">– loading SUBJ001 history (baseline, Week 8)</div>
      <div>
        <span className="muted">– </span>protocol rules: 12 · cross-domain: 4 ·
        medical: 3
      </div>
      <div>
        <span className="ok">✓</span> protocol layer · 12/12 pass
        <span className="ok ml-2">+0.4s</span>
      </div>
      <div>
        <span className="ok">✓</span> cross-domain layer · 3/4 pass
      </div>
      <div>
        <span className="bad">✗</span> TR-RS-001 · Target response = PR but
        target-sum decrease is 11% (need ≥30%)
      </div>
      <div>
        <span className="muted">→ </span>callout shown on Disease Response form
      </div>
      <div className="mt-2">
        <span className="prompt">$</span>{" "}
        <span className="muted"># coordinator updates response → re-runs → clean → submits</span>
      </div>
    </div>
  );
}
