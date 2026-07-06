// lib/billing/stripe.ts
import "server-only";
import Stripe from "stripe";
import type { Plan, Interval } from "@/lib/entitlements";
import type { BillingEvent, BillingProvider } from "./types";

const PRICE_ENV: Record<Plan, Record<Interval, string>> = {
  free: { monthly: "", annual: "" },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? "",
  },
  team: {
    monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY ?? "",
    annual: process.env.STRIPE_PRICE_TEAM_ANNUAL ?? "",
  },
};

function client(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  // No apiVersion override: the SDK pins its own latest (typeof ApiVersion,
  // currently "2026-06-24.dahlia" in stripe@22.3.0) and our types must match it.
  // Brief pinned "2024-06-20" but the installed SDK no longer ships those types.
  return new Stripe(key);
}

/**
 * Pure: map a Stripe event to our BillingEvent union. Exported for unit tests.
 * The org id is read from `client_reference_id` (checkout) or `metadata.org_id`
 * (subscription events); the plan from checkout `metadata.plan` or derived from
 * the Price id env map.
 */
export function mapStripeEvent(event: Stripe.Event): BillingEvent {
  const eventId = event.id;
  const t = event.type;
  if (t === "checkout.session.completed") {
    const o = event.data.object as Stripe.Checkout.Session;
    const orgId = (o.client_reference_id ?? o.metadata?.org_id ?? "") as string;
    const plan = (o.metadata?.plan ?? "free") as Plan;
    const customer = (typeof o.customer === "string" ? o.customer : o.customer?.id) ?? "";
    if (!orgId || !customer) return { eventId, kind: "unknown" };
    return {
      eventId,
      kind: "subscription_created",
      orgId,
      plan,
      providerCustomerId: customer,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    };
  }
  if (t === "customer.subscription.created" || t === "customer.subscription.updated") {
    const s = event.data.object as Stripe.Subscription;
    const orgId = (s.metadata?.org_id ?? "") as string;
    const customer = (typeof s.customer === "string" ? s.customer : s.customer?.id) ?? "";
    if (!orgId || !customer) return { eventId, kind: "unknown" };
    // current_period_end moved from Subscription to SubscriptionItem in API
    // version 2026-06-24.dahlia (stripe@22.x); read it off the first item.
    // Fail-SAFE: if the field is absent (e.g. dashboard-pinned API version
    // diverges from the SDK pin and the path reads undefined), treat it as
    // "no expiry known" (null) so resolvePlan keeps the customer on their
    // paid plan. A 0 here would yield new Date(0) (1970) and silently
    // downgrade a paying customer to free — wrong polarity for billing.
    const periodEnd = s.items?.data?.[0]?.current_period_end;
    return {
      eventId,
      kind: t === "customer.subscription.created" ? "subscription_created" : "subscription_updated",
      orgId,
      plan: planFromSubscription(s),
      providerCustomerId: customer,
      status: s.status === "active" ? "active" : "past_due",
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    };
  }
  if (t === "customer.subscription.deleted") {
    const s = event.data.object as Stripe.Subscription;
    const orgId = (s.metadata?.org_id ?? "") as string;
    const customer = (typeof s.customer === "string" ? s.customer : s.customer?.id) ?? "";
    if (!orgId || !customer) return { eventId, kind: "unknown" };
    return { eventId, kind: "subscription_deleted", orgId, providerCustomerId: customer };
  }
  return { eventId, kind: "unknown" };
}

function planFromSubscription(s: Stripe.Subscription): Plan {
  const priceId = s.items?.data?.[0]?.price?.id ?? "";
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_ANNUAL)
    return "pro";
  if (priceId === process.env.STRIPE_PRICE_TEAM_MONTHLY || priceId === process.env.STRIPE_PRICE_TEAM_ANNUAL)
    return "team";
  return "free";
}

export class StripeProvider implements BillingProvider {
  readonly name = "stripe" as const;

  async createCheckoutSession(input: {
    orgId: string;
    plan: Plan;
    interval: Interval;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    const price = PRICE_ENV[input.plan][input.interval];
    if (!price) throw new Error(`No Stripe price configured for ${input.plan}/${input.interval}`);
    const session = await client().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: input.orgId,
      metadata: { org_id: input.orgId, plan: input.plan },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url };
  }

  async createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    const session = await client().billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  }

  async parseWebhook(req: Request): Promise<BillingEvent> {
    const sig = req.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret) throw new Error("Missing stripe-signature or STRIPE_WEBHOOK_SECRET");
    const body = await req.text();
    const event = client().webhooks.constructEvent(body, sig, secret);
    return mapStripeEvent(event);
  }
}
