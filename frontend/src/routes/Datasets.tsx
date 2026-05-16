import JSZip from "jszip";
import { useEffect, useState } from "react";
import { fetchCsv, parseCsv } from "../api";

const SDTM_FILES = [
  { name: "dm.csv", label: "DM — Demographics" },
  { name: "tu.csv", label: "TU — Tumor Identification" },
  { name: "tr.csv", label: "TR — Tumor Results" },
  { name: "rs.csv", label: "RS — Disease Response" },
  { name: "lb.csv", label: "LB — Lab Values" },
];

const ECRF_FILES = [
  { name: "ecrf_dm.csv", label: "Demographics eCRF" },
  { name: "ecrf_baseline.csv", label: "Baseline tumor eCRF" },
  { name: "ecrf_followup.csv", label: "Follow-up tumor eCRF" },
  { name: "ecrf_disease_response.csv", label: "Disease response eCRF" },
  { name: "ecrf_lb.csv", label: "Lab values eCRF" },
];

type FileMeta = { name: string; label: string; rows?: number };

export function Datasets() {
  const [sdtm, setSdtm] = useState<FileMeta[]>(SDTM_FILES);
  const [ecrf, setEcrf] = useState<FileMeta[]>(ECRF_FILES);
  const [busy, setBusy] = useState<"sdtm" | "ecrf" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const probe = async (files: FileMeta[]): Promise<FileMeta[]> =>
      Promise.all(
        files.map(async (f) => {
          try {
            const text = await fetchCsv(f.name);
            return { ...f, rows: parseCsv(text).length };
          } catch {
            return { ...f, rows: -1 };
          }
        }),
      );
    probe(SDTM_FILES).then((r) => !cancelled && setSdtm(r));
    probe(ECRF_FILES).then((r) => !cancelled && setEcrf(r));
    return () => {
      cancelled = true;
    };
  }, []);

  const downloadBundle = async (
    kind: "sdtm" | "ecrf",
    files: FileMeta[],
    zipName: string,
  ) => {
    setBusy(kind);
    setErr(null);
    try {
      const zip = new JSZip();
      for (const f of files) {
        const text = await fetchCsv(f.name);
        zip.file(f.name, text);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(null);
    }
  };

  const sdtmRows = sdtm.reduce((a, f) => a + Math.max(0, f.rows ?? 0), 0);
  const ecrfRows = ecrf.reduce((a, f) => a + Math.max(0, f.rows ?? 0), 0);

  return (
    <div className="min-h-full bg-[#fafaf8]">
      <div className="border-b border-stone-200 bg-white">
        <div className="max-w-5xl mx-auto px-8 py-5">
          <div className="kicker mb-1">Deliverables</div>
          <h1 className="text-[24px] leading-tight serif font-medium">
            Datasets
          </h1>
          <div className="text-sm text-slate-600 mt-1 max-w-3xl">
            Everything the pipeline has produced so far for this study.
            Download the SDTM domains for sponsor handoff, or the eCRF rows
            for audit.
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-8 py-8 space-y-5">
        {err && (
          <div className="panel border-sev-critical-300 bg-sev-critical-50 text-sev-critical-800 text-sm p-3">
            {err}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <BundleCard
            badge="SDTM"
            title="SDTM bundle"
            description="CDISC SDTM domains — DM, TU, TR, RS, LB. Ready for sponsor handoff or Pinnacle 21 validation."
            files={sdtm}
            totalRows={sdtmRows}
            busy={busy === "sdtm"}
            onDownload={() =>
              downloadBundle("sdtm", sdtm, "klin-sdtm-bundle.zip")
            }
            buttonLabel="Download SDTM bundle (.zip)"
          />
          <BundleCard
            badge="eCRF"
            title="eCRF bundle"
            description="Coordinator-entered source forms — demographics, tumor baseline, follow-up, response, lab. The raw eCRF rows that produced the SDTM above."
            files={ecrf}
            totalRows={ecrfRows}
            busy={busy === "ecrf"}
            onDownload={() =>
              downloadBundle("ecrf", ecrf, "klin-ecrf-bundle.zip")
            }
            buttonLabel="Download eCRF bundle (.zip)"
          />
        </div>
      </div>
    </div>
  );
}

function BundleCard({
  badge,
  title,
  description,
  files,
  totalRows,
  busy,
  onDownload,
  buttonLabel,
}: {
  badge: string;
  title: string;
  description: string;
  files: FileMeta[];
  totalRows: number;
  busy: boolean;
  onDownload: () => void;
  buttonLabel: string;
}) {
  const probing = files.some((f) => f.rows === undefined);
  return (
    <div className="panel p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xs font-semibold tracking-wider px-1.5 py-0.5 rounded border border-accent-200 bg-accent-50 text-accent-700">
          {badge}
        </span>
        <span className="text-2xs text-slate-500 mono ml-auto">
          {files.length} files · {probing ? "…" : totalRows.toLocaleString()}{" "}
          rows
        </span>
      </div>
      <h2 className="text-lg font-semibold leading-tight">{title}</h2>
      <p className="text-sm text-slate-600 mt-1.5 leading-snug">
        {description}
      </p>
      <ul className="mt-4 space-y-1 text-2xs">
        {files.map((f) => (
          <li
            key={f.name}
            className="flex items-baseline justify-between gap-2 py-1 border-b border-stone-100 last:border-b-0"
          >
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="mono text-slate-600 truncate">{f.name}</span>
              <span className="text-slate-500 truncate">· {f.label}</span>
            </div>
            <span className="mono text-slate-400 shrink-0">
              {f.rows === undefined
                ? "…"
                : f.rows < 0
                  ? "—"
                  : `${f.rows.toLocaleString()} rows`}
            </span>
          </li>
        ))}
      </ul>
      <button
        className="btn btn-primary mt-5"
        onClick={onDownload}
        disabled={busy || probing}
      >
        {busy ? "Bundling…" : buttonLabel}
      </button>
    </div>
  );
}
