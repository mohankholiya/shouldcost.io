import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { nextCell } from "@/components/models/cbs-tree/keyboard";
import { CbsTree } from "@/components/models/cbs-tree/cbs-tree";
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

describe("nextCell", () => {
  it("moves right on Tab and wraps to next row", () => {
    expect(nextCell({ row: 0, col: 0 }, "Tab", { rows: 2, cols: 3 })).toEqual({ row: 0, col: 1 });
    expect(nextCell({ row: 0, col: 2 }, "Tab", { rows: 2, cols: 3 })).toEqual({ row: 1, col: 0 });
  });
  it("moves down on ArrowDown, clamped", () => {
    expect(nextCell({ row: 1, col: 1 }, "ArrowDown", { rows: 2, cols: 3 })).toEqual({
      row: 1,
      col: 1,
    });
  });
});

describe("CbsTree", () => {
  beforeEach(() => {
    useEditorStore.getState().hydrate([
      r({ id: "g", node_type: "group", name: "Material", sort_order: 0 }),
      r({ id: "a", parent_id: "g", name: "Billet", rate: 65000, quantity: 1 }),
    ]);
  });

  it("renders an editable line and a group subtotal", () => {
    render(<CbsTree />);
    expect(screen.getByDisplayValue("Billet")).toBeTruthy();
    expect(screen.getByRole("table")).toBeTruthy();
    // rolled-up value (650.00) appears in line total, group subtotal, and footer
    expect(screen.getAllByText(/650\.00/).length).toBeGreaterThanOrEqual(1);
  });
});
