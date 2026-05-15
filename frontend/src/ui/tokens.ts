import type { Severity } from "../types";

export const SEV_LETTER: Record<Severity, string> = {
  Critical: "C",
  Warning: "W",
  "Suggested Change": "S",
};

export const SEV_LABEL_SHORT: Record<Severity, string> = {
  Critical: "Critical",
  Warning: "Warning",
  "Suggested Change": "Suggested",
};

export const SEV_BADGE_CLASS: Record<Severity, string> = {
  Critical: "bg-sev-critical-50 text-sev-critical-800 border-sev-critical-300",
  Warning: "bg-sev-warning-50 text-sev-warning-800 border-sev-warning-300",
  "Suggested Change":
    "bg-sev-suggested-50 text-sev-suggested-800 border-sev-suggested-300",
};

export const SEV_STRIPE_CLASS: Record<Severity, string> = {
  Critical: "bg-sev-critical-600",
  Warning: "bg-sev-warning-600",
  "Suggested Change": "bg-sev-suggested-600",
};

export const SEV_FIELD_CLASS: Record<Severity, string> = {
  Critical: "is-flagged-critical",
  Warning: "is-flagged-warning",
  "Suggested Change": "is-flagged-suggested",
};

export const SEV_RANK: Record<Severity, number> = {
  Critical: 3,
  Warning: 2,
  "Suggested Change": 1,
};
