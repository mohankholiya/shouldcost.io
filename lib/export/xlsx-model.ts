import "server-only";
import { Workbook } from "exceljs";
import type { CostNodeRow, Rollup } from "@/lib/model/types";
import { fromMinor } from "@/lib/money";
import type { Currency } from "@/components/number/currency-select";
import {
  flattenTree,
  runningTotalBefore,
  ROOT_PARENT,
  type CellAddressMap,
  type OrderedRow,
} from "@/lib/export/excel-layout";

/**
 * Build an in-memory XLSX workbook for a should-cost model so a buyer can open
 * it in Excel, edit a driver (qty/rate), and watch the cost breakdown recompute
 * via LIVE formulas. Money is integer minor units end-to-end; worksheet money
 * cells are major units via `fromMinor`. The rollup is provided by the caller
 * (`rollupLive`) — this builder never recomputes model math; it only mirrors
 * `rollupLive`'s semantics as Excel formulas and writes a static
 * "Amount (model)" cross-check column from the rollup.
 *
 * `exceljs` does not evaluate formulas in Node — Excel computes on open. Live
 * correctness is therefore covered by (a) the formula-string unit tests and
 * (b) the static cross-check column, which equals `fromMinor(rollup.byNodeId)`
 * for every row and `fromMinor(rollup.total)` for the root.
 */

export interface BuildModelXlsxInput {
  modelName: string;
  currency: Currency;
  nodes: CostNodeRow[];
  /** Pre-computed via `rollupLive(buildTree(nodes))` — never recomputed here. */
  rollup: Rollup;
}

// Worksheet column layout (1-based).
const COL = {
  level: 1,
  name: 2,
  type: 3,
  driver: 4,
  qty: 5,
  unit: 6,
  rateMajor: 7, // visible, major units
  formulaText: 8,
  rateMinor: 9, // HIDDEN — integer minor units; feeds Amount
  amountLive: 10, // live = formula
  amountModel: 11, // static cross-check
} as const;

const HEADER_ROWS = 4; // model name, currency, grand total, column headers
const SHEET_NAME = "Should-cost";
const MONEY_FMT = "#,##0.00";

