"use client";

import { useEditorStore } from "@/lib/stores/editor-store";
import type { RateSource } from "@/lib/model/types";

const OPTIONS: RateSource[] = ["manual", "benchmark", "index"];

/** Lightweight native select — a Radix Select per grid row is too heavy. */
export function RateSourceCell({ id }: { id: string }) {
  const value = useEditorStore((s) => s.nodes[id]?.rate_source ?? "manual");
  const setCell = useEditorStore((s) => s.setCell);
  return (
    <select
      aria-label="rate source"
      value={value}
      onChange={(e) => setCell(id, "rate_source", e.target.value as RateSource)}
      className="h-7 rounded-sm border border-hairline bg-transparent px-1 text-xs"
    >
      {OPTIONS.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
