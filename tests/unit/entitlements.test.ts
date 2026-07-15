// tests/unit/entitlements.test.ts
import { describe, it, expect } from "vitest";
import {
  ENTITLEMENTS,
  FREE_LAUNCH,
  getEntitlement,
  canUseFeature,
  canUseTemplate,
  canCreateModel,
  aiDraftCreditsFor,
  canDraftWithAi,
  resolvePlan,
  resolveEffectivePlan,
  EntitlementError,
} from "@/lib/entitlements";

describe("ENTITLEMENTS matrix", () => {
  it("free: 2 models, 3 showcase templates, no paid features, $0", () => {
    const e = ENTITLEMENTS.free;
    expect(e.maxModels).toBe(2);
    expect(e.maxTemplates).toBe(3);
    expect(e.accessibleTemplateSlugs).toEqual([
      "octg-casing-tubing",
      "power-transformers",
      "epc-manhour-rate",
    ]);
    expect(e.features.export).toBe(false);
    expect(e.features.members).toBe(false);
    expect(e.price).toEqual({ monthly: 0, annual: 0 });
  });

  it("pro: unlimited models/templates, export+shareLinks+versionHistory, $49/$490", () => {
    const e = ENTITLEMENTS.pro;
    expect(e.maxModels).toBeNull();
    expect(e.accessibleTemplateSlugs).toBeNull();
    expect(e.features.export).toBe(true);
    expect(e.features.versionHistory).toBe(true);
    expect(e.features.auditLog).toBe(false);
    expect(e.price).toEqual({ monthly: 4900, annual: 49000 });
  });

  it("team: 5 seats, all features, $149/$1490", () => {
    const e = ENTITLEMENTS.team;
    expect(e.maxSeats).toBe(5);
    expect(e.features.auditLog).toBe(true);
    expect(e.features.members).toBe(true);
    expect(e.price).toEqual({ monthly: 14900, annual: 149000 });
  });
});

describe("decisions", () => {
  it("canCreateModel respects the free cap and unlimited paid tiers", () => {
    expect(canCreateModel("free", 1)).toBe(true);
    expect(canCreateModel("free", 2)).toBe(false);
    expect(canCreateModel("pro", 9999)).toBe(true);
    expect(canCreateModel("team", 9999)).toBe(true);
  });

  it("canUseTemplate allows showcase slugs on free, everything on paid", () => {
    expect(canUseTemplate("free", "octg-casing-tubing")).toBe(true);
    expect(canUseTemplate("free", "line-pipe")).toBe(false);
    expect(canUseTemplate("pro", "line-pipe")).toBe(true);
  });

  it("canUseFeature is plan-gated", () => {
    expect(canUseFeature("free", "export")).toBe(false);
    expect(canUseFeature("pro", "export")).toBe(true);
    expect(canUseFeature("pro", "auditLog")).toBe(false);
    expect(canUseFeature("team", "auditLog")).toBe(true);
  });
});

describe("AI draft entitlements", () => {
  it("free gets 1 credit; pro/team are unlimited", () => {
    expect(aiDraftCreditsFor("free")).toBe(1);
    expect(aiDraftCreditsFor("pro")).toBeNull();
    expect(aiDraftCreditsFor("team")).toBeNull();
  });
  it("free with a remaining credit can draft; zero cannot", () => {
    expect(canDraftWithAi("free", 1)).toBe(true);
    expect(canDraftWithAi("free", 0)).toBe(false);
  });
  it("paid plans can always draft regardless of counter", () => {
    expect(canDraftWithAi("pro", 0)).toBe(true);
  });
  it("FREE_LAUNCH is off", () => {
    expect(FREE_LAUNCH).toBe(false);
  });
});

describe("resolvePlan", () => {
  const now = new Date("2026-07-05T00:00:00Z");
  const future = new Date("2026-08-05T00:00:00Z");
  const past = new Date("2026-06-05T00:00:00Z");

  it("demo orgs are unrestricted (team) regardless of subscription", () => {
    expect(resolvePlan({ subscription: null, isDemo: true, now })).toBe("team");
  });

  it("active subscription returns its plan", () => {
    expect(resolvePlan({ subscription: { plan: "pro", status: "active", currentPeriodEnd: future }, isDemo: false, now })).toBe("pro");
  });

  it("past-due or expired subscription falls back to free", () => {
    expect(resolvePlan({ subscription: { plan: "pro", status: "past_due", currentPeriodEnd: future }, isDemo: false, now })).toBe("free");
    expect(resolvePlan({ subscription: { plan: "pro", status: "active", currentPeriodEnd: past }, isDemo: false, now })).toBe("free");
  });

  it("no subscription on a non-demo org is free", () => {
    expect(resolvePlan({ subscription: null, isDemo: false, now })).toBe("free");
  });
});

describe("resolveEffectivePlan (billing live — free-launch off)", () => {
  const now = new Date("2026-07-05T00:00:00Z");
  const future = new Date("2026-08-05T00:00:00Z");

  it("free-launch is off — billing is live", () => {
    // Guards the other assertions in this block; flip back on if relaunching free.
    expect(FREE_LAUNCH).toBe(false);
  });

  it("no longer elevates an unsubscribed org — it stays on free", () => {
    expect(resolvePlan({ subscription: null, isDemo: false, now })).toBe("free");
    expect(resolveEffectivePlan({ subscription: null, isDemo: false, now })).toBe("free");
  });

  it("leaves demo orgs and real paid subscriptions unchanged", () => {
    expect(resolveEffectivePlan({ subscription: null, isDemo: true, now })).toBe("team");
    expect(
      resolveEffectivePlan({
        subscription: { plan: "team", status: "active", currentPeriodEnd: future },
        isDemo: false,
        now,
      }),
    ).toBe("team");
  });
});

describe("EntitlementError", () => {
  it("carries a stable code and the plan required to unlock", () => {
    const err = new EntitlementError("MODELS_EXCEEDED", "pro", "hit the model cap");
    expect(err.code).toBe("MODELS_EXCEEDED");
    expect(err.requiredPlan).toBe("pro");
    expect(err.message).toContain("model cap");
  });
});

void getEntitlement;
