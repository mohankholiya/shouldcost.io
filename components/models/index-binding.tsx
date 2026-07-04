"use client";

import { useIndices } from "@/components/models/indices-context";
import { useEditorStore } from "@/lib/stores/editor-store";
import { effectiveRateMinor } from "@/lib/model/index-rate";
import { formatCurrency } from "@/lib/format";

/**
 * Inline index binding for a rate cell: pick an index and a conversion factor;
 * the effective rate = latest index value × factor is materialized onto the node.
 * `index_factor` is distinct from `quantity` (which the rollup multiplies separately).
 */
export function IndexBinding({ id }: { id: string }) {
  const indices = useIndices();
  const node = useEditorStore((s) => s.nodes[id]);
  const bindIndex = useEditorStore((s) => s.bindIndex);
  if (!node) return null;

  const selected = node.index_id ?? indices[0]?.id ?? "";
  const factor = node.index_factor ?? 1;

  const apply = (indexId: string, f: number) => {
    const idx = indices.find((i) => i.id === indexId);
    if (!idx) return;
    bindIndex(id, indexId, f, effectiveRateMinor(idx.latest, f));
  };

  return (
    <div className="flex items-center gap-1">
      <select
        aria-label="index"
        value={selected}
        onChange={(e) => apply(e.target.value, factor)}
        className="h-7 rounded-sm border border-hairline bg-transparent px-1 text-xs"
      >
        {indices.length === 0 && <option value="">—</option>}
        {indices.map((i) => (
          <option key={i.id} value={i.id}>
            {i.code}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-foreground">×</span>
      <input
        aria-label="factor"
        inputMode="decimal"
        value={factor}
        onChange={(e) => {
          const f = Number(e.target.value);
          if (Number.isFinite(f)) apply(selected, f);
        }}
        className="num h-7 w-12 rounded-sm border border-hairline bg-transparent px-1 text-right text-xs"
      />
      <span className="num text-xs text-muted-foreground">
        {formatCurrency(node.rate ?? 0, "USD")}
      </span>
    </div>
  );
}
