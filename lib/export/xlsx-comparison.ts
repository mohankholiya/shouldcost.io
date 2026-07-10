import "server-only";
import { Workbook } from "exceljs";
import { fromMinor } from "@/lib/money";
import type { Currency } from "@/components/number/currency-select";
import type { Comparison } from "@/lib/model/comparison";
import type { WaterfallBar } from "@/lib/model/waterfall";
import type { InsightCard } from "@/lib/model/insights";

/**
 * Build an in-memory XLSX workbook comparing a should-cost model to a supplier
 * quote so a buyer can walk into a negotiation with the matrix, the running
 * bridge, and the insight callouts in one file. Money is integer minor units in
 * (`comparison`, `waterfall`), major units out via `fromMinor`. Gap and Gap%
 * are LIVE Excel formulas over the Should-cost/Quoted cells — edit a quoted
 * figure in Excel and the gap recomputes — mirroring `buildComparison`
 * (gap = quoted − shouldCost; gapPct = gap / shouldCost). This builder never
 * recomputes the comparison; it renders what `buildComparison` produced.
 *
 * `exceljs` does not evaluate formulas in Node — Excel computes on open — so the
 * formula cells carry a cached `result` for viewers that show a value pre-recompute.
 */

export interface BuildComparisonXlsxInput {
  modelName: string;
  currency: Currency;
  comparison: Comparison;
  waterfall: WaterfallBar[];
  insights: InsightCard[];
  quoteSupplier: string;
}

// "Comparison" sheet columns (1-based).
const COL = {
  name: 1, // A
  shouldCost: 2, // B
  quoted: 3, // C
  gap: 4, // D
  gapPct: 5, // E
} as const;

const HEADER_ROWS = 5; // 4 info rows + 1 column-header row; data begins at row 6
const DATA_START = HEADER_ROWS + 1;
const MONEY_FMT = "#,##0.00";
const PCT_FMT = "0.0%";

export function buildComparisonXlsx(input: BuildComparisonXlsxInput): Workbook {
  const { modelName, currency, comparison, waterfall, insights, quoteSupplier } = input;
  const wb = new Workbook();

  buildComparisonSheet(wb, { modelName, currency, comparison, quoteSupplier });
  buildWaterfallSheet(wb, { currency, waterfall });
  buildInsightsSheet(wb, insights);

  return wb;
}

