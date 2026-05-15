/**
 * Client-side persistence (localStorage). Survives reload only.
 * Namespace `klin.v0.<subjectId>`.
 */

const NS = "klin.v0";

export interface Persisted {
  edits: Record<string, string>; // key `${visit}|${field}` -> value
  acknowledged: string[];
  resolved: string[];
  lastRunAt?: string;
}

const EMPTY: Persisted = {
  edits: {},
  acknowledged: [],
  resolved: [],
};

function key(subjectId: string): string {
  return `${NS}.${subjectId}`;
}

export function loadSubject(subjectId: string): Persisted {
  if (typeof localStorage === "undefined") return { ...EMPTY };
  try {
    const raw = localStorage.getItem(key(subjectId));
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      edits: parsed.edits ?? {},
      acknowledged: parsed.acknowledged ?? [],
      resolved: parsed.resolved ?? [],
      lastRunAt: parsed.lastRunAt,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveSubject(subjectId: string, data: Persisted): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key(subjectId), JSON.stringify(data));
  } catch {
    // quota / disabled storage — silently skip
  }
}

export function clearSubject(subjectId: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(key(subjectId));
}

export function editKey(visit: string | null | undefined, field: string): string {
  return `${visit || ""}|${field}`;
}
