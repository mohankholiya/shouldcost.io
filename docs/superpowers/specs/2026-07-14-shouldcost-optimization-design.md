# Shouldcost.io — Workspace Optimization Design

- **Date:** 2026-07-14
- **Status:** Approved (design) — pending spec review, then implementation plan
- **Branch:** `phase-0-foundation` (spec authoring; implementation will branch)
- **Author:** Mohan Kholiya + Claude

## 1. Purpose

Six-workstream optimization of the authenticated should-cost workspace:
performance/state, navigation, chart correctness + polish, export, and a
token-based freemium gate on AI drafting. The request that initiated this work
named several "flaws"; this design is built on a **fact-check of the live
code**, not on the request's assumptions, so two of the six named flaws are
treated as already-solved (with minor hardening) rather than rebuilt.

## 2. Verified findings (what the code actually does)

| Area named in request | Verified reality |
|---|---|
| No back arrow / breadcrumb; users get stuck in a model | **True.** `PageHeader` (`components/shared/page-header.tsx`) has no back/breadcrumb slot. The route is flat `/models/[id]`; `project_id` is not in the URL. The only outbound link from the editor is forward to Compare. |
| Charts only init for AI-drafted models | **False (no flag), true (structural symptom).** No `isAiDrafted`/`source` flag exists; charts read the same live tree for both. Manual models render blank because new lines start at `rate: 0` (donut drops `value > 0`) and formula lines (`"9% margin"`) are excluded from the tornado (`sensitivity.ts:17`), producing a silent `"No data yet."` |
| Charts not professional-grade | **True.** No tooltips; tornado is a single-color swing-magnitude bar (wrong form for polarity); currency hardcoded to `"USD"`; palette is light-mode-only; zero memoization (tornado `structuredClone`s the tree once per leaf per render). The palette also **fails** the dataviz validator (see §5.2). |
| "Compare Quotes" non-operational | **False.** Fully built: route `app/(app)/models/[id]/compare/page.tsx`, `components/quotes/*` (matrix, gap waterfall, insight cards), real `quotes`/`quote_lines` tables, server actions, live-formula comparison export, passing e2e. One minor smell: a throwaway empty quote is built to derive leaf lines (`compare-view.tsx:46-53`). |
| Excel export = flat text, no breakdown/charts | **Mostly false.** Already a structured hierarchical CBS breakdown with **native live Excel formulas** (`=SUM`, `=ROUND(qty*rate,0)/100`, `% of group`) in `lib/export/xlsx-model.ts`. The one real gap: no embedded charts (intentional; no image-rendering deps; `exceljs.addImage` never called). |
| High latency on state transitions | **True.** Root cause: `CbsTree` subscribes to coarse store refs; its `columns` useMemo deps are `[rollup, collapsed]`, so the columns array gets a new identity on every keystroke and TanStack re-renders every row; both charts then recompute. |
| Token/freemium AI gate missing | **True — greenfield for tracking.** `FREE_LAUNCH = true` (`lib/entitlements.ts:65`) elevates everyone to pro; no persisted AI tracking exists (only an in-memory per-instance limiter that resets on restart). **But** Stripe (checkout/portal/idempotent webhook), `subscriptions`, the entitlements catalog, and upgrade UI are fully built and switched off. |

**Architecture facts the design targets:**

- Single Zustand store: `lib/stores/editor-store.ts` (`nodes: Record<id, CostNodeRow>`, `order`, `rollup`, `selectedId`, `dirtyIds`, `deletedIds`, `saveStatus`).
- Pure model logic: `lib/model/{rollup-live,tree,sensitivity,comparison,types}.ts`. Money = integer minor units everywhere.
- Charts: `components/models/charts/{rollup-donut,tornado-chart}.tsx`, palette `lib/chart-palette.ts`.
- Export: `lib/export/{xlsx-model,xlsx-comparison,excel-layout}.ts`, route `app/api/models/[id]/export/route.ts`.
- AI draft: `components/ai/draft-model.tsx` → `app/api/ai/draft-model/route.ts` → `lib/actions/model.ts:createModelFromDraftAction`.
- Workspace = `organizations` table (`id, name, plan, is_demo`), RLS-protected, scoping fn `public.current_user_orgs()`.
- Entitlements: `lib/entitlements.ts` (`ENTITLEMENTS`, `resolveEffectivePlan`, `FREE_LAUNCH`).

