/**
 * Hybrid client-side persistence: localStorage is the synchronous cache
 * the UI reads from, the API is the durable source of truth.
 *
 * - Reads return localStorage immediately so render stays sync.
 * - Writes update localStorage *and* fire a write-through PUT to the API.
 * - On app bootstrap, `hydrateStudyFromServer(studyId)` overwrites the
 *   localStorage cache with the API snapshot so other browsers see your
 *   submissions.
 *
 * Keys are scoped by the currently-active study (read from
 * `klin.v0.current_study`) so multiple demo studies have independent
 * state. If DATABASE_URL is unset on the backend, the PUTs 503 and the
 * frontend falls back to localStorage-only.
 */

const NS = "klin.v0";
const CURRENT_STUDY_KEY = `${NS}.current_study`;
const DEFAULT_STUDY_ID = "KLIN-ONC-DEMO-001";
const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

function currentStudy(): string {
  if (typeof localStorage === "undefined") return DEFAULT_STUDY_ID;
  return localStorage.getItem(CURRENT_STUDY_KEY) || DEFAULT_STUDY_ID;
}

function studyPrefix(): string {
  return `${NS}.${currentStudy()}`;
}

// Fire-and-forget PUT; failures are swallowed so the UI stays responsive
// even if the backend is offline or DATABASE_URL is unset.
function bgPut(path: string, body: unknown): void {
  fetch(`${API_BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}

function bgDelete(path: string): void {
  fetch(`${API_BASE}${path}`, { method: "DELETE" }).catch(() => {});
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
  // Write-through: flatten the edits dict into the API's `field/value`
  // shape (`field` here is `${visit}|${col}` so the backend can split it).
  bgPut(`/api/state/${currentStudy()}/${subjectId}/edits`, {
    edits: Object.entries(data.edits).map(([k, v]) => ({ field: k, value: v })),
  });
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
  bgPut(`/api/state/${currentStudy()}/${subjectId}/submissions`, { visits });
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
  bgPut(`/api/state/${currentStudy()}/${subjectId}/ingests`, { visits });
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
 *  both call this. Hits the server too so other browsers see the reset. */
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
  bgDelete(`/api/state/${id}`);
}

// ---------------------------------------------------------------------------
// Server hydration
// ---------------------------------------------------------------------------

interface ServerSubjectState {
  subject_id: string;
  submissions: string[];
  ingests: string[];
  edits: { visit: string; field: string; value: string }[];
  dispositions: {
    visit: string;
    finding_key: string;
    state: string;
    rationale: string;
  }[];
  demographics: Record<string, unknown> | null;
}

interface ServerStudyState {
  study_id: string;
  subjects: ServerSubjectState[];
}

/** Pulls the DB snapshot for a study and hydrates the localStorage cache.
 *  Call once on app load (per study). Safe to call when the API is
 *  offline — it just no-ops. */
export async function hydrateStudyFromServer(studyId: string): Promise<void> {
  try {
    const r = await fetch(`${API_BASE}/api/state/${studyId}`);
    if (!r.ok) return;
    const snapshot = (await r.json()) as ServerStudyState;
    const oldCurrent = localStorage.getItem(CURRENT_STUDY_KEY);
    localStorage.setItem(CURRENT_STUDY_KEY, studyId);
    try {
      for (const subj of snapshot.subjects) {
        if (subj.submissions.length > 0) {
          localStorage.setItem(
            submitKey(subj.subject_id),
            JSON.stringify(subj.submissions),
          );
        }
        if (subj.ingests.length > 0) {
          localStorage.setItem(
            ingestKey(subj.subject_id),
            JSON.stringify(subj.ingests),
          );
        }
        if (subj.edits.length > 0) {
          const flat: Record<string, string> = {};
          for (const e of subj.edits) flat[`${e.visit}|${e.field}`] = e.value;
          localStorage.setItem(
            key(subj.subject_id),
            JSON.stringify({
              ...EMPTY,
              edits: flat,
            }),
          );
        }
      }
    } finally {
      if (oldCurrent !== null) {
        localStorage.setItem(CURRENT_STUDY_KEY, oldCurrent);
      }
    }
  } catch {
    // offline / DB unconfigured — keep using localStorage only.
  }
}

/** Backwards-compatible alias. */
export function clearAllDemoState(): void {
  clearStudyState();
}
