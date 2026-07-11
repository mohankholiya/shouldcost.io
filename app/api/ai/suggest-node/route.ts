import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getCurrentOrg } from "@/lib/db/orgs";
import { getAnthropic, AI_MODEL, isAiEnabled } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { NodeSuggestionSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";

const rl = new Map<string, number[]>();

export async function POST(req: Request) {
  if (!isAiEnabled()) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRateLimit(rl, org.org_id, Date.now()).allowed) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const { nodeName, parentName, currency } = (await req.json().catch(() => ({}))) as {
    nodeName?: string;
    parentName?: string;
    currency?: string;
  };
  if (!nodeName || !currency) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const res = await getAnthropic().messages.parse({
    model: AI_MODEL,
    max_tokens: 600,
    system:
      "You are a should-cost estimator. For the given cost line, propose the most likely cost driver, " +
      "its unit, and a realistic rate range (low/high) in the given currency, with a one-line rationale. " +
      "Values are approximate estimates for the user to verify, not certified figures.",
    messages: [
      {
        role: "user",
        content: `Currency ${currency}. Cost line: "${nodeName}"${parentName ? ` (under "${parentName}")` : ""}.`,
      },
    ],
    output_config: { format: zodOutputFormat(NodeSuggestionSchema) },
  });
  if (!res.parsed_output) return NextResponse.json({ error: "No suggestion" }, { status: 502 });
  return NextResponse.json(res.parsed_output);
}
