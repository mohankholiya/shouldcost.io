"use server";
import { z } from "zod";
import { saveNodes, loadNodes } from "@/lib/db/nodes";
import { saveVersion } from "@/lib/db/versions";
import { createModel, countModelsByOrg } from "@/lib/db/models";
import { getCurrentOrg } from "@/lib/db/orgs";
import { createServerClient } from "@/lib/supabase/server";
import { resolveEffectivePlan, canCreateModel, canUseTemplate } from "@/lib/entitlements";
import { findActiveSubscriptionByOrg, toSnapshot } from "@/lib/db/subscriptions";
import { ModelDraftSchema } from "@/lib/ai/schemas";
import type { CostNodeRow } from "@/lib/model/types";

export async function createProjectAction(input: unknown) {
  const { name } = z.object({ name: z.string().min(1) }).parse(input);
  const org = await getCurrentOrg();
  if (!org) throw new Error("No organization for the current user");
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ org_id: org.org_id, name })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data!.id as string };
}

const NodeSchema = z.object({
  id: z.string(),
  model_id: z.string(),
  parent_id: z.string().nullable(),
  sort_order: z.number(),
  name: z.string(),
  node_type: z.enum(["group", "line"]),
  driver_name: z.string().nullable(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  rate: z.number().int().nullable(),
  rate_source: z.enum(["manual", "index", "benchmark"]),
  index_id: z.string().nullable(),
  index_factor: z.number().nullable(),
  formula: z.string().nullable(),
  notes: z.string().nullable(),
});

export async function saveNodesAction(input: unknown) {
  const { modelId, changed, deleted } = z
    .object({
      modelId: z.string(),
      changed: z.array(NodeSchema),
      deleted: z.array(z.string()),
    })
    .parse(input);
  await saveNodes(modelId, changed, deleted);
  return { ok: true as const };
}

export async function saveVersionAction(input: unknown) {
  const { modelId, note, total } = z
    .object({ modelId: z.string(), note: z.string().default(""), total: z.number().int() })
    .parse(input);
  const snapshot = await loadNodes(modelId);
  const version_no = await saveVersion(modelId, snapshot, total, note);
  return { version_no };
}

export type InstantiateResult =
  | { id: string }
  | { error: "MODELS_EXCEEDED" | "TEMPLATE_LOCKED"; requiredPlan: "pro" | "team" };

export async function instantiateModelAction(input: unknown): Promise<InstantiateResult> {
  const { projectId, name, templateSlug } = z
    .object({ projectId: z.string(), name: z.string(), templateSlug: z.string().optional() })
    .parse(input);

  const org = await getCurrentOrg();
  if (!org?.organizations) throw new Error("No organization for the current user");
  const isDemo = Boolean(org.organizations.is_demo);
  const sub = await findActiveSubscriptionByOrg(org.org_id);
  const plan = resolveEffectivePlan({ subscription: toSnapshot(sub), isDemo });

  if (templateSlug && !canUseTemplate(plan, templateSlug)) {
    return { error: "TEMPLATE_LOCKED", requiredPlan: "pro" };
  }
  const count = await countModelsByOrg(org.org_id);
  if (!canCreateModel(plan, count)) {
    return { error: "MODELS_EXCEEDED", requiredPlan: "pro" };
  }

  const id = await createModel(projectId, name, templateSlug);
  return { id };
}

/**
 * Create a model from an AI-generated draft: reuses createModel + saveNodes so there is
 * one insert path. Node ids are generated server-side; every line is flagged as an AI
 * estimate for the user to verify.
 */
export async function createModelFromDraftAction(input: unknown): Promise<InstantiateResult> {
  const { projectId, draft } = z
    .object({ projectId: z.string(), draft: ModelDraftSchema })
    .parse(input);

  const org = await getCurrentOrg();
  if (!org?.organizations) throw new Error("No organization for the current user");
  const isDemo = Boolean(org.organizations.is_demo);
  const sub = await findActiveSubscriptionByOrg(org.org_id);
  const plan = resolveEffectivePlan({ subscription: toSnapshot(sub), isDemo });
  const count = await countModelsByOrg(org.org_id);
  if (!canCreateModel(plan, count)) {
    return { error: "MODELS_EXCEEDED", requiredPlan: "pro" };
  }

  const modelId = await createModel(projectId, draft.name);
  const rows: CostNodeRow[] = draft.nodes.map((n, i) => ({
    id: crypto.randomUUID(),
    model_id: modelId,
    parent_id: null,
    sort_order: i,
    name: n.name,
    node_type: "line",
    driver_name: n.driver,
    quantity: n.quantity,
    unit: n.unit,
    rate: Math.round(n.rate_minor),
    rate_source: "manual",
    index_id: null,
    index_factor: null,
    formula: null,
    notes: n.note ? `AI estimate — verify. ${n.note}` : "AI estimate — verify.",
  }));
  await saveNodes(modelId, rows, []);
  return { id: modelId };
}
