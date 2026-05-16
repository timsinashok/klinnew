import type {
  DomainResponse,
  Finding,
  ProtocolResponse,
  RunResponse,
  SourceAnnotationFile,
  SourceDocument,
  SourcesResponse,
  Stats,
} from "./types";

const BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export function sourcePdfUrl(sourceId: string): string {
  return `${BASE}/api/sources/${encodeURIComponent(sourceId)}/pdf`;
}

export async function fetchSourceAnnotations(
  sourceId: string,
): Promise<SourceAnnotationFile> {
  const r = await fetch(
    `${BASE}/api/sources/${encodeURIComponent(sourceId)}/annotations`,
  );
  if (!r.ok) throw new Error(`annotations ${sourceId} failed: ${r.status}`);
  return await r.json();
}

export async function runEngine(
  enableLlm = true,
  model = "claude-haiku-4-5",
): Promise<RunResponse> {
  const url = `${BASE}/api/run?enable_llm=${enableLlm}&model=${encodeURIComponent(model)}`;
  const r = await fetch(url, { method: "POST" });
  if (!r.ok) throw new Error(`run failed: ${r.status}`);
  return await r.json();
}

export async function fetchStats(): Promise<Stats> {
  const r = await fetch(`${BASE}/api/stats`);
  if (!r.ok) throw new Error(`stats failed: ${r.status}`);
  return await r.json();
}

export async function fetchProtocol(): Promise<ProtocolResponse> {
  const r = await fetch(`${BASE}/api/protocol`);
  if (!r.ok) throw new Error(`protocol failed: ${r.status}`);
  return await r.json();
}

export async function fetchSources(): Promise<SourcesResponse> {
  const r = await fetch(`${BASE}/api/sources`);
  if (!r.ok) throw new Error(`sources failed: ${r.status}`);
  return await r.json();
}

export async function fetchSource(id: string): Promise<SourceDocument> {
  const r = await fetch(`${BASE}/api/sources/${encodeURIComponent(id)}`);
  if (!r.ok) throw new Error(`source ${id} failed: ${r.status}`);
  return await r.json();
}

export async function fetchDomain(name: string): Promise<DomainResponse> {
  const r = await fetch(`${BASE}/api/domain/${name}`);
  if (!r.ok) throw new Error(`domain ${name} failed: ${r.status}`);
  return await r.json();
}

export async function fetchCsv(name: string): Promise<string> {
  const r = await fetch(`${BASE}/api/data/${name}`);
  if (!r.ok) throw new Error(`data ${name} failed: ${r.status}`);
  return await r.text();
}

export async function translateFinding(
  finding: Partial<Finding>,
  enableLlm = true,
): Promise<Finding> {
  const url = `${BASE}/api/translate?enable_llm=${enableLlm}`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(finding),
  });
  if (!r.ok) throw new Error(`translate failed: ${r.status}`);
  return await r.json();
}

export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') inQ = false;
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}
