import { describe, it, expect } from "vitest";
import { Workbook } from "exceljs";
import { buildTree } from "@/lib/model/tree";
import { rollupLive } from "@/lib/model/rollup-live";
import { fromMinor } from "@/lib/money";
import type { CostNodeRow } from "@/lib/model/types";
import type { Currency } from "@/components/number/currency-select";
import { flattenTree } from "@/lib/export/excel-layout";
import { buildModelXlsx } from "@/lib/export/xlsx-model";

// CostNodeRow factory — rates are integer minor units (mirrors rollup-live tests).
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

/**
 * Three-level tree exercising every formula path:
 *   Root
 *   ├─ Materials (group)
 *   │   ├─ Steel  (line, qty*rate)
 *   │   └─ Plastic (line, qty*rate)
 *   ├─ Margin (group)
 *   │   └─ Margin line (formula "10%" — bare, running total = Materials subtotal)
 *   └─ Logistics (group)
 *       └─ Allocation (formula "5% of Materials" — named-group reference)
 *
 * Minor math (must match rollupLive exactly):
 *   Steel 10000, Plastic 3000 → Materials 13000
 *   Margin "10%" of running 13000 → 1300
 *   Allocation "5% of Materials" (13000) → 650
 *   Root total = 14950 minor = 149.50 major
 */
function buildKnownTree(): { rows: CostNodeRow[]; currency: Currency } {
  const rows: CostNodeRow[] = [
    r({ id: "root", node_type: "group", name: "Should-cost", parent_id: null, sort_order: 0 }),
    r({ id: "mat", node_type: "group", name: "Materials", parent_id: "root", sort_order: 0 }),
    r({ id: "steel", parent_id: "mat", name: "Steel", quantity: 2, unit: "kg", rate: 5000, sort_order: 0 }),
    r({ id: "plastic", parent_id: "mat", name: "Plastic", quantity: 1, unit: "kg", rate: 3000, sort_order: 1 }),
    r({ id: "marg", node_type: "group", name: "Margin", parent_id: "root", sort_order: 1 }),
    r({ id: "marg-line", parent_id: "marg", name: "Margin line", node_type: "line", formula: "10%", sort_order: 0 }),
    r({ id: "log", node_type: "group", name: "Logistics", parent_id: "root", sort_order: 2 }),
    r({ id: "alloc", parent_id: "log", name: "Allocation", node_type: "line", formula: "5% of Materials", sort_order: 0 }),
  ];
  return { rows, currency: "USD" };
}

// Build, then read back via exceljs so the assertions exercise the real round-trip.
async function buildAndLoad(input: {
  modelName: string;
  currency: Currency;
  nodes: CostNodeRow[];
}) {
  const rollup = rollupLive(buildTree(input.nodes));
  const wb = await buildModelXlsx({ ...input, rollup });
  const buf = await wb.xlsx.writeBuffer();
  const wb2 = new Workbook();
  await wb2.xlsx.load(buf);
  return { wb: wb2, ws: wb2.getWorksheet("Should-cost")!, rollup };
}

