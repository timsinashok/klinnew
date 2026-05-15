import { Link } from "react-router-dom";

export function Home() {
  return (
    <div className="min-h-screen bg-neutral-50 flex flex-col">
      <header className="border-b bg-white px-6 py-4">
        <div className="text-base font-semibold">Klin</div>
        <div className="text-xs text-neutral-500">
          Oncology Consistency Engine — v0
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto p-6 w-full">
        <h1 className="text-2xl font-semibold mb-2">Two ways to see it</h1>
        <p className="text-sm text-neutral-600 mb-8">
          The same engine, rendered two ways. Pick a demo.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <DemoCard
            to="/magic"
            kicker="Demo 1 · The magic demo"
            title="Catch inconsistencies inside the eCRF"
            blurb="The coordinator-facing view. Fill in a patient's visit, hit Run consistency check, and see inconsistencies flagged inline with one-click actions."
          />
          <DemoCard
            to="/pipeline"
            kicker="Demo 2 · Data in action"
            title="Walk through the pipeline, stage by stage"
            blurb="Ingest → Map → Normalize → Check → Translate. Follow one subject end-to-end and see lineage threading every stage."
          />
        </div>

        <div className="mt-10 text-xs text-neutral-500">
          API:{" "}
          <span className="mono">
            {import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000"}
          </span>
        </div>
      </main>
    </div>
  );
}

function DemoCard({
  to,
  kicker,
  title,
  blurb,
}: {
  to: string;
  kicker: string;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      to={to}
      className="block border rounded p-5 bg-white hover:border-neutral-900 transition"
    >
      <div className="text-[11px] uppercase tracking-wider text-neutral-500">
        {kicker}
      </div>
      <div className="text-lg font-medium mt-1">{title}</div>
      <p className="text-sm text-neutral-600 mt-2">{blurb}</p>
      <div className="text-sm font-medium mt-4">Open →</div>
    </Link>
  );
}
