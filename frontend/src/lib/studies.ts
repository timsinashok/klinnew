/** Multi-study persistence (localStorage). Pre-DB shim.
 *  Schema lands in Session B; field names here mirror what Postgres will use.
 */

export interface Study {
  id: string;
  name: string;
  sponsor: string;
  criteria: string;
  protocol_name: string;
  status: "active" | "setup" | "archived";
  is_demo: boolean;
  subject_count: number;
  source_doc_count: number;
  created_at: string; // ISO
  owner: string; // stub until Clerk; "demo" for now
}

const STUDIES_KEY = "klin.v0.studies";
const CURRENT_KEY = "klin.v0.current_study";
const VISITED_KEY = "klin.v0.visited_app";

export const DEMO_STUDY: Study = {
  id: "KLIN-ONC-DEMO-001",
  name: "Phase II Solid Tumour",
  sponsor: "Klin AI · Synthetic Sponsor",
  criteria: "RECIST 1.1",
  protocol_name: "KLIN-ONC-DEMO-001.pdf",
  status: "active",
  is_demo: true,
  subject_count: 5,
  source_doc_count: 80,
  created_at: "2026-01-02T00:00:00Z",
  owner: "demo",
};

/** Second demo backed by the same engine data, separate persistence
 *  namespace — so two side-by-side demo walkthroughs can be at different
 *  stages without trampling each other. */
export const DEMO_STUDY_B: Study = {
  id: "KLIN-ONC-DEMO-002",
  name: "Phase II Solid Tumour (walkthrough copy)",
  sponsor: "Klin AI · Synthetic Sponsor",
  criteria: "RECIST 1.1",
  protocol_name: "KLIN-ONC-DEMO-001.pdf",
  status: "active",
  is_demo: true,
  subject_count: 5,
  source_doc_count: 80,
  created_at: "2026-01-02T00:00:00Z",
  owner: "demo",
};

const DEMO_STUDIES: Study[] = [DEMO_STUDY, DEMO_STUDY_B];

export function listStudies(): Study[] {
  const custom = loadCustomStudies();
  return [...DEMO_STUDIES, ...custom];
}

function loadCustomStudies(): Study[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STUDIES_KEY);
    return raw ? (JSON.parse(raw) as Study[]) : [];
  } catch {
    return [];
  }
}

export function saveStudy(study: Study): void {
  if (typeof localStorage === "undefined") return;
  if (DEMO_STUDIES.some((d) => d.id === study.id)) return; // never persist demos
  const studies = loadCustomStudies();
  const i = studies.findIndex((s) => s.id === study.id);
  if (i >= 0) studies[i] = study;
  else studies.push(study);
  localStorage.setItem(STUDIES_KEY, JSON.stringify(studies));
}

export function deleteStudy(id: string): void {
  if (typeof localStorage === "undefined") return;
  if (DEMO_STUDIES.some((d) => d.id === id)) return;
  const studies = loadCustomStudies().filter((s) => s.id !== id);
  localStorage.setItem(STUDIES_KEY, JSON.stringify(studies));
  if (getCurrentStudyId() === id) clearCurrentStudy();
}

export function getCurrentStudyId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(CURRENT_KEY);
}

export function setCurrentStudy(id: string): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(CURRENT_KEY, id);
}

export function clearCurrentStudy(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(CURRENT_KEY);
}

export function getStudy(id: string): Study | undefined {
  return listStudies().find((s) => s.id === id);
}

export function hasVisitedApp(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(VISITED_KEY) === "true";
}

export function markVisitedApp(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(VISITED_KEY, "true");
}

export function studyPath(studyId: string, suffix = ""): string {
  return `/platform/${encodeURIComponent(studyId)}${suffix}`;
}

export function newStudyId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  const stamp = Date.now().toString(36).slice(-5).toUpperCase();
  return `STUDY-${slug}-${stamp}`;
}
