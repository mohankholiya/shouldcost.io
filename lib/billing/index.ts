// lib/billing/index.ts
import "server-only";
import type { BillingProvider } from "./types";
import { StripeProvider } from "./stripe";
import { RazorpayProvider } from "./razorpay";

let cached: BillingProvider | null = null;

/** Env-driven provider selection. Defaults to Stripe (the only live provider in 3A). */
export function getBillingProvider(): BillingProvider {
  if (cached) return cached;
  const name = process.env.BILLING_PROVIDER ?? "stripe";
  cached = name === "razorpay" ? new RazorpayProvider() : new StripeProvider();
  return cached;
}
