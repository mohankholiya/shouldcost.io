"use client";
import { useEditorStore } from "@/lib/stores/editor-store";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/components/number/currency-select";

export function GrandTotal({ currency }: { currency: Currency }) {
  const total = useEditorStore((s) => s.rollup.total);
  return <span className="num">{formatCurrency(total, currency)}</span>;
}
