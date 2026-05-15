import { useState } from "react";
import { uploadCsvs } from "../api";
import type { Finding } from "../types";

export function UploadPage({
  onFindings,
}: {
  onFindings: (f: Finding[]) => void;
}) {
  const [tu, setTu] = useState<File | null>(null);
  const [tr, setTr] = useState<File | null>(null);
  const [rs, setRs] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!tu || !tr || !rs) {
      setErr("Pick all three CSVs.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const f = await uploadCsvs(tu, tr, rs);
      onFindings(f);
    } catch (e) {
      setErr(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {[
        { label: "TU", val: tu, set: setTu },
        { label: "TR", val: tr, set: setTr },
        { label: "RS", val: rs, set: setRs },
      ].map(({ label, val, set }) => (
        <label key={label} className="block">
          <span className="text-xs font-medium block mb-1">
            {label} CSV
          </span>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => set(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
          {val && (
            <span className="mono text-xs text-neutral-500 ml-2">
              {val.name}
            </span>
          )}
        </label>
      ))}
      <button
        onClick={submit}
        disabled={busy}
        className="bg-neutral-900 text-white text-sm px-3 py-1.5 rounded hover:bg-neutral-700 disabled:opacity-50"
      >
        {busy ? "Running…" : "Run engine"}
      </button>
      {err && <div className="text-xs text-red-600">{err}</div>}
    </div>
  );
}
