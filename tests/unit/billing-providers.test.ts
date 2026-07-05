// tests/unit/billing-providers.test.ts
import { describe, it, expect } from "vitest";
import { mapStripeEvent } from "@/lib/billing/stripe";
import { RazorpayProvider, RAZORPAY_NOT_IMPLEMENTED } from "@/lib/billing/razorpay";
import type { BillingProvider } from "@/lib/billing/types";
import type { Stripe } from "stripe";

const customer = "cus_test";
const subscription = (planId = "price_pro_monthly", status = "active") =>
  ({
    id: "sub_test",
    customer,
    status,
    metadata: { org_id: "org-123" },
    // stripe@22 (API 2026-06-24.dahlia) moved current_period_end onto the item.
    items: { data: [{ price: { id: planId }, current_period_end: 1754352000 /* 2025-08-04 UTC */ }] },
  }) as unknown as Stripe.Subscription;

describe("mapStripeEvent", () => {
  it("maps checkout.session.completed to subscription_created with the org id", () => {
    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { customer, client_reference_id: "org-123", metadata: { plan: "pro" } } },
    } as unknown as Stripe.Event;
    const mapped = mapStripeEvent(event);
    expect(mapped.kind).toBe("subscription_created");
    if (mapped.kind === "subscription_created") {
      expect(mapped.orgId).toBe("org-123");
      expect(mapped.plan).toBe("pro");
    }
  });

  it("maps customer.subscription.updated to subscription_updated", () => {
    const event = {
      id: "evt_2",
      type: "customer.subscription.updated",
      data: { object: subscription("price_team_monthly", "active") },
    } as unknown as Stripe.Event;
    const mapped = mapStripeEvent(event);
    expect(mapped.kind).toBe("subscription_updated");
    if (mapped.kind === "subscription_updated") {
      expect(mapped.orgId).toBe("org-123");
      expect(mapped.status).toBe("active");
      expect(mapped.currentPeriodEnd).toEqual(new Date(1754352000 * 1000));
    }
  });

  it("maps subscription.deleted to subscription_deleted", () => {
    const event = {
      id: "evt_3",
      type: "customer.subscription.deleted",
      data: { object: subscription() },
    } as unknown as Stripe.Event;
    const mapped = mapStripeEvent(event);
    expect(mapped.kind).toBe("subscription_deleted");
    if (mapped.kind === "subscription_deleted") {
      expect(mapped.orgId).toBe("org-123");
    }
  });

  it("unknown event types map to kind 'unknown' but still carry the event id", () => {
    const event = { id: "evt_x", type: "invoice.paid", data: { object: {} } } as unknown as Stripe.Event;
    const mapped = mapStripeEvent(event);
    expect(mapped.kind).toBe("unknown");
    expect(mapped.eventId).toBe("evt_x");
  });
});

describe("RazorpayProvider", () => {
  it("is present but throws NOT_IMPLEMENTED on every method", async () => {
    // Typed against the interface so call sites resolve to BillingProvider's
    // signatures (the stub class declares 0-param methods, which satisfy the
    // interface via method bivariance but would fail strict arg-count checks).
    const p: BillingProvider = new RazorpayProvider();
    expect(p.name).toBe("razorpay");
    await expect(
      p.createCheckoutSession({
        orgId: "o",
        plan: "pro",
        interval: "monthly",
        successUrl: "https://x/s",
        cancelUrl: "https://x/c",
      }),
    ).rejects.toThrow(RAZORPAY_NOT_IMPLEMENTED);
    await expect(p.createPortalSession({ customerId: "c", returnUrl: "https://x" })).rejects.toThrow(
      RAZORPAY_NOT_IMPLEMENTED,
    );
  });
});
