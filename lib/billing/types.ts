// lib/billing/types.ts
import type { Plan, Interval } from "@/lib/entitlements";

export type BillingEvent =
  | {
      eventId: string;
      kind: "subscription_created" | "subscription_updated";
      orgId: string;
      plan: Plan;
      providerCustomerId: string;
      status: "active" | "past_due";
      currentPeriodEnd: Date;
    }
  | { eventId: string; kind: "subscription_deleted"; orgId: string; providerCustomerId: string }
  | { eventId: string; kind: "unknown" };

export interface BillingProvider {
  name: "stripe" | "razorpay";
  createCheckoutSession(input: {
    orgId: string;
    plan: Plan;
    interval: Interval;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }>;
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  parseWebhook(req: Request): Promise<BillingEvent>;
}
