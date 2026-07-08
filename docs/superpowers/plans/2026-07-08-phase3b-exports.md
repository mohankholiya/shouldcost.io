# Phase 3B — Exports (XLSX + PDF) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the should-cost artifact portable. A Pro/Team user downloads an XLSX of a model (CBS tree, live formulas — edit a driver in Excel and it recomputes) or of a quote comparison, and optionally a polished PDF. A Free user sees an upgrade prompt. This is the first feature that earns the plans Phase 3A shipped.

**Architecture:** Pure builders in `lib/export/` turn already-computed data into an `exceljs` Workbook or a `@react-pdf/renderer` document. They reuse the existing pure functions (`rollupLive`, `buildComparison`, `waterfallData`, `evaluateInsights`) so export can never drift from in-app math. A `GET /api/models/[id]/export?format=xlsx|pdf[&quoteId=…]` route handler is the single entry point: it entitlement-gates (`canUseFeature(plan, "export")`), reads via the RLS-bound cookie client, runs the builders, and streams bytes. Client `ExportMenu` components render links when allowed and `UpgradePrompt` when not.

**Tech Stack:** Next.js 14 App Router route handler (`runtime = "nodejs"`), TypeScript strict, Supabase SSR server client (RLS), Vitest + Testing Library, Playwright. New server-only deps: `exceljs` (XLSX), `@react-pdf/renderer` (PDF, spike-gated). No migration, no env vars.

**Spec:** `docs/superpowers/specs/2026-07-08-phase3b-exports-design.md`.

## Global Constraints

