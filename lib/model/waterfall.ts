import type { Comparison } from "@/lib/model/comparison";

export type WaterfallBar = {
  label: string;
  delta: number;
  cumulative: number;
  kind: "base" | "increase" | "decrease" | "total";
};

export function waterfallData(c: Comparison, topN = 6): WaterfallBar[] {
  const mapped = c.rows.filter((r): r is typeof r & { gap: number } => r.gap !== null);
  const ranked = [...mapped].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const top = ranked.slice(0, topN);
  const topSum = top.reduce((s, r) => s + r.gap, 0);
  const other = c.gapTotal - topSum;

  const bars: WaterfallBar[] = [];
  let cumulative = c.shouldCostTotal;
  bars.push({ label: "Should-cost", delta: c.shouldCostTotal, cumulative, kind: "base" });

  for (const r of top) {
    cumulative += r.gap;
    bars.push({
      label: r.name,
      delta: r.gap,
      cumulative,
      kind: r.gap >= 0 ? "increase" : "decrease",
    });
  }

  if (other !== 0) {
    cumulative += other;
    bars.push({ label: "Other", delta: other, cumulative, kind: other >= 0 ? "increase" : "decrease" });
  }

  bars.push({ label: "Quote", delta: c.quoteTotal, cumulative: c.quoteTotal, kind: "total" });
  return bars;
}
