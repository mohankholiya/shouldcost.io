import { describe, it, expect } from "vitest";
import { buildTree } from "@/lib/model/tree";
import { tornado } from "@/lib/model/sensitivity";
import type { CostNodeRow } from "@/lib/model/types";

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
  rate_source: "benchmark",
  index_id: null,
  index_factor: null,
  formula: o.formula ?? null,
  notes: null,
});

describe("tornado", () => {
  it("ranks drivers by swing, biggest first", () => {
    const rows = [
      r({ id: "g", node_type: "group" }),
      r({ id: "big", parent_id: "g", name: "Big", rate: 100000 }),
      r({ id: "small", parent_id: "g", name: "Small", rate: 1000 }),
    ];
    const bars = tornado(buildTree(rows), 10);
    expect(bars[0]!.name).toBe("Big");
    expect(bars[0]!.swing).toBeGreaterThan(bars[1]!.swing);
    expect(bars[0]!.swing).toBe(20000);
  });
});