- **Money is integer minor units end-to-end** (DB, types, rollup, comparison). XLSX cells are **major units** via `fromMinor(minor, currency)`; PDF text via `formatCurrency(minor, currency)`. Pass `model.currency` through — never hardcode `/100` or assume USD. Verbatim from spec §2 / §11.
- **Reuse the pure functions; do not recompute.** Model export runs `rollupLive(buildTree(nodes))`; comparison export runs `buildComparison` + `waterfallData` + `evaluateInsights`. The export's numbers must be the same objects the UI shows. Verbatim from spec §5.1.
- **The XLSX must match `rollupLive` to the cent.** Amount formulas compute from a hidden integer-minor `rate` column with `ROUND(...,0)`; a static "Amount (model)" column (`fromMinor(rollup.byNodeId[id])`) cross-checks every row. Verbatim from spec §5.2 / §11.
- **`exceljs` and `@react-pdf/renderer` are server-only** — never reach the browser bundle. They live under `lib/export/*` (mark `import "server-only"`), imported only from the route handler. Verbatim from spec §8.
- **RLS via `createServerClient()` (cookie client), never `createAdminClient()`.** A user can only export models their org can read. Verbatim from spec §5.5 / §10.
- **Server-side is the real gate; the client `UpgradePrompt` is UX only.** The route handler calls `assertCanExport(plan)` on every request; Free callers are redirected to `/settings/billing/upgrade`. Verbatim from spec §1 / §5.4.
- **TypeScript strict, zero `any`. Zod is not required here** (export is a read with a 2-value `format` enum validated at the route boundary). Verbatim from spec §10.
- **No new migration, no new env vars.** Reads existing tables only. Verbatim from spec §7.
- **Vercel serverless constraints.** PDF uses `@react-pdf/renderer` (pure JS) — **not** Playwright/Chromium (serverless can't run it). Route handlers must stay within size/time limits; `exceljs` streams. Verbatim from spec §11.
- **Renders at 375 / 768 / 1440; WCAG AA; `num` class on figures.** Verbatim from spec §10.

**Existing verified facts this plan relies on (do not re-derive):**
- `canUseFeature(plan, f)` (`lib/entitlements.ts:58-60`) is implemented; `ENTITLEMENTS.pro.features.export` and `team.features.export` are `true`, `free.features.export` is `false`. **It is not yet called from any action** — Phase 3B is where it lands (Phase 3A plan §Self-Review deviation 5).
- **Gate pattern to mirror** — `instantiateModelAction` (`lib/actions/model.ts:68-89`): Zod/parse → `getCurrentOrg()` → `isDemo = Boolean(org.organizations.is_demo)` → `findActiveSubscriptionByOrg(org_id)` → `toSnapshot(sub)` → `resolvePlan({ subscription, isDemo })` → pure check → on failure return `{ error: "FEATURE_LOCKED"; requiredPlan: "pro" }`.
- `getCurrentOrg()` (`lib/db/orgs.ts:11`). `findActiveSubscriptionByOrg` + `toSnapshot` (`lib/db/subscriptions.ts`). `resolvePlan({ subscription, isDemo, now })` (`lib/entitlements.ts:79-92`) — demo org → `"team"` (so demo can export).
- `createServerClient()` (`lib/supabase/server.ts:5`) — cookie-bound, RLS-scoped. `createAdminClient()` (`lib/supabase/admin.ts:8`) bypasses RLS — **do not use** for export.
- Loaders (all RLS-scoped via the server client): `loadModel(id)` (`lib/db/models.ts:15`), `loadNodes(id)` (`lib/db/nodes.ts:4`), `loadQuotes(id)` (`lib/db/quotes.ts`).
- Money: `fromMinor(minor, currency)` (`lib/money.ts:24`), `formatCurrency(minor, currency)` (`lib/format.ts:12`). `Currency` type + `DECIMALS` (`lib/money.ts:6`). `cost_models.currency` defaults to `'USD'` (`0001_init_schema.sql:95`).
- Types: `CostNodeRow`, `Rollup = { total; byNodeId }`, `CostTree`, `TreeNode` (`lib/model/types.ts`). All monetary fields are integer minor.
- Pure model fns: `buildTree(nodes)` (`lib/model/tree.ts:3`), `rollupLive(tree)` (`lib/model/rollup-live.ts:11`). Semantics — line = `Math.round((qty??1)*(rate??0))`; group = sum of children (left-to-right, each named group's subtotal visible to later siblings); `"N% of <group>"` = `Math.round(namedGroupSubtotal * pct/100)`; bare `"N%"` / `"N% margin"` = `Math.round(runningSubtotalBefore * pct/100)`.
- Pure comparison fns: `buildComparison(nodes, rollup, quote)` (`lib/model/comparison.ts:44`), `waterfallData(c, topN=6)` (`lib/model/waterfall.ts:10`), `evaluateInsights(c, currency)` (`lib/model/insights.ts:14`). Types: `Comparison`, `CompRow`, `WaterfallBar`, `InsightCard`.
- Route-handler precedent: `app/api/billing/stripe/webhook/route.ts` (`runtime = "nodejs"`, `export async function POST(req): Promise<NextResponse>`). 3B adds a `GET` handler.
- UI slots: `ModelEditor` actions slot (`components/models/model-editor.tsx:76-92`) currently holds the "Compare quotes" button + total + saved indicator; `CompareView` actions slot (`components/quotes/compare-view.tsx:86`) holds the "Add quote" trigger. Both pages already import the loaders.
- `UpgradePrompt` (`components/billing/upgrade-prompt.tsx`) accepts `requiredPlan: Plan`. `plan-card.tsx:45` already advertises "PDF / XLSX export" as a Pro+ perk.
- No Excel/PDF library is installed (`package.json`, `pnpm-lock.yaml`). `@playwright/test` is dev-only (e2e), not a renderer.
- Test scripts: `pnpm test` / `pnpm typecheck` / `pnpm lint` / `pnpm build` / `pnpm test:e2e`. **Env note:** `pnpm add exceljs` / `@react-pdf/renderer` may prompt under the supply-chain policy — approve when Task 1 / Task 5 runs. E2E is session-gated like `tests/e2e/editor.spec.ts`.

---

### Task 1: Excel layout helper + XLSX model builder + fidelity tests

**Files:**
- Create: `lib/export/excel-layout.ts`, `lib/export/xlsx-model.ts`
- Test: `tests/unit/xlsx-model.test.ts`
- Dep: add `exceljs` (server-only)

**Interfaces:**
- `excel-layout.ts` produces (shared by Tasks 1 & 2):
  - `function flattenTree(nodes: CostNodeRow[]): OrderedRow[]` — depth-first by `sort_order`, computing `level` (depth) and stable row index; returns rows carrying the original `CostNodeRow` plus `level` and a map address.
  - `interface OrderedRow { node: CostNodeRow; level: number; rowNumber: number }`
  - A **cell-address map** so formula writers can resolve "the amount cell for node X" and "the amount cells of this group's children" and "the prior siblings' amount cells within the parent" — the inputs the rounding/running-total formulas need.
- `xlsx-model.ts` produces:
  - `function buildModelXlsx(input: { modelName: string; currency: Currency; nodes: CostNodeRow[]; rollup: Rollup }): Workbook` (from `exceljs`).
  - `import "server-only"` at top.

> Key implementation notes: one sheet "Should-cost"; columns Level / Name / Type / Driver / Qty / Unit / **Rate** (major, `fromMinor`, display) / Formula (text) / **Amount** (live `=` formula) / **Amount (model)** (static `fromMinor(rollup.byNodeId[node.id])`) — plus a **hidden integer-minor rate column** feeding Amount. Formulas: line `=ROUND(qty*<rateMinorCell>,0)/100`; group `=SUM(<child amount cells>)`; `"N% of <group>"` `=ROUND(<pct>%*<groupAmountCell>,0)/100`; bare `"N%"` `=ROUND(<pct>%*SUM(<priorSiblingAmountCells>),0)/100`. Parse the `formula` text (`/(\d+(?:\.\d+)?)\s*%\s*(?:of\s+<group>)?/i`) to extract `pct` and optional named group; the named group resolves via the cell-address map (lowercased-name match, mirroring `rollupLive`). Header rows: model name, currency, grand total = root group's Amount cell. Number format `#,##0.00` on money cells. Confirm exact `exceljs` cell-formula API during Step 1 (`cell.value = { formula, result? }` or `cell.formula = ...`).

- [ ] **Step 1 — Confirm `exceljs` API.** `pnpm add exceljs` (approve supply-chain prompt). In a scratch Vitest, create a workbook, set a formula cell, write to buffer, re-open (`exceljs` read) and assert the formula + a computed result round-trips. This de-risks every later step against API drift.
- [ ] **Step 2 — Write the failing test** (`tests/unit/xlsx-model.test.ts`): build a known 3-level tree (a Materials group with two lines + a Margin line using `"10%"` and a second group using `"5% of Materials"`); assert (a) row count + depth-first order, (b) a line Amount cell formula contains `ROUND(` and the minor-rate reference, (c) a group Amount cell formula is `SUM(...)`, (d) the static "Amount (model)" column equals `fromMinor(rollup.byNodeId[id], currency)` for every node, (e) the root group's static value equals `fromMinor(rollup.total)`.
- [ ] **Step 3 — Implement `flattenTree` + cell-address map** (`excel-layout.ts`). Roots = nodes with null/missing parent. Pure; no I/O. Unit-test the ordering/addressing through the Task 1 test.
- [ ] **Step 4 — Implement `buildModelXlsx`** (`xlsx-model.ts`) against the test. Hidden minor-rate column; visible Rate via `fromMinor`; Amount formulas per the note above; static cross-check column; header block; number formats.
- [ ] **Step 5 — Rounding-fidelity assertion.** Add a test that loads each seed template available to the test (or a representative hand-built tree with fractional `qty`) and asserts the workbook's recomputed root total equals `fromMinor(rollup.total, currency)` exactly. If `exceljs` can't evaluate formulas in Node, assert the static cross-check column instead and document that live evaluation is verified manually in the DoD.
- [ ] **Step 6 — `pnpm test tests/unit/xlsx-model.test.ts` green; `pnpm typecheck` clean.**

---

### Task 2: XLSX comparison builder + tests

**Files:**
- Create: `lib/export/xlsx-comparison.ts`
- Test: `tests/unit/xlsx-comparison.test.ts`

**Interfaces:**
- `function buildComparisonXlsx(input: { modelName: string; currency: Currency; comparison: Comparison; waterfall: WaterfallBar[]; insights: InsightCard[]; quoteSupplier: string }): Workbook`
- `import "server-only"`. Reuses `flattenTree` is **not** needed here — comparison rows are `comparison.rows` (leaf lines already).

> Sheet "Comparison": one row per `comparison.rows` — Name / Should-cost (`fromMinor` major) / Quoted (major, blank if `null`) / Gap `=<quoted>-<shouldCost>` / Gap % `=IFERROR(<gap>/<shouldCost>,0)`; a Total row summing Should-cost, Quoted, Gap. Number format `#,##0.00`; `0.0%` on Gap %. Optional sheet "Insights": one row per `InsightCard` (severity, title, detail). Header: model name, supplier, currency, headline gap.

- [ ] **Step 1 — Failing test:** known `Comparison` fixture → assert sheet name, one row per `CompRow`, Total row present, Gap/Gap% cells are formulas, Should-cost cells equal `fromMinor`.
- [ ] **Step 2 — Implement `buildComparisonXlsx`** against the test.
- [ ] **Step 3 — Insights sheet** (severity / title / detail rows) behind the same test.
- [ ] **Step 4 — `pnpm test tests/unit/xlsx-comparison.test.ts` green; typecheck clean.**

---

### Task 3: Export gate + route handler + integration tests

**Files:**
- Create: `lib/export/gate.ts`, `app/api/models/[id]/export/route.ts`
- Test: `tests/unit/export-gate.test.ts`, `tests/integration/export-route.test.ts` (env-gated)

**Interfaces:**
- `gate.ts`: `function assertCanExport(plan: Plan): void` — throws `new EntitlementError("FEATURE_LOCKED", "pro")` when `!canUseFeature(plan, "export")`. Pure, `import "server-only"` not required (no I/O) but keep it under `lib/export/` for cohesion.
- `route.ts`: `export const runtime = "nodejs"; export async function GET(req: Request, ctx: { params: { id: string } }): Promise<Response>`.
  - Search params: `format` ∈ {`xlsx`,`pdf`} (default/invalid → 400); optional `quoteId`.
  - `getCurrentOrg()` → throw 404/no-org as the existing actions do (redirect to `/login` is the app convention).
  - `findActiveSubscriptionByOrg` → `toSnapshot` → `resolvePlan({ subscription, isDemo })` → `assertCanExport(plan)`; on `EntitlementError` → `NextResponse.redirect("/settings/billing/upgrade")`.
  - `loadModel(id)` (+ `loadNodes(id)`; for comparison: `loadQuotes(id)` → pick `quoteId`). All via `createServerClient()`.
  - Branch on `format`:
    - `xlsx` → run `rollupLive(buildTree(nodes))` → (comparison ? `buildComparison` + `waterfallData` + `evaluateInsights` → `buildComparisonXlsx` : `buildModelXlsx`) → `await wb.xlsx.writeBuffer()` → `Response` with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment; filename="<slug>-<model>.xlsx"`.
    - `pdf` → (only if Task 5 shipped) equivalent via `pdf-*` builders → `Content-Type: application/pdf`. **If Task 5 deferred PDF, return 501 Not Implemented** (clean, honest) until 3C — do not half-build.
  - Slug: `modelName` lowercased, non-alphanumerics → `-`, trimmed.

- [ ] **Step 1 — `assertCanExport` + unit test:** `free` throws `FEATURE_LOCKED`/`pro`; `pro`, `team` pass; (demo resolves to `team` upstream, so it passes).
- [ ] **Step 2 — Route handler skeleton** (GET, parse, gate, redirect-on-locked, 400 on bad format, 501 for PDF until Task 5). Wire XLSX path fully (model + comparison).
- [ ] **Step 3 — Integration test (env-gated, like RLS tests):** seeded Pro org → `GET /api/models/<id>/export?format=xlsx` returns 200 + correct Content-Type + non-empty body; Free org → 302 to `/settings/billing/upgrade`. Skip when env absent (same gate as `tests/integration/*`).
- [ ] **Step 4 — `pnpm typecheck`, `pnpm lint`, `pnpm build`** (route present in build output). Manual: open the URL logged-in as Pro → file downloads and opens in Excel with live formulas.

---

### Task 4: Export UI on model + compare pages (locked / unlocked)

**Files:**
- Create: `components/export/export-menu.tsx`
- Modify: `components/models/model-editor.tsx` (actions slot), `components/quotes/compare-view.tsx` (actions slot), and the two server pages that resolve `plan` to pass it down (`app/(app)/models/[id]/page.tsx`, `app/(app)/models/[id]/compare/page.tsx`)
- Test: `tests/unit/export-menu.test.tsx`

**Interfaces:**
- `ExportMenu` (`"use client"` not required if it's pure links, but keep it a server-rendered component receiving `plan`):
  - Props: `{ modelId: string; plan: Plan; quoteId?: string }`.
  - If `canUseFeature(plan, "export")` → render a small menu (dropdown or two links) to `/api/models/[id]/export?format=xlsx` and (if PDF shipped) `=pdf`. PDF link omitted entirely until Task 5 ships.
  - Else → render `<UpgradePrompt requiredPlan="pro" />` (reuse the 3A component).
- The two pages already resolve the org/plan for other reasons (sidebar badge); thread `plan` into `ModelEditor` / `CompareView` props and into `ExportMenu`.

> Placement: add `ExportMenu` into the existing `actions` flex slot alongside the current buttons (Compare quotes / Add quote). Match the `Button`/outline styling already there. No new layout.

- [ ] **Step 1 — Failing component test:** `ExportMenu` with `plan="pro"` → asserts both export links present and correct `href`; with `plan="free"` → asserts `UpgradePrompt` renders (no export links).
- [ ] **Step 2 — Implement `ExportMenu`.**
- [ ] **Step 3 — Thread `plan`** from each server page → editor/compare-view → `ExportMenu`; render in the actions slot.
- [ ] **Step 4 — `pnpm test` green; `pnpm typecheck`/`lint`/`build` clean. Manual at 375/768/1440: Pro sees Export; Free sees the upgrade prompt.**

---

### Task 5: PDF spike → PDF builders (spike-gated; may defer to 3C)

**Files:**
- Create: `lib/export/pdf-model.ts`, `lib/export/pdf-comparison.ts`
- Dep: add `@react-pdf/renderer` (server-only) — **only if the spike passes**
- Test: `tests/unit/pdf-model.test.ts`, `tests/unit/pdf-comparison.test.ts`

> **This task is gated on a spike.** Playwright/Chromium print-to-PDF is rejected upfront (Vercel serverless cannot run Chromium). The spike confirms `@react-pdf/renderer` renders through the route handler in the Vercel runtime. **If the spike fails, stop, document the failure in `.superpowers/sdd/task-5-report.md`, leave the route returning 501 for `format=pdf`, and defer PDF to Phase 3C. XLSX (Tasks 1–4) still ships.**

- [ ] **Step 1 — Spike (timeboxed ~1h):** `pnpm add @react-pdf/renderer`; write a 1-element PDF through a scratch route handler using `renderToBuffer`/`renderToStream`; `pnpm build` and (if possible) a Preview deploy to confirm it works under Vercel serverless (watch the 50 MB unzipped layer limit + cold-start). **Pass criterion:** a non-empty `application/pdf` buffer returns from the handler in the built app. **On fail → defer per above; mark this task done-with-deferral and skip Steps 2–5.**
- [ ] **Step 2 — `buildModelPdf({ modelName, currency, nodes, rollup })`** → React tree of should-cost CBS (header + a `@react-pdf/renderer` Table: Name / Driver / Qty / Unit / Amount). Money via `formatCurrency`. Reuses `flattenTree` for ordering.
- [ ] **Step 3 — `buildComparisonXlsx`'s PDF twin** `buildComparisonPdf({ modelName, currency, comparison, waterfall, insights, quoteSupplier })` → comparison table + an insights list. (Waterfall chart is omitted in PDF v1 — `@react-pdf/renderer` has no Recharts; the table + insights carry the negotiation signal. Document as a known gap.)
- [ ] **Step 4 — Wire into the route handler** (Task 3's `pdf` branch): replace the 501 with the real PDF buffer + `Content-Type: application/pdf`. Surface the PDF link in `ExportMenu`.
- [ ] **Step 5 — Unit tests** (document structure: expected sections/rows from fixtures) + manual PDF open. `pnpm test`/`typecheck`/`lint`/`build` clean.

---

### Task 6: QA + e2e + full-suite verification

**Files:**
- Create: `tests/e2e/export.spec.ts`
- Modify: `.superpowers/sdd/progress.md` (the Phase 3B ledger — create the section)

- [ ] **Step 1 — e2e (session-gated, mirrors `tests/e2e/model-cap.spec.ts` convention):** always-run auth guard (`/models/<id>` → `/login` when signed out); `test.skip` full flow (Pro seeded session → click Export → `download` event fires with `.xlsx` extension). `REPLACE_WITH_SEEDED_PRO_PROJECT_ID` token + docblock, matching the existing e2e convention.
- [ ] **Step 2 — Full suite:** `pnpm test` (all unit + component green incl. Phase 0/1/2/3A), `pnpm typecheck`, `pnpm lint`, `pnpm build` (export route present; XLSX/PDF libs absent from client bundle — verify with a bundle check or `grep -rn "exceljs\|@react-pdf" app components` returning nothing).
- [ ] **Step 3 — Manual walkthrough:** Pro user exports a model XLSX, opens in Excel, edits a `Qty`, confirms the CBS recomputes and the grand total matches the app. Free user sees the upgrade prompt. Comparison export of the active quote downloads and opens.
- [ ] **Step 4 — Currency spot-check:** export a non-USD model if any seed supports it; confirm formatting honors `model.currency`. If all seeds are USD, add a unit test with a synthetic EUR model instead.
- [ ] **Step 5 — Write the Phase 3B section of `.superpowers/sdd/progress.md`** (status, per-task results, deferred items, deploy note that PDF is/isn't included).

---

## Phase 3B Definition of Done (verify before declaring complete)

Run and confirm each:

- [ ] `pnpm test` — all unit/component tests green (export builders, gate, route integration, menu + all Phase 0/1/2/3A tests).
- [ ] `pnpm typecheck` — zero errors, zero `any`.
- [ ] `pnpm lint` — clean.
- [ ] `pnpm build` — succeeds; route `/api/models/[id]/export` present.
- [ ] `exceljs` (and `@react-pdf/renderer` if Task 5 shipped) never imports from a client component (`grep -rn "from \"exceljs\"\|@react-pdf" app components` returns nothing; only `lib/export/*` + the route import them).
- [ ] XLSX opens in Excel with **live formulas**; editing a driver recomputes the tree; the static cross-check column matches the live Amount column on every row; the grand total equals the app's should-cost total, to the cent, across seed templates.
- [ ] Export is **server-side gated**: Free → 302 to `/settings/billing/upgrade`; Pro/Team/demo → download. A cross-org model URL is blocked by RLS (404/empty), not exported.
- [ ] Comparison export renders the active quote's matrix + totals (+ insights sheet); gap/gap% are live formulas.
- [ ] PDF (if shipped) renders model + comparison with correct currency; if deferred, the route returns a clean 501 and the deferral is documented in the task-5 report + progress.md.
- [ ] Money uses `fromMinor`/`formatCurrency` with `model.currency` throughout — no hardcoded `/100`, no USD assumption.
- [ ] Renders at 375 / 768 / 1440; `num` class on figures; WCAG AA focus + contrast on the menu.
- [ ] No new migration applied; no new env vars required.

---

## Self-Review (completed against the spec)

**Spec coverage:**
- §0/§1 exports-only scope (share links → 3C) → plan scope + Task list. ✓
- §1 XLSX primary, PDF spike-gated → Tasks 1–4 (XLSX) + Task 5 (spike-gated PDF). ✓
- §1 live formulas → Task 1 (hidden minor-rate column + ROUND + static cross-check). ✓
- §2 decisions (exceljs; @react-pdf; GET route; server-side gate; RLS; fromMinor) → Global Constraints + Tasks 1, 3. ✓
- §3 tech stack delta (exceljs, @react-pdf) → Tasks 1, 5. ✓
- §4 file/folder structure → Tasks 1–5 create exactly those files. ✓
- §5.1 pure builders reuse existing fns → Task 1/2 contracts. ✓
- §5.2 XLSX model layout (columns, formulas, hidden rate, cross-check) → Task 1 note + steps. ✓
- §5.3 XLSX comparison layout → Task 2. ✓
- §5.4 `assertCanExport` gate → Task 3. ✓
- §5.5 route handler (gate, redirect, RLS, Content-Type/Disposition, slug) → Task 3. ✓
- §6 data flow (model + comparison; locked → UpgradePrompt) → Tasks 3, 4. ✓
- §7 no data-model delta → Global Constraints (no migration). ✓
- §8 deps server-only → Global Constraints + Task 1/5 + DoD grep check. ✓
- §9 testing (unit/component/integration/e2e) → Tasks 1–4, 6. ✓
- §10 DoD → plan DoD. ✓
- §11 risks (PDF serverless spike; rounding fidelity; running-total %; route size/time; currency hardcoding) → Task 5 spike, Task 1 fidelity + running-total test, Global Constraints size note, money-via-fromMinor. ✓

**Deviations from spec (intentional, all safe):**
1. **PDF chart omission.** Spec §5.3 implies charts; `@react-pdf/renderer` cannot render Recharts. PDF v1 ships the CBS table + comparison table + insights text; the waterfall chart is omitted and documented. XLSX carries the waterfall data as the "Insights"/comparison sheet; the in-app compare page keeps the visual chart.
2. **Route returns 501 for `format=pdf` until Task 5 ships** (and permanently if the spike fails). Honest, non-crashing; the `ExportMenu` simply omits the PDF link until then, so no user ever hits the 501 in the UI.
3. **`format` validated at the route boundary** (2-value enum) rather than via Zod — export is a read with no body; a Zod schema would be ceremony. Matches the spec §Global note.

**Placeholder scan:** none in shipped content. The `REPLACE_WITH_SEEDED_PRO_PROJECT_ID` token in the e2e (Task 6) is an explicit, documented prerequisite matching the existing `tests/e2e/editor.spec.ts` / `model-cap.spec.ts` convention — not shipped content.

**Type consistency:** `CostNodeRow`, `Rollup`, `CostTree` (existing) consumed by Task 1. `Comparison`, `CompRow`, `WaterfallBar`, `InsightCard` (existing) consumed by Task 2. `Plan`, `canUseFeature`, `EntitlementError` (existing from 3A) consumed by Task 3's `assertCanExport`. `OrderedRow` + cell-address map (Task 1, new) consumed by Task 2 + Task 5. Builder signatures (`buildModelXlsx`, `buildComparisonXlsx`, `buildModelPdf`, `buildComparisonPdf`) are the contract the route handler (Task 3) calls unchanged. `ExportMenu` props (`modelId`, `plan`, `quoteId?`) consumed by both pages (Task 4).
