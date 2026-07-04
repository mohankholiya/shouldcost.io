import { describe, it, expect } from "vitest";
import { useEditorStore } from "@/lib/stores/editor-store";
import { effectiveRateMinor } from "@/lib/model/index-rate";
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

describe("index binding", () => {
  it("materializes rate = value x factor and recomputes (factor != quantity)", () => {
    useEditorStore.getState().hydrate([
      r({ id: "g", node_type: "group" }),
      r({ id: "a", parent_id: "g", rate: 0, quantity: 1.08 }),
    ]);
    // HRC 650 at factor 1.0 -> rate 65000 minor; quantity 1.08 applied by the rollup.
    useEditorStore.getState().bindIndex("a", "idx1", 1.0, effectiveRateMinor(650, 1.0));
    const s = useEditorStore.getState();
    expect(s.nodes["a"]!.rate).toBe(65000);
    expect(s.nodes["a"]!.rate_source).toBe("index");
    expect(s.rollup.total).toBe(70200); // round(1.08 * 65000)
  });
});
