"use client";

import { useState } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { toMinor } from "@/lib/money";
import { Surface } from "@/components/ui/surface";
import { SuggestNode } from "@/components/ai/suggest-node";
import type { Currency } from "@/components/number/currency-select";
import type { CostNodeRow } from "@/lib/model/types";

/**
 * Additive AI helper for the editor: pick a manual line, get a driver/rate suggestion,
 * and Apply it through the store's setCell (which marks the node dirty → autosaves).
 * Only affects the chosen line, and only on Apply.
 */
export function NodeAiAssist({ currency }: { currency: Currency }) {
  const nodesMap = useEditorStore((s) => s.nodes);
  const order = useEditorStore((s) => s.order);
  const setCell = useEditorStore((s) => s.setCell);
  const [selectedId, setSelectedId] = useState<string>("");

  const lines = order
    .map((id) => nodesMap[id])
    .filter((n): n is CostNodeRow => Boolean(n) && n!.node_type === "line" && n!.rate_source === "manual");

  if (lines.length === 0) return null;
  const selected = lines.find((n) => n.id === selectedId) ?? null;

  return (
    <Surface padding="lg" radius="lg" className="space-y-3">
      <div className="text-sm font-medium">AI assist — suggest a driver &amp; rate</div>
      <select
        className="w-full rounded-md border border-hairline bg-background px-2 py-1.5 text-sm"
        value={selectedId}
        onChange={(e) => setSelectedId(e.target.value)}
        aria-label="Choose a cost line for an AI suggestion"
      >
        <option value="">Choose a cost line…</option>
        {lines.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>
      {selected && (
        <SuggestNode
          key={selected.id}
          nodeName={selected.name}
          currency={currency}
          onApply={(s) => {
            setCell(selected.id, "driver_name", s.driver);
            setCell(selected.id, "unit", s.unit);
            const mid = (s.rate_low + s.rate_high) / 2;
            setCell(selected.id, "rate", toMinor(mid, currency));
          }}
        />
      )}
    </Surface>
  );
}
