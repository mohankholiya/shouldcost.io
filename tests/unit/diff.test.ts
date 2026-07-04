import { describe, it, expect } from "vitest";
import { diffVersions } from "@/lib/model/diff";
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

describe("diffVersions", () => {
  it("reports added, removed, and changed lines", () => {
    const a = [r({ id: "1", rate: 100 }), r({ id: "2", rate: 200 })];
    const b = [r({ id: "1", rate: 150 }), r({ id: "3", rate: 300 })];
    const d = diffVersions(a, b);
    expect(d.added.map((x) => x.id)).toEqual(["3"]);
    expect(d.removed.map((x) => x.id)).toEqual(["2"]);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0]!.fields[0]).toMatchObject({ field: "rate", from: 100, to: 150 });
  });
});