## 3. Locked decisions (from user)

1. **Scope:** all six workstreams in one pass.
2. **Monetization:** hard flip — `FREE_LAUNCH = false`, gate Draft-with-AI to 1 free per workspace, pro/team unlimited, upgrade modal links to live Stripe checkout.
3. **AI gate scope:** Draft-with-AI only. Suggest-node and Explain-gap stay open (structured for future gating).
4. **Export:** embed rendered chart images (donut + tornado) via a server-side render pipeline.

## 4. Ripple effect to confirm (accepted by user)

Flipping `FREE_LAUNCH = false` also activates the **existing** entitlement gates that are currently bypassed. A free workspace will therefore additionally: lose Export, Share links, and Version history; be capped at 2 models. Demo orgs remain on `team`. This is the intended, explicit consequence of "turn billing on."

## 5. Design by workstream

### 5.1 Workstream A — Performance & state

**Root cause (keep the live rollup, localize the re-renders):** `rollupLive(buildTree(...))` runs synchronously on every mutation and is O(tree) — cheap. The latency is the **re-render cascade**, not the rollup.

**Changes:**

1. **Stabilize the TanStack `columns` array** (`components/models/cbs-tree/cbs-tree.tsx`).
   - Today `columns` has `useMemo` deps `[rollup, collapsed]`; every `setCell` creates a new `rollup`, so `columns` gets a new identity and every row re-renders.
   - Move each per-cell `rollup`/total read out of the column-definition closures and into the cell components (which already select `useEditorStore(s => s.nodes[id]?.field)`). After this, `columns` is `useMemo(() => […], [])` — identity-stable for the editor's lifetime. A new `rollup` no longer re-renders every row; only the specific total cell that reads it re-renders.
   - `rows` useMemo deps become `[order, collapsed]` (drop `nodes`); row bodies read their node inside the memoized `CbsRow` via selector.

2. **Memoized row component.** Extract `CbsRow` (`React.memo`) that selects its own node with `useEditorStore((s) => s.nodes[id])` (wrapped in `useShallow` to avoid identity churn on the object). Editing one cell updates only that row + the header total.

3. **Debounce chart inputs (200 ms).** New `components/models/charts/use-debounced-rollup.ts` exposes `useDebouncedRollup()` returning a rollup whose identity changes at most every 200 ms. Charts consume the debounced rollup, so they stop recomputing on every keystroke while still updating live.

4. **Content-keyed derivation memo.** Add a `rev: number` counter to the store, bumped only inside value-changing mutations (`setCell`, `bindIndex`, `addLine`, `addGroup`, `removeNode`, `hydrate`, `recompute`). Chart components `useMemo` their data on `[rev, pct, currency]`, so a re-render with no value change is a no-op.

5. **Single-pass tornado coefficient walk** (`lib/model/sensitivity.ts`).
   - The rollup is piecewise-linear in each non-formula leaf's `rate`. Therefore `swing = |dTotal/dRate| · baseRate · (2·pct/100)`, and `|dTotal/dRate|` is computable for **all** leaves in a single O(tree) walk that propagates the coefficient through ancestor groups and any downstream formula lines that reference a containing group.
   - Public output type `TornadoBar` is unchanged (`{ nodeId, name, low, high, swing }`); add an internal `baseline` to support the diverging chart (Workstream C). `low`/`high` are reconstructed as `baseline ∓ swing/2` (they remain the totals at rate·(1∓pct)).
   - Replaces the O(leaves × tree) `structuredClone`-per-leaf loop.
   - **Equivalence guarantee:** unit tests assert the new walk reproduces the current `tornado()` output for the existing fixtures before the old path is removed.

**Targets:** `lib/stores/editor-store.ts`, `components/models/cbs-tree/cbs-tree.tsx` + new `cbs-row.tsx`, `lib/model/sensitivity.ts`, new `components/models/charts/use-debounced-rollup.ts`.

### 5.2 Workstream B — Navigation

**Changes:**