describe("flattenTree (excel-layout)", () => {
  it("orders depth-first by sort_order with correct depth", () => {
    const { rows } = buildKnownTree();
    const { rows: ordered } = flattenTree(rows);
    expect(ordered.map((o) => o.node.id)).toEqual([
      "root",
      "mat",
      "steel",
      "plastic",
      "marg",
      "marg-line",
      "log",
      "alloc",
    ]);
    expect(ordered.map((o) => o.level)).toEqual([0, 1, 2, 2, 1, 2, 1, 2]);
    expect(ordered.map((o) => o.rowNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("treats missing-parent nodes as roots", () => {
    const { rows } = buildKnownTree();
    // reparent root to a non-existent id → becomes a second root
    const orphan = r({ id: "orphan", node_type: "group", name: "Orphan", parent_id: "ghost", sort_order: 99 });
    const { rows: ordered } = flattenTree([...rows, orphan]);
    expect(ordered[0]!.node.id).toBe("root");
    expect(ordered.map((o) => o.node.id)).toContain("orphan");
  });
});

describe("buildModelXlsx", () => {
  it("emits one row per node in depth-first order with header block", async () => {
    const { rows, currency } = buildKnownTree();
    const { ws } = await buildAndLoad({ modelName: "Demo model", currency, nodes: rows });
    // header block
    expect(String(ws.getCell("A1").value)).toContain("Demo model");
    expect(String(ws.getCell("A2").value)).toContain("USD");
    expect(ws.getCell("A3").value).toBeTruthy(); // grand-total row
    // 8 data rows starting at row 5
    const names: string[] = [];
    for (let i = 0; i < 8; i++) {
      names.push(String(ws.getCell(`B${5 + i}`).value));
    }
    expect(names).toEqual([
      "Should-cost",
      "Materials",
      "Steel",
      "Plastic",
      "Margin",
      "Margin line",
      "Logistics",
      "Allocation",
    ]);
  });

  it("line Amount formula contains ROUND( and the hidden minor-rate reference", async () => {
    const { rows, currency } = buildKnownTree();
    const { ws } = await buildAndLoad({ modelName: "M", currency, nodes: rows });
    // Steel is data row 3 → Excel row 7
    const steelAmt = ws.getCell("J7");
    expect(steelAmt.formula).toContain("ROUND(");
    // references the hidden minor-rate column (I) on the same row
    expect(steelAmt.formula).toMatch(/I7/);
    // cached result matches model (100.00)
    expect(steelAmt.result).toBeCloseTo(100, 2);
  });

  it("group Amount formula is SUM(...) of its child amount cells", async () => {
    const { rows, currency } = buildKnownTree();
    const { ws } = await buildAndLoad({ modelName: "M", currency, nodes: rows });
    // Materials group is data row 2 → Excel row 6; children Steel(7), Plastic(8)
    const matAmt = ws.getCell("J6");
    expect(matAmt.formula).toMatch(/^SUM\(/);
    expect(matAmt.formula).toContain("J7");
    expect(matAmt.formula).toContain("J8");
    // Root group (row 5) sums its three group children: Materials(6), Margin(9), Logistics(11)
    const rootAmt = ws.getCell("J5");
    expect(rootAmt.formula).toMatch(/^SUM\(/);
    expect(rootAmt.formula).toContain("J6");
    expect(rootAmt.formula).toContain("J9");
    expect(rootAmt.formula).toContain("J11");
  });

  it('emits a named-group percent formula for "5% of Materials"', async () => {
    const { rows, currency } = buildKnownTree();
    const { ws } = await buildAndLoad({ modelName: "M", currency, nodes: rows });
    // Allocation line is data row 8 → Excel row 12; references Materials group amount J6
    const allocAmt = ws.getCell("J12");
    expect(allocAmt.formula).toContain("ROUND(");
    expect(allocAmt.formula).toContain("5%");
    expect(allocAmt.formula).toContain("J6");
    expect(allocAmt.result).toBeCloseTo(6.5, 2); // fromMinor(650)
  });

  it('emits a bare-percent running-total formula for "10%" referencing prior top-level group cells', async () => {
    const { rows, currency } = buildKnownTree();
    const { ws } = await buildAndLoad({ modelName: "M", currency, nodes: rows });
    // Margin line is data row 6 → Excel row 10. Running total before it = Materials
    // group subtotal (prior top-level sibling of the Margin group) → J6.
    const margAmt = ws.getCell("J10");
    expect(margAmt.formula).toContain("ROUND(");
    expect(margAmt.formula).toContain("10%");
    expect(margAmt.formula).toContain("J6");
    expect(margAmt.result).toBeCloseTo(13, 2); // fromMinor(1300)
  });

  it("static Amount(model) column equals fromMinor(rollup.byNodeId) for every node", async () => {
    const { rows, currency } = buildKnownTree();
    const { ws, rollup } = await buildAndLoad({ modelName: "M", currency, nodes: rows });
    const { rows: ordered } = flattenTree(rows);
    for (const o of ordered) {
      const excelRow = 4 + o.rowNumber;
      const cell = ws.getCell(`K${excelRow}`);
      const expected = fromMinor(rollup.byNodeId[o.node.id] ?? 0, currency);
      expect(Number(cell.value)).toBeCloseTo(expected, 2);
    }
  });

  it("root group static value equals fromMinor(rollup.total)", async () => {
    const { rows, currency } = buildKnownTree();
    const { ws, rollup } = await buildAndLoad({ modelName: "M", currency, nodes: rows });
    // root is data row 1 → Excel row 5
    const rootStatic = ws.getCell("K5");
    expect(Number(rootStatic.value)).toBeCloseTo(fromMinor(rollup.total, currency), 2);
    // grand-total header cell (row 3) references the live root amount
    const totalCell = ws.getCell("B3");
    expect(totalCell.formula).toContain("J5");
  });

  it("hides the integer-minor rate column and stores minor values there", async () => {
    const { rows, currency } = buildKnownTree();
    const { ws } = await buildAndLoad({ modelName: "M", currency, nodes: rows });
    expect(ws.getColumn(9).hidden).toBe(true); // column I
    // Steel (row 7) minor rate = 5000
    expect(Number(ws.getCell("I7").value)).toBe(5000);
    // visible Rate (major) column G shows fromMinor
    expect(Number(ws.getCell("G7").value)).toBeCloseTo(50, 2);
  });

  it("treats an empty group as a SUM (mirrors rollupLive), not a qty*rate line", async () => {
    const rows: CostNodeRow[] = [
      r({ id: "root", node_type: "group", name: "Root", parent_id: null, sort_order: 0 }),
      r({ id: "empty", node_type: "group", name: "Empty", parent_id: "root", sort_order: 0 }),
    ];
    const { ws } = await buildAndLoad({ modelName: "M", currency: "USD", nodes: rows });
    // Empty group is data row 2 → Excel row 6. rollupLive gives it 0.
    const emptyAmt = ws.getCell("J6");
    expect(emptyAmt.value).toBe(0); // static 0, no line-formula ROUND
  });

  it("a line with a non-parseable formula emits a literal 0 Amount (matches rollupLive)", async () => {
    // rollupLive's evalFormula returns 0 for any formula that doesn't match its
    // percent regexes; the workbook must recompute to 0, not qty*rate.
    const rows: CostNodeRow[] = [
      r({ id: "root", node_type: "group", name: "Root", parent_id: null, sort_order: 0 }),
      r({
        id: "weird",
        parent_id: "root",
        name: "Weird",
        node_type: "line",
        formula: "abc",
        quantity: 2,
        rate: 5000,
        sort_order: 0,
      }),
    ];
    const { ws, rollup } = await buildAndLoad({ modelName: "M", currency: "USD", nodes: rows });
    expect(rollup.byNodeId["weird"]).toBe(0);
    // Weird is data row 2 → Excel row 6. Amount cell is a literal 0 (no ROUND formula).
    const amtCell = ws.getCell("J6");
    expect(amtCell.value).toBe(0);
    expect(amtCell.formula).toBeFalsy(); // literal cell, not a formula
    // static cross-check column is also 0
    expect(Number(ws.getCell("K6").value)).toBe(0);
  });

  it("named-group reference resolves to the most-recently COMPLETED group (post-order), matching rollupLive", async () => {
    // Two sibling groups both named "X": G1 then G2. G2 contains a line
    // "10% of X". rollupLive registers G1 in ctx.named only AFTER G1's subtree
    // completes; when G2's line evaluates, G2 has not completed yet, so the
    // reference resolves to G1.
    const rows: CostNodeRow[] = [
      r({ id: "root", node_type: "group", name: "Root", parent_id: null, sort_order: 0 }),
      r({ id: "g1", node_type: "group", name: "X", parent_id: "root", sort_order: 0 }),
      r({ id: "g1-line", parent_id: "g1", name: "G1 line", quantity: 1, rate: 100000, sort_order: 0 }),
      r({ id: "g2", node_type: "group", name: "X", parent_id: "root", sort_order: 1 }),
      r({
        id: "g2-line",
        parent_id: "g2",
        name: "G2 line",
        node_type: "line",
        formula: "10% of X",
        sort_order: 0,
      }),
    ];
    const tree = buildTree(rows);
    const rollup = rollupLive(tree);
    // g1 subtotal = 100000 minor; g2-line = 10% of G1 (100000) = 10000 minor
    expect(rollup.byNodeId["g1"]).toBe(100000);
    expect(rollup.byNodeId["g2-line"]).toBe(10000);

    const { ws } = await buildAndLoad({ modelName: "M", currency: "USD", nodes: rows });
    // Order: root(5), g1(6), g1-line(7), g2(8), g2-line(9).
    // g2-line's formula must reference G1's amount cell (J6), NOT G2's (J8).
    const g2LineCell = ws.getCell("J9");
    expect(g2LineCell.formula).toContain("ROUND(");
    expect(g2LineCell.formula).toContain("10%");
    expect(g2LineCell.formula).toContain("J6");
    expect(g2LineCell.formula).not.toContain("J8");
    // cached result = fromMinor(10000) = 100.00
    expect(g2LineCell.result).toBeCloseTo(fromMinor(10000, "USD"), 2);
  });

  it("multi-root model: grand-total cell is SUM of root amount cells and equals fromMinor(rollup.total)", async () => {
    const rows: CostNodeRow[] = [
      r({ id: "rootA", node_type: "group", name: "Root A", parent_id: null, sort_order: 0 }),
      r({ id: "a-line", parent_id: "rootA", name: "A line", quantity: 1, rate: 10000, sort_order: 0 }),
      r({ id: "rootB", node_type: "group", name: "Root B", parent_id: null, sort_order: 1 }),
      r({ id: "b-line", parent_id: "rootB", name: "B line", quantity: 1, rate: 25000, sort_order: 0 }),
    ];
    const { ws, rollup } = await buildAndLoad({ modelName: "M", currency: "USD", nodes: rows });
    // Order: rootA(5), a-line(6), rootB(7), b-line(8). Grand-total cell is B3.
    const totalCell = ws.getCell("B3");
    expect(totalCell.formula).toMatch(/^SUM\(/);
    expect(totalCell.formula).toContain("J5"); // rootA amount
    expect(totalCell.formula).toContain("J7"); // rootB amount
    // total = 10000 + 25000 = 35000 minor = 350.00
    expect(Number(totalCell.result)).toBeCloseTo(fromMinor(rollup.total, "USD"), 2);
  });
});

describe("buildModelXlsx rounding fidelity (fractional quantity)", () => {
  it("matches rollupLive to the cent on a fractional-qty tree (static cross-check)", async () => {
    // Slice of the OCTG seed: fractional steel billet (1.08 MT @ 650 → minor 65000)
    // plus a named-group overhead and a bare-percent margin.
    const rows: CostNodeRow[] = [
      r({ id: "root", node_type: "group", name: "OCTG", parent_id: null, sort_order: 0 }),
      r({ id: "mat", node_type: "group", name: "Material", parent_id: "root", sort_order: 0 }),
      r({ id: "steel", parent_id: "mat", name: "Steel billet (HRC)", quantity: 1.08, unit: "MT", rate: 65000, driver_name: "1.08 MT/MT yield", sort_order: 0 }),
      r({ id: "conv", node_type: "group", name: "Conversion", parent_id: "root", sort_order: 1 }),
      r({ id: "pr", parent_id: "conv", name: "Piercing & rolling", quantity: 1, rate: 28000, sort_order: 0 }),
      r({ id: "ht", parent_id: "conv", name: "Heat treatment", quantity: 1, rate: 15000, sort_order: 1 }),
      r({ id: "oh", node_type: "group", name: "Overhead", parent_id: "root", sort_order: 2 }),
      r({ id: "oh-line", parent_id: "oh", name: "Mfg overhead", node_type: "line", formula: "12% of Conversion", sort_order: 0 }),
      r({ id: "mar", node_type: "group", name: "Margin", parent_id: "root", sort_order: 3 }),
      r({ id: "mar-line", parent_id: "mar", name: "Supplier margin", node_type: "line", formula: "9% margin", sort_order: 0 }),
    ];
    const tree = buildTree(rows);
    const rollup = rollupLive(tree);

    // hand-computed expectations (minor): material 70200, conversion 43000,
    // overhead 12% of conversion → 5160, margin 9% of (70200+43000+5160=118360) → 10652 (rounded down)
    expect(rollup.byNodeId["mat"]).toBe(70200);
    expect(rollup.byNodeId["conv"]).toBe(43000);
    expect(rollup.byNodeId["oh"]).toBe(5160);
    expect(rollup.byNodeId["mar"]).toBe(Math.round(118360 * 9 / 100));

    const wb = await buildModelXlsx({ modelName: "OCTG", currency: "USD", nodes: rows, rollup });
    const buf = await wb.xlsx.writeBuffer();
    const wb2 = new Workbook();
    await wb2.xlsx.load(buf);
    const ws = wb2.getWorksheet("Should-cost")!;
    const { rows: ordered } = flattenTree(rows);

    // every static cross-check cell must equal fromMinor(rollup) exactly
    for (const o of ordered) {
      const excelRow = 4 + o.rowNumber;
      const cellVal = Number(ws.getCell(`K${excelRow}`).value);
      const expected = fromMinor(rollup.byNodeId[o.node.id] ?? 0, "USD");
      expect(cellVal).toBeCloseTo(expected, 2);
    }
    // root static = fromMinor(total)
    const rootStatic = Number(ws.getCell("K5").value);
    expect(rootStatic).toBeCloseTo(fromMinor(rollup.total, "USD"), 2);

    // the fractional line's live formula references the minor rate and ROUND
    const steelRow = 4 + ordered.find((o) => o.node.id === "steel")!.rowNumber;
    const steelFormula = ws.getCell(`J${steelRow}`).formula;
    expect(steelFormula).toContain("ROUND(");
    expect(steelFormula).toMatch(new RegExp(`I${steelRow}`));
    // bare-margin formula references the three prior top-level group cells
    const marLineRow = 4 + ordered.find((o) => o.node.id === "mar-line")!.rowNumber;
    const marFormula = ws.getCell(`J${marLineRow}`).formula;
    const matRow = 4 + ordered.find((o) => o.node.id === "mat")!.rowNumber;
    const convRow = 4 + ordered.find((o) => o.node.id === "conv")!.rowNumber;
    const ohRow = 4 + ordered.find((o) => o.node.id === "oh")!.rowNumber;
    expect(marFormula).toContain(`J${matRow}`);
    expect(marFormula).toContain(`J${convRow}`);
    expect(marFormula).toContain(`J${ohRow}`);
  });
});
