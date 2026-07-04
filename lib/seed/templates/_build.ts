import type { CbsGroup } from "@/lib/seed/schema";

export type CategoryTemplate = {
  slug: string;
  industry: string;
  name: string;
  unit: string;
  description: string;
  practitioner_notes: string;
  is_public: boolean;
  draft: boolean;
  cbs_json: CbsGroup;
};

/** A concrete benchmark line: quantity * rate (rate in currency units). */
export const line = (
  name: string,
  quantity: number,
  rate: number,
  extra: Partial<CbsGroup> = {},
): CbsGroup => ({
  name,
  node_type: "line",
  quantity,
  rate,
  rate_source: "benchmark",
  nodes: [],
  ...extra,
});

/** A line whose rate seeds from a commodity index. */
export const idxLine = (
  name: string,
  quantity: number,
  rate: number,
  index_code: string,
  extra: Partial<CbsGroup> = {},
): CbsGroup => ({
  name,
  node_type: "line",
  quantity,
  rate,
  rate_source: "index",
  index_code,
  nodes: [],
  ...extra,
});

/** A derived line, e.g. "12% of conversion" or "9% margin". */
export const formula = (name: string, expr: string): CbsGroup => ({
  name,
  node_type: "line",
  formula: expr,
  nodes: [],
});

export const group = (name: string, nodes: CbsGroup[]): CbsGroup => ({
  name,
  node_type: "group",
  nodes,
});
