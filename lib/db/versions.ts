import { createServerClient } from "@/lib/supabase/server";
import type { CostNodeRow } from "@/lib/model/types";

export type ModelVersion = {
  id: string;
  version_no: number;
  total_cost: number;
  note: string | null;
  created_at: string;
  snapshot_json: CostNodeRow[];
};

export async function saveVersion(
  modelId: string,
  snapshot: CostNodeRow[],
  total: number,
  note: string,
): Promise<number> {
  const supabase = await createServerClient();
  const { data: last } = await supabase
    .from("model_versions")
    .select("version_no")
    .eq("model_id", modelId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const version_no = ((last?.version_no as number | undefined) ?? 0) + 1;
  const { error } = await supabase.from("model_versions").insert({
    model_id: modelId,
    version_no,
    snapshot_json: snapshot,
    total_cost: total,
    note,
  });
  if (error) throw error;
  return version_no;
}

export async function loadVersions(modelId: string): Promise<ModelVersion[]> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("model_versions")
    .select("id, version_no, total_cost, note, created_at, snapshot_json")
    .eq("model_id", modelId)
    .order("version_no", { ascending: false });
  return (data ?? []) as ModelVersion[];
}
