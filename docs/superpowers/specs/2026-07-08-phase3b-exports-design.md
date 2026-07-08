# Phase 3B — Exports (XLSX + PDF) (Design Spec)

**Project:** shouldcost.io
**Phase:** 3B of 5 (second slice of Phase 3 — paid-tier user value)
**Status:** Draft (pending written-spec review)
**Date:** 2026-07-08
**Builds on:** Phase 0 (schema, money discipline, RLS), Phase 1 (model editor + live rollup), Phase 2 (comparison / waterfall / insights), Phase 3A (entitlements — the `export` feature flag is already provisioned for Pro/Team and advertised on `plan-card.tsx`).

---

## 0. Assumptions to confirm

Phase 3A's spec decomposed Phase 3 as: 3A entitlements+billing, **3B "PDF/XLSX export + public share links"**, 3C marketing/SEO. This spec **narrows 3B to exports** and moves share links out, on the following recommendations (confirm on review):

1. **3B = exports only (XLSX + PDF). Public share links move to 3C (or a later 3B-slice).** A PDF already covers the "share externally" need without adding an anon-readable RLS surface; share links are a separable security review and shouldn't delay the higher-value, lower-risk export work.
2. **XLSX is the primary deliverable; PDF is a spike-gated second wave.** XLSX with live formulas is the procurement differentiator — a buyer opens it in Excel, edits a driver, and the CBS recomputes. PDF reuses the same data but carries a serverless-runtime risk (§11) that needs a 1-hour spike before commit.
3. **Live formulas, not a flat value dump.** The XLSX reproduces the CBS with working `=` formulas (line `=qty*rate`, group `=SUM(children)`, `"N% of <group>"` `=N%*<groupcell>`). This is the whole point for a should-cost audience.
4. **One export per model (CBS) and one per comparison (active quote).** Batch / all-quotes export is a fast-follow.

---

## 1. Purpose

Phase 1 builds a defensible should-cost model; Phase 2 compares it against supplier quotes; **Phase 3B makes the output portable** — a procurement user can take the model (or a quote comparison) into Excel and into a negotiation as a polished PDF. Today the artifact is trapped in the browser; export closes the should-cost loop.

It is also the first feature that **earns** the Pro/Team plans 3A shipped: `components/billing/plan-card.tsx` already advertises "PDF / XLSX export" as a Pro+ perk, and the `export` flag in `ENTITLEMENTS` (`lib/entitlements.ts`) is already `true` for `pro`/`team`, `false` for `free`. 3B wires the feature behind the existing gate — it does not touch entitlements.

End state: from the model page a Pro user clicks "Export → XLSX" and downloads a workbook whose CBS tree recomputes live in Excel; from the compare page they export the active quote comparison as XLSX or PDF. A Free user sees an upgrade prompt instead.

### Phase 3B scope boundary

**In scope:**
- `lib/export/`: pure builders that turn `model + nodes + rollup` (and `comparison + waterfall + insights`) into an `exceljs` Workbook or a `@react-pdf/renderer` document.
- `GET /api/models/[id]/export?format=xlsx|pdf[&quoteId=…]`: entitlement-gated, RLS-scoped route handler that streams the file.
- Export control on the model page (`ModelEditor` actions slot) and the compare page (`CompareView` actions slot), rendered as `UpgradePrompt` when the plan lacks `export`.
- Tests: unit (workbook/pdf structure, formulas, gate), component (menu locked vs unlocked), one e2e (Pro → download), integration env-gated.

**Explicitly out of scope (deferred):**
- **Public share links** → 3C / later slice (anon-readable RLS surface; separate security review).
- **CSV export** → trivial fast-follow once XLSX lands (same builders, different serializer).
- **Batch export** (all quotes / multiple models) → fast-follow.
- **Scheduled / emailed exports** → not now.

---

