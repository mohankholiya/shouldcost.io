import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "@/lib/stores/editor-store";
import type { CostNodeRow } from "@/lib/model/types";

const r = (o: Partial<CostNodeRow>): CostNodeRow => ({
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
  ...o,
});

describe("editor store", () => {
  beforeEach(() => {
    useEditorStore.getState().hydrate([
      r({ id: "g", node_type: "group" }),
      r({ id: "a", parent_id: "g", rate: 10000 }),
    ]);
  });

  it("recomputes rollup on hydrate", () => {
    expect(useEditorStore.getState().rollup.total).toBe(10000);
  });

  it("setCell updates a value, marks dirty, and recomputes", () => {
    useEditorStore.getState().setCell("a", "rate", 25000);
    const s = useEditorStore.getState();
    expect(s.nodes["a"]!.rate).toBe(25000);
    expect(s.dirtyIds.has("a")).toBe(true);
    expect(s.rollup.total).toBe(25000);
  });

  it("removeNode tracks deletion and recomputes", () => {
    useEditorStore.getState().removeNode("a");
    const s = useEditorStore.getState();
    expect(s.nodes["a"]).toBeUndefined();
    expect(s.deletedIds).toContain("a");
    expect(s.rollup.total).toBe(0);
  });

  it("addLine inserts a new line under a parent", () => {
    const id = useEditorStore.getState().addLine("g");
    const s = useEditorStore.getState();
    expect(s.nodes[id]!.parent_id).toBe("g");
    expect(s.nodes[id]!.node_type).toBe("line");
    expect(s.dirtyIds.has(id)).toBe(true);
  });
});
