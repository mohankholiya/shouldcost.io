import type { CostNodeRow, CostTree, TreeNode } from "@/lib/model/types";

export function buildTree(rows: CostNodeRow[]): CostTree {
  const byId = new Map<string, TreeNode>();
  for (const r of rows) byId.set(r.id, { ...r, children: [] });
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return { roots };
}

export function flattenTree(tree: CostTree): CostNodeRow[] {
  const out: CostNodeRow[] = [];
  const walk = (nodes: TreeNode[]) => {
    nodes.forEach((n, i) => {
      const { children, ...row } = n;
      out.push({ ...row, sort_order: i });
      walk(children);
    });
  };
  walk(tree.roots);
  return out;
}
