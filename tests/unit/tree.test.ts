import { describe, it, expect } from "vitest";
import { buildTree, flattenTree } from "@/lib/model/tree";
import type { CostNodeRow } from "@/lib/model/types";

const row = (over: Partial<CostNodeRow>): CostNodeRow => ({
  id: "x",
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
  ...over,
});

describe("tree", () => {
  it("builds an ordered tree from flat rows", () => {
    const rows = [
      row({ id: "g", node_type: "group", parent_id: null, sort_order: 0, name: "G" }),
      row({ id: "b", parent_id: "g", sort_order: 1, name: "B" }),
      row({ id: "a", parent_id: "g", sort_order: 0, name: "A" }),
    ];
    const tree = buildTree(rows);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0]!.children.map((c) => c.name)).toEqual(["A", "B"]);
  });

  it("round-trips flatten(build(rows)) preserving parent/child order", () => {
    const rows = [
      row({ id: "g", node_type: "group", sort_order: 0 }),
      row({ id: "a", parent_id: "g", sort_order: 0 }),
      row({ id: "b", parent_id: "g", sort_order: 1 }),
    ];
    const flat = flattenTree(buildTree(rows));
    expect(flat.map((r) => r.id)).toEqual(["g", "a", "b"]);
    expect(flat.find((r) => r.id === "b")!.sort_order).toBe(1);
  });
});
