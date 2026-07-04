"use client";

import { useEditorStore } from "@/lib/stores/editor-store";
import { MoneyInput } from "@/components/number/money-input";

export function MoneyCell({ id }: { id: string }) {
  const value = useEditorStore((s) => s.nodes[id]?.rate ?? 0);
  const setCell = useEditorStore((s) => s.setCell);
  return <MoneyInput valueMinor={value ?? 0} currency="USD" onChange={(m) => setCell(id, "rate", m)} />;
}
