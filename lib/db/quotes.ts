import { createServerClient } from "@/lib/supabase/server";

export type QuoteLineRow = {
  id: string;
  quote_id: string;
  cost_node_id: string | null;
  description: string | null;
  amount: number;
};

export type QuoteRow = {
  id: string;
  model_id: string;
  supplier_name: string;
  currency: string;
  incoterm: string | null;
  payment_terms: string | null;
  quoted_total: number;
  received_at: string;
};

export type QuoteWithLines = QuoteRow & { lines: QuoteLineRow[] };

export type QuoteInputData = {
  supplier_name: string;
  currency: string;
  incoterm: string | null;
  payment_terms: string | null;
  quoted_total: number;
  lines: { cost_node_id: string | null; description: string | null; amount: number }[];
};

export async function loadQuotes(modelId: string): Promise<QuoteWithLines[]> {
  const supabase = await createServerClient();
  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, model_id, supplier_name, currency, incoterm, payment_terms, quoted_total, received_at")
    .eq("model_id", modelId)
    .order("received_at", { ascending: false });
  if (error) throw error;

  const rows = (quotes ?? []) as QuoteRow[];
  if (rows.length === 0) return [];

  const { data: lines, error: lErr } = await supabase
    .from("quote_lines")
    .select("id, quote_id, cost_node_id, description, amount")
    .in(
      "quote_id",
      rows.map((q) => q.id),
    );
  if (lErr) throw lErr;

  const byQuote = new Map<string, QuoteLineRow[]>();
  for (const l of (lines ?? []) as QuoteLineRow[]) {
    const list = byQuote.get(l.quote_id) ?? [];
    list.push(l);
    byQuote.set(l.quote_id, list);
  }
  return rows.map((q) => ({ ...q, lines: byQuote.get(q.id) ?? [] }));
}

/** Upsert a quote and replace its lines. Returns the quote id. */
export async function saveQuote(
  modelId: string,
  data: QuoteInputData,
  quoteId?: string,
): Promise<string> {
  const supabase = await createServerClient();
  const payload = {
    model_id: modelId,
    supplier_name: data.supplier_name,
    currency: data.currency,
    incoterm: data.incoterm,
    payment_terms: data.payment_terms,
    quoted_total: data.quoted_total,
  };

  let id = quoteId;
  if (id) {
    const { error } = await supabase.from("quotes").update(payload).eq("id", id);
    if (error) throw error;
    const { error: dErr } = await supabase.from("quote_lines").delete().eq("quote_id", id);
    if (dErr) throw dErr;
  } else {
    const { data: inserted, error } = await supabase
      .from("quotes")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    id = inserted!.id as string;
  }

  if (data.lines.length) {
    const { error: lErr } = await supabase.from("quote_lines").insert(
      data.lines.map((l) => ({
        quote_id: id,
        cost_node_id: l.cost_node_id,
        description: l.description,
        amount: l.amount,
      })),
    );
    if (lErr) throw lErr;
  }
  return id;
}

export async function deleteQuote(quoteId: string): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  if (error) throw error; // quote_lines cascade on delete (FK)
}
