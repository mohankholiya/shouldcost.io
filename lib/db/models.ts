import { createServerClient } from "@/lib/supabase/server";
import { ALL_TEMPLATES } from "@/lib/seed/templates";
import type { CbsGroup } from "@/lib/seed/schema";
import type { CostNodeRow } from "@/lib/model/types";
import { toMinor } from "@/lib/money";

export type ModelHeader = {
  id: string;
  name: string;
  currency: string;
  project_id: string;
  status: string;
};

export async function loadModel(id: string): Promise<ModelHeader | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("cost_models")
    .select("id, name, currency, project_id, status")
    .eq("id", id)
    .maybeSingle();
  return (data as ModelHeader | null) ?? null;
}

export async function createModel(
  projectId: string,
  name: string,
  templateSlug?: string,
): Promise<string> {
  const supabase = await createServerClient();
  const template = templateSlug ? ALL_TEMPLATES.find((t) => t.slug === templateSlug) : undefined;

  const { data: model, error } = await supabase
    .from("cost_models")
    .insert({ project_id: projectId, name, currency: "USD", status: "draft" })
    .select("id")
    .single();
  if (error) throw error;
  const modelId = model!.id as string;

  if (template) {
    // Resolve index codes -> ids so bound lines link to real indices.
    const { data: indices } = await supabase.from("indices").select("id, code");
    const idByCode: Record<string, string> = {};
    for (const i of (indices ?? []) as { id: string; code: string }[]) idByCode[i.code] = i.id;

    const rows = templateToNodes(modelId, template.cbs_json, idByCode);
    const { error: nErr } = await supabase.from("cost_nodes").insert(rows);
    if (nErr) throw nErr;
  }
  return modelId;
}

/** Flatten a template CBS (rates in UNITS) into cost_nodes rows (rate in MINOR). */
export function templateToNodes(
  modelId: string,
  cbs: CbsGroup,
  indexIdByCode: Record<string, string> = {},
): CostNodeRow[] {
  const rows: CostNodeRow[] = [];
  const walk = (node: CbsGroup, parentId: string | null, order: number) => {
    const id = crypto.randomUUID();
    rows.push({
      id,
      model_id: modelId,
      parent_id: parentId,
      sort_order: order,
      name: node.name,
      node_type: node.node_type,
      driver_name: node.driver_name ?? null,
      quantity: node.quantity ?? (node.node_type === "line" ? 1 : null),
      unit: node.unit ?? null,
      rate:
        node.rate != null ? toMinor(node.rate, "USD") : node.node_type === "line" ? 0 : null,
      rate_source: node.rate_source ?? "manual",
      index_id: node.index_code ? (indexIdByCode[node.index_code] ?? null) : null,
      index_factor: node.index_factor ?? null,
      formula: node.formula ?? null,
      notes: node.notes ?? null,
    });
    (node.nodes ?? []).forEach((child, i) => walk(child, id, i));
  };
  walk(cbs, null, 0);
  return rows;
}

/** Count cost models in an org (via projects). Used by entitlement enforcement. */
export async function countModelsByOrg(orgId: string): Promise<number> {
  const supabase = await createServerClient();
  const projectIds =
    (await supabase.from("projects").select("id").eq("org_id", orgId)).data?.map(
      (p) => (p as { id: string }).id,
    ) ?? [];
  // Short-circuit before the count query: `.in("project_id", [])` is
  // PostgREST-version-dependent and can throw (rather than return zero
  // rows), which would make instantiateModelAction throw on a brand-new
  // Free user's FIRST model. Same guard pattern as lib/db/nodes.ts.
  if (!projectIds.length) return 0;
  const { count, error } = await supabase
    .from("cost_models")
    .select("id", { count: "exact", head: true })
    .in("project_id", projectIds);
  if (error) throw error;
  return count ?? 0;
}
