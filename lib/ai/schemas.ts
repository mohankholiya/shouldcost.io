import { z } from "zod";

/** A per-node AI suggestion: cost driver, unit, and a rate range with a short rationale. */
export const NodeSuggestionSchema = z.object({
  driver: z.string().min(1),
  unit: z.string().min(1),
  rate_low: z.number(),
  rate_high: z.number(),
  rationale: z.string().min(1),
});
export type NodeSuggestion = z.infer<typeof NodeSuggestionSchema>;

/** One node in an AI-drafted should-cost model. Rates are integer minor units. */
export const ModelDraftNodeSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  driver: z.string().min(1),
  quantity: z.number(),
  unit: z.string().min(1),
  rate_minor: z.number().int(),
  note: z.string(),
});
export type ModelDraftNode = z.infer<typeof ModelDraftNodeSchema>;

/** A full AI-drafted model: a name plus at least one cost node. */
export const ModelDraftSchema = z.object({
  name: z.string().min(1),
  nodes: z.array(ModelDraftNodeSchema).min(1),
});
export type ModelDraft = z.infer<typeof ModelDraftSchema>;
