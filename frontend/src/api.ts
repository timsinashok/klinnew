import type { BenchmarkReport, Finding } from "./types";

const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8011";

export async function fetchDemo(): Promise<Finding[]> {
  const r = await fetch(`${BASE}/demo`);
  if (!r.ok) throw new Error(`demo failed: ${r.status}`);
  return (await r.json()).findings;
}

export async function fetchBenchmarkDemo(): Promise<{
  findings: Finding[];
  report: BenchmarkReport;
}> {
  const r = await fetch(`${BASE}/benchmark/demo`);
  if (!r.ok) throw new Error(`benchmark/demo failed: ${r.status}`);
  return await r.json();
}

export async function uploadCsvs(
  tu: File,
  tr: File,
  rs: File
): Promise<Finding[]> {
  const fd = new FormData();
  fd.append("tu", tu);
  fd.append("tr", tr);
  fd.append("rs", rs);
  const r = await fetch(`${BASE}/run`, { method: "POST", body: fd });
  if (!r.ok) throw new Error(`run failed: ${r.status}`);
  return (await r.json()).findings;
}
