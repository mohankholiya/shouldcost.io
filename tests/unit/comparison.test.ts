import { describe, it, expect } from "vitest";
import { buildComparison } from "@/lib/model/comparison";
import type { CostNodeRow, Rollup } from "@/lib/model/types";

const r = (o: Partial<CostNodeRow>): CostNodeRow => ({
  id: o.id ?? "x",
  model_id: "m",
  parent_id: o.parent_id ?? null,
  sort_order: o.sort_order ?? 0,
  name: o.name ?? "n",
  node_type: o.node_type ?? "line",
  driver_name: null,
  quantity: o.quantity ?? 1,
  unit: null,
  rate: o.rate ?? null,
  rate_source: "manual",
  index_id: null,
  index_factor: null,
  formula: o.formula ?? null,
  notes: null,
});

// Group G with two leaf lines: steel (100000) and threading (50000).
const nodes: CostNodeRow[] = [
  r({ id: "g", node_type: "group", name: "G", sort_order: 0 }),
  r({ id: "steel", parent_id: "g", name: "Steel", sort_order: 0 }),
  r({ id: "thread", parent_id: "g", name: "Threading", sort_order: 1 }),
];
const rollup: Rollup = { total: 150000, byNodeId: { g: 150000, steel: 100000, thread: 50000 } };

describe("buildComparison", () => {
  it("computes per-leaf and total gaps in minor units; unmapped leaf is null", () => {
    const quote = {
      quoted_total: 180000,
      lines: [{ cost_node_id: "steel", amount: 130000 }], // threading unmapped
    };
    const c = buildComparison(nodes, rollup, quote);

    expect(c.rows.map((x) => x.nodeId)).toEqual(["steel", "thread"]); // leaves only, tree order
    const steel = c.rows.find((x) => x.nodeId === "steel")!;
    expect(steel.shouldCost).toBe(100000);
    expect(steel.quoted).toBe(130000);
    expect(steel.gap).toBe(30000);
    expect(steel.gapPct).toBeCloseTo(30, 5);

    const thread = c.rows.find((x) => x.nodeId === "thread")!;
    expect(thread.quoted).toBeNull();
    expect(thread.gap).toBeNull();
    expect(thread.gapPct).toBeNull();

    expect(c.shouldCostTotal).toBe(150000);
    expect(c.quoteTotal).toBe(180000);
    expect(c.gapTotal).toBe(30000);
    expect(c.gapPct).toBeCloseTo(20, 5);
  });

  it("sums multiple quote lines mapped to the same node", () => {
    const quote = {
      quoted_total: 150000,
      lines: [
        { cost_node_id: "steel", amount: 60000 },
        { cost_node_id: "steel", amount: 60000 },
      ],
    };
    const c = buildComparison(nodes, rollup, quote);
    expect(c.rows.find((x) => x.nodeId === "steel")!.quoted).toBe(120000);
  });

  it("guards divide-by-zero: zero should-cost yields null gapPct on the row and 0 overall", () => {
    const zeroRollup: Rollup = { total: 0, byNodeId: { g: 0, steel: 0, thread: 0 } };
    const c = buildComparison(nodes, zeroRollup, { quoted_total: 0, lines: [] });
    expect(c.rows.every((x) => x.gapPct === null || x.gap === null)).toBe(true);
    expect(c.gapPct).toBe(0);
  });
});
