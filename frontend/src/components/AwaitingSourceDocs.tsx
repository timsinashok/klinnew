import type { SourceDocument } from "../types";

export function AwaitingSourceDocs({
  subject,
  visit,
  docs,
  onUpload,
}: {
  subject: string;
  visit: string;
  docs: SourceDocument[];
  onUpload: () => void;
}) {
  return (
    <section>
      <div className="panel border-dashed border-2 border-stone-300 p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 inline-flex items-center justify-center rounded-full bg-accent-50 text-accent-700">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="5" y="3" width="14" height="18" rx="2" />
            <path d="M9 9h6M9 13h6M9 17h4" strokeLinecap="round" />
          </svg>
        </div>
        <div className="text-base font-semibold text-slate-900">
          Awaiting source documents for {visit}
        </div>
        <p className="text-sm text-slate-600 mt-1 max-w-xl mx-auto leading-snug">
          Drop the radiology report and central lab report for this visit.
          Klin extracts the clinical facts and pre-fills the eCRF, ready for
          your review before submission.
        </p>
        {docs.length > 0 && (
          <div className="mt-4 inline-flex flex-wrap gap-1.5 justify-center text-2xs">
            {docs.map((d) => (
              <span
                key={d.source_document_id}
                className="mono text-slate-600 bg-stone-100 rounded px-2 py-1"
              >
                {typeShort(d.document_type)} · {d.source_document_id}
              </span>
            ))}
          </div>
        )}
        <div className="mt-5">
          <button className="btn btn-primary" onClick={onUpload}>
            Upload source documents
          </button>
        </div>
        <div className="text-2xs text-slate-400 mt-3">
          {subject} · {visit}
        </div>
      </div>
    </section>
  );
}

function typeShort(t: string): string {
  if (t.startsWith("Rad")) return "RAD";
  if (t.startsWith("Central Lab")) return "LAB";
  if (t.startsWith("Path")) return "PATH";
  if (t.startsWith("Doctor")) return "MD";
  return t;
}
