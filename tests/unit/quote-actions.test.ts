import { describe, it, expect } from "vitest";
import { QuoteInputSchema } from "@/lib/actions/quotes";

describe("QuoteInputSchema", () => {
  it("accepts a valid total-only quote with integer minor amounts", () => {
    const parsed = QuoteInputSchema.parse({
      modelId: "m1",
      supplier_name: "Acme",
      currency: "USD",
      incoterm: null,
      payment_terms: null,
      quoted_total: 180000,
      lines: [],
    });
    expect(parsed.quoted_total).toBe(180000);
  });

  it("rejects non-integer money (minor units must be integers)", () => {
    expect(() =>
      QuoteInputSchema.parse({
        modelId: "m1",
        supplier_name: "Acme",
        currency: "USD",
        incoterm: null,
        payment_terms: null,
        quoted_total: 180000.5,
        lines: [],
      }),
    ).toThrow();
  });

  it("rejects an empty supplier name", () => {
    expect(() =>
      QuoteInputSchema.parse({
        modelId: "m1",
        supplier_name: "",
        currency: "USD",
        incoterm: null,
        payment_terms: null,
        quoted_total: 0,
        lines: [],
      }),
    ).toThrow();
  });

  it("accepts line-level amounts mapped to nodes", () => {
    const parsed = QuoteInputSchema.parse({
      modelId: "m1",
      supplier_name: "Acme",
      currency: "USD",
      incoterm: "DAP",
      payment_terms: "Net 30",
      quoted_total: 180000,
      lines: [{ cost_node_id: "n1", description: "Steel", amount: 130000 }],
    });
    expect(parsed.lines[0]!.amount).toBe(130000);
  });
});