/** Convert a 1-based column index to an Excel column letter (1 → "A"). */
function colLetter(col: number): string {
  let s = "";
  let n = col;
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function buildModelXlsx(input: BuildModelXlsxInput): Workbook {
  const { modelName, currency, nodes, rollup } = input;
  const { rows, address } = flattenTree(nodes);

  const nodesById = new Map<string, CostNodeRow>();
  for (const n of nodes) nodesById.set(n.id, n);

  const wb = new Workbook();
  const ws = wb.addWorksheet(SHEET_NAME);

  // header block
  ws.getCell("A1").value = `Model: ${modelName}`;
  ws.getCell("A2").value = `Currency: ${currency}`;
  ws.getCell("A3").value = "Grand total";

  // column headers (row 4)
  const headers = [
    "Level",
    "Name",
    "Type",
    "Driver",
    "Qty",
    "Unit",
    "Rate",
    "Formula",
    "Rate (minor)", // hidden column — kept for traceability
    "Amount",
    "Amount (model)",
  ];
  headers.forEach((h, i) => {
    ws.getCell(HEADER_ROWS, i + 1).value = h;
  });

  // hide the integer-minor rate column
  ws.getColumn(COL.rateMinor).hidden = true;

  // address helpers — absolute Excel row = HEADER_ROWS + rowNumber (rowNumber is 1-based)
  const rowByNodeId = new Map<string, OrderedRow>();
  for (const o of rows) rowByNodeId.set(o.node.id, o);
  const xRow = (id: string) => rowByNodeId.get(id) ?? rows[0]!;
  const excelRow = (id: string) => HEADER_ROWS + xRow(id).rowNumber;
  const cellRef = (id: string, col: number) => `${colLetter(col)}${excelRow(id)}`;
  const amountCell = (id: string) => cellRef(id, COL.amountLive);

  // Grand-total cell references the root amount(s). Single root → direct ref;
  // multiple roots → SUM of root amount cells (mirrors rollupLive total).
  const rootIds = address.childrenOf(ROOT_PARENT);
  const totalRef =
    rootIds.length === 1
      ? amountCell(rootIds[0]!)
      : rootIds.length > 1
        ? `SUM(${rootIds.map(amountCell).join(",")})`
        : "0";
  ws.getCell("B3").value = { formula: totalRef, result: fromMinor(rollup.total, currency) };
  ws.getCell("B3").numFmt = MONEY_FMT;

  // data rows
  for (const o of rows) {
    const { node } = o;
    const row = HEADER_ROWS + o.rowNumber;
    const childIds = address.childrenOf(node.id);
    // rollupLive evaluates a node as a line iff node_type === "line" && no
    // children; everything else (groups, including empty ones) is a SUM.
    const isLine = node.node_type === "line" && childIds.length === 0;
    const hasFormula = typeof node.formula === "string" && node.formula.trim().length > 0;

    ws.getCell(row, COL.level).value = o.level;
    ws.getCell(row, COL.name).value = node.name;
    ws.getCell(row, COL.type).value = node.node_type;
    ws.getCell(row, COL.driver).value = node.driver_name ?? null;
    ws.getCell(row, COL.qty).value = node.quantity ?? null;
    ws.getCell(row, COL.unit).value = node.unit ?? null;

    // visible Rate (major) + hidden minor rate
    const rateMinor = node.rate ?? 0;
    ws.getCell(row, COL.rateMajor).value = fromMinor(rateMinor, currency);
    ws.getCell(row, COL.rateMajor).numFmt = MONEY_FMT;
    ws.getCell(row, COL.rateMinor).value = rateMinor;

    // Formula text (human-readable driver)
    ws.getCell(row, COL.formulaText).value = node.formula ?? null;

    const modelMinor = rollup.byNodeId[node.id] ?? 0;
    const modelMajor = fromMinor(modelMinor, currency);

    // Amount (live) — mirrors rollupLive semantics as an Excel formula.
    const amountFormula = buildAmountFormula({
      nodeId: node.id,
      node,
      isLine,
      hasFormula,
      address,
      amountCell,
      cellRef,
      nodesById,
    });
    const amountCellObj = ws.getCell(row, COL.amountLive);
    if (amountFormula === "0") {
      // empty group — nothing to compute; write a literal 0
      amountCellObj.value = 0;
    } else {
      amountCellObj.value = {
        formula: amountFormula,
        result: modelMajor, // cached so apps show a value before recompute
      };
    }
    amountCellObj.numFmt = MONEY_FMT;

    // Amount (model) — static cross-check from the caller's rollup
    ws.getCell(row, COL.amountModel).value = modelMajor;
    ws.getCell(row, COL.amountModel).numFmt = MONEY_FMT;
  }

  // light readability: widen the name column, freeze the header
  ws.getColumn(COL.name).width = 32;
  ws.getColumn(COL.formulaText).width = 24;
  ws.views = [{ state: "frozen", ySplit: HEADER_ROWS }];

  return wb;
}

interface FormulaCtx {
  nodeId: string;
  node: CostNodeRow;
  isLine: boolean;
  hasFormula: boolean;
  address: CellAddressMap;
  amountCell: (id: string) => string;
  cellRef: (id: string, col: number) => string;
  nodesById: Map<string, CostNodeRow>;
}

/**
 * Generate the live Amount formula for a node, faithfully mirroring
 * `rollupLive` (lib/model/rollup-live.ts):
 *   - line without formula  → `ROUND(qty*<rateMinor>,0)/100`
 *   - line with "N% of <g>" → `ROUND(N%*<namedGroupAmount>,2)`
 *   - line with bare "N%"   → `ROUND(N%*SUM(<runningTotalBefore>),2)`
 *   - group / branch        → `SUM(<child amount cells>)` (0 when empty)
 *
 * Line formulas convert the hidden integer-minor rate to major (`/100`).
 * Percent formulas operate on already-major amount cells, so they round to 2
 * decimals — the major-unit equivalent of `Math.round(minor*pct/100)` — which
 * matches `rollupLive` to the cent for all supported (2-decimal) currencies.
 */
function buildAmountFormula(ctx: FormulaCtx): string {
  const { nodeId, node, isLine, hasFormula, address, amountCell, cellRef } = ctx;

  if (!isLine) {
    const kids = address.childrenOf(nodeId);
    return kids.length === 0 ? "0" : `SUM(${kids.map(amountCell).join(",")})`;
  }

  if (hasFormula && node.formula) {
    const parsed = parsePercentFormula(node.formula);
    if (parsed) {
      const pct = trimNumber(parsed.percent);
      if (parsed.namedGroup) {
        const groupId = resolveNamedGroup(parsed.namedGroup, nodeId, address, ctx.nodesById);
        if (groupId) {
          return `ROUND(${pct}%*${amountCell(groupId)},2)`;
        }
        // fallback: running total (mirrors rollupLive `?? ctx.running`)
        const rt = runningTotalBefore(nodeId, address, amountCell);
        return `ROUND(${pct}%*SUM(${rt.join(",") || "0"}),2)`;
      }
      // bare percent — running total before this node
      const rt = runningTotalBefore(nodeId, address, amountCell);
      return `ROUND(${pct}%*SUM(${rt.join(",") || "0"}),2)`;
    }
  }

  // plain line: qty * minor-rate, converted to major
  const qty = node.quantity ?? 1;
  return `ROUND(${trimNumber(qty)}*${cellRef(nodeId, COL.rateMinor)},0)/100`;
}

interface ParsedPercent {
  percent: number;
  namedGroup: string | null;
}

/** Parse `formula` using `rollupLive`'s own regex semantics. */
function parsePercentFormula(formula: string): ParsedPercent | null {
  const of = formula.match(/([\d.]+)\s*%\s*of\s+(.+)/i);
  if (of) {
    const percent = Number(of[1]);
    if (Number.isFinite(percent)) return { percent, namedGroup: of[2]!.trim() };
  }
  const p = formula.match(/([\d.]+)\s*%/);
  if (p) {
    const percent = Number(p[1]);
    if (Number.isFinite(percent)) return { percent, namedGroup: null };
  }
  return null;
}

/**
 * Resolve a named-group reference (lowercased-name match, mirroring
 * `rollupLive`'s `ctx.named`) to the most-recently-evaluated group before
 * `fromId`. Returns the group's node id, or null if no match.
 */
function resolveNamedGroup(
  name: string,
  fromId: string,
  address: CellAddressMap,
  nodesById: Map<string, CostNodeRow>,
): string | null {
  const needle = name.toLowerCase();
  let matched: string | null = null;
  for (const id of address.order) {
    if (id === fromId) break;
    const node = nodesById.get(id);
    if (node && node.node_type === "group" && node.name.toLowerCase() === needle) {
      matched = id;
    }
  }
  return matched;
}

/** Render a number for an Excel formula without trailing `.0` / decimals. */
function trimNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toFixed(6)));
}
