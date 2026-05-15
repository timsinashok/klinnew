import type { Finding } from "../types";
import { FindingCard } from "./FindingCard";

export function FindingsList({
  findings,
  selected,
  onSelect,
}: {
  findings: Finding[];
  selected: number | null;
  onSelect: (i: number) => void;
}) {
  if (findings.length === 0) {
    return (
      <div className="text-sm text-neutral-500 italic p-4">
        No findings.
      </div>
    );
  }
  return (
    <div>
      {findings.map((f, i) => (
        <FindingCard
          key={i}
          finding={f}
          selected={i === selected}
          onClick={() => onSelect(i)}
        />
      ))}
    </div>
  );
}