1. Extend `PageHeader` (`components/shared/page-header.tsx`) with optional slots: `breadcrumbs?: React.ReactNode` and `back?: { href: string; label: string }`. Render `back` as a styled `← {label}` link above the title; render `breadcrumbs` as a chevron-separated trail.
2. New `components/layout/breadcrumbs.tsx`: `Breadcrumbs({ items: { label, href? }[] })` (last item is plain text, others are `Link`s). Items render in text tokens (never series colors); chevron separators in muted ink.
3. Load the parent project on the model page. Extend `lib/db/models.ts` `loadModel` (or a thin `loadModelWithProject`) to return `project_id` + `project_name` (join `projects`). `ModelHeader`/`ModelEditor` already carry `model`; thread `project` through props.
4. Editor breadcrumb: `Home › Projects › {Project} › {Model}` + `← Back to Project` (href `/projects/{project_id}`). Wire in `components/models/model-editor.tsx`.
5. Compare breadcrumb: `Home › Projects › {Project} › {Model} › Compare quotes` + `← Back to Model` (href `/models/{model_id}`). Wire in `app/(app)/models/[id]/compare/page.tsx` + `components/quotes/compare-view.tsx`.
6. Sidebar "Recent models" already exists; no change required.

**Targets:** `components/shared/page-header.tsx`, new `components/layout/breadcrumbs.tsx`, `lib/db/models.ts`, `app/(app)/models/[id]/page.tsx`, `app/(app)/models/[id]/compare/page.tsx`, `components/models/model-editor.tsx`, `components/quotes/compare-view.tsx`.

### 5.3 Workstream C — Charts: correctness for manual models + professional polish

Method (per the `dataviz` skill): form → color → marks → interaction → accessibility. Color is **validator-locked, not eyeballed**.

#### 5.3.1 Palette rework (`lib/chart-palette.ts`)

The current petrol categorical set **fails** the validator: lightness band spans L 0.343→0.855 (outside band) and every petrol tone is below the chroma floor (reads gray). Rework:

- **Categorical (donut):** adopt a **validator-passing 6-slot set** — confirmed CVD ΔE 24.2, with two slots (aqua, yellow) below 3:1 contrast whose relief is satisfied by the always-present side legend + table view. Candidate (validated): `#2a78d6, #1baf7a, #eda100, #008300, #4a3aa7, #e34948`.
- **Diverging (tornado):** amber ↔ green — **validated ΔE 32.3, all checks pass**: `#b45309` (increase / cost-up) ↔ `#059669` (decrease / cost-down), neutral gray midpoint. This reuses the app's existing waterfall semantics (`CHART.increase`, `CHART.decrease`).
- **Primary single-series accent:** keep petrol `#0b3c5d` (`PETROL_600`) for any single-series/one-color mark (a lone color is exempt from band/chroma checks).
- **Dark mode (selected, not auto-flipped):** add validated dark steps for the categorical set and the diverging pair against the dark surface (`#1a1a19`), delivered through a new `useChartColors()` hook that reads CSS tokens via `getComputedStyle(document.documentElement)`. This resolves the documented `TODO(phase-4 dark)`.
- **Final values are locked by re-running `validate_palette.js`** for both `--mode light` and `--mode dark` during implementation; the candidates above are the validated starting points.

#### 5.3.2 Cost Composition donut (`components/models/charts/rollup-donut.tsx`)

- **Form:** keep donut (part-to-whole, ≤ 6 segments). **Fold the tail into "Other"** beyond 6 slices — no hue cycling past 8 (anti-pattern). `donutData` returns at most 6 named slices + one optional `Other`.
- **Marks:** 2 px surface gap between slices (Recharts `paddingAngle` / stroke = surface color); recessive chrome.
- **Currency:** thread `model.currency` (kills the `"USD"` hardcode bug; `format.ts` already supports EUR/GBP/SAR/AED/INR).
- **Interaction:** add Recharts `<Tooltip>` (currency-aware). Hit targets include the 2 px gap.
- **Accessibility:** `<svg role="img" aria-label="…">` via a wrapping container; the side legend (name · currency · %) and the copy-data CSV are the table-view twin. **Diagnostic empty state:** replace generic `"No data yet."` with a targeted message — "Add rate-carrying line items (or fill in rates) to see cost composition" — so a manual model with `rate: 0` lines or only groups is explained, not silently blank.

