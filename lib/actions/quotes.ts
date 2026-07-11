"use server";
import { z } from "zod";
import { saveQuote, deleteQuote, type QuoteInputData } from "@/lib/db/quotes";

const money = z.number().int();

export const QuoteInputSchema = z.object({
  modelId: z.string().min(1),
  supplier_name: z.string().min(1),
  currency: z.string().min(1),
  incoterm: z.string().nullable(),
  payment_terms: z.string().nullable(),
  quoted_total: money,
  lines: z.array(
    z.object({
      cost_node_id: z.string().nullable(),
      description: z.string().nullable(),
      amount: money,
    }),
  ),
  quoteId: z.string().optional(),
});

export type SaveQuoteResult = { ok: true; id: string } | { ok: false; error: string };

export async function saveQuoteAction(input: unknown): Promise<SaveQuoteResult> {
  try {
    const { modelId, quoteId, ...rest } = QuoteInputSchema.parse(input);
    const data: QuoteInputData = rest;
    const id = await saveQuote(modelId, data, quoteId);
    return { ok: true, id };
  } catch (e) {
    // Surface the real cause: production redacts thrown server-action errors to a digest,
    // so we log server-side (Vercel logs) and return the message for the form to display.
    const error = e instanceof Error ? e.message : String(e);
    console.error("[saveQuoteAction] failed:", error, e);
    return { ok: false, error };
  }
}

export async function deleteQuoteAction(input: unknown): Promise<{ ok: true }> {
  const { quoteId } = z.object({ quoteId: z.string().min(1) }).parse(input);
  await deleteQuote(quoteId);
  return { ok: true };
}
