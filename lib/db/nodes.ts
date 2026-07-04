import { createServerClient } from "@/lib/supabase/server";
import type { CostNodeRow } from "@/lib/model/types";

export async function loadNodes(modelId: string): Promise<CostNodeRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("cost_nodes")
    .select("*")
    .eq("model_id", modelId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as CostNodeRow[];
}

export async function saveNodes(
  modelId: string,
  changed: CostNodeRow[],
  deleted: string[],
): Promise<void> {
  const supabase = await createServerClient();
  if (deleted.length) {
    const { error } = await supabase.from("cost_nodes").delete().in("id", deleted);
    if (error) throw error;
  }
  if (changed.length) {
    const rows = changed.map((c) => ({ ...c, model_id: modelId }));
    const { error } = await supabase.from("cost_nodes").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }
}
