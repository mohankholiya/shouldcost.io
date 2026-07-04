import type { CostTree, Rollup, TreeNode } from "@/lib/model/types";

type Ctx = { named: Record<string, number>; running: number; by: Record<string, number> };

/**
 * Rolls a live CBS tree up to a total in integer minor units. `rate` is already
 * minor, so a line value is quantity * rate. Formula lines mirror the Phase 0
 * seed rollup: "N% of <group>" references a named sibling group's subtotal; a
 * bare "N%" / "N% margin" applies to the running subtotal before that group.
 */
export function rollupLive(tree: CostTree): Rollup {
  const ctx: Ctx = { named: {}, running: 0, by: {} };
  let total = 0;
  for (const node of tree.roots) {
    const v = evalNode(node, { named: ctx.named, running: total, by: ctx.by });
    total += v;
    if (node.node_type === "group") ctx.named[node.name.toLowerCase()] = v;
  }
  return { total, byNodeId: ctx.by };
}

function evalNode(node: TreeNode, ctx: Ctx): number {
  if (node.node_type === "line" && node.children.length === 0) {
    const value = node.formula
      ? evalFormula(node.formula, ctx)
      : Math.round((node.quantity ?? 1) * (node.rate ?? 0));
    ctx.by[node.id] = value;
    return value;
  }
  let sum = 0;
  for (const child of node.children) {
    const v = evalNode(child, { named: ctx.named, running: ctx.running + sum, by: ctx.by });
    sum += v;
    if (child.node_type === "group") ctx.named[child.name.toLowerCase()] = v;
  }
  ctx.by[node.id] = sum;
  return sum;
}

function evalFormula(formula: string, ctx: Ctx): number {
  const of = formula.match(/([\d.]+)\s*%\s*of\s+([a-z&/ -]+)/i);
  if (of) {
    const pct = Number(of[1]);
    const base = ctx.named[of[2]!.trim().toLowerCase()] ?? ctx.running;
    return Math.round((base * pct) / 100);
  }
  const p = formula.match(/([\d.]+)\s*%/);
  return p ? Math.round((ctx.running * Number(p[1])) / 100) : 0;
}
