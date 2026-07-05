// lib/billing/webhook.ts
import "server-only";
import type { Plan } from "@/lib/entitlements";
import type { BillingEvent } from "./types";

export interface WebhookRepo {
  isProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
  upsertSubscription(row: {
    org_id: string;
    provider: "stripe" | "razorpay";
    provider_customer_id: string | null;
    plan: Plan;
    status: string;
    current_period_end: Date | null;
  }): Promise<void>;
  syncOrgPlan(orgId: string, plan: Plan): Promise<void>;
}

/**
 * Apply a verified billing event. Idempotent by event id: a replay is a no-op.
 * Order matters: persist first, then mark processed — so a mid-write failure
 * leaves the event un-processed and Stripe retries it.
 */
export async function handleBillingEvent(event: BillingEvent, repo: WebhookRepo): Promise<void> {
  if (await repo.isProcessed(event.eventId)) return;

  if (event.kind === "subscription_created" || event.kind === "subscription_updated") {
    await repo.upsertSubscription({
      org_id: event.orgId,
      provider: "stripe",
      provider_customer_id: event.providerCustomerId,
      plan: event.plan,
      status: event.status,
      current_period_end: event.currentPeriodEnd,
    });
    await repo.syncOrgPlan(event.orgId, event.plan);
  } else if (event.kind === "subscription_deleted") {
    await repo.upsertSubscription({
      org_id: event.orgId,
      provider: "stripe",
      provider_customer_id: event.providerCustomerId,
      plan: "free",
      status: "canceled",
      current_period_end: null,
    });
    await repo.syncOrgPlan(event.orgId, "free");
  }

  await repo.markProcessed(event.eventId);
}
