import { describe, expect, it } from "vitest";
import { NodeSuggestionSchema, ModelDraftSchema } from "@/lib/ai/schemas";

describe("NodeSuggestionSchema", () => {
  it("accepts a well-formed suggestion", () => {
    const ok = NodeSuggestionSchema.safeParse({
      driver: "machining hours",
      unit: "hr",
      rate_low: 40,
      rate_high: 80,
      rationale: "typical shop rate",
    });
    expect(ok.success).toBe(true);
  });
  it("rejects a malformed suggestion", () => {
    expect(NodeSuggestionSchema.safeParse({ driver: "x" }).success).toBe(false);
    expect(
      NodeSuggestionSchema.safeParse({
        driver: "x",
        unit: "hr",
        rate_low: "a",
        rate_high: 1,
        rationale: "",
      }).success,
    ).toBe(false);
  });
});

describe("ModelDraftSchema", () => {
  it("accepts a well-formed model draft", () => {
    const ok = ModelDraftSchema.safeParse({
      name: "Valve body",
      nodes: [
        {
          name: "Steel",
          category: "material",
          driver: "kg",
          quantity: 12,
          unit: "kg",
          rate_minor: 300,
          note: "bar stock",
        },
      ],
    });
    expect(ok.success).toBe(true);
  });
  it("rejects a draft with no nodes", () => {
    expect(ModelDraftSchema.safeParse({ name: "x", nodes: [] }).success).toBe(false);
  });
});
