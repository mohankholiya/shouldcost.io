import { describe, it, expect } from "vitest";
import { waterfallData } from "@/lib/model/waterfall";
import type { Comparison } from "@/lib/model/comparison";

const comp = (over: Partial<Comparison>): Comparison => ({
  rows: [],
  shouldCostTotal: 100000,
  quoteTotal: 130000,
  gapTotal: 30000,
  gapPct: 30,
  ...over,
});

describe("waterfallData", () => {
  it("starts at should-cost, ends exactly at quote total, closing the gap", () => {
    const c = comp({
      rows: [
        { nodeId: "a", name: "Steel", shouldCost: 60000, quoted: 80000, gap: 20000, gapPct: 33.3 },
        { nodeId: "b", name: "Threading", shouldCost: 40000, quoted: 50000, gap: 10000, gapPct: 25 },
      ],
    });
    const bars = waterfallData(c, 6);
    expect(bars[0]).toMatchObject({ label: "Should-cost", kind: "base", cumulative: 100000 });
    expect(bars.at(-1)).toMatchObject({ label: "Quote", kind: "total", cumulative: 130000 });
    // cumulative is monotonic through the mapped gaps
    expect(bars[1]).toMatchObject({ label: "Steel", delta: 20000, cumulative: 120000, kind: "increase" });
    expect(bars[2]).toMatchObject({ label: "Threading", delta: 10000, cumulative: 130000, kind: "increase" });
  });

  it("groups beyond topN into an 'Other' bar and still closes on quote total", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      nodeId: `n${i}`,
      name: `L${i}`,
      shouldCost: 10000,
      quoted: 10000 + (i + 1) * 1000,
      gap: (i + 1) * 1000, // 1000,2000,3000,4000,5000 => sum 15000
      gapPct: 10,
    }));
    const c = comp({ rows, shouldCostTotal: 50000, quoteTotal: 65000, gapTotal: 15000, gapPct: 30 });
    const bars = waterfallData(c, 2); // keep top 2 (5000,4000), other = 15000-9000=6000
    const other = bars.find((b) => b.label === "Other")!;
    expect(other.delta).toBe(6000);
    expect(bars.at(-1)!.cumulative).toBe(65000);
  });

  it("emits a downward bar for a favorable (negative) line gap", () => {
    const c = comp({
      shouldCostTotal: 100000,
      quoteTotal: 95000,
      gapTotal: -5000,
      gapPct: -5,
      rows: [{ nodeId: "a", name: "Coating", shouldCost: 20000, quoted: 15000, gap: -5000, gapPct: -25 }],
    });
    const bars = waterfallData(c);
    expect(bars.find((b) => b.label === "Coating")).toMatchObject({ delta: -5000, kind: "decrease" });
    expect(bars.at(-1)!.cumulative).toBe(95000);
  });
});
