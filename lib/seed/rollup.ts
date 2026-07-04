import type { CbsGroup } from "@/lib/seed/schema";

type Ctx = {
  /** Totals (minor units) of already-evaluated sibling groups, keyed by lowercased name. */
  named: Record<string, number>;
  /** Running subtotal (minor units) of everything evaluated before the current node. */
  running: number;
};

/**
 * Rolls a CBS tree up to a total in integer minor units.
 *
 * Line values are `quantity * rate` (rate in currency units) converted to minor.
 * Formula lines are derived: "N% of <group>" applies N% to a named sibling
 * group's total; a bare "N%" / "N% margin" applies to the running subtotal.
 */
export function rollupCbs(root: CbsGroup): number {
  const ctx: Ctx = { named: {}, running: 0 };
  return evalNode(root, ctx);
}

function evalNode(node: CbsGroup, ctx: Ctx): number {
  if (node.node_type === "line" && (node.nodes?.length ?? 0) === 0) {
    if (node.formula) return evalFormula(node.formula, ctx);
    const qty = node.quantity ?? 1;
    const rate = node.rate ?? 0;
    return Math.round(qty * rate * 100);
  }

  // Group: sum children left-to-right, exposing each group's total to later siblings.
  let sum = 0;
  for (const child of node.nodes ?? []) {
    const value = evalNode(child, { named: ctx.named, running: ctx.running + sum });
    sum += value;
    if (child.node_type === "group") ctx.named[child.name.toLowerCase()] = value;
  }
  return sum;
}

function evalFormula(formula: string, ctx: Ctx): number {
  const ofMatch = formula.match(/([\d.]+)\s*%\s*of\s+([a-z&/ -]+)/i);
  if (ofMatch) {
    const pct = Number(ofMatch[1]);
    const ref = ofMatch[2]!.trim().toLowerCase();
    const base = ctx.named[ref] ?? ctx.running;
    return Math.round((base * pct) / 100);
  }
  const pctMatch = formula.match(/([\d.]+)\s*%/);
  if (pctMatch) {
    const pct = Number(pctMatch[1]);
    return Math.round((ctx.running * pct) / 100);
  }
  return 0;
}
