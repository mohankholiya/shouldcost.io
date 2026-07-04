import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartContainer } from "@/components/models/charts/chart-container";
import { donutData } from "@/components/models/charts/rollup-donut";
import { sparklineStats } from "@/components/models/charts/index-sparkline";
import { buildTree } from "@/lib/model/tree";
import { rollupLive } from "@/lib/model/rollup-live";
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

describe("ChartContainer", () => {
  it("renders title, copy button, and body", () => {
    render(
      <ChartContainer title="Cost composition" data={[{ a: 1 }]}>
        <div>body</div>
      </ChartContainer>,
    );
    expect(screen.getByText("Cost composition")).toBeTruthy();
    expect(screen.getByLabelText("Copy data")).toBeTruthy();
    expect(screen.getByText("body")).toBeTruthy();
  });
  it("shows empty state when no data", () => {
    render(<ChartContainer title="X" data={[]} />);
    expect(screen.getByText(/No data yet/)).toBeTruthy();
  });
});

describe("donutData", () => {
  it("returns a slice per top-level node with subtotals", () => {
    const rows = [
      r({ id: "g1", node_type: "group", name: "Material", sort_order: 0 }),
      r({ id: "a", parent_id: "g1", rate: 10000 }),
      r({ id: "g2", node_type: "group", name: "Conversion", sort_order: 1 }),
      r({ id: "b", parent_id: "g2", rate: 5000 }),
    ];
    const rollup = rollupLive(buildTree(rows));
    const data = donutData(rows, rollup);
    expect(data.map((d) => d.name)).toEqual(["Material", "Conversion"]);
    expect(data.find((d) => d.name === "Material")!.value).toBe(10000);
  });
});

describe("sparklineStats", () => {
  it("computes last value and delta %", () => {
    const s = sparklineStats([
      { date: "a", value: 100 },
      { date: "b", value: 150 },
    ]);
    expect(s.last).toBe(150);
    expect(s.deltaPct).toBeCloseTo(50, 5);
  });
});
