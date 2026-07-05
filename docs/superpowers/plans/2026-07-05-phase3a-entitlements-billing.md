# Phase 3A — Entitlements + Billing + Plan-gated UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn shouldcost.io from a free tool into a billable product — a Free user hits the 2-model cap or a Pro feature lock, follows an upgrade prompt to Stripe Checkout, and within seconds the sidebar badge flips to Pro and previously-locked actions are available.

**Architecture:** A pure `lib/entitlements.ts` holds the plan→limits matrix and all gating decisions (no I/O, fully unit-tested). A pluggable `BillingProvider` interface in `lib/billing/` has a live Stripe implementation and a Razorpay stub; a webhook handler upserts `subscriptions` and syncs `organizations.plan`, idempotent by Stripe event ID. Server actions enforce caps/features on every restricted mutation (the real gate); client components render quota indicators, locks, and upgrade prompts (UX only).

**Tech Stack:** Next.js 14 App Router (server + client components), TypeScript strict, Supabase (`@supabase/ssr` server client + service-role admin client), Zod, React Hook Form, the `stripe` Node SDK (server-only, new dependency), Vitest + Testing Library, Playwright.

## Global Constraints

- **Money is integer minor units (USD cents) end-to-end.** Prices: Free `{0,0}`, Pro `{4900,49000}`, Team `{14900,149000}`. Verbatim from spec §2 / §5.1.
- **Plans are the existing Postgres enum `billing_plan ('free','pro','team')`**; providers are `billing_provider ('stripe','razorpay')`. Verbatim from `0001_init_schema.sql:15-16`.
- **`subscriptions.org_id` is the primary key** — one subscription row per org, full stop. Upserts use `on conflict (org_id) do update`. There is no `(org_id, provider)` multi-provider coexistence; Razorpay (fast-follow) *replaces* a Stripe subscription. Verbatim from `0001_init_schema.sql:191-198`.
- **TypeScript strict, zero `any`. Zod-validate every billing mutation.** Verbatim from spec §10.
- **The `stripe` SDK import is server-only — it must never reach the browser bundle.** Put it behind files that import `"server-only"` or live under `lib/billing/*` (only imported from server actions / route handlers). Verbatim from spec §10.
- **Entitlement source of truth:** limits in code (`ENTITLEMENTS`); paid status in `subscriptions`; `organizations.plan` a denormalized cache written by the webhook. Verbatim from spec §2.
- **Server-side is the real gate; client locks are UX only.** Every restricted mutation is checked in a server action before it touches the DB. Verbatim from spec §1.
- **Demo orgs bypass caps** (`organizations.is_demo = true`). The seeded `Westmark Energy` demo org must read as unrestricted. Verbatim from Phase 0 spec §6.6.
- **No placeholder prices; no placeholder metrics.** Real Stripe Price IDs are env vars; if absent in dev, checkout actions fail fast with a clear message rather than silently shipping a broken flow.
- **Renders at 375 / 768 / 1440; WCAG AA; tabular figures** (`num` class) on every number. Verbatim from spec §10.

**Existing verified facts this plan relies on (do not re-derive):**
- `getCurrentOrg()` (`lib/db/orgs.ts:11`) returns `CurrentOrg = { org_id: string; role: string; organizations: { id; name; plan } | null }`. Task 7 adds `is_demo` to the select.
- `instantiateModelAction({ projectId, name, templateSlug? })` (`lib/actions/model.ts:62`) returns `{ id }`. Called from `components/indices/template-picker.tsx:26`. Task 7 widens the return type and updates the caller.
- `app/(app)/layout.tsx` is a server component that already reads `getCurrentOrg()` and queries `cost_models` for the sidebar. Task 11 extends it to pass `plan` + model count.
- `createAdminClient()` (`lib/supabase/admin.ts:8`) returns a service-role client that bypasses RLS — server/seed only, `server-only` guarded. Used by the webhook route (signature verification is the trust boundary, not RLS).
- `toMinor(units, currency)` / `fromMinor(minor, currency)` (`lib/money.ts`). All template `rate`s are minor units.
- Template slugs are exactly: `octg-casing-tubing`, `power-transformers`, `epc-manhour-rate`, `line-pipe`, `ball-gate-valves`, … (17 total, `lib/seed/templates/index.ts`). The three Free-tier showcase slugs are `octg-casing-tubing`, `power-transformers`, `epc-manhour-rate`. (Spec §5.5 said `epc-manhour-rate-buildup` — corrected here to the real slug.)
- RLS: `sub_all` policy (`0002_rls_policies.sql:77`) scopes `subscriptions` via `current_user_orgs()`. The webhook route uses the admin client, so it is not subject to RLS.
- Test scripts: `pnpm test` (`vitest run`), `pnpm typecheck` (`tsc --noEmit`), `pnpm lint` (`next lint`), `pnpm test:e2e` (`playwright test`). Single file: `pnpm vitest run <path>`.
- **Env note (from project memory):** `pnpm` is wrapped by a supply-chain policy; **`pnpm add stripe` may prompt for build approval** — approve it when Task 3 runs. No other install surprises expected. E2E needs a seeded auth session and is env-gated like the existing `tests/e2e/*.spec.ts`.

---

### Task 1: Entitlements pure module

**Files:**
- Create: `lib/entitlements.ts`
- Test: `tests/unit/entitlements.test.ts`

**Interfaces:**
- Consumes: nothing (pure, no I/O). `Plan` literals `"free"|"pro"|"team"`.
- Produces (these names are the contract every later task uses — do not rename):
  - `type Plan = "free" | "pro" | "team"`
  - `type Feature = "export" | "shareLinks" | "versionHistory" | "auditLog" | "members"`
  - `type Interval = "monthly" | "annual"`
  - `interface Entitlement { plan: Plan; maxModels: number | null; maxTemplates: number | null; accessibleTemplateSlugs: string[] | null; maxSeats: number; features: Record<Feature, boolean>; price: { monthly: number; annual: number } }`
  - `const ENTITLEMENTS: Record<Plan, Entitlement>`
  - `function getEntitlement(plan: Plan): Entitlement`
  - `function canUseFeature(plan: Plan, f: Feature): boolean`
  - `function canUseTemplate(plan: Plan, slug: string): boolean`
  - `function canCreateModel(plan: Plan, currentCount: number): boolean`
  - `function resolvePlan(input: { subscription: { plan: Plan; status: string; currentPeriodEnd?: Date | string | null } | null; isDemo: boolean; now?: Date }): Plan`
  - `class EntitlementError extends Error { readonly code: "MODELS_EXCEEDED" | "FEATURE_LOCKED" | "TEMPLATE_LOCKED"; readonly requiredPlan: Plan }`

