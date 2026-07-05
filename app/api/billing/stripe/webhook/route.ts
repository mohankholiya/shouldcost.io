// app/api/billing/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { getBillingProvider } from "@/lib/billing";
import { handleBillingEvent, type WebhookRepo } from "@/lib/billing/webhook";
import { upsertSubscription, syncOrgPlan } from "@/lib/db/subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/entitlements";

export const runtime = "nodejs";

function makeRepo(): WebhookRepo {
  const admin = createAdminClient();
  return {
    async isProcessed(eventId: string): Promise<boolean> {
      const { data } = await admin
        .from("processed_stripe_events")
        .select("event_id")
        .eq("event_id", eventId)
        .maybeSingle();
      return Boolean(data);
    },
    async markProcessed(eventId: string): Promise<void> {
      await admin.from("processed_stripe_events").insert({ event_id: eventId });
    },
    async upsertSubscription(row): Promise<void> {
      await upsertSubscription(row);
    },
    async syncOrgPlan(orgId: string, plan: Plan): Promise<void> {
      await syncOrgPlan(orgId, plan);
    },
  };
}

export async function POST(req: Request): Promise<NextResponse> {
  let event;
  try {
    event = await getBillingProvider().parseWebhook(req);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }
  try {
    await handleBillingEvent(event, makeRepo());
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("billing webhook handler failed", err);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
}
