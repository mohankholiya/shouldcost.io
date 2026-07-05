import { describe, it, expect } from "vitest";
import { evaluateInsights } from "@/lib/model/insights";
import type { Comparison } from "@/lib/model/comparison";

const base: Comparison = {
  rows: [
    { nodeId: "steel", name: "Steel", shouldCost: 60000, quoted: 80000, gap: 20000, gapPct: 33.3 },
    { nodeId: "coat", name: "Coating", shouldCost: 20000, quoted: 15000, gap: -5000, gapPct: -25 },
    { nodeId: "margin", name: "Margin", shouldCost: 20000, quoted: 25000, gap: 5000, gapPct: 25 },
  ],
  shouldCostTotal: 100000,
  quoteTotal: 120000,
  gapTotal: 20000,
  gapPct: 20,
};

describe("evaluateInsights", () => {
  it("always emits a headline card describing the total gap direction", () => {
    const cards = evaluateInsights(base, "USD");
    const headline = cards.find((x) => x.id === "headline")!;
    expect(headline.severity).toBe("lever"); // quote above should-cost
    expect(headline.title).toContain("20.0%");
    expect(headline.title.toLowerCase()).toContain("above");
  });

  it("flags over-quoted lines above the 10% threshold as levers", () => {
    const cards = evaluateInsights(base, "USD");
    const lever = cards.find((x) => x.id === "lever-steel");
    expect(lever?.severity).toBe("lever");
  });

  it("frames lines quoted below should-cost as concede", () => {
    const cards = evaluateInsights(base, "USD");
    const concede = cards.find((x) => x.id === "concede-coat");
    expect(concede?.severity).toBe("concede");
  });

  it("reports implied margin when a line name mentions margin", () => {
    const cards = evaluateInsights(base, "USD");
    const margin = cards.find((x) => x.id === "margin")!;
    expect(margin.severity).toBe("info");
    expect(margin.title).toContain("20.0%"); // 20000 / 100000
  });

  it("headline reads 'below' and info severity when quote is under should-cost", () => {
    const under: Comparison = { ...base, quoteTotal: 90000, gapTotal: -10000, gapPct: -10, rows: [] };
    const headline = evaluateInsights(under, "USD").find((x) => x.id === "headline")!;
    expect(headline.severity).toBe("info");
    expect(headline.title.toLowerCase()).toContain("below");
  });
});
