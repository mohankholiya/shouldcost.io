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
  aiDraftCredits: number | null; // null = unlimited
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
    aiDraftCredits: 1,
    price: { monthly: 0, annual: 0 },
  },
  pro: {
    plan: "pro",
    maxModels: null,
    maxTemplates: null,
    accessibleTemplateSlugs: null,
    maxSeats: 1,
    features: { ...NO_FEATURES, export: true, shareLinks: true, versionHistory: true },
    aiDraftCredits: null,
    price: { monthly: 4900, annual: 49000 },
  },
  team: {
    plan: "team",
    maxModels: null,
    maxTemplates: null,
    accessibleTemplateSlugs: null,
    maxSeats: 5,
    features: { ...NO_FEATURES, export: true, shareLinks: true, versionHistory: true, auditLog: true, members: true },
    aiDraftCredits: null,
    price: { monthly: 14900, annual: 149000 },
  },
};

/**
 * Free-launch mode toggle. `false` (current) means billing is live:
 * unsubscribed orgs stay on `free` and hit the entitlement gates, and the
 * Stripe billing surfaces / upgrade UI are shown. Set back to `true` only to
 * re-open the free beta — that elevates every unsubscribed org to the full
 * `pro` feature set via `resolveEffectivePlan` and hides billing. The
 * `ENTITLEMENTS` catalog and the pure `resolvePlan` resolver are unchanged
 * either way, so flipping is a one-line change.
 */
export const FREE_LAUNCH = false;

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

/** AI-draft credits granted by a plan; null means unlimited (pro/team). */
export function aiDraftCreditsFor(plan: Plan): number | null {
  return ENTITLEMENTS[plan].aiDraftCredits;
}

/** Can this org draft with AI right now? Paid plans always can; free only with a credit remaining. */
export function canDraftWithAi(plan: Plan, creditsRemaining: number): boolean {
  if (plan !== "free") return true; // pro/team: unlimited
  return creditsRemaining > 0;
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
