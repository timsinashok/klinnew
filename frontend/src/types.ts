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
