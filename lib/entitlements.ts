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
 * Free-launch mode toggle. `true` (current) means the whole product is free:
 * every unsubscribed org is elevated to the top `team` tier via
 * `resolveEffectivePlan` — unlimited models, all templates, unlimited AI
 * drafts, export, every feature — so no entitlement gate fires, and the paid
 * plans / upgrade UI are hidden. Set to `false` to turn billing back on:
 * unsubscribed orgs then get the {@link TRIAL_DAYS}-day trial and drop to
 * `free` afterwards. The `ENTITLEMENTS` catalog is unchanged either way.
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

/** Length of the full-feature trial every new workspace gets, counted from org creation. */
export const TRIAL_DAYS = 7;

/** When an org's trial ends, or null if there is no trial start date. */
export function trialEndsAt(trialStartedAt: Date | string | null | undefined): Date | null {
  if (!trialStartedAt) return null;
  const start = new Date(trialStartedAt);
  if (Number.isNaN(start.getTime())) return null;
  return new Date(start.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
}

/** Is the org still inside its free trial window? */
export function isInTrial(
  trialStartedAt: Date | string | null | undefined,
  now: Date = new Date(),
): boolean {
  const end = trialEndsAt(trialStartedAt);
  return end !== null && now.getTime() < end.getTime();
}

export type TrialStatus =
  | { state: "none" }
  | { state: "active"; endsAt: Date; daysLeft: number }
  | { state: "expired"; endsAt: Date };

/**
 * Where an org stands on its trial, for UI copy (sidebar chip, billing page).
 * Only an unsubscribed, non-demo org has a trial at all; `daysLeft` rounds up
 * so the last partial day reads "1 day left", never "0".
 */
export function trialStatus(input: {
  subscription: SubscriptionSnapshot | null;
  isDemo: boolean;
  trialStartedAt?: Date | string | null;
  now?: Date;
}): TrialStatus {
  // In free-launch mode everything is already free, so there is no trial to count down.
  if (FREE_LAUNCH || resolvePlan(input) !== "free") return { state: "none" };
  const endsAt = trialEndsAt(input.trialStartedAt);
  if (!endsAt) return { state: "none" };
  const now = input.now ?? new Date();
  if (now.getTime() >= endsAt.getTime()) return { state: "expired", endsAt };
  const daysLeft = Math.max(1, Math.ceil((endsAt.getTime() - now.getTime()) / 86_400_000));
  return { state: "active", endsAt, daysLeft };
}

/**
 * The plan the app should actually enforce. Identical to `resolvePlan` except
 * that a `free` (unsubscribed) org is elevated to `team` while inside its
 * {@link TRIAL_DAYS}-day trial (counted from `trialStartedAt`, the org's
 * `created_at`), and always in {@link FREE_LAUNCH} mode. Demo orgs and any
 * real paid subscription are unaffected. Every app/route/action gate calls
 * this instead of `resolvePlan`, so the unlock is applied in exactly one place.
 */
export function resolveEffectivePlan(input: {
  subscription: SubscriptionSnapshot | null;
  isDemo: boolean;
  trialStartedAt?: Date | string | null;
  now?: Date;
}): Plan {
  const plan = resolvePlan(input);
  if (plan !== "free") return plan;
  if (FREE_LAUNCH || isInTrial(input.trialStartedAt, input.now)) return "team";
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
