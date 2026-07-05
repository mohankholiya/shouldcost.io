# Phase 3A — Entitlements + Billing + Plan-gated UI (Design Spec)

**Project:** shouldcost.io
**Phase:** 3A of 5 (first slice of Phase 3 — the monetization spine)
**Status:** Approved (pending written-spec review)
**Date:** 2026-07-05
**Builds on:** Phase 0 (foundation, `subscriptions` + `organizations.plan` enum `free|pro|team`, RLS) and Phase 1/2 (model editor, quotes & comparison).

---

## 1. Purpose

Phase 3A turns shouldcost.io from a free tool into a billable product. It adds the **entitlements layer** (what each plan allows), **Stripe billing** (subscribe, upgrade, cancel), and the **plan-gated UI** (quota indicators, feature locks, upgrade prompts) so a Free user can hit a limit and complete an upgrade to Pro or Team without leaving the app.

Phase 3 is decomposed into three slices, each its own spec → plan → build cycle:
- **3A (this spec):** entitlements + billing + plan-gated UI.
- **3B:** PDF/XLSX export + public share links (paid-tier user value).
- **3C:** marketing site + public SEO calculators + template gallery (growth; gated on seed-template sign-off).

End state of 3A: a Free user signs up, hits the 2-model cap or a Pro feature lock, follows the upgrade prompt to Stripe Checkout, completes payment, and within seconds the sidebar badge flips to **Pro**, the quota indicator disappears, and previously-locked actions are available. Cancellation flows through the Stripe Customer Portal and downgrades the org to Free at period end.

### Phase 3A scope boundary

**In scope:**
- `lib/entitlements.ts`: plan → limits matrix, feature gates, `effectivePlan` resolver.
- `lib/billing/` behind a `BillingProvider` interface: **Stripe live** (Checkout + Customer Portal + webhook), **Razorpay stubbed** (throws `NOT_IMPLEMENTED`) as a documented fast-follow.
- Stripe webhook handler that upserts `subscriptions` and syncs `organizations.plan`, idempotent by Stripe event ID.
- Server-side enforcement of model/template/seat caps and feature gates on every restricted mutation.
- Client UX: `PlanBadge`, `ModelQuotaIndicator`, `UpgradePrompt`, locked-feature affordances.
- Settings → Billing page (current plan, manage link, invoices via Customer Portal) and an upgrade page (pick plan + monthly/annual).
- Tests: unit (entitlements, webhook), component (billing UI), one e2e (Free user hits cap → upgrade prompt), Stripe-test-mode integration env-gated.

