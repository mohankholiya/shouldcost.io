// lib/entitlements.ts
export type Plan = "free" | "pro" | "team";
export type Feature = "export" | "shareLinks" | "versionHistory" | "auditLog" | "members";
export type Interval = "monthly" | "annual";

export interface Entitlement {
  plan: Plan;
  maxModels: number | null;                 // null = unlimited
  maxTemplates: number | null;
  accessibleTemplateSlugs: string[] | null; // null = all
  maxSeats: number;
  features: Record<Feature, boolean>;
  price: { monthly: number; annual: number }; // integer minor units (USD cents)
}

const NO_FEATURES: Record<Feature, boolean> = {
  export: false,
  shareLinks: false,
  versionHistory: false,
  auditLog: false,
  members: false,
};

export const ENTITLEMENTS: Record<Plan, Entitlement> = {
  free: {
    plan: "free",
    maxModels: 2,
    maxTemplates: 3,
    accessibleTemplateSlugs: ["octg-casing-tubing", "power-transformers", "epc-manhour-rate"],
    maxSeats: 1,
    features: { ...NO_FEATURES },
    price: { monthly: 0, annual: 0 },
  },
  pro: {
    plan: "pro",
    maxModels: null,
    maxTemplates: null,
    accessibleTemplateSlugs: null,
    maxSeats: 1,
    features: { ...NO_FEATURES, export: true, shareLinks: true, versionHistory: true },
    price: { monthly: 4900, annual: 49000 },
  },
  team: {
    plan: "team",
    maxModels: null,
    maxTemplates: null,
    accessibleTemplateSlugs: null,
    maxSeats: 5,
    features: { ...NO_FEATURES, export: true, shareLinks: true, versionHistory: true, auditLog: true, members: true },
    price: { monthly: 14900, annual: 149000 },
  },
};

/**
 * Free-launch mode. While `true`, every real (unsubscribed) org is elevated to
 * the full `pro` feature set at no cost via `resolveEffectivePlan`, and the
 * Stripe billing surfaces are hidden (the billing pages read this flag). This
 * lets the product ship free while payments are deferred.
 *
 * To re-enable paid plans: set to `false`, restore the billing UI CTAs, and
 * complete the Stripe/Vercel env setup. The `ENTITLEMENTS` catalog and the pure
 * `resolvePlan` billing-semantics resolver are intentionally left unchanged so
 * this is a clean one-line revert.
 */
export const FREE_LAUNCH = true;

export function getEntitlement(plan: Plan): Entitlement {
  return ENTITLEMENTS[plan];
}

export function canUseFeature(plan: Plan, f: Feature): boolean {
  return ENTITLEMENTS[plan].features[f];
}

export function canUseTemplate(plan: Plan, slug: string): boolean {
  const slugs = ENTITLEMENTS[plan].accessibleTemplateSlugs;
  return slugs === null || slugs.includes(slug);
}

export function canCreateModel(plan: Plan, currentCount: number): boolean {
  const max = ENTITLEMENTS[plan].maxModels;
  return max === null || currentCount < max;
}

export type SubscriptionSnapshot = {
  plan: Plan;
  status: string;
  currentPeriodEnd?: Date | string | null;
};

/** The single source of truth for "what plan is this org effectively on?". */
export function resolvePlan(input: {
  subscription: SubscriptionSnapshot | null;
  isDemo: boolean;
  now?: Date;
}): Plan {
  if (input.isDemo) return "team";
  const sub = input.subscription;
  if (!sub) return "free";
  const now = input.now ?? new Date();
  const end = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const ended = end !== null && end.getTime() <= now.getTime();
  if (sub.status !== "active" || ended) return "free";
  return sub.plan;
}

/**
 * The plan the app should actually enforce. Identical to `resolvePlan` except
 * that in {@link FREE_LAUNCH} mode a `free` (unsubscribed) org is elevated to
 * `pro` — demo orgs and any real paid subscription are unaffected. Every
 * app/route/action gate calls this instead of `resolvePlan`, so the free-launch
 * unlock is applied in exactly one place.
 */
export function resolveEffectivePlan(input: {
  subscription: SubscriptionSnapshot | null;
  isDemo: boolean;
  now?: Date;
}): Plan {
  const plan = resolvePlan(input);
  if (FREE_LAUNCH && plan === "free") return "pro";
  return plan;
}

export class EntitlementError extends Error {
  readonly code: "MODELS_EXCEEDED" | "FEATURE_LOCKED" | "TEMPLATE_LOCKED";
  readonly requiredPlan: Plan;
  constructor(
    code: "MODELS_EXCEEDED" | "FEATURE_LOCKED" | "TEMPLATE_LOCKED",
    requiredPlan: Plan,
    message: string,
  ) {
    super(message);
    this.name = "EntitlementError";
    this.code = code;
    this.requiredPlan = requiredPlan;
  }
}
