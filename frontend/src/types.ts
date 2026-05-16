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

export interface ProtocolCheck {
  check_id: string;
  protocol_section: string;
  layer: string;
  domain_scope: string;
  variables_or_fields: string;
  plain_english_rule: string;
  logic_or_threshold: string;
  severity_when_failed: string;
  demo_action: string;
  error_message_template: string;
}

export interface ProtocolSection {
  section: string;
  title: string;
  protocol_text: string;
  data_needed: string;
  domains_impacted: string;
  check_ids: string[];
  checks: ProtocolCheck[];
}

export interface ProtocolResponse {
  study_id: string;
  title: string;
  sections: ProtocolSection[];
  all_checks: ProtocolCheck[];
}

export interface SourceMapping {
  file_name: string;
  target_domain: string;
  target_fields: string;
  source_fields: string;
}

export interface SourceDocument {
  source_document_id: string;
  subject_id: string;
  visit: string;
  document_type: string;
  document_date: string;
  page_title: string;
  source_text: string;
  maps_to_domains: string;
  mappings: SourceMapping[];
  ecrf_consumer_rows: number;
}

export interface SourcesResponse {
  documents: SourceDocument[];
}

export interface DomainRow extends Record<string, unknown> {}
export interface DomainResponse {
  rows: DomainRow[];
}
