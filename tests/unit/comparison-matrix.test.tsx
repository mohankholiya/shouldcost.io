import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparisonMatrix } from "@/components/quotes/comparison-matrix";
import type { Comparison } from "@/lib/model/comparison";

const c: Comparison = {
  rows: [
    { nodeId: "steel", name: "Steel", shouldCost: 100000, quoted: 130000, gap: 30000, gapPct: 30 },
    { nodeId: "thread", name: "Threading", shouldCost: 50000, quoted: null, gap: null, gapPct: null },
  ],
  shouldCostTotal: 150000,
  quoteTotal: 180000,
  gapTotal: 30000,
  gapPct: 20,
};

describe("ComparisonMatrix", () => {
  it("renders one row per line, the total row, and an em dash for unmapped quotes", () => {
    render(<ComparisonMatrix comparison={c} currency="USD" />);
    expect(screen.getByText("Steel")).toBeInTheDocument();
    expect(screen.getByText("Threading")).toBeInTheDocument();
    expect(screen.getByText(/total/i)).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0); // unmapped quoted cells
  });
});
