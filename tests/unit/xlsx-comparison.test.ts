import { describe, it, expect } from "vitest";
import { Workbook } from "exceljs";
import { fromMinor } from "@/lib/money";
import type { Currency } from "@/components/number/currency-select";
import type { Comparison, CompRow } from "@/lib/model/comparison";
import { waterfallData } from "@/lib/model/waterfall";
import { evaluateInsights } from "@/lib/model/insights";
import { buildComparisonXlsx } from "@/lib/export/xlsx-comparison";

/**
 * Known Comparison fixture (all money integer minor units):
 *   Steel   — should 10000, quoted 13000 → gap +3000 (lever, +30%)
 *   Freight — should  5000, quoted  null → no quote
 *   Margin  — should  4000, quoted  3000 → gap -1000 (concede, -25%)
 *
 * Totals: shouldCost 19000, quote 16000, gap -3000, gapPct -15.79%
 */
const CURRENCY: Currency = "USD";

function row(o: Partial<CompRow> & Pick<CompRow, "nodeId" | "name" | "shouldCost">): CompRow {
  const quoted = o.quoted ?? null;
  const gap = quoted === null ? null : quoted - o.shouldCost;
  const gapPct = gap === null ? null : o.shouldCost !== 0 ? (gap / o.shouldCost) * 100 : null;
  return { quoted, gap, gapPct, ...o };
}

function buildFixture(): { comparison: Comparison } {
  const rows: CompRow[] = [
    row({ nodeId: "steel", name: "Steel", shouldCost: 10000, quoted: 13000 }),
    row({ nodeId: "freight", name: "Freight", shouldCost: 5000, quoted: null }),
    row({ nodeId: "margin", name: "Margin", shouldCost: 4000, quoted: 3000 }),
  ];
  const shouldCostTotal = 19000;
  const quoteTotal = 16000;
  const gapTotal = quoteTotal - shouldCostTotal;
  const comparison: Comparison = {
    rows,
    shouldCostTotal,
    quoteTotal,
    gapTotal,
    gapPct: (gapTotal / shouldCostTotal) * 100,
  };
  return { comparison };
}

async function buildAndLoad(modelName = "Demo", supplier = "Acme Steel Co") {
  const { comparison } = buildFixture();
  const waterfall = waterfallData(comparison);
  const insights = evaluateInsights(comparison, CURRENCY);
  const wb = buildComparisonXlsx({
    modelName,
    currency: CURRENCY,
    comparison,
    waterfall,
    insights,
    quoteSupplier: supplier,
  });
  const buf = await wb.xlsx.writeBuffer();
  const wb2 = new Workbook();
  await wb2.xlsx.load(buf);
  return { wb: wb2, comparison, insights, waterfall };
}

describe("buildComparisonXlsx", () => {
  it("creates a Comparison sheet with a header block", async () => {
    const { wb } = await buildAndLoad("My model", "Acme Steel Co");
    const ws = wb.getWorksheet("Comparison");
    expect(ws).toBeTruthy();
    // header block mentions model, supplier, currency somewhere in column A
    const colA: string[] = [];
    for (let i = 1; i <= 4; i++) colA.push(String(ws!.getCell(`A${i}`).value ?? ""));
    const blob = colA.join(" | ");
    expect(blob).toContain("My model");
    expect(blob).toContain("Acme Steel Co");
    expect(blob).toContain("USD");
  });

  it("emits one data row per CompRow plus a Total row", async () => {
    const { wb, comparison } = await buildAndLoad();
    const ws = wb.getWorksheet("Comparison")!;
    // data starts at row 6; column A (name)
    const names: string[] = [];
    for (let i = 0; i < comparison.rows.length; i++) {
      names.push(String(ws.getCell(`A${6 + i}`).value));
    }
    expect(names).toEqual(["Steel", "Freight", "Margin"]);
    // Total row immediately after the data
    const totalRow = 6 + comparison.rows.length;
    expect(String(ws.getCell(`A${totalRow}`).value)).toMatch(/total/i);
  });

  it("Should-cost cells equal fromMinor(shouldCost) for every row", async () => {
    const { wb, comparison } = await buildAndLoad();
    const ws = wb.getWorksheet("Comparison")!;
    comparison.rows.forEach((r, i) => {
      const cell = ws.getCell(`B${6 + i}`);
      expect(Number(cell.value)).toBeCloseTo(fromMinor(r.shouldCost, CURRENCY), 2);
    });
  });

  it("Quoted cell is fromMinor when present and blank when null", async () => {
    const { wb } = await buildAndLoad();
    const ws = wb.getWorksheet("Comparison")!;
    // Steel (row 6) quoted 13000 → 130.00
    expect(Number(ws.getCell("C6").value)).toBeCloseTo(130, 2);
    // Freight (row 7) has no quote → blank
    expect(ws.getCell("C7").value ?? null).toBeNull();
  });

  it("Gap and Gap% are live formulas for quoted rows", async () => {
    const { wb } = await buildAndLoad();
    const ws = wb.getWorksheet("Comparison")!;
    // Steel row 6: Gap = C6-B6, Gap% = IFERROR(D6/B6,0)
    expect(ws.getCell("D6").formula).toBe("C6-B6");
    expect(ws.getCell("E6").formula).toContain("IFERROR");
    expect(ws.getCell("E6").formula).toContain("D6");
    // cached results
    expect(Number(ws.getCell("D6").result)).toBeCloseTo(30, 2); // 130-100
  });

  it("does not emit Gap/Gap% formulas for a row with no quote", async () => {
    const { wb } = await buildAndLoad();
    const ws = wb.getWorksheet("Comparison")!;
    // Freight row 7 has null quote → no gap formula
    expect(ws.getCell("D7").formula).toBeFalsy();
    expect(ws.getCell("E7").formula).toBeFalsy();
  });

  it("Total row sums Should-cost/Quoted and computes Gap/Gap% as formulas", async () => {
    const { wb, comparison } = await buildAndLoad();
    const ws = wb.getWorksheet("Comparison")!;
    const t = 6 + comparison.rows.length; // total row
    expect(ws.getCell(`B${t}`).formula).toMatch(/^SUM\(/);
    expect(ws.getCell(`C${t}`).formula).toMatch(/^SUM\(/);
    expect(ws.getCell(`D${t}`).formula).toBe(`C${t}-B${t}`);
    expect(ws.getCell(`E${t}`).formula).toContain("IFERROR");
    // cached should-cost total = fromMinor(19000)
    expect(Number(ws.getCell(`B${t}`).result)).toBeCloseTo(fromMinor(comparison.shouldCostTotal, CURRENCY), 2);
  });

  it("creates an Insights sheet with one row per InsightCard", async () => {
    const { wb, insights } = await buildAndLoad();
    const ws = wb.getWorksheet("Insights");
    expect(ws).toBeTruthy();
    // header row 1 (Severity/Title/Detail), data from row 2
    let count = 0;
    for (let i = 0; i < insights.length; i++) {
      const sev = ws!.getCell(`A${2 + i}`).value;
      if (sev) count++;
    }
    expect(count).toBe(insights.length);
    // first insight is the headline
    expect(String(ws!.getCell("B2").value)).toContain(insights[0]!.title);
  });
});
