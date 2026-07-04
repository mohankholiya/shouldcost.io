"use server";
import { z } from "zod";
import { saveNodes, loadNodes } from "@/lib/db/nodes";
import { saveVersion } from "@/lib/db/versions";
import { createModel } from "@/lib/db/models";
import { getCurrentOrg } from "@/lib/db/orgs";
import { createServerClient } from "@/lib/supabase/server";

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

export async function instantiateModelAction(input: unknown) {
  const { projectId, name, templateSlug } = z
    .object({ projectId: z.string(), name: z.string(), templateSlug: z.string().optional() })
    .parse(input);
  const id = await createModel(projectId, name, templateSlug);
  return { id };
}
