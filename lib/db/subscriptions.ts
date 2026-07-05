// lib/db/subscriptions.ts
import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/entitlements";

export type SubscriptionRow = {
  org_id: string;
  provider: "stripe" | "razorpay";
  provider_customer_id: string | null;
  plan: Plan;
  status: string;
  current_period_end: string | null;
};

export async function findActiveSubscriptionByOrg(
  orgId: string,
): Promise<SubscriptionRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("org_id, provider, provider_customer_id, plan, status, current_period_end")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return (data as SubscriptionRow | null) ?? null;
}

/** Admin write — called only from the verified webhook handler. */
export async function upsertSubscription(row: {
  org_id: string;
  provider: "stripe" | "razorpay";
  provider_customer_id: string | null;
  plan: Plan;
  status: string;
  current_period_end: Date | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("subscriptions").upsert({
    org_id: row.org_id,
    provider: row.provider,
    provider_customer_id: row.provider_customer_id,
    plan: row.plan,
    status: row.status,
    current_period_end: row.current_period_end,
  });
  if (error) throw error;
}

/** Denormalize the effective plan onto the org for fast client reads. */
export async function syncOrgPlan(orgId: string, plan: Plan): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update({ plan }).eq("id", orgId);
  if (error) throw error;
}
