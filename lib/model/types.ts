export type NodeType = "group" | "line";
export type RateSource = "manual" | "index" | "benchmark";

/** Mirrors a public.cost_nodes row. `rate` is integer minor units. */
export type CostNodeRow = {
  id: string;
  model_id: string;
  parent_id: string | null;
  sort_order: number;
  name: string;
  node_type: NodeType;
  driver_name: string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null; // minor units
  rate_source: RateSource;
  index_id: string | null;
  index_factor: number | null;
  formula: string | null;
  notes: string | null;
};

export type TreeNode = CostNodeRow & { children: TreeNode[] };
export type CostTree = { roots: TreeNode[] };

/** Result of a rollup: grand total + per-node subtotal, both minor units. */
export type Rollup = { total: number; byNodeId: Record<string, number> };