## 2. Confirmed / assumed decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Exports only (XLSX + PDF); share links deferred | Highest value, lowest risk slice; PDF covers external sharing safely |
| XLSX lib | `exceljs` | Only mainstream option that supports cell formulas + streams + number formats |
| PDF lib | `@react-pdf/renderer` (pending spike) | Vercel-serverless-safe (pure JS); Playwright/Chromium rejected (serverless can't run it). React mental model fits the stack |
| XLSX semantics | **Live formulas**; per-node rounding fidelity via a hidden integer-minor `rate` column + a static value cross-check column | Buyer can stress-test drivers in Excel — the should-cost differentiator |
| Gate | `canUseFeature(plan, "export")` (already `pro`/`team` = true, `free` = false) | Reuses the 3A seam exactly; no entitlement change |
| Download mechanism | `GET` route handler → binary `Response` (Content-Type + Content-Disposition) | Cleanest for browser downloads; Next 14 convention; only route-handler precedent is the Stripe webhook |
| Trust boundary | Server-side gate in the route handler (defense-in-depth); client renders `UpgradePrompt` when locked | Client lock is UX only — every download is re-checked server-side |
| Money in XLSX | Major-unit cells via `fromMinor(minor, currency)`; integer-minor `rate` in a hidden column feeding formulas | Keeps Excel math matching `rollupLive`'s per-node `Math.round` |
| Money in PDF | `formatCurrency(minor, currency)` text | Reuses the existing helper |
| Currency source | `cost_models.currency` read server-side in the handler | Tamper-proof; never trust client |
| Comparison export | The active quote (one `quoteId`) | Multi-quote batch is a fast-follow |

---

## 3. Tech stack (delta over Phase 3A)

- **`exceljs`** (new, runtime) — XLSX workbooks with formulas + streams.
- **`@react-pdf/renderer`** (new, runtime, PDF wave only) — PDF documents, Vercel-safe. Added only if the §11 spike passes.
- No other deps. **No Supabase migration, no env vars.** Route handlers, server clients, entitlements, and the pure model/comparison functions are all already in place.

---

## 4. File / folder structure (delta)

```
app/api/models/[id]/export/route.ts        # GET ?format=xlsx|pdf [&quoteId=…] → gate → RLS → binary Response (runtime = "nodejs")

lib/export/
├── xlsx-model.ts                          # buildModelXlsx(model, nodes, currency) → exceljs Workbook (CBS tree, live formulas)
├── xlsx-comparison.ts                     # buildComparisonXlsx(model, nodes, comparison, waterfall, insights) → Workbook
├── pdf-model.ts                           # buildModelPdf(...) → ReactElement (@react-pdf/renderer; spike-gated)
├── pdf-comparison.ts                      # buildComparisonPdf(...)
├── excel-layout.ts                        # tree → ordered rows + indent levels + cell-address map (shared by model & comparison)
└── gate.ts                                # assertCanExport(plan) → throws EntitlementError("FEATURE_LOCKED", "pro")

components/export/
└── export-menu.tsx                        # client dropdown: XLSX / PDF; renders UpgradePrompt when !canUseFeature

tests/unit/
├── xlsx-model.test.ts                     # workbook structure + live formulas + rounding fidelity vs rollupLive
├── xlsx-comparison.test.ts
└── export-gate.test.ts                    # free → FEATURE_LOCKED; pro/team/demo → allow
```

---

## 5. Core units & interfaces

### 5.1 Builders (`lib/export/*.ts`) — pure, no I/O

```ts
import type { Workbook } from "exceljs";

export function buildModelXlsx(input: {
  modelName: string; currency: Currency; nodes: CostNodeRow[]; rollup: Rollup;
}): Workbook;

export function buildComparisonXlsx(input: {
  modelName: string; currency: Currency;
  comparison: Comparison; waterfall: WaterfallBar[]; insights: InsightCard[];
  quoteSupplier: string;
}): Workbook;
```

The route handler loads data server-side, runs the **existing pure functions** (`buildTree` + `rollupLive` for the model; `buildComparison` + `waterfallData` + `evaluateInsights` for the comparison), and hands the results to the builder. The export therefore can never drift from the in-app math.

### 5.2 XLSX model layout

One sheet "Should-cost"; one row per node in depth-first `sort_order`. Columns:
- **Level** (0..N indent), **Name**, **Type** (group/line), **Driver**, **Qty**, **Unit**, **Rate** (major, display via `fromMinor`), **Formula** (text, e.g. `5% of Materials`), **Amount** (live `=` formula), **Amount (model)** (static `fromMinor(rollup.byNodeId[id])` cross-check).
- A hidden integer-minor **rate** column feeds the amount formula so Excel rounds per-line like `rollupLive`:
  - line → `=ROUND(qty * rateMinorCell, 0) / 100`
  - group → `=SUM(child amount cells)`
  - `"N% of <group>"` → `=ROUND(N% * <group amount cell>, 0) / 100`
  - bare `"N%"` → `=ROUND(N% * SUM(<prior-sibling amount cells in this group>), 0) / 100` (the running-subtotal case)
- Header block: model name, currency, grand total (= root group amount).
- Number format `#,##0.00` on money cells; `0.0%` on gap %.

### 5.3 XLSX comparison layout

Sheet "Comparison": one row per leaf line — **Name, Should-cost, Quoted, Gap (`=quoted−shouldCost`), Gap % (`=IFERROR(gap/shouldCost,0)`)** — plus a **Total** row. Optional second sheet "Insights" listing `InsightCard[]` as title + detail rows.

### 5.4 Gate (`lib/export/gate.ts`)

```ts
export function assertCanExport(plan: Plan): void {
  if (!canUseFeature(plan, "export")) throw new EntitlementError("FEATURE_LOCKED", "pro");
}
```

Mirrors the `instantiateModelAction` gate (`lib/actions/model.ts:68-89`). Demo org → `resolvePlan` returns `"team"` → demo can export (intentional, for sales demos).

### 5.5 Route handler (`app/api/models/[id]/export/route.ts`)

`GET`, `runtime = "nodejs"`. Steps:
1. Parse `format` (`xlsx` | `pdf`) and optional `quoteId`.
2. `getCurrentOrg()` → `toSnapshot(sub)` → `resolvePlan({ subscription, isDemo })`.
3. `assertCanExport(plan)` — on fail, `NextResponse.redirect("/settings/billing/upgrade")`.
4. `loadModel(id)` + `loadNodes(id)` (+ `loadQuotes(id)` for comparison) via `createServerClient()` (**RLS-bound cookie client**, never `createAdminClient()`).
5. Run the pure builders; render to bytes (`wb.xlsx.writeBuffer()` / `renderToBuffer(...)`).
6. Respond `200` with the correct `Content-Type` and `Content-Disposition: attachment; filename="<slug>.xlsx|pdf"`.

---

## 6. Data flow

**Model export:** model page `ModelEditor` actions slot (`components/models/model-editor.tsx:76-92`) → `<ExportMenu modelId plan />` → if `canUseFeature(plan,"export")` render link to `/api/models/[id]/export?format=xlsx` (and `=pdf`); else `<UpgradePrompt requiredPlan="pro"/>`. Click → handler gates server-side → loads model + nodes → `rollupLive(buildTree(nodes))` → `buildModelXlsx` → streamed download.

**Comparison export:** compare page `CompareView` actions slot (`components/quotes/compare-view.tsx:86`) → `<ExportMenu modelId quoteId plan />` → same gate → handler loads model + nodes + active quote → `buildComparison` + `waterfallData` + `evaluateInsights` → `buildComparisonXlsx` → download.

**Gated (Free):** both menus render `UpgradePrompt` client-side; the route still re-checks (defense-in-depth) and redirects Free callers to `/settings/billing/upgrade`.

---

## 7. Data model (delta)

**None.** Reads existing `cost_models`, `cost_nodes`, `quotes`, `quote_lines`. No migration, no new tables, no new env vars. RLS policies from `0002_rls_policies.sql` scope every read to the caller's org.

---

## 8. Dependencies (delta)

```
exceljs                 # runtime — XLSX (formulas, streams)
@react-pdf/renderer     # runtime — PDF wave only (spike-gated, §11)
```

Neither reaches the browser bundle — the route handler and `lib/export/` are server-only (mark with `server-only` where helpful).

---

## 9. Testing

- **Unit:** `xlsx-model.test.ts` — build a workbook from a known tree; assert row count/order, a line cell formula is `=ROUND(qty*rateMinor,0)/100`, a group cell is `=SUM(...)`, the static "Amount (model)" column equals `fromMinor(rollup.byNodeId[id])` for every node, and the workbook's recomputed total matches `rollup.total/100`. `xlsx-comparison.test.ts` — gap/gap% formulas + totals row. `export-gate.test.ts` — `free` throws `FEATURE_LOCKED`/`pro`; `pro`/`team`/demo pass.
- **Component:** `export-menu.test.tsx` — renders links when `canUseFeature`, renders `UpgradePrompt` when not.
- **Integration (env-gated):** route handler returns 200 + correct Content-Type for a seeded Pro org; 302 to `/settings/billing/upgrade` for a Free org.
- **e2e (Playwright, session-gated/skipped):** Pro user clicks Export → download triggered.

---

## 10. Definition of done (Phase 3B)

- XLSX export of a model and of a comparison, downloadable from the model/compare pages; Pro/Team/demo only.
- XLSX uses **live formulas**; opening it in Excel and editing a driver recomputes the CBS; per-node totals match `rollupLive` to the cent (verified by the static cross-check column).
- PDF export of model + comparison **if the §11 spike passes**; if it fails, PDF slips to 3C with a documented reason and XLSX still ships.
- Export is **server-side gated** via `assertCanExport`; Free users see `UpgradePrompt` client-side and are redirected server-side.
- RLS enforced (cookie-bound server client, never admin); a user cannot export another org's model.
- TypeScript strict, zero `any`; money via `fromMinor`/`formatCurrency` with `model.currency` passed through (never hardcoded `/100` or USD).
- No new migration, no new env vars; `exceljs` (+ `@react-pdf/renderer`) server-only.
- Unit + component tests green; renders at 375/768/1440; WCAG AA on the menu.

---

## 11. Risks & open items

- **PDF library on Vercel serverless (the spike).** Playwright/Chromium print-to-PDF is the highest-fidelity option but Vercel serverless cannot run Chromium (binary + the 50 MB unzipped layer limit). Recommendation: `@react-pdf/renderer` (pure JS). **Action: a 1-hour spike** — render a minimal PDF through the route handler and confirm it builds + runs in the Vercel runtime before committing the PDF wave. If it fails, PDF slips to 3C and 3B ships XLSX-only.
- **XLSX rounding fidelity.** `rollupLive` uses `Math.round` per node; raw Excel float math can drift cents that cascade up group sums. Mitigation: amount formulas compute from a hidden integer-minor rate column with `ROUND(...,0)`, and a static "Amount (model)" column cross-checks every row. Acceptance: workbook total == `rollup.total/100` across all seed templates.
- **Running-total `"N%"` formula nodes.** The bare-percentage case applies to a left-to-right running subtotal (`lib/model/rollup-live.ts:33`); reproducing it in Excel needs a cumulative range over prior siblings. Mitigation: the layout emits the correct range, with a unit test on a model that uses a margin line. Fallback for that node type only: emit the static value (correct, just not live).
- **Route handler size/time.** Very large models could approach serverless limits. Mitigation: `exceljs` streams; cap at a generous node count (e.g. 1000) with a clear error beyond it. Not expected to bind for real should-cost models.
- **Currency hardcoding in existing helpers.** `formatCurrency`/`formatMinorInput` hardcode `/100` (safe today — every supported currency is 2-decimal). Export uses `fromMinor(minor, currency)` directly to stay correct if a 3-decimal currency (KWD) lands later.

---

## 12. Next step

On written-spec review (especially §0 assumptions 1–4), invoke the **writing-plans** skill to produce the Phase 3B implementation plan, anticipated waves:
- **A** XLSX model builder + rounding-fidelity tests (reuse `rollupLive`).
- **B** XLSX comparison builder (reuse `buildComparison` / `waterfallData` / `evaluateInsights`).
- **C** Route handler + `assertCanExport` gate + RLS wiring.
- **D** Export UI on model + compare pages (locked / unlocked).
- **E** PDF spike → PDF model + comparison builders (or slip to 3C).
- **F** QA + e2e.
