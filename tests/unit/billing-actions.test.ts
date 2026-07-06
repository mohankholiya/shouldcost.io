import { describe, it, expect } from "vitest";
import { CheckoutInputSchema } from "@/lib/actions/billing";

describe("CheckoutInputSchema", () => {
  it("accepts a valid plan + interval", () => {
    expect(CheckoutInputSchema.parse({ plan: "pro", interval: "monthly" })).toEqual({
      plan: "pro",
      interval: "monthly",
    });
  });

  it("rejects the free plan (nothing to check out)", () => {
    expect(() => CheckoutInputSchema.parse({ plan: "free", interval: "monthly" })).toThrow();
  });

  it("rejects an unknown interval", () => {
    expect(() => CheckoutInputSchema.parse({ plan: "pro", interval: "quarterly" })).toThrow();
  });
});
