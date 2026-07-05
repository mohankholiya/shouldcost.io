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

export async function saveQuoteAction(input: unknown): Promise<{ id: string }> {
  const { modelId, quoteId, ...rest } = QuoteInputSchema.parse(input);
  const data: QuoteInputData = rest;
  const id = await saveQuote(modelId, data, quoteId);
  return { id };
}

export async function deleteQuoteAction(input: unknown): Promise<{ ok: true }> {
  const { quoteId } = z.object({ quoteId: z.string().min(1) }).parse(input);
  await deleteQuote(quoteId);
  return { ok: true };
}
