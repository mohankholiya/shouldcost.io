import { describe, it, expect } from "vitest";
import { buildTree } from "@/lib/model/tree";
import { rollupLive } from "@/lib/model/rollup-live";
import type { CostNodeRow } from "@/lib/model/types";

const r = (o: Partial<CostNodeRow>): CostNodeRow => ({
  id: crypto.randomUUID(),
  model_id: "m",
  parent_id: null,
  sort_order: 0,
  name: "n",
  node_type: "line",
  driver_name: null,
  quantity: 1,
  unit: null,
  rate: 0,
  rate_source: "benchmark",
  index_id: null,
  index_factor: null,
  formula: null,
  notes: null,
  ...o,
});

describe("rollupLive", () => {
  it("sums line items (rate in minor)", () => {
    const rows = [
      r({ id: "g", node_type: "group", parent_id: null }),
      r({ id: "a", parent_id: "g", quantity: 1, rate: 10000 }),
      r({ id: "b", parent_id: "g", quantity: 2, rate: 5000 }),
    ];
    const { total, byNodeId } = rollupLive(buildTree(rows));
    expect(total).toBe(20000);
    expect(byNodeId["g"]).toBe(20000);
  });

  it("matches Phase 0 OCTG (~176,021 minor) with minor-unit rates", () => {
    const rows: CostNodeRow[] = [
      r({ id: "mat", node_type: "group", name: "Material", sort_order: 0 }),
      r({ id: "mat1", parent_id: "mat", quantity: 1.08, rate: 65000 }),
      r({ id: "conv", node_type: "group", name: "Conversion", sort_order: 1 }),
      r({ id: "c1", parent_id: "conv", rate: 28000 }),
      r({ id: "c2", parent_id: "conv", rate: 15000 }),
      r({ id: "c3", parent_id: "conv", rate: 22000 }),
      r({ id: "c4", parent_id: "conv", rate: 6000 }),
      r({ id: "oh", node_type: "group", name: "Overhead", sort_order: 2 }),
      r({ id: "oh1", parent_id: "oh", node_type: "line", formula: "12% of conversion" }),
      r({ id: "sga", node_type: "group", name: "SG&A", sort_order: 3 }),
      r({ id: "sga1", parent_id: "sga", node_type: "line", formula: "5% of material" }),
      r({ id: "mar", node_type: "group", name: "Margin", sort_order: 4 }),
      r({ id: "mar1", parent_id: "mar", node_type: "line", formula: "9% margin" }),
      r({ id: "log", node_type: "group", name: "Logistics", sort_order: 5 }),
      r({ id: "log1", parent_id: "log", rate: 9000 }),
    ];
    const { total } = rollupLive(buildTree(rows));
    expect(total / 100).toBeGreaterThan(1700);
    expect(total / 100).toBeLessThan(1820);
  });
});
