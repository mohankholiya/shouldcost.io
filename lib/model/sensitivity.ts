import type { CostTree, TreeNode } from "@/lib/model/types";
import { rollupLive } from "@/lib/model/rollup-live";

export type TornadoBar = {
  nodeId: string;
  name: string;
  low: number;
  high: number;
  swing: number;
};

/** For each concrete leaf driver, recompute the grand total at rate*(1±pct%) and rank by swing. */
export function tornado(tree: CostTree, pct = 10): TornadoBar[] {
  const leaves: TreeNode[] = [];
  const collect = (nodes: TreeNode[]) =>
    nodes.forEach((n) => {
      if (n.node_type === "line" && n.rate != null && !n.formula) leaves.push(n);
      collect(n.children);
    });
  collect(tree.roots);

  const bars = leaves.map((leaf) => {
    const base = leaf.rate ?? 0;
    const low = totalWithRate(tree, leaf.id, Math.round(base * (1 - pct / 100)));
    const high = totalWithRate(tree, leaf.id, Math.round(base * (1 + pct / 100)));
    return { nodeId: leaf.id, name: leaf.name, low, high, swing: Math.abs(high - low) };
  });
  return bars.sort((a, b) => b.swing - a.swing);
}

function totalWithRate(tree: CostTree, nodeId: string, rate: number): number {
  const clone: CostTree = structuredClone(tree);
  const patch = (nodes: TreeNode[]) =>
    nodes.forEach((n) => {
      if (n.id === nodeId) n.rate = rate;
      patch(n.children);
    });
  patch(clone.roots);
  return rollupLive(clone).total;
}