#### 5.3.3 Driver Sensitivity tornado (`components/models/charts/tornado-chart.tsx`) — form change

- **Form:** convert from a single-color magnitude bar to a **diverging horizontal tornado**: a vertical **baseline reference line** at the current model total; for each driver, one bar left (low outcome) and one bar right (high outcome) from that baseline; sorted by total swing descending, largest on top; top 8 shown.
- **Color:** amber (high / cost-up) and green (low / cost-down) from the validated diverging pair; neutral gray baseline line (solid hairline, never dashed).
- **Labels (institutional-reporting standard):** center baseline marker with its value; each bar end direct-labeled `−Δ` / `+Δ` in currency and percent with explicit sign; numeric labels use `tabular-nums`; X-axis **visible** (not hidden) with currency ticks.
- **Interaction/a11y:** per-bar tooltip showing low / baseline / high totals; table-view twin via copy-data; `role="img"` + `aria-label`. Perturbation input remains, keyboard-accessible.
- **Currency:** thread `model.currency`.

**Targets:** `components/models/charts/{rollup-donut,tornado-chart}.tsx`, `lib/chart-palette.ts` (+ dark steps + `useChartColors`), `lib/model/sensitivity.ts`, `model-editor.tsx` (pass `currency`), `tests/unit/{charts,sensitivity}.*`.

### 5.4 Workstream D — Compare Quotes: keep + harden

Functionally complete; no rebuild.

1. Replace the throwaway-empty-quote leaf-lines derivation (`components/quotes/compare-view.tsx:46-53`) with the existing `leafLines()` helper from `lib/model/comparison.ts`.
2. Add breadcrumb + `← Back to Model` (from §5.2).
3. **Open item:** if a specific "non-operational" repro exists (a dead button, an error, a blank tab), it will be captured and root-caused during implementation. Without a repro, this workstream is the two items above.

**Targets:** `components/quotes/compare-view.tsx`, breadcrumb wiring.

### 5.5 Workstream E — Advanced XLSX export: embed rendered charts

Keep the structured breakdown + all live formulas; add embedded visuals.

1. **Shared data-prep:** extract/confirm `donutData(nodes, rollup)` and `tornado(nodes)` as the single sources both the on-screen charts and the export consume (they are already pure; this formalizes the contract).
2. **New `lib/export/chart-svg.ts`:** pure `renderDonutSvg(data, currency, theme): string` and `renderTornadoSvg(bars, baseline, currency, theme): string` returning SVG strings, using the **same validated palette** as the on-screen charts (light surface for print-friendly output). No DOM/React dependency — string construction only.
3. **Rasterize SVG → PNG with `sharp`** (new dependency; Vercel-supported): `sharp(Buffer.from(svg)).png().toBuffer()`.
4. **Embed in `lib/export/xlsx-model.ts`:** after the breakdown sheet (untouched, formulas intact), `worksheet.addImage(png, { tl, br })` places the donut below the breakdown, with a caption cell. Optionally add the tornado image. `xlsx-comparison.ts` may add the waterfall image.
5. **No API change** (`app/api/models/[id]/export/route.ts`); the entitlement gate stays server-side.

**Targets:** new `lib/export/chart-svg.ts`, `lib/export/{xlsx-model,xlsx-comparison}.ts`, `package.json` (`+ sharp`), `tests/unit/chart-svg.*`.

### 5.6 Workstream F — Token-based freemium (1 free Draft-with-AI, hard billing flip)

#### 5.6.1 Schema — migration `supabase/migrations/0008_ai_credits.sql`

One migration owns the whole feature: the column plus the two atomic RPCs the
route calls (see §5.6.3). `security definer` runs as the table owner so a member
cannot bypass the `> 0` guard; the decrement returns the new balance or no rows
(surfaced as `null`) when exhausted.

