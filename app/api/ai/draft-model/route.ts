import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getCurrentOrg } from "@/lib/db/orgs";
import { getAnthropic, AI_MODEL, isAiEnabled } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { ModelDraftSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

const rl = new Map<string, number[]>();

export async function POST(req: Request) {
  if (!isAiEnabled()) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRateLimit(rl, org.org_id, Date.now()).allowed) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const { description, currency } = (await req.json().catch(() => ({}))) as {
    description?: string;
    currency?: string;
  };
  if (!description || !currency) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const res = await getAnthropic().messages.parse({
    model: AI_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system:
      "You are a should-cost estimator. From a plain-language part or service description, draft a cost " +
      "breakdown (material, process/machining, labour, overhead, margin) as structured nodes with a driver, " +
      "quantity, unit, and approximate rate in integer minor units of the given currency. Values are " +
      "approximate estimates for the user to refine — do not imply certified precision.",
    messages: [{ role: "user", content: `Currency ${currency}. Describe: ${description}` }],
    output_config: { format: zodOutputFormat(ModelDraftSchema) },
  });
  if (!res.parsed_output) return NextResponse.json({ error: "No draft" }, { status: 502 });
  return NextResponse.json(res.parsed_output);
}
