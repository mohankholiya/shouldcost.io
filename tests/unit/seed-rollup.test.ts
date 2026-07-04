import { describe, it, expect } from "vitest";
import { rollupCbs } from "@/lib/seed/rollup";
import { OCTG_TEMPLATE } from "@/lib/seed/templates/octg-casing-tubing";

describe("rollup", () => {
  it("sums line items", () => {
    const group = {
      name: "x",
      node_type: "group",
      nodes: [
        { name: "a", node_type: "line", quantity: 1, rate: 100, nodes: [] },
        { name: "b", node_type: "line", quantity: 2, rate: 50, nodes: [] },
      ],
    };
    expect(rollupCbs(group as never)).toBe(20000); // (100 + 2*50) * 100 minor
  });
  it("OCTG should-cost lands near 1814 USD/MT", () => {
    const total = rollupCbs(OCTG_TEMPLATE.cbs_json as never);
    const units = total / 100;
    expect(units).toBeGreaterThan(1700);
    expect(units).toBeLessThan(1950);
  });
});