```sql
-- One free "Draft with AI" per workspace. Pro/team are unlimited via plan, not this counter.
alter table organizations
  add column ai_draft_credits integer not null default 1;
-- Backfill is implicit (column default applies to existing rows): every existing org starts with 1.

-- Atomically reserve one credit before the Anthropic call. Returns the new balance, or NULL when exhausted.
create or replace function public.dec_ai_credit(p_org_id uuid)
returns integer language sql security definer set search_path = public as $$
  update public.organizations
    set ai_draft_credits = ai_draft_credits - 1
    where id = p_org_id and ai_draft_credits > 0
    returning ai_draft_credits;
$$;
grant execute on function public.dec_ai_credit(uuid) to authenticated;

-- Refund one credit on a failed/aborted draft.
create or replace function public.inc_ai_credit(p_org_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.organizations
    set ai_draft_credits = ai_draft_credits + 1
    where id = p_org_id;
$$;
grant execute on function public.inc_ai_credit(uuid) to authenticated;
```

`organizations` inherits the existing `org_read` / `org_admin` RLS policies automatically; the RPCs are the only write paths for the counter (members never update the column directly). TypeScript mirror updated in `lib/db/orgs.ts` (`CurrentOrg.organizations.ai_draft_credits`).

#### 5.6.2 Entitlements (`lib/entitlements.ts`)

- Add `aiDraftCredits: number | null` to `Entitlement` (null = unlimited). Values: `free → 1`, `pro → null`, `team → null`.
- Add `aiDraftCreditsFor(plan: Plan): number | null` and `canDraftWithAi(plan: Plan, creditsRemaining: number): boolean` (`plan !== "free"` → true; else `creditsRemaining > 0`).
- Set `export const FREE_LAUNCH = false;` (the flip — see §4 ripple).

#### 5.6.3 Server gate — `app/api/ai/draft-model/route.ts` (authoritative)

Order of operations after the existing `isAiEnabled()` + `getCurrentOrg()` + rate-limit checks:

1. Resolve effective plan for the org (`resolveEffectivePlan({ subscription, isDemo })`).
2. If `plan !== "free"` → unlimited; proceed to the Anthropic call (no counter touch).
3. If `plan === "free"`:
   - **Reserve** a credit *before* the Anthropic call, atomically and race-safe, via a single Postgres RPC invoked through the service-role admin client:
     ```ts
     // returns the new balance, or null when the org had no credits left
     const { data: remaining } = await supabaseAdmin
       .rpc("dec_ai_credit", { p_org_id: org.org_id });
     if (remaining === null) {
       return NextResponse.json(
         { error: "AI_CREDITS_EXHAUSTED", requiredPlan: "pro" },
         { status: 402 },
       );
     }
     ```
     The `dec_ai_credit` RPC (defined in §5.6.1) performs the conditional decrement in one statement; a `null` return means "no credits left" and short-circuits before any Anthropic call.
   - On success, call Anthropic, persist via `createModelFromDraftAction`. The reservation stays consumed.
   - On Anthropic failure or parse failure → **refund**: `ai_draft_credits = ai_draft_credits + 1` (RPC `inc_ai_credit`), then return the existing 502.
4. Keep the in-memory rate limiter as a secondary abuse guard.

> Race-safety: the `where ai_draft_credits > 0` conditional update is the single authoritative decrement; two concurrent requests cannot both reduce a 1-credit balance to a negative number. The reserve-before-call ordering means a credit is only spent on a draft that will actually be attempted.

#### 5.6.4 Client intercept — `components/ai/draft-model.tsx`

- The project page already resolves `plan`; thread `aiDraftCredits` (read from the org row) into `<DraftModel projectId plan aiDraftCredits />`.
- In `run()`, before `fetch("/api/ai/draft-model")`: if `canDraftWithAi(plan, aiDraftCredits) === false` → **do not dispatch**; open `<UpgradeAiDraftsModal>` instead.
- On a `402 AI_CREDITS_EXHAUSTED` response (e.g., race the client lost), also open the modal.
- The "1 free draft left" state is shown subtly in the Draft panel (e.g., "1 AI draft remaining on the Free plan") so users understand the limit before hitting it.

#### 5.6.5 Upgrade modal — new `components/ai/upgrade-ai-drafts-modal.tsx`

- Reuses `components/billing/plan-card.tsx` + `createCheckoutSessionAction` (already wired to Stripe checkout, now active because `FREE_LAUNCH = false`).
- Copy: "You've used your free AI draft. Upgrade to Pro for unlimited AI drafts — and unlock export, version history, and unlimited models." (Consulting-native tone; no hype.)
- Structured so a future "buy more credits" / Suggest+Explain gating hook slots in without redesign.

