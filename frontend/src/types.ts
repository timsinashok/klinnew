export type Severity = "LOW" | "MEDIUM" | "HIGH";

export interface Finding {
  rule_id: string;
  severity: Severity;
  usubjid: string;
  visit: string | null;
  message: string;
  template_id: string;
  template_params: Record<string, unknown>;
  evidence_rows: Record<string, Record<string, unknown>[]>;
  citation: string;
}

export interface BenchmarkReport {
  total_truth: number;
  covered_count: number;
  missing: string[];
  total_findings: number;
  matched_findings: number;
  false_positives: { rule_id: string; usubjid: string; visit: string | null }[];
  recall: number;
  precision: number;
  per_error: Record<string, string[]>;
}