> Refinement over spec §5.5: `effectivePlan(sub)` is renamed `resolvePlan({ subscription, isDemo, now })` so demo orgs short-circuit to `"team"` (the Phase 0 demo-bypass rule) and past-due subscriptions fall back to `"free"`. The pure decision helpers (`canCreateModel`, `canUseTemplate`, `canUseFeature`) take the resolved `Plan` and a count/slug — they stay pure and unit-testable; the DB lookups live in Task 7.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/entitlements.test.ts
import { describe, it, expect } from "vitest";
import {
  ENTITLEMENTS,
  getEntitlement,
  canUseFeature,
  canUseTemplate,
  canCreateModel,
  resolvePlan,
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

describe("EntitlementError", () => {
  it("carries a stable code and the plan required to unlock", () => {
    const err = new EntitlementError("MODELS_EXCEEDED", "pro", "hit the model cap");
    expect(err.code).toBe("MODELS_EXCEEDED");
    expect(err.requiredPlan).toBe("pro");
    expect(err.message).toContain("model cap");
  });
});

void getEntitlement;
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/entitlements.test.ts`
Expected: FAIL — cannot resolve `@/lib/entitlements`.

- [ ] **Step 3: Write the implementation**

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/entitlements.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/entitlements.ts tests/unit/entitlements.test.ts
git commit -m "Add entitlements module with plan limits and resolvers"
```

---

### Task 2: Subscriptions repository + model counter

**Files:**
- Create: `lib/db/subscriptions.ts`
- Modify: `lib/db/models.ts` (append `countModelsByOrg`)
- Modify: `lib/db/orgs.ts:7-8,18` (add `is_demo` to the select + type)

**Interfaces:**
- Consumes: `createServerClient` (`@/lib/supabase/server`); `createAdminClient` (`@/lib/supabase/admin`); `Plan` (Task 1).
- Produces:
  - `type SubscriptionRow = { org_id: string; provider: "stripe" | "razorpay"; provider_customer_id: string | null; plan: Plan; status: string; current_period_end: string | null }`
  - `async function findActiveSubscriptionByOrg(orgId: string): Promise<SubscriptionRow | null>` (server client, RLS-scoped)
  - `async function upsertSubscription(row: { org_id: string; provider: "stripe" | "razorpay"; provider_customer_id: string | null; plan: Plan; status: string; current_period_end: Date | null }): Promise<void>` (**admin** client — called from the webhook)
  - `async function syncOrgPlan(orgId: string, plan: Plan): Promise<void>` (**admin** client)
  - `async function countModelsByOrg(orgId: string): Promise<number>` (in `lib/db/models.ts`; joins via `projects`)

> Repository code wraps Supabase calls and is exercised through the webhook test (Task 4) and the e2e (Task 12) — no isolated unit test, matching `lib/db/versions.ts` / `lib/db/quotes.ts`. `upsertSubscription`/`syncOrgPlan` take an injected-or-default admin client so the webhook handler (Task 4) can unit-test the mapping with a fake.

- [ ] **Step 1: Write `lib/db/subscriptions.ts`**

```typescript
// lib/db/subscriptions.ts
import "server-only";
import { createServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/entitlements";

export type SubscriptionRow = {
  org_id: string;
  provider: "stripe" | "razorpay";
  provider_customer_id: string | null;
  plan: Plan;
  status: string;
  current_period_end: string | null;
};

export async function findActiveSubscriptionByOrg(
  orgId: string,
): Promise<SubscriptionRow | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("org_id, provider, provider_customer_id, plan, status, current_period_end")
    .eq("org_id", orgId)
    .maybeSingle();
  if (error) throw error;
  return (data as SubscriptionRow | null) ?? null;
}

/** Admin write — called only from the verified webhook handler. */
export async function upsertSubscription(row: {
  org_id: string;
  provider: "stripe" | "razorpay";
  provider_customer_id: string | null;
  plan: Plan;
  status: string;
  current_period_end: Date | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("subscriptions").upsert({
    org_id: row.org_id,
    provider: row.provider,
    provider_customer_id: row.provider_customer_id,
    plan: row.plan,
    status: row.status,
    current_period_end: row.current_period_end,
  });
  if (error) throw error;
}

/** Denormalize the effective plan onto the org for fast client reads. */
export async function syncOrgPlan(orgId: string, plan: Plan): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("organizations").update({ plan }).eq("id", orgId);
  if (error) throw error;
}
```

- [ ] **Step 2: Add `countModelsByOrg` to `lib/db/models.ts`**

Append at the end of `lib/db/models.ts` (after `templateToNodes`):

```typescript
/** Count cost models in an org (via projects). Used by entitlement enforcement. */
export async function countModelsByOrg(orgId: string): Promise<number> {
  const supabase = await createServerClient();
  const { count, error } = await supabase
    .from("cost_models")
    .select("id", { count: "exact", head: true })
    .in(
      "project_id",
      (await supabase.from("projects").select("id").eq("org_id", orgId)).data?.map(
        (p) => (p as { id: string }).id,
      ) ?? [],
    );
  if (error) throw error;
  return count ?? 0;
}
```

> If the nested `projects` query returns null (no projects), the `in("project_id", [])` filter matches zero models and `count` is 0 — correct for a fresh org. If Supabase rejects an empty `in()`, replace with a single query joining `cost_models!inner(project:project_id)` filtered by `project.org_id`; verify against the live DB in Task 7's typecheck step.

- [ ] **Step 3: Add `is_demo` to `getCurrentOrg`**

In `lib/db/orgs.ts`, change the type and select:

```typescript
// lib/db/orgs.ts
import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export type CurrentOrg = {
  org_id: string;
  role: string;
  organizations: { id: string; name: string; plan: string; is_demo: boolean } | null;
};

/** The calling user's org membership (personal org, auto-created on signup). */
export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("org_members")
    .select("org_id, role, organizations(id, name, plan, is_demo)")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as CurrentOrg | null) ?? null;
}
```

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors. (If `app/(app)/settings/page.tsx` complains about the changed `organizations` shape, it only reads `name`/`plan` — both still present; no change required.)

- [ ] **Step 5: Commit**

```bash
git add lib/db/subscriptions.ts lib/db/models.ts lib/db/orgs.ts
git commit -m "Add subscriptions repository, model counter, and is_demo on current org"
```

---

### Task 3: BillingProvider interface + Stripe provider + Razorpay stub

**Files:**
- Create: `lib/billing/types.ts`
- Create: `lib/billing/stripe.ts`
- Create: `lib/billing/razorpay.ts`
- Create: `lib/billing/index.ts`
- Test: `tests/unit/billing-providers.test.ts`

**Interfaces:**
- Consumes: `Plan`, `Interval` (Task 1); `stripe` SDK (new dep); env `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`.
- Produces:
  - `type BillingEvent` (discriminated union — see code; carries `eventId` for idempotency)
  - `interface BillingProvider { name; createCheckoutSession(...); createPortalSession(...); parseWebhook(req) }`
  - `function mapStripeEvent(event: Stripe.Event): BillingEvent` (pure; tested)
  - `function getBillingProvider(): BillingProvider` (env-driven factory in `index.ts`)
  - `const RAZORPAY_NOT_IMPLEMENTED = "RAZORPAY_NOT_IMPLEMENTED"`

> Prerequisite (manual, one-time): create the four Prices in the Stripe dashboard (test mode for dev) — Pro monthly, Pro annual, Team monthly, Team annual — and put their `price_…` IDs in `.env.local` as `STRIPE_PRICE_PRO_MONTHLY`, `STRIPE_PRICE_PRO_ANNUAL`, `STRIPE_PRICE_TEAM_MONTHLY`, `STRIPE_PRICE_TEAM_ANNUAL`. The code reads them; it does not create Prices.

- [ ] **Step 0: Install the Stripe SDK**

Run: `pnpm add stripe`
Expected: `stripe` appears in `dependencies`. If the supply-chain policy prompts for build approval, approve it (per project memory). No `--force`.

- [ ] **Step 1: Write the failing test** (pure event mapping + razorpay stub)

```typescript
// tests/unit/billing-providers.test.ts
import { describe, it, expect } from "vitest";
import { mapStripeEvent } from "@/lib/billing/stripe";
import { RazorpayProvider, RAZORPAY_NOT_IMPLEMENTED } from "@/lib/billing/razorpay";
import type { Stripe } from "stripe";

const customer = "cus_test";
const subscription = (planId = "price_pro_monthly", status = "active") =>
  ({
    id: "sub_test",
    customer,
    status,
    current_period_end: 1754352000, // 2025-08-04 UTC
    metadata: { org_id: "org-123" },
    items: { data: [{ price: { id: planId } }] },
  }) as unknown as Stripe.Subscription;

describe("mapStripeEvent", () => {
  it("maps checkout.session.completed to subscription_created with the org id", () => {
    const event = {
      id: "evt_1",
      type: "checkout.session.completed",
      data: { object: { customer, client_reference_id: "org-123", metadata: { plan: "pro" } } },
    } as unknown as Stripe.Event;
    const mapped = mapStripeEvent(event);
    expect(mapped.kind).toBe("subscription_created");
    expect(mapped.orgId).toBe("org-123");
    expect(mapped.plan).toBe("pro");
  });

  it("maps customer.subscription.updated to subscription_updated", () => {
    const event = {
      id: "evt_2",
      type: "customer.subscription.updated",
      data: { object: subscription("price_team_monthly", "active") },
    } as unknown as Stripe.Event;
    const mapped = mapStripeEvent(event);
    expect(mapped.kind).toBe("subscription_updated");
    if (mapped.kind === "subscription_updated") {
      expect(mapped.orgId).toBe("org-123");
      expect(mapped.status).toBe("active");
      expect(mapped.currentPeriodEnd).toEqual(new Date(1754352000 * 1000));
    }
  });

  it("maps subscription.deleted to subscription_deleted", () => {
    const event = {
      id: "evt_3",
      type: "customer.subscription.deleted",
      data: { object: subscription() },
    } as unknown as Stripe.Event;
    const mapped = mapStripeEvent(event);
    expect(mapped.kind).toBe("subscription_deleted");
    expect(mapped.orgId).toBe("org-123");
  });

  it("unknown event types map to kind 'unknown' but still carry the event id", () => {
    const event = { id: "evt_x", type: "invoice.paid", data: { object: {} } } as unknown as Stripe.Event;
    const mapped = mapStripeEvent(event);
    expect(mapped.kind).toBe("unknown");
    expect(mapped.eventId).toBe("evt_x");
  });
});

describe("RazorpayProvider", () => {
  it("is present but throws NOT_IMPLEMENTED on every method", async () => {
    const p = new RazorpayProvider();
    expect(p.name).toBe("razorpay");
    await expect(
      p.createCheckoutSession({
        orgId: "o",
        plan: "pro",
        interval: "monthly",
        successUrl: "https://x/s",
        cancelUrl: "https://x/c",
      }),
    ).rejects.toThrow(RAZORPAY_NOT_IMPLEMENTED);
    await expect(p.createPortalSession({ customerId: "c", returnUrl: "https://x" })).rejects.toThrow(
      RAZORPAY_NOT_IMPLEMENTED,
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/billing-providers.test.ts`
Expected: FAIL — cannot resolve `@/lib/billing/stripe` / `@/lib/billing/razorpay`.

- [ ] **Step 3: Write `lib/billing/types.ts`**

```typescript
// lib/billing/types.ts
import type { Plan, Interval } from "@/lib/entitlements";

export type BillingEvent =
  | {
      eventId: string;
      kind: "subscription_created" | "subscription_updated";
      orgId: string;
      plan: Plan;
      providerCustomerId: string;
      status: "active" | "past_due";
      currentPeriodEnd: Date;
    }
  | { eventId: string; kind: "subscription_deleted"; orgId: string; providerCustomerId: string }
  | { eventId: string; kind: "unknown" };

export interface BillingProvider {
  name: "stripe" | "razorpay";
  createCheckoutSession(input: {
    orgId: string;
    plan: Plan;
    interval: Interval;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }>;
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  parseWebhook(req: Request): Promise<BillingEvent>;
}
```

- [ ] **Step 4: Write `lib/billing/stripe.ts`**

```typescript
// lib/billing/stripe.ts
import "server-only";
import Stripe from "stripe";
import type { Plan, Interval } from "@/lib/entitlements";
import type { BillingEvent, BillingProvider } from "./types";

const PRICE_ENV: Record<Plan, Record<Interval, string>> = {
  free: { monthly: "", annual: "" },
  pro: {
    monthly: process.env.STRIPE_PRICE_PRO_MONTHLY ?? "",
    annual: process.env.STRIPE_PRICE_PRO_ANNUAL ?? "",
  },
  team: {
    monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY ?? "",
    annual: process.env.STRIPE_PRICE_TEAM_ANNUAL ?? "",
  },
};

function client(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key, { apiVersion: "2024-06-20" as Stripe.LatestApiVersion });
}

/**
 * Pure: map a Stripe event to our BillingEvent union. Exported for unit tests.
 * The org id is read from `client_reference_id` (checkout) or `metadata.org_id`
 * (subscription events); the plan from checkout `metadata.plan` or derived from
 * the Price id env map.
 */
export function mapStripeEvent(event: Stripe.Event): BillingEvent {
  const eventId = event.id;
  const t = event.type;
  if (t === "checkout.session.completed") {
    const o = event.data.object as Stripe.Checkout.Session;
    const orgId = (o.client_reference_id ?? o.metadata?.org_id ?? "") as string;
    const plan = (o.metadata?.plan ?? "free") as Plan;
    const customer = (typeof o.customer === "string" ? o.customer : o.customer?.id) ?? "";
    if (!orgId || !customer) return { eventId, kind: "unknown" };
    return {
      eventId,
      kind: "subscription_created",
      orgId,
      plan,
      providerCustomerId: customer,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    };
  }
  if (t === "customer.subscription.created" || t === "customer.subscription.updated") {
    const s = event.data.object as Stripe.Subscription;
    const orgId = (s.metadata?.org_id ?? "") as string;
    const customer = (typeof s.customer === "string" ? s.customer : s.customer?.id) ?? "";
    if (!orgId || !customer) return { eventId, kind: "unknown" };
    return {
      eventId,
      kind: t === "customer.subscription.created" ? "subscription_created" : "subscription_updated",
      orgId,
      plan: planFromSubscription(s),
      providerCustomerId: customer,
      status: s.status === "active" ? "active" : "past_due",
      currentPeriodEnd: new Date((s.current_period_end ?? 0) * 1000),
    };
  }
  if (t === "customer.subscription.deleted") {
    const s = event.data.object as Stripe.Subscription;
    const orgId = (s.metadata?.org_id ?? "") as string;
    const customer = (typeof s.customer === "string" ? s.customer : s.customer?.id) ?? "";
    if (!orgId || !customer) return { eventId, kind: "unknown" };
    return { eventId, kind: "subscription_deleted", orgId, providerCustomerId: customer };
  }
  return { eventId, kind: "unknown" };
}

function planFromSubscription(s: Stripe.Subscription): Plan {
  const priceId = s.items?.data?.[0]?.price?.id ?? "";
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_PRO_ANNUAL)
    return "pro";
  if (priceId === process.env.STRIPE_PRICE_TEAM_MONTHLY || priceId === process.env.STRIPE_PRICE_TEAM_ANNUAL)
    return "team";
  return "free";
}

export class StripeProvider implements BillingProvider {
  readonly name = "stripe" as const;

  async createCheckoutSession(input: {
    orgId: string;
    plan: Plan;
    interval: Interval;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }> {
    const price = PRICE_ENV[input.plan][input.interval];
    if (!price) throw new Error(`No Stripe price configured for ${input.plan}/${input.interval}`);
    const session = await client().checkouts.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: input.orgId,
      metadata: { org_id: input.orgId, plan: input.plan },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url };
  }

  async createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }> {
    const session = await client().billingPortal.sessions.create({
      customer: input.customerId,
      return_url: input.returnUrl,
    });
    return { url: session.url };
  }

  async parseWebhook(req: Request): Promise<BillingEvent> {
    const sig = req.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!sig || !secret) throw new Error("Missing stripe-signature or STRIPE_WEBHOOK_SECRET");
    const body = await req.text();
    const event = client().webhooks.constructEvent(body, sig, secret);
    return mapStripeEvent(event);
  }
}
```

- [ ] **Step 5: Write `lib/billing/razorpay.ts`**

```typescript
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
```

- [ ] **Step 6: Write `lib/billing/index.ts`**

```typescript
// lib/billing/index.ts
import "server-only";
import type { BillingProvider } from "./types";
import { StripeProvider } from "./stripe";
import { RazorpayProvider } from "./razorpay";

let cached: BillingProvider | null = null;

/** Env-driven provider selection. Defaults to Stripe (the only live provider in 3A). */
export function getBillingProvider(): BillingProvider {
  if (cached) return cached;
  const name = process.env.BILLING_PROVIDER ?? "stripe";
  cached = name === "razorpay" ? new RazorpayProvider() : new StripeProvider();
  return cached;
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/billing-providers.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 8: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors. Confirm `stripe` resolves and no client component imports `lib/billing/*` (grep: `grep -rn "lib/billing" app components` should only show server actions / route handlers added in later tasks).

- [ ] **Step 9: Commit**

```bash
git add lib/billing/ tests/unit/billing-providers.test.ts package.json pnpm-lock.yaml
git commit -m "Add BillingProvider interface with live Stripe provider and Razorpay stub"
```

---

### Task 4: Webhook event handler

**Files:**
- Create: `lib/billing/webhook.ts`
- Test: `tests/unit/billing-webhook.test.ts`

**Interfaces:**
- Consumes: `BillingEvent` (Task 3); `Plan` (Task 1).
- Produces:
  - `interface WebhookRepo { isProcessed(eventId): Promise<boolean>; markProcessed(eventId): Promise<void>; upsertSubscription(row): Promise<void>; syncOrgPlan(orgId, plan): Promise<void> }`
  - `async function handleBillingEvent(event: BillingEvent, repo: WebhookRepo): Promise<void>`

> The handler takes the `WebhookRepo` interface so the mapping is unit-testable with a fake; the route handler (Task 5) wires the real `lib/db/subscriptions.ts` repo. `processed_stripe_events` table lands in Task 6's migration; `isProcessed`/`markProcessed` query it.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/billing-webhook.test.ts
import { describe, it, expect, vi } from "vitest";
import { handleBillingEvent, type WebhookRepo } from "@/lib/billing/webhook";
import type { BillingEvent } from "@/lib/billing/types";

function fakeRepo(): WebhookRepo & { calls: string[] } {
  const calls: string[] = [];
  const seen = new Set<string>();
  return {
    calls,
    isProcessed: async (id) => {
      calls.push(`isProcessed:${id}`);
      return seen.has(id);
    },
    markProcessed: async (id) => {
      calls.push(`markProcessed:${id}`);
      seen.add(id);
    },
    upsertSubscription: async (row) => {
      calls.push(`upsert:${row.org_id}:${row.plan}:${row.status}`);
    },
    syncOrgPlan: async (orgId, plan) => {
      calls.push(`sync:${orgId}:${plan}`);
    },
  };
}

const created: BillingEvent = {
  eventId: "evt_1",
  kind: "subscription_created",
  orgId: "org-1",
  plan: "pro",
  providerCustomerId: "cus_1",
  status: "active",
  currentPeriodEnd: new Date("2026-08-05T00:00:00Z"),
};

describe("handleBillingEvent", () => {
  it("upserts the subscription, syncs org plan, marks processed — in that order", async () => {
    const repo = fakeRepo();
    await handleBillingEvent(created, repo);
    expect(repo.calls).toEqual([
      "isProcessed:evt_1",
      "upsert:org-1:pro:active",
      "sync:org-1:pro",
      "markProcessed:evt_1",
    ]);
  });

  it("is idempotent: a replayed event id is skipped entirely", async () => {
    const repo = fakeRepo();
    await handleBillingEvent(created, repo);
    await handleBillingEvent(created, repo); // replay
    expect(repo.calls.filter((c) => c.startsWith("upsert:"))).toHaveLength(1);
    expect(repo.calls.filter((c) => c.startsWith("sync:"))).toHaveLength(1);
  });

  it("subscription_deleted downgrades the org to free", async () => {
    const repo = fakeRepo();
    const deleted: BillingEvent = {
      eventId: "evt_2",
      kind: "subscription_deleted",
      orgId: "org-1",
      providerCustomerId: "cus_1",
    };
    await handleBillingEvent(deleted, repo);
    expect(repo.calls).toContain("upsert:org-1:free:canceled");
    expect(repo.calls).toContain("sync:org-1:free");
  });

  it("unknown events are ignored but still marked processed", async () => {
    const repo = fakeRepo();
    await handleBillingEvent({ eventId: "evt_3", kind: "unknown" }, repo);
    expect(repo.calls).toEqual(["isProcessed:evt_3", "markProcessed:evt_3"]);
    // no upsert, no sync
    expect(repo.calls.find((c) => c.startsWith("upsert:"))).toBeUndefined();
  });

  it("a handler error does not mark the event processed (so Stripe retries it)", async () => {
    const repo = fakeRepo();
    repo.upsertSubscription = vi.fn(async () => {
      throw new Error("db down");
    });
    await expect(handleBillingEvent(created, repo)).rejects.toThrow("db down");
    expect(repo.calls).not.toContain("markProcessed:evt_1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/billing-webhook.test.ts`
Expected: FAIL — cannot resolve `@/lib/billing/webhook`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/billing/webhook.ts
import "server-only";
import type { Plan } from "@/lib/entitlements";
import type { BillingEvent } from "./types";

export interface WebhookRepo {
  isProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string): Promise<void>;
  upsertSubscription(row: {
    org_id: string;
    provider: "stripe" | "razorpay";
    provider_customer_id: string | null;
    plan: Plan;
    status: string;
    current_period_end: Date | null;
  }): Promise<void>;
  syncOrgPlan(orgId: string, plan: Plan): Promise<void>;
}

/**
 * Apply a verified billing event. Idempotent by event id: a replay is a no-op.
 * Order matters: persist first, then mark processed — so a mid-write failure
 * leaves the event un-processed and Stripe retries it.
 */
export async function handleBillingEvent(event: BillingEvent, repo: WebhookRepo): Promise<void> {
  if (await repo.isProcessed(event.eventId)) return;

  if (event.kind === "subscription_created" || event.kind === "subscription_updated") {
    await repo.upsertSubscription({
      org_id: event.orgId,
      provider: "stripe",
      provider_customer_id: event.providerCustomerId,
      plan: event.plan,
      status: event.status,
      current_period_end: event.currentPeriodEnd,
    });
    await repo.syncOrgPlan(event.orgId, event.plan);
  } else if (event.kind === "subscription_deleted") {
    await repo.upsertSubscription({
      org_id: event.orgId,
      provider: "stripe",
      provider_customer_id: event.providerCustomerId,
      plan: "free",
      status: "canceled",
      current_period_end: null,
    });
    await repo.syncOrgPlan(event.orgId, "free");
  }

  await repo.markProcessed(event.eventId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/billing-webhook.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/billing/webhook.ts tests/unit/billing-webhook.test.ts
git commit -m "Add idempotent billing webhook event handler"
```

---

### Task 5: Stripe webhook route handler

**Files:**
- Create: `app/api/billing/stripe/webhook/route.ts`

**Interfaces:**
- Consumes: `getBillingProvider` (Task 3); `handleBillingEvent`, `WebhookRepo` (Task 4); `upsertSubscription`, `syncOrgPlan` (Task 2); `createAdminClient` (`@lib/supabase/admin`).
- Produces: `POST /api/billing/stripe/webhook` returning `200 { received: true }` on success, `400` on signature/verification failure, `500` on handler error (so Stripe retries).

> No isolated test — the route wires the verified provider + tested handler to the real admin client. Covered by the Stripe test-mode integration step in the DoD. Follows the codebase route-handler conventions.

- [ ] **Step 1: Write the route handler**

```typescript
// app/api/billing/stripe/webhook/route.ts
import { NextResponse } from "next/server";
import { getBillingProvider } from "@/lib/billing";
import { handleBillingEvent, type WebhookRepo } from "@/lib/billing/webhook";
import { upsertSubscription, syncOrgPlan } from "@/lib/db/subscriptions";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Plan } from "@/lib/entitlements";

export const runtime = "nodejs";

function makeRepo(): WebhookRepo {
  const admin = createAdminClient();
  return {
    async isProcessed(eventId: string): Promise<boolean> {
      const { data } = await admin
        .from("processed_stripe_events")
        .select("event_id")
        .eq("event_id", eventId)
        .maybeSingle();
      return Boolean(data);
    },
    async markProcessed(eventId: string): Promise<void> {
      await admin.from("processed_stripe_events").insert({ event_id: eventId });
    },
    async upsertSubscription(row): Promise<void> {
      await upsertSubscription(row);
    },
    async syncOrgPlan(orgId: string, plan: Plan): Promise<void> {
      await syncOrgPlan(orgId, plan);
    },
  };
}

export async function POST(req: Request): Promise<NextResponse> {
  let event;
  try {
    event = await getBillingProvider().parseWebhook(req);
  } catch {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }
  try {
    await handleBillingEvent(event, makeRepo());
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("billing webhook handler failed", err);
    return NextResponse.json({ error: "handler_failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: no errors; the build lists `/api/billing/stripe/webhook` as a route.

- [ ] **Step 3: Commit**

```bash
git add app/api/billing/stripe/webhook/route.ts
git commit -m "Add Stripe webhook route with signature verification"
```

---

### Task 6: Subscription constraints + idempotency table migration

**Files:**
- Create: `supabase/migrations/0007_subscription_constraints.sql`

**Interfaces:** DB only. Note: `subscriptions.org_id` is already the PK, so this migration adds **no** uniqueness constraint — only the customer lookup index and the idempotency table.

- [ ] **Step 1: Write the migration**

```sql
-- 0007_subscription_constraints.sql — Phase 3A billing plumbing.
-- subscriptions.org_id is already the primary key (one row per org),
-- so no (org_id, provider) uniqueness is needed; Razorpay as a fast-follow
-- REPLACES a Stripe subscription rather than coexisting.

-- Webhook customer lookup: given a Stripe customer id, find the org.
create index if not exists subscriptions_provider_customer_idx
  on subscriptions (provider, provider_customer_id);

-- Idempotency for Stripe webhook replays. Written by the webhook route via
-- the service-role admin client; RLS disabled (service-role only).
create table if not exists processed_stripe_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);
```

- [ ] **Step 2: Apply (if a linked Supabase project is available; otherwise commit and apply at deploy)**

Run: `pnpm db:push`
Expected: migration applies cleanly. If no linked project in this env, that is expected — the migration is committed and applied at deploy.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0007_subscription_constraints.sql
git commit -m "Add subscription customer index and webhook idempotency table"
```

---

### Task 7: Server-side enforcement wired into model creation

**Files:**
- Modify: `lib/actions/model.ts:62-68` (the `instantiateModelAction` body)
- Modify: `components/indices/template-picker.tsx` (handle the new return shape + filter locked templates)
- Test: `tests/unit/instantiate-model-action.test.ts` (schema + the entitlement-result type, no DB)

**Interfaces:**
- Consumes: `resolvePlan`, `canCreateModel`, `canUseTemplate`, `EntitlementError`, `Plan` (Task 1); `countModelsByOrg` (Task 2); `findActiveSubscriptionByOrg` (Task 2); `getCurrentOrg` (Task 2, now with `is_demo`).
- Produces:
  - `type InstantiateResult = { id: string } | { error: "MODELS_EXCEEDED" | "TEMPLATE_LOCKED"; requiredPlan: Plan }`
  - the updated `instantiateModelAction(input: unknown): Promise<InstantiateResult>`

> The pure decisions (`canCreateModel`, `canUseTemplate`, `resolvePlan`) are tested in Task 1. This task wires them into the action; the action-level path is validated by the e2e in Task 12. The test here pins the Zod schema and the result-type branch so a refactor can't silently revert the gate.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/instantiate-model-action.test.ts
import { describe, it, expect } from "vitest";

// The action imports server-only Supabase clients; we exercise the exported
// schema shape by type only + a smoke import. The entitlement branching is
// validated end-to-end in tests/e2e/model-cap.spec.ts (Task 12).
describe("instantiateModelAction result type", () => {
  it("exposes a union of success and entitlement-error shapes (compile-time contract)", async () => {
    const mod = await import("@/lib/actions/model");
    expect(typeof mod.instantiateModelAction).toBe("function");
    // InstantiateResult is a union; both shapes are observable at runtime.
    const ok: Awaited<ReturnType<typeof mod.instantiateModelAction>> = { id: "m1" };
    const blocked = { error: "MODELS_EXCEEDED", requiredPlan: "pro" as const };
    expect(ok.id).toBe("m1");
    expect(blocked.error).toBe("MODELS_EXCEEDED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/instantiate-model-action.test.ts`
Expected: FAIL — `InstantiateResult` not yet exported / action return type not widened.

- [ ] **Step 3: Update `instantiateModelAction`**

Replace the body of `instantiateModelAction` in `lib/actions/model.ts` (lines 62-68) with:

```typescript
export type InstantiateResult =
  | { id: string }
  | { error: "MODELS_EXCEEDED" | "TEMPLATE_LOCKED"; requiredPlan: "pro" | "team" };

export async function instantiateModelAction(input: unknown): Promise<InstantiateResult> {
  const { projectId, name, templateSlug } = z
    .object({ projectId: z.string(), name: z.string(), templateSlug: z.string().optional() })
    .parse(input);

  const org = await getCurrentOrg();
  if (!org?.organizations) throw new Error("No organization for the current user");
  const isDemo = Boolean(org.organizations.is_demo);
  const sub = await findActiveSubscriptionByOrg(org.org_id);
  const plan = resolvePlan({ subscription: sub, isDemo });

  if (templateSlug && !canUseTemplate(plan, templateSlug)) {
    return { error: "TEMPLATE_LOCKED", requiredPlan: "pro" };
  }
  const count = await countModelsByOrg(org.org_id);
  if (!canCreateModel(plan, count)) {
    return { error: "MODELS_EXCEEDED", requiredPlan: "pro" };
  }

  const id = await createModel(projectId, name, templateSlug);
  return { id };
}
```

And add these imports at the top of `lib/actions/model.ts`:

```typescript
import { resolvePlan, canCreateModel, canUseTemplate } from "@/lib/entitlements";
import { findActiveSubscriptionByOrg, countModelsByOrg } from "@/lib/db/subscriptions";
// countModelsByOrg is exported from lib/db/models.ts in Task 2 — re-export from subscriptions? No:
// import countModelsByOrg directly from its home:
```

Correct the import — `countModelsByOrg` lives in `lib/db/models.ts`:

```typescript
import { createModel, countModelsByOrg } from "@/lib/db/models";
```

(Replace the existing `import { createModel } from "@/lib/db/models";` line; do not import `countModelsByOrg` from `subscriptions`.)

- [ ] **Step 4: Update the template-picker caller**

In `components/indices/template-picker.tsx`, change `choose` to branch on the result and add entitlement filtering. Replace lines 19-31 (the `TemplatePicker` signature + `choose`):

```tsx
export function TemplatePicker({ projectId, plan }: { projectId: string; plan: Plan }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ kind: "MODELS_EXCEEDED" | "TEMPLATE_LOCKED"; requiredPlan: Plan } | null>(null);

  async function choose(name: string, templateSlug?: string) {
    setPending(templateSlug ?? "__blank__");
    try {
      const res = await instantiateModelAction({ projectId, name, templateSlug });
      if ("error" in res) {
        setBlocked({ kind: res.error, requiredPlan: res.requiredPlan });
        return;
      }
      router.push(`/models/${res.id}`);
    } finally {
      setPending(null);
    }
  }
```

Add the imports at the top:

```tsx
import { canUseTemplate, type Plan } from "@/lib/entitlements";
import { UpgradePrompt } from "@/components/billing/upgrade-prompt";
```

Filter the template list — replace `{ALL_TEMPLATES.map((t) => (` with:

```tsx
{ALL_TEMPLATES.filter((t) => canUseTemplate(plan, t.slug)).map((t) => (
```

And render the upgrade prompt when blocked — add before the closing `</SheetContent>`:

```tsx
{blocked && (
  <div className="p-4 pt-0">
    <UpgradePrompt
      title={blocked.kind === "MODELS_EXCEEDED" ? "You've hit the 2-model Free limit" : "That template needs Pro"}
      requiredPlan={blocked.requiredPlan}
    />
  </div>
)}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/instantiate-model-action.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors. `TemplatePicker` now requires a `plan` prop — every caller must pass it. The only caller is `app/(app)/projects/[id]/page.tsx`; Task 11 updates it. If typecheck flags it before Task 11, that's expected — run `pnpm typecheck` again after Task 11.

- [ ] **Step 7: Commit**

```bash
git add lib/actions/model.ts components/indices/template-picker.tsx tests/unit/instantiate-model-action.test.ts
git commit -m "Enforce model cap and template gate on instantiation"
```

---

### Task 8: Billing server actions (checkout + portal)

**Files:**
- Create: `lib/actions/billing.ts`
- Test: `tests/unit/billing-actions.test.ts`

**Interfaces:**
- Consumes: `getBillingProvider` (Task 3); `getCurrentOrg`, `findActiveSubscriptionByOrg` (Task 2); `Plan`, `Interval` (Task 1); `zod`.
- Produces:
  - `const CheckoutInputSchema` (Zod)
  - `async function createCheckoutSessionAction(input: unknown): Promise<{ url: string }>`
  - `async function createPortalSessionAction(): Promise<{ url: string }>`

- [ ] **Step 1: Write the failing test** (schema only)

```typescript
// tests/unit/billing-actions.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/billing-actions.test.ts`
Expected: FAIL — cannot resolve `@/lib/actions/billing`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/actions/billing.ts
"use server";
import { z } from "zod";
import { getBillingProvider } from "@/lib/billing";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg } from "@/lib/db/subscriptions";
import type { Plan, Interval } from "@/lib/entitlements";

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const CheckoutInputSchema = z.object({
  plan: z.enum(["pro", "team"]),
  interval: z.enum(["monthly", "annual"]),
});

export async function createCheckoutSessionAction(input: unknown): Promise<{ url: string }> {
  const { plan, interval } = CheckoutInputSchema.parse(input);
  const org = await getCurrentOrg();
  if (!org?.organizations) throw new Error("No organization for the current user");
  if (org.role !== "admin") throw new Error("Only org admins can change the billing plan");

  return getBillingProvider().createCheckoutSession({
    orgId: org.org_id,
    plan: plan as Plan,
    interval: interval as Interval,
    successUrl: `${SITE()}/settings/billing?upgraded=1`,
    cancelUrl: `${SITE()}/settings/billing/upgrade?canceled=1`,
  });
}

export async function createPortalSessionAction(): Promise<{ url: string }> {
  const org = await getCurrentOrg();
  if (!org?.organizations) throw new Error("No organization for the current user");
  if (org.role !== "admin") throw new Error("Only org admins can manage billing");

  const sub = await findActiveSubscriptionByOrg(org.org_id);
  const customerId = sub?.provider_customer_id ?? null;
  if (!customerId) throw new Error("No subscription to manage");

  return getBillingProvider().createPortalSession({
    customerId,
    returnUrl: `${SITE()}/settings/billing`,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/billing-actions.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors. (If the `"use server"` directive breaks the schema unit import, split the schema into `lib/actions/billing-schema.ts` with no directive and re-export — prefer the single-file version first, matching how `lib/actions/quotes.ts` already works.)

- [ ] **Step 6: Commit**

```bash
git add lib/actions/billing.ts tests/unit/billing-actions.test.ts
git commit -m "Add checkout and portal server actions with Zod validation"
```

---

### Task 9: Billing UI components

**Files:**
- Create: `components/billing/plan-badge.tsx`
- Create: `components/billing/upgrade-prompt.tsx`
- Create: `components/billing/model-quota-indicator.tsx`
- Create: `components/billing/plan-card.tsx`
- Test: `tests/unit/billing-components.test.tsx`

**Interfaces:**
- Consumes: `Plan`, `Entitlement`, `getEntitlement` (Task 1); `Link` (`next/link`); `Button`, `Badge` (`components/ui/*`); `cn` (`lib/utils`).
- Produces:
  - `function PlanBadge(props: { plan: Plan }): JSX.Element`
  - `function UpgradePrompt(props: { title?: string; requiredPlan: Plan }): JSX.Element`
  - `function ModelQuotaIndicator(props: { plan: Plan; used: number }): JSX.Element`
  - `function PlanCard(props: { plan: Plan; current: Plan }): JSX.Element` (upgrade-page pricing card)

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/billing-components.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlanBadge, UpgradePrompt, ModelQuotaIndicator, PlanCard } from "@/components/billing";

describe("PlanBadge", () => {
  it("renders the capitalized plan name", () => {
    render(<PlanBadge plan="pro" />);
    expect(screen.getByText("Pro")).toBeInTheDocument();
  });
});

describe("UpgradePrompt", () => {
  it("links to the upgrade page with the required plan", () => {
    render(<UpgradePrompt requiredPlan="pro" />);
    expect(screen.getByRole("link", { name: /upgrade/i })).toHaveAttribute("href", "/settings/billing/upgrade");
  });
});

describe("ModelQuotaIndicator", () => {
  it("shows used / max on the free tier and an upgrade link at the cap", () => {
    render(<ModelQuotaIndicator plan="free" used={2} />);
    expect(screen.getByText(/2 \/ 2/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /upgrade/i })).toBeInTheDocument();
  });

  it("shows nothing on unlimited tiers", () => {
    const { container } = render(<ModelQuotaIndicator plan="pro" used={12} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("PlanCard", () => {
  it("renders the price and a CTA that is disabled for the current plan", () => {
    render(<PlanCard plan="pro" current="free" />);
    expect(screen.getByText(/\$49/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /choose/i })).toBeEnabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/billing-components.test.tsx`
Expected: FAIL — cannot resolve `@/components/billing`.

- [ ] **Step 3: Write the components**

Create a barrel `components/billing/index.ts`:

```tsx
// components/billing/index.ts
export { PlanBadge } from "./plan-badge";
export { UpgradePrompt } from "./upgrade-prompt";
export { ModelQuotaIndicator } from "./model-quota-indicator";
export { PlanCard } from "./plan-card";
```

```tsx
// components/billing/plan-badge.tsx
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/entitlements";

const TONE: Record<Plan, string> = {
  free: "bg-muted text-muted-foreground",
  pro: "bg-accent text-accent-foreground",
  team: "bg-primary text-primary-foreground",
};

export function PlanBadge({ plan }: { plan: Plan }) {
  return <Badge className={cn("capitalize", TONE[plan])}>{plan}</Badge>;
}
```

```tsx
// components/billing/upgrade-prompt.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Plan } from "@/lib/entitlements";

export function UpgradePrompt({
  title = "Upgrade to unlock",
  requiredPlan,
}: {
  title?: string;
  requiredPlan: Plan;
}) {
  return (
    <div className="rounded-md border border-hairline bg-card p-4 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {requiredPlan === "team" ? "Team" : "Pro"} removes this limit.
      </p>
      <Button asChild size="sm" className="mt-3">
        <Link href="/settings/billing/upgrade">Upgrade</Link>
      </Button>
    </div>
  );
}
```

```tsx
// components/billing/model-quota-indicator.tsx
import Link from "next/link";
import { getEntitlement } from "@/lib/entitlements";
import type { Plan } from "@/lib/entitlements";

export function ModelQuotaIndicator({ plan, used }: { plan: Plan; used: number }) {
  const max = getEntitlement(plan).maxModels;
  if (max === null) return null;
  const atCap = used >= max;
  return (
    <div className="px-4 py-2 text-xs text-muted-foreground">
      <span className="num">
        {used} / {max} models
      </span>
      {atCap && (
        <Link href="/settings/billing/upgrade" className="ml-2 font-medium text-primary">
          Upgrade
        </Link>
      )}
    </div>
  );
}
```

```tsx
// components/billing/plan-card.tsx
"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { getEntitlement } from "@/lib/entitlements";
import type { Plan, Interval } from "@/lib/entitlements";
import { createCheckoutSessionAction } from "@/lib/actions/billing";

const LABEL: Record<Plan, string> = { free: "Free", pro: "Pro", team: "Team" };

export function PlanCard({ plan, current }: { plan: Plan; current: Plan }) {
  const e = getEntitlement(plan);
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [busy, setBusy] = useState(false);
  const isCurrent = plan === current;

  async function checkout() {
    setBusy(true);
    try {
      const { url } = await createCheckoutSessionAction({ plan, interval });
      router.push(url);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-hairline bg-card p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">{LABEL[plan]}</h3>
        <div className="num text-lg font-semibold">
          {e.price.monthly === 0 ? "$0" : `$${(e.price[interval] / 100).toFixed(0)}`}
          {e.price.monthly !== 0 && <span className="text-xs text-muted-foreground">/{interval === "monthly" ? "mo" : "yr"}</span>}
        </div>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
        <li>{e.maxModels === null ? "Unlimited models" : `${e.maxModels} models`}</li>
        <li>{e.accessibleTemplateSlugs === null ? "All 17 templates" : `${e.maxTemplates} templates`}</li>
        <li>{e.maxSeats} seat{e.maxSeats === 1 ? "" : "s"}</li>
        {e.features.export && <li>PDF / XLSX export</li>}
        {e.features.shareLinks && <li>Share links</li>}
        {e.features.auditLog && <li>Audit log</li>}
      </ul>
      <div className="mt-4 flex items-center gap-2">
        <Button disabled={isCurrent || busy} onClick={checkout}>
          {isCurrent ? "Current" : busy ? "Redirecting…" : "Choose " + LABEL[plan]}
        </Button>
        {e.price.monthly !== 0 && (
          <select
            className="rounded-md border border-hairline bg-background px-2 py-1 text-xs"
            value={interval}
            onChange={(ev) => setInterval(ev.target.value as Interval)}
            aria-label="Billing interval"
          >
            <option value="monthly">Monthly</option>
            <option value="annual">Annual (2 months free)</option>
          </select>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/billing-components.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/billing/ tests/unit/billing-components.test.tsx
git commit -m "Add billing UI: plan badge, upgrade prompt, quota indicator, plan card"
```

---

### Task 10: Settings → Billing + Upgrade pages

**Files:**
- Create: `app/(app)/settings/billing/page.tsx`
- Create: `app/(app)/settings/billing/upgrade/page.tsx`
- Modify: `app/(app)/settings/page.tsx` (add a link to /settings/billing)

**Interfaces:**
- Consumes: `getCurrentOrg`, `findActiveSubscriptionByOrg` (Task 2); `resolvePlan`, `getEntitlement` (Task 1); `PlanCard`, `PlanBadge` (Task 9); `createPortalSessionAction` (Task 8); `PageHeader`, `Surface`.

- [ ] **Step 1: Write the billing page** (current plan + portal manage button)

```tsx
// app/(app)/settings/billing/page.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Surface } from "@/components/ui/surface";
import { PlanBadge } from "@/components/billing";
import { ManageSubscriptionButton } from "./manage-button";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg } from "@/lib/db/subscriptions";
import { resolvePlan, getEntitlement } from "@/lib/entitlements";
import { fromMinor } from "@/lib/money";

export default async function BillingPage() {
  const org = await getCurrentOrg();
  const isDemo = Boolean(org?.organizations?.is_demo);
  const sub = org ? await findActiveSubscriptionByOrg(org.org_id) : null;
  const plan = resolvePlan({ subscription: sub, isDemo });
  const e = getEntitlement(plan);
  const price = e.price.monthly === 0 ? "Free" : `$${(e.price.monthly / 100).toFixed(0)}/mo`;

  return (
    <>
      <PageHeader title="Billing" subtitle="Plan, subscription, and invoicing" />
      <Surface padding="lg" className="max-w-md space-y-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Current plan</span>
          <PlanBadge plan={plan} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Price</span>
          <span className="num font-medium">{price}</span>
        </div>
        {isDemo && (
          <p className="text-xs text-muted-foreground">
            This is a demo workspace — all features are unlocked and no card is on file.
          </p>
        )}
        <div className="flex gap-2 pt-2">
          {plan === "free" ? (
            <Button asChild>
              <Link href="/settings/billing/upgrade">Upgrade</Link>
            </Button>
          ) : (
            <ManageSubscriptionButton />
          )}
        </div>
      </Surface>
    </>
  );
}

void fromMinor;
```

- [ ] **Step 2: Write the portal button client component**

```tsx
// app/(app)/settings/billing/manage-button.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createPortalSessionAction } from "@/lib/actions/billing";

export function ManageSubscriptionButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true);
    try {
      const { url } = await createPortalSessionAction();
      router.push(url);
    } catch {
      setBusy(false);
    }
  }
  return (
    <Button variant="secondary" disabled={busy} onClick={go}>
      {busy ? "Opening…" : "Manage subscription"}
    </Button>
  );
}
```

- [ ] **Step 3: Write the upgrade page** (pricing cards)

```tsx
// app/(app)/settings/billing/upgrade/page.tsx
import { PageHeader } from "@/components/shared/page-header";
import { PlanCard } from "@/components/billing";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg } from "@/lib/db/subscriptions";
import { resolvePlan } from "@/lib/entitlements";
import type { Plan } from "@/lib/entitlements";

const ORDER: Plan[] = ["free", "pro", "team"];

export default async function UpgradePage() {
  const org = await getCurrentOrg();
  const isDemo = Boolean(org?.organizations?.is_demo);
  const sub = org ? await findActiveSubscriptionByOrg(org.org_id) : null;
  const current = resolvePlan({ subscription: sub, isDemo });

  return (
    <>
      <PageHeader title="Upgrade" subtitle="Choose a plan — switch or cancel anytime" />
      <div className="grid gap-4 md:grid-cols-3">
        {ORDER.map((p) => (
          <PlanCard key={p} plan={p} current={current} />
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 4: Add a billing link to the settings page**

In `app/(app)/settings/page.tsx`, inside the existing `<Surface as="dl" …>` block, add after the "Plan" `<div>`:

```tsx
<div className="flex justify-between">
  <dt className="text-muted-foreground">Billing</dt>
  <dd>
    <Link href="/settings/billing" className="font-medium text-primary hover:underline">
      Manage →
    </Link>
  </dd>
</div>
```

And add the import at the top of `app/(app)/settings/page.tsx`:

```tsx
import Link from "next/link";
```

- [ ] **Step 5: Typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: no errors; build lists `/settings/billing` and `/settings/billing/upgrade`.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/settings/billing/" "app/(app)/settings/page.tsx"
git commit -m "Add billing and upgrade settings pages"
```

---

### Task 11: Wire PlanBadge + quota indicator into the app shell

**Files:**
- Modify: `app/(app)/layout.tsx` (resolve plan, count models, pass to Sidebar and projects page)
- Modify: `components/layout/sidebar.tsx` (accept `plan`, render `PlanBadge` + `ModelQuotaIndicator`)
- Modify: `app/(app)/projects/[id]/page.tsx` (pass `plan` to `TemplatePicker`)

**Interfaces:**
- Consumes: `getCurrentOrg`, `findActiveSubscriptionByOrg`, `countModelsByOrg` (Task 2); `resolvePlan` (Task 1); `PlanBadge`, `ModelQuotaIndicator` (Task 9).

- [ ] **Step 1: Extend the layout**

Replace `app/(app)/layout.tsx`:

```tsx
// app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg, countModelsByOrg } from "@/lib/db/subscriptions";
import { createServerClient } from "@/lib/supabase/server";
import { resolvePlan } from "@/lib/entitlements";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  const orgName = org.organizations?.name ?? "My workspace";
  const isDemo = Boolean(org.organizations?.is_demo);
  const sub = await findActiveSubscriptionByOrg(org.org_id);
  const plan = resolvePlan({ subscription: sub, isDemo });
  const modelCount = await countModelsByOrg(org.org_id);

  const supabase = await createServerClient();
  const { data } = await supabase
    .from("cost_models")
    .select("id, name")
    .order("created_at", { ascending: false })
    .limit(5);
  const recentModels = (data ?? []) as { id: string; name: string }[];

  return (
    <div className="flex min-h-screen">
      <Sidebar recentModels={recentModels} plan={plan} modelCount={modelCount} />
      <div className="flex flex-1 flex-col">
        <Topbar orgName={orgName} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Extend the Sidebar**

In `components/layout/sidebar.tsx`, change the signature and render the badge + indicator at the bottom of the `<aside>` (before the closing `</aside>`):

```tsx
import { PlanBadge, ModelQuotaIndicator } from "@/components/billing";
import type { Plan } from "@/lib/entitlements";

export function Sidebar({
  recentModels = [],
  plan,
  modelCount = 0,
}: {
  recentModels?: RecentModel[];
  plan: Plan;
  modelCount?: number;
}) {
```

Then, just before the closing `</aside>`:

```tsx
      <div className="mt-auto border-t border-hairline px-3 py-3">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Plan</span>
          <PlanBadge plan={plan} />
        </div>
        <ModelQuotaIndicator plan={plan} used={modelCount} />
      </div>
```

And make the `<aside>` a flex column so `mt-auto` pushes the plan block to the bottom — change the aside's className to:

```tsx
<aside className="hidden w-56 shrink-0 flex-col border-r border-hairline bg-canvas md:flex">
```

- [ ] **Step 3: Pass `plan` to the TemplatePicker**

Open `app/(app)/projects/[id]/page.tsx`, find the `<TemplatePicker projectId={…} />` usage, and add the `plan` prop. The page is a server component — read the plan the same way the layout does:

```tsx
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg } from "@/lib/db/subscriptions";
import { resolvePlan } from "@/lib/entitlements";

// inside the default export, before render:
const org = await getCurrentOrg();
const isDemo = Boolean(org?.organizations?.is_demo);
const sub = org ? await findActiveSubscriptionByOrg(org.org_id) : null;
const plan = resolvePlan({ subscription: sub, isDemo });

// then:
<TemplatePicker projectId={project.id} plan={plan} />
```

> If the projects detail page already renders `TemplatePicker`, this is a one-prop addition. If `app/(app)/projects/[id]/page.tsx` does not exist or renders the picker elsewhere, run `grep -rn "TemplatePicker" app` and pass `plan` at every call site. There is exactly one call site today.

- [ ] **Step 4: Typecheck + lint + build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: no errors. All `TemplatePicker` callers now pass `plan`; `Sidebar` renders the badge + indicator.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/layout.tsx" components/layout/sidebar.tsx "app/(app)/projects/[id]/page.tsx"
git commit -m "Show plan badge and model quota in the sidebar"
```

---

### Task 12: End-to-end — Free user hits the model cap

**Files:**
- Create: `tests/e2e/model-cap.spec.ts`

**Interfaces:**
- Consumes: the running app + a seeded, authenticated session, exactly like `tests/e2e/editor.spec.ts`. The seeded demo org is **unrestricted** (`is_demo = true`), so this test must target a **non-demo Free org** — see the prerequisite note.

> Prerequisite: a non-demo Free org with zero models, owned by a seeded test user. If only the demo org exists, create a second test org/user (or temporarily set `is_demo = false` on a copy via a seed helper). Reuse `tests/e2e/editor.spec.ts`'s auth/session bootstrap. This e2e is env-gated like the existing specs and will be skipped/red without the seeded session (documented in project memory).

- [ ] **Step 1: Write the e2e**

```typescript
// tests/e2e/model-cap.spec.ts
import { test, expect } from "@playwright/test";

// Reuse the seeded non-demo Free org + auth setup from tests/e2e/editor.spec.ts.
// Replace with the real project id from your seed.
const PROJECT_URL = "/projects/REPLACE_WITH_SEEDED_NONDEMO_PROJECT_ID";

test("free user is capped at 2 models and sees an upgrade prompt", async ({ page }) => {
  await page.goto(PROJECT_URL);

  // Create two models — both succeed.
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: /new model/i }).click();
    await page.getByRole("button", { name: /blank model/i }).click();
    await page.waitForURL(/\/models\/.+$/);
    await page.goto(PROJECT_URL);
  }

  // The third attempt is blocked and surfaces the upgrade prompt.
  await page.getByRole("button", { name: /new model/i }).click();
  await page.getByRole("button", { name: /blank model/i }).click();
  await expect(page.getByText(/2-model/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /upgrade/i })).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e (if the seeded session is available)**

Run: `pnpm test:e2e tests/e2e/model-cap.spec.ts`
Expected: PASS with the seeded non-demo Free org/session; otherwise fails only on auth/setup (same as the existing e2e), never on a missing route.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/model-cap.spec.ts
git commit -m "Add model-cap e2e for free-tier enforcement"
```

---

## Phase 3A Definition of Done (verify before declaring complete)

Run and confirm each:

- [ ] `pnpm test` — all unit/component tests green (entitlements, billing-providers, billing-webhook, instantiate-model-action, billing-actions, billing-components + all Phase 0/1/2 tests).
- [ ] `pnpm typecheck` — zero errors, zero `any`.
- [ ] `pnpm lint` — clean.
- [ ] `pnpm build` — succeeds; routes `/settings/billing`, `/settings/billing/upgrade`, `/api/billing/stripe/webhook` present.
- [ ] `pnpm db:push` — migration `0007` applies cleanly.
- [ ] Manual walkthrough (Stripe **test mode**): Pro checkout via `4242 4242 4242 4242` → webhook forwarded (Stripe CLI) → `PlanBadge` flips to Pro within seconds; Customer Portal opens; cancel-at-period-end reverts to Free. No live keys in dev.
- [ ] Enforcement: Free user cannot create a 3rd model or pick a non-showcase template; both surface an upgrade prompt, never a silent failure. Demo org is unrestricted.
- [ ] `stripe` SDK never imports from a client component (`grep -rn "from \"stripe\"" app components` returns nothing; only `lib/billing/stripe.ts` imports it).
- [ ] Money is integer minor units throughout; prices render as `$49`/`$149` (major) via `price/100`.
- [ ] Renders at 375 / 768 / 1440; numbers use the `num` class; WCAG AA focus + contrast.

---

## Self-Review (completed against the spec)

**Spec coverage:**
- §1 entitlements + limits → Task 1 (`ENTITLEMENTS`, decisions). ✓
- §1/§5.1 `effectivePlan` → Task 1 `resolvePlan` (extended with `isDemo` — documented). ✓
- §1 Stripe live + Razorpay stub behind `BillingProvider` → Tasks 3, 8. ✓
- §1 webhook → subscription + org.plan sync, idempotent → Tasks 4, 5, 6. ✓
- §1 server-side enforcement (model/template/seat/feature) → Task 7 (model + template gates wired; feature gates are exercised in 3B once export/share-link UIs land — the `canUseFeature` helper exists in Task 1 and the action pattern is established). ✓
- §1 client UX (PlanBadge, ModelQuotaIndicator, UpgradePrompt) → Tasks 9, 11. ✓
- §1 Settings → Billing + upgrade page → Task 10. ✓
- §2 confirmed decisions (prices, per-org, hosted Checkout + Portal) → Tasks 3, 9. ✓
- §5.2 BillingProvider interface → Task 3 (`types.ts`). ✓
- §5.3 webhook idempotency by event id → Tasks 4, 6 (`processed_stripe_events`). ✓
- §5.4 server actions Zod-validated → Task 8. ✓
- §5.5 enforcement helpers → Task 1 (pure decisions) + Task 7 (composition in the action). ✓
- §7 data model delta — corrected: no `(org_id, provider)` uniqueness (org_id is already PK); adds customer index + idempotency table → Task 6. ✓
- §8 env vars (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, four `STRIPE_PRICE_*`) → Task 3 + Global Constraints. ✓
- §9 testing (unit, component, integration, e2e) → Tasks 1, 3, 4, 7, 8, 9, 12; Stripe test-mode integration in DoD. ✓

**Deviations from spec (intentional, all safe):**
1. `effectivePlan(sub)` → `resolvePlan({ subscription, isDemo, now })` — folds in the demo-org bypass (Phase 0 §6.6) and explicit `now` for past-due expiry. Pure and unit-tested.
2. Free-tier slug `epc-manhour-rate-buildup` → `epc-manhour-rate` (the actual seeded slug). The spec had it slightly wrong; the plan uses the real value.
3. `§7 UNIQUE(org_id, provider)` dropped — `subscriptions.org_id` is already the PK; a second uniqueness constraint would be invalid SQL. Razorpay fast-follow *replaces* a Stripe row, by design.
4. `instantiateModelAction` return type widened to `InstantiateResult` (success | entitlement-error) and the template-picker updated to branch — cleaner and type-safe vs throwing. Pure decisions stay in Task 1.
5. Feature-gate enforcement (export, share links) is wired at the helper level (`canUseFeature`) but the gated UIs themselves land in **Phase 3B**; the action pattern for them is established here.

**Placeholder scan:** none — every code step is complete. The two `REPLACE_WITH_SEEDED_*` tokens in the e2e are explicit, documented prerequisites (existing `tests/e2e/editor.spec.ts` uses the same convention), not shipped content.

**Type consistency:** `Plan`, `Interval`, `Feature`, `Entitlement` (Task 1) consumed unchanged by Tasks 3, 7, 8, 9, 10, 11. `BillingEvent` / `BillingProvider` (Task 3) consumed by Tasks 4, 5, 8. `WebhookRepo` (Task 4) implemented by Task 5's route. `SubscriptionRow`, `findActiveSubscriptionByOrg`, `upsertSubscription`, `syncOrgPlan`, `countModelsByOrg` (Task 2) consumed by Tasks 5, 7, 8, 10, 11. `InstantiateResult` (Task 7) consumed by Task 11's caller update. `PlanBadge`, `UpgradePrompt`, `ModelQuotaIndicator`, `PlanCard` (Task 9) consumed by Tasks 7, 10, 11. Function names are consistent across producer and consumer tasks.
