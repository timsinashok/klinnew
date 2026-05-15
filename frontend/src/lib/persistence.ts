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

// --- visit submission tracking --------------------------------------------

const SUBMIT_KEY_PREFIX = "klin.v0.submitted.";

export function loadSubmissions(subjectId: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(SUBMIT_KEY_PREFIX + subjectId);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveSubmissions(subjectId: string, visits: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      SUBMIT_KEY_PREFIX + subjectId,
      JSON.stringify(visits),
    );
  } catch {
    /* quota / disabled */
  }
}

export function clearSubmissions(subjectId: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(SUBMIT_KEY_PREFIX + subjectId);
}
