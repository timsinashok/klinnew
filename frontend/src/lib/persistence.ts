/**
 * Client-side persistence (localStorage). Survives reload only.
 * Namespace `klin.v0.<studyId>.<subjectId>`.
 *
 * Keys are scoped by the currently-active study (read from
 * `klin.v0.current_study`) so multiple demo studies have independent
 * submissions, ingests, and edits — switching study via URL or the studies
 * dashboard gives you a clean state to demo from.
 */

const NS = "klin.v0";
const CURRENT_STUDY_KEY = `${NS}.current_study`;
const DEFAULT_STUDY_ID = "KLIN-ONC-DEMO-001";

function currentStudy(): string {
  if (typeof localStorage === "undefined") return DEFAULT_STUDY_ID;
  return localStorage.getItem(CURRENT_STUDY_KEY) || DEFAULT_STUDY_ID;
}

function studyPrefix(): string {
  return `${NS}.${currentStudy()}`;
}

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
  return `${studyPrefix()}.${subjectId}`;
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

function submitKey(subjectId: string): string {
  return `${studyPrefix()}.submitted.${subjectId}`;
}

export function loadSubmissions(subjectId: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(submitKey(subjectId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveSubmissions(subjectId: string, visits: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(submitKey(subjectId), JSON.stringify(visits));
  } catch {
    /* quota / disabled */
  }
}

export function clearSubmissions(subjectId: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(submitKey(subjectId));
}

// --- ingested visits (source documents processed) -------------------------

function ingestKey(subjectId: string): string {
  return `${studyPrefix()}.ingested.${subjectId}`;
}

export function loadIngested(subjectId: string): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(ingestKey(subjectId));
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function saveIngested(subjectId: string, visits: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(ingestKey(subjectId), JSON.stringify(visits));
  } catch {
    /* quota */
  }
}

// --- protocol upload gate -------------------------------------------------

function protocolKey(): string {
  return `${studyPrefix()}.protocol_uploaded`;
}

export function isProtocolUploaded(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(protocolKey()) === "true";
}

export function markProtocolUploaded(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(protocolKey(), "true");
}

// --- demo seeding ---------------------------------------------------------

/** Mark the visits prior to a subject's "demo visit" as already submitted
 *  and ingested. Idempotent. */
export function seedPriorVisits(
  subjectId: string,
  priorVisits: string[],
): void {
  const submitted = loadSubmissions(subjectId);
  const ingested = loadIngested(subjectId);
  const submittedSet = new Set([...submitted, ...priorVisits]);
  const ingestedSet = new Set([...ingested, ...priorVisits]);
  saveSubmissions(subjectId, Array.from(submittedSet));
  saveIngested(subjectId, Array.from(ingestedSet));
}

/** Wipe state for a specific study by id (defaults to currently-active
 *  study). The Reset button on the studies dashboard and on a workspace
 *  both call this. */
export function clearStudyState(studyId?: string): void {
  if (typeof localStorage === "undefined") return;
  const id = studyId || currentStudy();
  const prefix = `${NS}.${id}.`;
  const keys: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(prefix)) keys.push(k);
  }
  for (const k of keys) localStorage.removeItem(k);
}

/** Backwards-compatible alias. */
export function clearAllDemoState(): void {
  clearStudyState();
}
