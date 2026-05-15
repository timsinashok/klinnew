export type Severity = "Critical" | "Warning" | "Suggested Change";

export interface Lineage {
  form: string;
  field: string;
  source_doc: string;
}

export interface Finding {
  rule_id: string;
  severity: Severity;
  subject_id: string;
  visit: string | null;
  domain: string;
  variable: string;
  lineage: Lineage;
  evidence_rows: Record<string, Record<string, unknown>[]>;
  raw_message: string;
  template_id: string;
  template_params: Record<string, unknown>;
  citation: string;
  user_message: string;
  suggested_actions: string[];
  translator_source: "" | "llm" | "template";
}

export interface RunResponse {
  count: number;
  findings: Finding[];
  enable_llm: boolean;
  model: string;
}

export interface StudyMeta {
  study_id: string;
  title: string;
  sponsor: string;
  site: string;
  criteria: string;
  enrolment_opened: string;
  enrolment_closed: string | null;
}

export interface SubjectStat {
  subject_id: string;
  visits_completed: string[];
  visits_planned: string[];
  latest_visit: string | null;
  last_visit_date: string | null;
  status: "Active" | "Off-study";
}

export interface Stats {
  study: StudyMeta;
  subjects: SubjectStat[];
  total_subjects: number;
  total_visits_completed: number;
  total_visits_planned: number;
}
