import { describe, it, expect } from "vitest";
import { assertCanExport } from "@/lib/export/gate";
import { EntitlementError } from "@/lib/entitlements";

describe("assertCanExport", () => {
  it("throws FEATURE_LOCKED for the free plan", () => {
    try {
      assertCanExport("free");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(EntitlementError);
      const e = err as EntitlementError;
      expect(e.code).toBe("FEATURE_LOCKED");
      expect(e.requiredPlan).toBe("pro");
    }
  });

  it("passes for pro", () => {
    expect(() => assertCanExport("pro")).not.toThrow();
  });

  it("passes for team", () => {
    expect(() => assertCanExport("team")).not.toThrow();
  });
});
