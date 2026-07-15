"use client";
import { memo } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/components/number/currency-select";

export const TotalCell = memo(function TotalCell({ id, currency }: { id: string; currency: Currency }) {
  const value = useEditorStore((s) => s.rollup.byNodeId[id] ?? 0);
  return <span className="num">{formatCurrency(value, currency)}</span>;
});