#### 5.6.6 Suggest-node & Explain-gap

Stay open. They retain the existing in-memory rate limiter. Because the credit/entitlement seam is general, gating them later is additive.

#### 5.6.7 Manual edits stay free

`addGroup` / `addLine` are pure `useEditorStore` mutations (Workstream A) and never touch the AI route or the credit counter. Confirmed out of scope for gating.

**Targets:** `supabase/migrations/0008_ai_credits.sql` (column + `dec_ai_credit`/`inc_ai_credit` RPCs), `lib/entitlements.ts`, `app/api/ai/draft-model/route.ts`, `lib/db/orgs.ts`, `app/(app)/projects/[id]/page.tsx`, `components/ai/draft-model.tsx`, new `components/ai/upgrade-ai-drafts-modal.tsx`, RLS integration test.

## 6. Testing

- **Unit (`vitest`):**
  - `sensitivity.test.ts` — new coefficient walk reproduces legacy `tornado()` outputs on existing fixtures; `baseline`/`low`/`high` invariants.
  - `charts.test.tsx` — donut "Other" fold at >6 roots; diagnostic empty states; currency threading.
  - `chart-svg.test.ts` — SVG builders produce well-formed output for empty, single, and multi-slice/bar inputs.
  - `entitlements.test.ts` — `canDraftWithAi` / `aiDraftCreditsFor` matrix; `resolveEffectivePlan` with `FREE_LAUNCH=false`.
  - `ai-credit.test.ts` — reserve/refund arithmetic; exhaustion → 402.
- **RLS integration (`vitest --config vitest.integration.config.ts`):** `dec_ai_credit`/`inc_ai_credit` enforce `> 0`; cross-org isolation; service-role-only writes where required.
- **E2E (`playwright`):**
  1. First free Draft-with-AI succeeds and decrements to 0; second attempt is intercepted client-side by the upgrade modal (no API call).
  2. Back-arrow + breadcrumb navigate Home → Projects → Model → Compare and back.
  3. A manually-built model with filled rates renders the donut and tornado (not blank).
  4. Export produces an `.xlsx` containing the breakdown sheet (live formulas) and the embedded chart image.

## 7. Definition of done

- No placeholder text/metrics anywhere; no `TODO` tokens in shipped copy.
- Lighthouse ≥ 90 on Performance, Accessibility, Best Practices, SEO.
- Fully keyboard-navigable with visible focus; WCAG 2.1 AA (chart contrast relief via labels + table view).
- Renders correctly at 375 / 768 / 1440 px.
- All links work: email, LinkedIn, résumé (portfolio site), and every internal anchor/breadcrumb/back link.
- `pnpm typecheck`, `pnpm lint`, `pnpm test` green; `pnpm test:integration` green; `pnpm test:e2e` green for the flows above.
- Chart palette passes `validate_palette.js` for `--mode light` and `--mode dark`.

## 8. Out of scope / deferred

- PDF export (`501` stub, "Phase 3C").
- Razorpay provider (stub).
- Gating Suggest-node / Explain-gap (structured for, not implemented).
- Sentry / comments / audit-log UI (Phase 4B).
- Restructuring the flat `/models/[id]` route into nested `/projects/[id]/models/[id]` (breadcrumb solves the UX without a route migration; revisit if routing pain grows).

## 9. Risks

- **`sharp` on Windows dev / Vercel:** supported on both; if a local install fails, gate chart-image export behind a try/catch and fall back to the (already strong) formula-only breakdown so export never 500s.
- **Tornado coefficient correctness with formula lines:** a formula line referencing a group that contains the perturbed leaf amplifies the swing. The single-pass walk must propagate the coefficient through such references; equivalence tests guard this before the legacy path is removed.
- **`FREE_LAUNCH` flip surprises existing free-beta users:** mitigated by clear in-product upgrade CTAs and the existing upgrade page; demo orgs unaffected.
- **Credit race at the boundary:** reserve-before-call + conditional decrement eliminates negative balances; the only residual is two near-simultaneous first drafts both succeeding, which is acceptable for a 1-free-credit product and self-corrects on the next attempt.