function buildComparisonSheet(
  wb: Workbook,
  args: { modelName: string; currency: Currency; comparison: Comparison; quoteSupplier: string },
): void {
  const { modelName, currency, comparison, quoteSupplier } = args;
  const ws = wb.addWorksheet("Comparison");

  const dataEnd = DATA_START + comparison.rows.length - 1;
  const totalRow = dataEnd + 1;

  // Header block (rows 1-3 info; row 4 headline gap; row 5 column headers).
  ws.getCell("A1").value = `Model: ${modelName}`;
  ws.getCell("A2").value = `Supplier: ${quoteSupplier}`;
  ws.getCell("A3").value = `Currency: ${currency}`;
  ws.getCell("A4").value = "Headline gap";
  // Headline gap references the Total row so it stays live if quotes are edited.
  const gapResult = fromMinor(comparison.gapTotal, currency);
  ws.getCell("B4").value = { formula: `D${totalRow}`, result: gapResult };
  ws.getCell("B4").numFmt = MONEY_FMT;
  ws.getCell("C4").value = { formula: `E${totalRow}`, result: comparison.gapPct / 100 };
  ws.getCell("C4").numFmt = PCT_FMT;

  // Column headers.
  const headers = ["Name", "Should-cost", "Quoted", "Gap", "Gap %"];
  headers.forEach((h, i) => {
    ws.getCell(HEADER_ROWS, i + 1).value = h;
  });

  // Data rows — one per CompRow.
  comparison.rows.forEach((r, i) => {
    const row = DATA_START + i;
    ws.getCell(row, COL.name).value = r.name;

    const shouldMajor = fromMinor(r.shouldCost, currency);
    ws.getCell(row, COL.shouldCost).value = shouldMajor;
    ws.getCell(row, COL.shouldCost).numFmt = MONEY_FMT;

    if (r.quoted === null) {
      // No quote for this line — leave Quoted/Gap/Gap% blank (mirrors gap === null).
      ws.getCell(row, COL.quoted).value = null;
      return;
    }

    ws.getCell(row, COL.quoted).value = fromMinor(r.quoted, currency);
    ws.getCell(row, COL.quoted).numFmt = MONEY_FMT;

    // Gap = Quoted − Should-cost (live).
    ws.getCell(row, COL.gap).value = {
      formula: `C${row}-B${row}`,
      result: fromMinor(r.gap ?? 0, currency),
    };
    ws.getCell(row, COL.gap).numFmt = MONEY_FMT;

    // Gap % = Gap / Should-cost, guarded against divide-by-zero.
    ws.getCell(row, COL.gapPct).value = {
      formula: `IFERROR(D${row}/B${row},0)`,
      result: (r.gapPct ?? 0) / 100,
    };
    ws.getCell(row, COL.gapPct).numFmt = PCT_FMT;
  });

  // Total row — SUM of the money columns; Gap/Gap% derived from those sums so
  // the totals stay consistent with the model (blank Quoted cells count as 0 in
  // SUM, matching quoteTotal which only sums quoted lines).
  ws.getCell(totalRow, COL.name).value = "Total";
  ws.getCell(totalRow, COL.shouldCost).value = {
    formula: `SUM(B${DATA_START}:B${dataEnd})`,
    result: fromMinor(comparison.shouldCostTotal, currency),
  };
  ws.getCell(totalRow, COL.shouldCost).numFmt = MONEY_FMT;
  ws.getCell(totalRow, COL.quoted).value = {
    formula: `SUM(C${DATA_START}:C${dataEnd})`,
    result: fromMinor(comparison.quoteTotal, currency),
  };
  ws.getCell(totalRow, COL.quoted).numFmt = MONEY_FMT;
  ws.getCell(totalRow, COL.gap).value = {
    formula: `C${totalRow}-B${totalRow}`,
    result: fromMinor(comparison.gapTotal, currency),
  };
  ws.getCell(totalRow, COL.gap).numFmt = MONEY_FMT;
  ws.getCell(totalRow, COL.gapPct).value = {
    formula: `IFERROR(D${totalRow}/B${totalRow},0)`,
    result: comparison.gapPct / 100,
  };
  ws.getCell(totalRow, COL.gapPct).numFmt = PCT_FMT;

  ws.getColumn(COL.name).width = 32;
  ws.views = [{ state: "frozen", ySplit: HEADER_ROWS }];
}

/**
 * "Waterfall" sheet — the should-cost → quote bridge as a table (label / delta /
 * cumulative / kind). `@react-pdf`/Recharts charts don't belong in a spreadsheet;
 * the table carries the same negotiation signal and lets Excel users chart it.
 */
function buildWaterfallSheet(
  wb: Workbook,
  args: { currency: Currency; waterfall: WaterfallBar[] },
): void {
  const { currency, waterfall } = args;
  const ws = wb.addWorksheet("Waterfall");

  const headers = ["Step", "Delta", "Cumulative", "Kind"];
  headers.forEach((h, i) => {
    ws.getCell(1, i + 1).value = h;
  });

  waterfall.forEach((bar, i) => {
    const row = 2 + i;
    ws.getCell(row, 1).value = bar.label;
    ws.getCell(row, 2).value = fromMinor(bar.delta, currency);
    ws.getCell(row, 2).numFmt = MONEY_FMT;
    ws.getCell(row, 3).value = fromMinor(bar.cumulative, currency);
    ws.getCell(row, 3).numFmt = MONEY_FMT;
    ws.getCell(row, 4).value = bar.kind;
  });

  ws.getColumn(1).width = 28;
}

/** "Insights" sheet — one row per InsightCard (severity / title / detail). */
function buildInsightsSheet(wb: Workbook, insights: InsightCard[]): void {
  const ws = wb.addWorksheet("Insights");

  const headers = ["Severity", "Title", "Detail"];
  headers.forEach((h, i) => {
    ws.getCell(1, i + 1).value = h;
  });

  insights.forEach((card, i) => {
    const row = 2 + i;
    ws.getCell(row, 1).value = card.severity;
    ws.getCell(row, 2).value = card.title;
    ws.getCell(row, 3).value = card.detail;
  });

  ws.getColumn(2).width = 40;
  ws.getColumn(3).width = 60;
}
