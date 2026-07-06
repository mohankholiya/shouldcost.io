"use server";
import { z } from "zod";
import { getBillingProvider } from "@/lib/billing";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg } from "@/lib/db/subscriptions";
import type { Plan, Interval } from "@/lib/entitlements";

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const CheckoutInputSchema = z.object({
  plan: z.enum(["pro", "team"]),
  interval: z.enum(["monthly", "annual"]),
});

export async function createCheckoutSessionAction(input: unknown): Promise<{ url: string }> {
  const { plan, interval } = CheckoutInputSchema.parse(input);
  const org = await getCurrentOrg();
  if (!org?.organizations) throw new Error("No organization for the current user");
  if (org.role !== "admin") throw new Error("Only org admins can change the billing plan");

  return getBillingProvider().createCheckoutSession({
    orgId: org.org_id,
    plan: plan as Plan,
    interval: interval as Interval,
    successUrl: `${SITE()}/settings/billing?upgraded=1`,
    cancelUrl: `${SITE()}/settings/billing/upgrade?canceled=1`,
  });
}

export async function createPortalSessionAction(): Promise<{ url: string }> {
  const org = await getCurrentOrg();
  if (!org?.organizations) throw new Error("No organization for the current user");
  if (org.role !== "admin") throw new Error("Only org admins can manage billing");

  const sub = await findActiveSubscriptionByOrg(org.org_id);
  const customerId = sub?.provider_customer_id ?? null;
  if (!customerId) throw new Error("No subscription to manage");

  return getBillingProvider().createPortalSession({
    customerId,
    returnUrl: `${SITE()}/settings/billing`,
  });
}
