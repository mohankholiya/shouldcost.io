"use client";

import { useEditorStore } from "@/lib/stores/editor-store";
import { Input } from "@/components/ui/input";

export function NumberCell({ id }: { id: string }) {
  const value = useEditorStore((s) => s.nodes[id]?.quantity ?? null);
  const setCell = useEditorStore((s) => s.setCell);
  return (
    <Input
      type="text"
      inputMode="decimal"
      aria-label="quantity"
      value={value ?? ""}
      onChange={(e) => {
        if (e.target.value === "") return setCell(id, "quantity", null);
        const n = Number(e.target.value);
        if (Number.isFinite(n)) setCell(id, "quantity", n);
      }}
      className="num h-7 w-20 border-0 bg-transparent px-1 text-right shadow-none focus-visible:ring-1"
    />
  );
}
