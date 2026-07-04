import { describe, it, expect } from "vitest";
import { ALL_TEMPLATES } from "@/lib/seed/templates";
import { rollupCbs } from "@/lib/seed/rollup";

describe("all templates", () => {
  it("has 17 templates with unique slugs", () => {
    expect(ALL_TEMPLATES).toHaveLength(17);
    expect(new Set(ALL_TEMPLATES.map((t) => t.slug)).size).toBe(17);
  });
  it("each rolls up within its target range", () => {
    const ranges: Record<string, [number, number]> = {
      "octg-casing-tubing": [1700, 1950],
      "line-pipe": [900, 1150],
      "ball-gate-valves": [4000, 9000],
      "wellheads-xmas-trees": [80000, 180000],
      "centrifugal-pumps-api610": [20000, 60000],
      "pressure-vessels-hx": [6, 12],
      "drilling-day-rates": [18000, 45000],
      "structural-steel-fabrication": [1100, 1500],
      "power-transformers": [45000, 95000],
      "hv-mv-cables": [40, 120],
      "switchgear-panels": [15000, 60000],
      "solar-pv-modules": [0.18, 0.3],
      "solar-epc-bos": [250000, 500000],
      "wind-turbine-towers": [2500, 4500],
      "transmission-towers": [1300, 1800],
      "epc-manhour-rate": [8, 95],
      "maintenance-shutdown": [50000, 250000],
    };
    for (const t of ALL_TEMPLATES) {
      const totalUnits = rollupCbs(t.cbs_json) / 100;
      const range = ranges[t.slug];
      expect(range, `no range for ${t.slug}`).toBeTruthy();
      const [lo, hi] = range!;
      expect(totalUnits, `${t.slug} rolled to ${totalUnits}`).toBeGreaterThanOrEqual(lo);
      expect(totalUnits, `${t.slug} rolled to ${totalUnits}`).toBeLessThanOrEqual(hi);
    }
  });
});
