// lib/billing/razorpay.ts
import "server-only";
import type { BillingProvider } from "./types";

export const RAZORPAY_NOT_IMPLEMENTED = "RAZORPAY_NOT_IMPLEMENTED";

/** Stub — drops in behind the same interface as a fast-follow for INR India collections. */
export class RazorpayProvider implements BillingProvider {
  readonly name = "razorpay" as const;
  async createCheckoutSession(): Promise<{ url: string }> {
    throw new Error(RAZORPAY_NOT_IMPLEMENTED);
  }
  async createPortalSession(): Promise<{ url: string }> {
    throw new Error(RAZORPAY_NOT_IMPLEMENTED);
  }
  async parseWebhook(): Promise<never> {
    throw new Error(RAZORPAY_NOT_IMPLEMENTED);
  }
}
