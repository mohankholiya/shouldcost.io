import type { CostNodeRow, Rollup, TreeNode } from "@/lib/model/types";
import { buildTree } from "@/lib/model/tree";

export type CompRow = {
  nodeId: string;
  name: string;
  shouldCost: number;
  quoted: number | null;
  gap: number | null;
  gapPct: number | null;
};

export type Comparison = {
  rows: CompRow[];
  shouldCostTotal: number;
  quoteTotal: number;
  gapTotal: number;
  gapPct: number;
};

/** Minimal structural view of a quote this module needs; QuoteWithLines matches. */
export type QuoteInput = {
  quoted_total: number;
  lines: { cost_node_id: string | null; amount: number }[];
};

function pct(part: number, base: number): number | null {
  return base !== 0 ? (part / base) * 100 : null;
}

/** Leaf lines in tree (sort) order — a `line` node with no children. */
export function leafLines(nodes: CostNodeRow[]): CostNodeRow[] {
  const { roots } = buildTree(nodes);
  const out: CostNodeRow[] = [];
  const walk = (ns: TreeNode[]) =>
    ns.forEach((n) => {
      if (n.node_type === "line" && n.children.length === 0) out.push(n);
      walk(n.children);
    });
  walk(roots);
  return out;
}

export function buildComparison(
  nodes: CostNodeRow[],
  rollup: Rollup,
  quote: QuoteInput,
): Comparison {
  const quotedByNode = new Map<string, number>();
  for (const line of quote.lines) {
    if (!line.cost_node_id) continue;
    quotedByNode.set(line.cost_node_id, (quotedByNode.get(line.cost_node_id) ?? 0) + line.amount);
  }

  const rows: CompRow[] = leafLines(nodes).map((n) => {
    const shouldCost = rollup.byNodeId[n.id] ?? 0;
    const quoted = quotedByNode.has(n.id) ? quotedByNode.get(n.id)! : null;
    const gap = quoted === null ? null : quoted - shouldCost;
    return {
      nodeId: n.id,
      name: n.name,
      shouldCost,
      quoted,
      gap,
      gapPct: gap === null ? null : pct(gap, shouldCost),
    };
  });

  const shouldCostTotal = rollup.total;
  const quoteTotal = quote.quoted_total;
  const gapTotal = quoteTotal - shouldCostTotal;
  return { rows, shouldCostTotal, quoteTotal, gapTotal, gapPct: pct(gapTotal, shouldCostTotal) ?? 0 };
}
