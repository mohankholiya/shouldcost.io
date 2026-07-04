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

export type SeriesPoint = { date: string; value: number };
export type IndexWithSeries = IndexWithLatest & { series: SeriesPoint[] };

/** All indices with their full ascending 24-month series (for hub sparklines). */
export async function loadIndicesWithSeries(): Promise<IndexWithSeries[]> {
  const supabase = await createServerClient();
  const { data: indices } = await supabase
    .from("indices")
    .select("id, code, name, unit, currency")
    .order("code");
  const { data: values } = await supabase
    .from("index_values")
    .select("index_id, date, value")
    .order("date", { ascending: true });

  const byIndex = new Map<string, SeriesPoint[]>();
  for (const v of (values ?? []) as { index_id: string; date: string; value: number }[]) {
    if (!byIndex.has(v.index_id)) byIndex.set(v.index_id, []);
    byIndex.get(v.index_id)!.push({ date: v.date, value: v.value });
  }
  return ((indices ?? []) as Omit<IndexWithLatest, "latest">[]).map((i) => {
    const series = byIndex.get(i.id) ?? [];
    return { ...i, series, latest: series.at(-1)?.value ?? 0 };
  });
}

export type IndexDetail = IndexWithSeries & {
  source_note: string | null;
  region: string | null;
  usedBy: { modelId: string; modelName: string }[];
};

/** One index by code, with its series and the caller's models that bind it (RLS-scoped). */
export async function loadIndexByCode(code: string): Promise<IndexDetail | null> {
  const supabase = await createServerClient();
  const { data: index } = await supabase
    .from("indices")
    .select("id, code, name, unit, currency, source_note, region")
    .eq("code", code)
    .maybeSingle();
  if (!index) return null;
  const idx = index as Omit<IndexWithLatest, "latest"> & {
    source_note: string | null;
    region: string | null;
  };

  const { data: values } = await supabase
    .from("index_values")
    .select("date, value")
    .eq("index_id", idx.id)
    .order("date", { ascending: true });
  const series = (values ?? []) as SeriesPoint[];

  const { data: nodes } = await supabase
    .from("cost_nodes")
    .select("model_id, cost_models(name)")
    .eq("index_id", idx.id);
  const usedBy = new Map<string, string>();
  for (const n of (nodes ?? []) as { model_id: string; cost_models: { name: string }[] | null }[]) {
    usedBy.set(n.model_id, n.cost_models?.[0]?.name ?? "Model");
  }

  return {
    ...idx,
    series,
    latest: series.at(-1)?.value ?? 0,
    usedBy: [...usedBy].map(([modelId, modelName]) => ({ modelId, modelName })),
  };
}
