import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/db/orgs";
import { loadModel } from "@/lib/db/models";
import { loadNodes } from "@/lib/db/nodes";
import { loadQuotes } from "@/lib/db/quotes";
import { buildTree } from "@/lib/model/tree";
import { rollupLive } from "@/lib/model/rollup-live";
import { buildComparison } from "@/lib/model/comparison";
import { fromMinor } from "@/lib/money";
import type { Currency } from "@/components/number/currency-select";
import { getAnthropic, AI_MODEL, isAiEnabled } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/rate-limit";

export const runtime = "nodejs";

// Module-singleton rate-limit state (per server instance).
const rl = new Map<string, number[]>();

export async function POST(req: Request) {
  if (!isAiEnabled()) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRateLimit(rl, org.org_id, Date.now()).allowed) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const { modelId, quoteId } = (await req.json().catch(() => ({}))) as {
    modelId?: string;
    quoteId?: string;
  };
  if (!modelId || !quoteId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  // RLS-scoped: a cross-org model resolves to null → 404.
  const model = await loadModel(modelId);
  if (!model) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [nodes, quotes] = await Promise.all([loadNodes(modelId), loadQuotes(modelId)]);
  const quote = quotes.find((q) => q.id === quoteId);
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const rollup = rollupLive(buildTree(nodes));
  const comparison = buildComparison(nodes, rollup, quote);
  const cur = model.currency as Currency;

  const lines = comparison.rows
    .filter((r) => r.quoted !== null)
    .map(
      (r) =>
        `${r.name}: should-cost ${fromMinor(r.shouldCost, cur)}, quoted ${fromMinor(r.quoted!, cur)}`,
    )
    .join("\n");
  const totals = `Totals — should-cost ${fromMinor(comparison.shouldCostTotal, cur)}, quoted ${fromMinor(comparison.quoteTotal, cur)}, gap ${fromMinor(comparison.gapTotal, cur)}.`;

  const stream = getAnthropic().messages.stream({
    model: AI_MODEL,
    max_tokens: 1200,
    system:
      "You are a procurement should-cost analyst. Given a should-cost baseline and a supplier quote, " +
      "explain in 4-6 sentences where the quote is high or low versus should-cost, the likely reasons, " +
      "and concrete negotiation levers. Be specific and grounded in the numbers. These are estimates for " +
      "the user to verify — do not present them as certified figures.",
    messages: [
      {
        role: "user",
        content: `Currency ${cur}. Supplier: ${quote.supplier_name}.\n${totals}\n\nLine comparison:\n${lines || "(no line-level breakdown; only a quoted total was provided)"}`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      stream.on("text", (t) => controller.enqueue(encoder.encode(t)));
      try {
        await stream.finalMessage();
      } catch {
        // Surface nothing further; the client shows a generic error if the body is empty.
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
