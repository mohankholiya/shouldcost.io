import { z } from "zod";

/**
 * A CBS node. `rate` is expressed in currency UNITS (e.g. USD/MT), not minor
 * units — the rollup converts to integer minor units. `formula` lines carry no
 * rate; their value is derived (e.g. "12% of conversion", "9% margin").
 */
export const CbsNode: z.ZodType<CbsGroup> = z.lazy(() =>
  z.object({
    name: z.string(),
    node_type: z.enum(["group", "line"]),
    driver_name: z.string().optional(),
    quantity: z.number().optional(),
    unit: z.string().optional(),
    rate: z.number().optional(),
    rate_source: z.enum(["manual", "index", "benchmark"]).optional(),
    index_code: z.string().optional(),
    index_factor: z.number().optional(),
    formula: z.string().optional(),
    notes: z.string().optional(),
    nodes: z.array(CbsNode).default([]),
  }),
);

export type CbsGroup = {
  name: string;
  node_type: "group" | "line";
  driver_name?: string;
  quantity?: number;
  unit?: string;
  rate?: number;
  rate_source?: "manual" | "index" | "benchmark";
  index_code?: string;
  index_factor?: number;
  formula?: string;
  notes?: string;
  nodes: CbsGroup[];
};
