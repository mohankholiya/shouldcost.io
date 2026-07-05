"use client";

import { evaluateInsights, type InsightCard } from "@/lib/model/insights";
import type { Comparison } from "@/lib/model/comparison";
import type { Currency } from "@/components/number/currency-select";
import { cn } from "@/lib/utils";

// Reuses the same favor/amber tokens as DeltaPill; base card border stays hairline.
const CHIP: Record<InsightCard["severity"], string> = {
  lever: "text-amber",
  concede: "text-favor",
  info: "text-muted-foreground",
};
const LABEL: Record<InsightCard["severity"], string> = {
  lever: "Lever",
  concede: "Concede",
  info: "Info",
};

export function InsightCards({
  comparison,
  currency,
}: {
  comparison: Comparison;
  currency: Currency;
}) {
  const cards = evaluateInsights(comparison, currency);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <div key={card.id} className="rounded-md border border-hairline bg-card p-3">
          <span
            className={cn("text-[10px] font-medium uppercase tracking-wide", CHIP[card.severity])}
          >
            {LABEL[card.severity]}
          </span>
          <h4 className="mt-1 text-sm font-medium">{card.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
        </div>
      ))}
    </div>
  );
}
