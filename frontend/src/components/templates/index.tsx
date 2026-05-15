import type { ReactElement } from "react";
import type { Finding } from "../../types";
import { EvidenceTables } from "./EvidenceTables";
import { GhostReferenceTemplate } from "./GhostReferenceTemplate";
import { LesionCountTemplate } from "./LesionCountTemplate";
import { MeasurabilityTemplate } from "./MeasurabilityTemplate";
import { ResponseThresholdTemplate } from "./ResponseThresholdTemplate";
import { TimelineMismatchTemplate } from "./TimelineMismatchTemplate";

type TemplateComponent = (props: { finding: Finding }) => ReactElement;

const REGISTRY: Record<string, TemplateComponent> = {
  RESPONSE_THRESHOLD: ResponseThresholdTemplate,
  LESION_COUNT: LesionCountTemplate,
  GHOST_REFERENCE: GhostReferenceTemplate,
  TIMELINE_MISMATCH: TimelineMismatchTemplate,
  MEASURABILITY: MeasurabilityTemplate,
};

export function renderTemplate(finding: Finding) {
  const Comp = REGISTRY[finding.template_id];
  if (!Comp) {
    return (
      <div className="space-y-3">
        <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
          No renderer registered for template <span className="mono">{finding.template_id}</span>.
        </div>
        <EvidenceTables finding={finding} />
      </div>
    );
  }
  return <Comp finding={finding} />;
}
