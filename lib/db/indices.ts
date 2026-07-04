import { createServerClient } from "@/lib/supabase/server";

export type IndexWithLatest = {
  id: string;
  code: string;
  name: string;
  unit: string;
  currency: string;
  latest: number;
};

/** All indices with their most recent value (latest of the 24-month series). */
export async function loadIndicesWithLatest(): Promise<IndexWithLatest[]> {
  const supabase = await createServerClient();
  const { data: indices } = await supabase
    .from("indices")
    .select("id, code, name, unit, currency")
    .order("code");
  const { data: values } = await supabase
    .from("index_values")
    .select("index_id, date, value")
    .order("date", { ascending: false });

  const latest = new Map<string, number>();
  for (const v of (values ?? []) as { index_id: string; value: number }[]) {
    if (!latest.has(v.index_id)) latest.set(v.index_id, v.value);
  }
  return ((indices ?? []) as Omit<IndexWithLatest, "latest">[]).map((i) => ({
    ...i,
    latest: latest.get(i.id) ?? 0,
  }));
}
