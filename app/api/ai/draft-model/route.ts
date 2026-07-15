import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg, toSnapshot } from "@/lib/db/subscriptions";
import { getAnthropic, AI_MODEL, isAiEnabled } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { ModelDraftSchema } from "@/lib/ai/schemas";
import { decideAiDraftAccess } from "@/lib/ai/draft-access";
import { resolveEffectivePlan } from "@/lib/entitlements";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const rl = new Map<string, number[]>();

export async function POST(req: Request) {
  if (!isAiEnabled()) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRateLimit(rl, org.org_id, Date.now()).allowed) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const sub = await findActiveSubscriptionByOrg(org.org_id);
  const plan = resolveEffectivePlan({
    subscription: toSnapshot(sub),
    isDemo: Boolean(org.organizations?.is_demo),
  });
  const credits = org.organizations?.ai_draft_credits ?? 0;
  const decision = decideAiDraftAccess(plan, credits);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "AI_CREDITS_EXHAUSTED", requiredPlan: "pro" },
      { status: 402 },
    );
  }

  const supabase = await createServerClient();
  if (decision.reserveCredit) {
    const { data: remaining } = await supabase.rpc("dec_ai_credit", { p_org_id: org.org_id });
    if (remaining === null || remaining === undefined) {
      return NextResponse.json(
        { error: "AI_CREDITS_EXHAUSTED", requiredPlan: "pro" },
        { status: 402 },
      );
    }
  }

  const { description, currency } = (await req.json().catch(() => ({}))) as {
    description?: string;
    currency?: string;
  };
  if (!description || !currency) {
    if (decision.reserveCredit) await supabase.rpc("inc_ai_credit", { p_org_id: org.org_id });
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
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
    if (!res.parsed_output) {
      if (decision.reserveCredit) await supabase.rpc("inc_ai_credit", { p_org_id: org.org_id });
      return NextResponse.json({ error: "No draft" }, { status: 502 });
    }
    return NextResponse.json(res.parsed_output);
  } catch {
    if (decision.reserveCredit) await supabase.rpc("inc_ai_credit", { p_org_id: org.org_id });
    return NextResponse.json({ error: "Draft failed" }, { status: 502 });
  }
}
