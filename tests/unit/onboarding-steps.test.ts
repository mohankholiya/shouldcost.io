import { describe, expect, it } from "vitest";
import { allComplete, deriveOnboardingSteps } from "@/lib/onboarding/steps";

describe("deriveOnboardingSteps", () => {
  it("marks create-model done once a model exists", () => {
    const steps = deriveOnboardingSteps({ modelCount: 1, quoteCount: 0 });
    expect(steps.find((s) => s.id === "create-model")?.done).toBe(true);
    expect(steps.find((s) => s.id === "add-quote")?.done).toBe(false);
  });

  it("marks quote + compare done once a quote exists", () => {
    const steps = deriveOnboardingSteps({ modelCount: 2, quoteCount: 3 });
    expect(steps.every((s) => s.done)).toBe(true);
    expect(allComplete(steps)).toBe(true);
  });

  it("is fully incomplete for a brand-new org", () => {
    const steps = deriveOnboardingSteps({ modelCount: 0, quoteCount: 0 });
    expect(steps.some((s) => s.done)).toBe(false);
    expect(allComplete(steps)).toBe(false);
  });
});