**Explicitly out of scope (deferred):**
- **Razorpay live** (INR India collections) → fast-follow behind the existing interface; not required to run 3A.
- **PDF/XLSX export** and **public share links** UI → Phase 3B (entitlements gate them in 3A, but the features themselves are built in 3B).
- **Marketing site, SEO calculators, template gallery** → Phase 3C.
- **Free trial** of paid tiers (`trial_end` on checkout) → fast-follow.
- **Stripe Tax**, **Team per-seat metered add-ons** (3A ships Team as flat 5 seats) → documented follow-ups.
- **Webhook reconcile job** (periodic truth-sync beyond Stripe's retries) → follow-up.

---

## 2. Confirmed decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Plan tiers | `free` / `pro` / `team` (already a Postgres enum) | Matches Phase 0 schema; covers solo → team buyer arc |
| Pricing (real, not placeholder) | Free $0 · Pro $49/mo or $490/yr · Team $149/mo or $1,490/yr (5 seats) | Accepted by owner; annual = 10× monthly (2 months free) |
| Entitlement model | Quantity gates on Free; **feature gates** differentiate paid tiers; Pro/Team = unlimited models & templates | Free caps drive conversion; paid tiers compete on features/seats, not counts |
| Billing unit | Per-org (matches `subscriptions(org_id, …)`); Team includes 5 seats | Solo-first product; seat add-ons are a follow-up |
| Money | Integer minor units (USD cents) everywhere; `lib/money.ts` reused | Continues the no-floats discipline |
| Provider scope (3A) | **Stripe live**; Razorpay stubbed behind `BillingProvider` | Stripe covers USD/GCC + hosted Checkout/Portal keep 3A small; Razorpay drops in later for INR |
| Checkout flow | **Stripe Checkout (hosted)** for upgrade; **Stripe Customer Portal (hosted)** for manage/cancel | Minimal build, SCA/taxes handled by Stripe, robust |
| Entitlement source of truth | **Limits in code** (`ENTITLEMENTS`); **paid status in `subscriptions`**; `organizations.plan` a denormalized cache | Plan-limit change = one-line deploy; status survives webhook replays |
| Enforcement | Server-side at server-action/repository layer (the real gate); client locks are UX only | Client cannot be trusted; every restricted mutation checked before DB write |
| Free-tier templates | Three showcase slugs spanning all three industries: `octg-casing-tubing`, `power-transformers`, `epc-man-hour-rate-buildup` | Hardcoded in `ENTITLEMENTS`; no migration for a 3-element list |

---

## 3. Tech stack (delta over Phase 2)

- **`stripe`** Node SDK (new dependency) — server only, never reaches the browser bundle.
- No other new runtime dependencies. Server actions, RHF + Zod, Supabase, Next.js route handlers are already in place.
- Dev uses Stripe **test mode** + the Stripe CLI to forward webhooks to `localhost`.

---

## 4. File / folder structure (delta)

```
app/(app)/settings/
├── billing/page.tsx                       # current plan + "Manage subscription" (portal)
└── billing/upgrade/page.tsx               # pick plan + monthly/annual toggle

app/api/billing/stripe/webhook/route.ts    # raw body + signature verify → handleStripeEvent

lib/
├── entitlements.ts                        # ENTITLEMENTS config + helpers (new)
├── billing/
│   ├── types.ts                           # BillingProvider interface, BillingEvent type
│   ├── stripe.ts                          # StripeProvider (live)
│   ├── razorpay.ts                        # RazorpayProvider (stub → NOT_IMPLEMENTED)
│   ├── index.ts                           # getBillingProvider() — env-driven factory
│   └── webhook.ts                         # handleStripeEvent → upsert sub + sync org.plan
├── db/subscriptions.ts                    # upsert, findActiveByOrg, syncOrgPlan (new)
└── actions/billing.ts                     # createCheckoutSessionAction, createPortalSessionAction

components/billing/
├── plan-badge.tsx                         # sidebar Free/Pro/Team chip
├── plan-card.tsx                          # pricing card (upgrade page)
├── upgrade-prompt.tsx                     # inline lock CTA (reused across the app)
└── model-quota-indicator.tsx              # "2 / 2 models · Upgrade"

supabase/migrations/
└── 0007_subscription_constraints.sql      # UNIQUE(org_id, provider); provider_customer_id index
```

---

## 5. Core units & interfaces

### 5.1 Entitlements (`lib/entitlements.ts`) — pure, no I/O

```ts
export type Plan = "free" | "pro" | "team";
export type Feature =
  | "export" | "shareLinks" | "versionHistory" | "auditLog" | "members";

export interface Entitlement {
  plan: Plan;
  maxModels: number | null;                 // null = unlimited
  maxTemplates: number | null;
  accessibleTemplateSlugs: string[] | null; // null = all
  maxSeats: number;
  features: Record<Feature, boolean>;
  price: { monthly: number; annual: number }; // integer minor units (USD cents)
}

export const ENTITLEMENTS: Record<Plan, Entitlement>;
export function getEntitlement(plan: Plan): Entitlement;
export function canUseFeature(plan: Plan, f: Feature): boolean;

// Active, non-past-due subscription → its plan; otherwise "free".
export function effectivePlan(sub: SubscriptionRow | null, now?: Date): Plan;
```

**Matrix (the values shipped in code):**

| Plan | maxModels | maxTemplates | slugs | maxSeats | features (true) | price (cents) |
|------|-----------|--------------|-------|----------|-----------------|---------------|
| free | 2 | 3 | the 3 showcase slugs | 1 | (none) | {0, 0} |
| pro | null | null | null (all 17) | 1 | export, shareLinks, versionHistory | {4900, 49000} |
| team | null | null | null (all 17) | 5 | export, shareLinks, versionHistory, auditLog, members | {14900, 149000} |

### 5.2 Billing provider (`lib/billing/types.ts` + `stripe.ts`)

```ts
export interface BillingProvider {
  name: "stripe" | "razorpay";
  createCheckoutSession(input: {
    orgId: string;
    plan: Plan;
    interval: "monthly" | "annual";
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ url: string }>;
  createPortalSession(input: { customerId: string; returnUrl: string }): Promise<{ url: string }>;
  parseWebhook(req: Request): Promise<BillingEvent>;
}

export type BillingEvent =
  | { kind: "subscription_created" | "subscription_updated" | "subscription_deleted"
      orgId: string; plan: Plan; providerCustomerId: string;
      status: "active" | "past_due" | "canceled"; currentPeriodEnd: Date }
  | { kind: "unknown" };
```

- `StripeProvider` uses `stripe.checkouts.sessions.create` (mode `subscription`, line items derived from `plan × interval` against Stripe Price IDs held in env/config) and `stripe.billingPortal.sessions.create`.
- `RazorpayProvider` throws `new Error("RAZORPAY_NOT_IMPLEMENTED")` on every method — present so the seam compiles and the entitlements layer can stay provider-agnostic.

### 5.3 Webhook handler (`lib/billing/webhook.ts` + `lib/db/subscriptions.ts`)

- `handleStripeEvent(event: BillingEvent)`: maps the event to a `subscriptions` upsert keyed by `(org_id, provider="stripe")` and writes `organizations.plan` via `syncOrgPlan(orgId)`. `effectivePlan` reads the active subscription to recompute.
- **Idempotency:** the `processed_stripe_events` table (see §7) dedupes by Stripe event ID so replays are safe.
- `currentPeriodEnd` stored on the subscription row (existing column).

### 5.4 Server actions (`lib/actions/billing.ts`)

- `createCheckoutSessionAction(plan, interval)` — Zod-validated; resolves org, calls `getBillingProvider().createCheckoutSession(…)`, returns the URL for client redirect.
- `createPortalSessionAction()` — resolves org's `provider_customer_id`, returns Customer Portal URL.
- Both run under the user's RLS session; both check the caller is an `admin` of the org.

### 5.5 Enforcement helpers (in `lib/entitlements.ts`, used by repositories/actions)

- `assertCanCreateModel(orgId)` — counts the org's models, compares to `entitlement.maxModels`; throws `EntitlementError("MODELS_EXCEEDED")` if over.
- `assertCanUseFeature(plan, feature)` — throws `EntitlementError("FEATURE_LOCKED")` if not permitted.
- `canUseTemplate(plan, slug): boolean` — true iff `accessibleTemplateSlugs` is null (all) or contains `slug`; backs the template-picker filter (Free → 3, Pro/Team → 17).

---

## 6. Data flow

**Upgrade:** sidebar "Upgrade" CTA → `/settings/billing/upgrade` → choose Pro/Team + monthly/annual → `createCheckoutSessionAction` → browser redirects to Stripe Checkout URL → on success Stripe redirects to `/settings/billing?upgraded=1` **and** fires a webhook → `handleStripeEvent` upserts subscription + `syncOrgPlan` → next server render shows `PlanBadge = Pro` + toast "Upgraded ✓".

**Manage / cancel:** `/settings/billing` → "Manage subscription" → `createPortalSessionAction` → Stripe Customer Portal. Cancel-at-period-end → `subscription_deleted` (or `updated` to `canceled`) webhook → org reverts to `free` at `currentPeriodEnd`.

**Enforcement (server, the real gate):**
- `createModelAction` → `assertCanCreateModel(orgId)` → over cap → `EntitlementError` → client shows `UpgradePrompt`.
- Export / share-link creation (their UIs land in 3B; the gate exists in 3A) → `assertCanUseFeature(plan, …)`.
- Template picker → filters server-side by `accessibleTemplateSlugs`; Free sees 3, Pro/Team see 17.

**Client UX:** server components resolve `effectivePlan` once per render and pass the `Entitlement` down; locked controls render `LockIcon` + tooltip "Upgrade to Pro to export." The model counter shows `2 / 2 models · Upgrade` on Free.

---

## 7. Data model (delta)

No new product tables. One migration:

`0007_subscription_constraints.sql`
- `ALTER TABLE subscriptions ADD CONSTRAINT subs_org_provider_unique UNIQUE (org_id, provider);` — one subscription per org per provider.
- Index on `subscriptions(provider, provider_customer_id)` for webhook customer lookup.
- A small `processed_stripe_events(event_id text primary key, created_at timestamptz)` table for webhook idempotency.

RLS already scopes `subscriptions` via the org chain (Phase 0 policies). Webhook route uses the service-role admin client (signature verification is the trust boundary, not RLS).

---

## 8. Env vars (delta)

```
STRIPE_SECRET_KEY=                     # server-only
STRIPE_WEBHOOK_SECRET=                 # Stripe CLI / dashboard
STRIPE_PRICE_PRO_MONTHLY= price_…      # Price IDs for the 4 plan×interval combos
STRIPE_PRICE_PRO_ANNUAL=  price_…
STRIPE_PRICE_TEAM_MONTHLY= price_…
STRIPE_PRICE_TEAM_ANNUAL=  price_…
# Fast-follow (not required to run 3A):
RAZORPAY_KEY_ID= · RAZORPAY_KEY_SECRET= · RAZORPAY_WEBHOOK_SECRET=
```

`.env.example` updated; `.env.local` stays gitignored.

---

## 9. Testing

- **Unit:** `entitlements.test.ts` — per-plan limits, feature flags, `effectivePlan` active vs past-due vs null → `free`. `billing/webhook.test.ts` — event → subscription upsert, plan sync, idempotent replay.
- **Component:** `plan-card`, `upgrade-prompt`, `model-quota-indicator`, `plan-badge` (Vitest + Testing Library).
- **Integration (env-gated):** Stripe test-mode checkout (`4242 4242 4242 4242`) → forwarded webhook → plan synced on the org.
- **e2e (Playwright):** Free-seeded user creates 2 models, the 3rd attempt surfaces `UpgradePrompt`; plan mocked to avoid a live Stripe call in CI.

---

## 10. Definition of done (Phase 3A)

- `ENTITLEMENTS` enforces Free/Pro/Team limits server-side; every restricted mutation is gated and surfaces a clear `UpgradePrompt`, never a silent failure.
- Stripe Checkout upgrades a Free org to Pro/Team; the webhook syncs the plan within seconds; Customer Portal opens and cancel-at-period-end correctly reverts to Free.
- Model cap (2), template access (3 vs 17), and seat cap enforced; over-cap actions show upgrade CTAs.
- `Settings → Billing` shows current plan + "Manage subscription."
- TypeScript strict, zero `any`; Zod on every billing action; all money integer minor units; `stripe` import never reaches the browser bundle.
- Real Stripe env in prod, test mode + CLI in dev; no placeholder prices.
- Lighthouse ≥ 95; WCAG AA contrast and focus states; renders at 375 / 768 / 1440.

---

## 11. Risks & open items

- **Webhook reliability** — mitigated by signature verification + event-ID idempotency + Stripe's retries. A periodic reconcile job is a documented follow-up (not in 3A).
- **Plan desync between `subscriptions` and `organizations.plan`** — both written in the same webhook handler; `effectivePlan` recomputes from `subscriptions` so a stale cache value self-heals on the next paid-state event.
- **Team per-seat add-ons** — 3A ships Team as a flat 5 seats; metered extra seats are a follow-up. Seat count is enforced at `org_members` invite time.
- **No free trial in 3A** — `trial_end` is a fast-follow on the checkout call.
- **Stripe Tax / invoicing** — customer self-handles in 3A; Stripe Tax is a later refinement.
- **Razorpay** — interface present, methods stubbed. INR India collections land in a tight follow-up with no entitlements-layer changes.

---

## 12. Next step

On written-spec review, invoke the **writing-plans** skill to produce the Phase 3A implementation plan (anticipated waves: A entitlements module + tests → B `BillingProvider` + Stripe provider + webhook → C server-side enforcement wired into existing actions → D billing UI + settings pages → E QA + Stripe test-mode integration). 3B and 3C each get their own spec at their own session.
