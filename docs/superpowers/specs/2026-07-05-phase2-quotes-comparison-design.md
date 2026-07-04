# Phase 2 — Quotes & Comparison (Design Spec)

**Project:** shouldcost.io
**Phase:** 2 of 5
**Status:** Draft — decisions assumed while user was away; **pending user confirmation + written-spec review**
**Date:** 2026-07-05
**Builds on:** Phase 0 (foundation, schema incl. `quotes`/`quote_lines`) and Phase 1 (cost-model editor, live rollup, versioning, charts).

---

## 0. Assumptions to confirm

The user asked to proceed to Phase 2 but stepped away before answering the scoping questions. These decisions were made on the assistant's recommendation and should be confirmed on review:

1. **Scope = Negotiation core only.** Quotes + comparison + gap waterfall + insight cards. **PDF/XLSX exports and public share links are deferred to Phase 3** (exports need an export-library decision; share links add a public security surface — both are cleaner as their own phase).
2. **Quotes are per cost model**, using the existing `quotes`/`quote_lines` tables — **no schema migration required**.
3. **Comparison lives on the model page** as a "Compare" view (route `/models/[id]/compare`), linked from the editor header.
4. **Line-level quote entry is optional**: a quote can be total-only or mapped line-by-line to the model's CBS leaf lines. Line detail unlocks the per-line matrix and waterfall; total-only still shows the headline gap.

---

## 1. Purpose

Phase 1 lets a user build a defensible should-cost model. **Phase 2 closes the loop: compare that should-cost against real supplier quotes and surface the negotiation levers.** A buyer enters one or more supplier quotes for a model, sees a line-by-line comparison of should-cost vs each quote, a gap waterfall showing which line items drive the difference, and rule-based insight cards that call out where a supplier is over-quoting and where to concede.

End state: from a cost model, a user adds a supplier quote, and immediately sees "this quote is ~19% above your should-cost; the threading and margin lines account for most of it" — backed by a matrix, a waterfall, and actionable insight cards.

### Phase 2 scope boundary

**In scope:**
- **Quote entry:** add/edit/delete supplier quotes per model (supplier, currency, incoterm, payment terms, received date). Optional line-level amounts mapped to the model's CBS leaf lines.
- **Comparison matrix:** should-cost (from the model's live rollup or a chosen version) vs each quote, per CBS line and total, with gap (Δ minor) and gap %.
- **Gap waterfall** (Recharts): from should-cost total → per-line gaps (ranked) → quote total, for a selected quote.
- **Insight cards:** a pure, rule-based engine producing negotiation insights (biggest over-quoted lines, total gap, favorable lines to concede, implied margin vs the model's margin line).
- **Tests:** unit (gap math, waterfall data, insight rules, quote rollup), component (quote form, comparison matrix), one e2e (add quote → see comparison), integration env-gated.

**Explicitly out of scope (deferred):**
- **PDF/XLSX export** of a model/comparison → **Phase 3** (decide `@react-pdf/renderer` vs Playwright-print then).
- **Public share links** (anon-readable via `resolve_share_link`) → **Phase 3**.
- Billing/plan gating, marketing site, calculators → **Phase 3**.
- Command palette, dark-mode toggle, audit-log UI, comments → **Phase 4**.
- Multi-currency quote normalization beyond the model's FX rate (quotes assumed in the model currency, or converted via the model `fx_rate`; per-quote FX is a later refinement).

---

## 2. Confirmed / assumed decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Negotiation core (quotes+comparison+waterfall+insights) | Fastest path to the core value; exports/share links are a separable phase |
| Data model | Existing `quotes` + `quote_lines`; no migration | Phase 0 already created them (optional `0006` index only) |
| Comparison baseline | The model's **live rollup** by default; optionally a saved `model_version` | Reuses Phase 1 `rollupLive`; versions give a frozen baseline |
| Quote line mapping | Optional per-line map to `cost_nodes` leaf lines by `cost_node_id` | Enables per-line matrix + waterfall; total-only still supported |
| Location | `/models/[id]/compare` route + link from editor | Keeps the editor page focused; comparison is its own surface |
| Charts | Gap waterfall via Recharts behind the existing `ChartContainer` | Consistent with Phase 1 charts |
| Insights | Pure rule engine `lib/model/insights.ts` returning typed cards | Testable, deterministic, extensible |
| Money | Integer minor units throughout; `DeltaPill`/`formatCurrency` reused | Continues the money discipline |

---

## 3. Tech stack (delta over Phase 1)

No new runtime dependencies expected — Recharts, TanStack Table, Zustand, RHF+Zod, Supabase are already in place. Quote entry uses React Hook Form + Zod (already installed). Server actions (already used) handle quote persistence under RLS. An optional migration `0006_quote_indexes.sql` adds `quote_lines(quote_id)` / `quotes(model_id)` indexes; Phase 2 works without it.

---

## 4. File / folder structure (delta)

```
app/(app)/models/[id]/
├── compare/page.tsx            # NEW: server-loads model + versions + quotes; renders comparison
└── (editor header gets a "Compare" link)

components/quotes/
├── quote-form.tsx              # add/edit a quote (supplier, currency, incoterm, terms, total)
├── quote-line-editor.tsx       # optional: map quote amounts to CBS leaf lines
├── quote-list.tsx              # quotes for a model; select active quote; delete
├── comparison-matrix.tsx       # should-cost vs quotes, per line + total, gap %
├── gap-waterfall.tsx           # Recharts waterfall for a selected quote
└── insight-cards.tsx           # renders rule-engine output

lib/model/
├── comparison.ts               # buildComparison(model nodes, rollup, quote) -> rows + totals + gaps
├── waterfall.ts                # waterfallData(comparison) -> ordered bars (should-cost -> quote)
└── insights.ts                 # evaluateInsights(comparison, model) -> InsightCard[]

lib/db/
└── quotes.ts                   # loadQuotes, saveQuote, deleteQuote, saveQuoteLines

lib/actions/
└── quotes.ts                   # server actions: saveQuoteAction, deleteQuoteAction

supabase/migrations/
└── 0006_quote_indexes.sql      # OPTIONAL, non-blocking

tests/unit/
├── comparison.test.ts · waterfall.test.ts · insights.test.ts
└── quote-form.test.tsx · comparison-matrix.test.tsx
tests/e2e/compare.spec.ts
```

---

## 5. Core units & interfaces

### 5.1 Comparison (`lib/model/comparison.ts`) — pure
- `buildComparison(nodes: CostNodeRow[], rollup: Rollup, quote: QuoteWithLines): Comparison`
  where `Comparison = { rows: CompRow[]; shouldCostTotal: number; quoteTotal: number; gapTotal: number; gapPct: number }`
  and `CompRow = { nodeId: string; name: string; shouldCost: number; quoted: number | null; gap: number | null; gapPct: number | null }`.
  Rows come from the model's leaf lines; `quoted` is the matched `quote_lines.amount` (by `cost_node_id`) or null. `gap = quoted - shouldCost` (positive = quote above should-cost = negotiation lever). All minor units.

### 5.2 Waterfall (`lib/model/waterfall.ts`) — pure
- `waterfallData(c: Comparison, topN = 6): WaterfallBar[]` — starts at `shouldCostTotal`, applies the largest per-line gaps in order, groups the remainder as "Other", ends at `quoteTotal`. `WaterfallBar = { label: string; delta: number; cumulative: number; kind: "base" | "increase" | "decrease" | "total" }`.

### 5.3 Insights (`lib/model/insights.ts`) — pure
- `evaluateInsights(c: Comparison, nodes: CostNodeRow[]): InsightCard[]` where `InsightCard = { id: string; severity: "lever" | "info" | "concede"; title: string; detail: string }`. Rules (Phase 2 set):
  1. **Headline gap** — total gap % and amount.
  2. **Top over-quoted lines** — up to 3 lines where `gapPct` exceeds a threshold (e.g. 10%), as "levers".
  3. **Favorable lines** — lines quoted below should-cost, framed as "concede here."
  4. **Implied margin** — if the model has a `Margin` group, compare its should-cost share to the quote's implied margin.

### 5.4 Persistence (`lib/db/quotes.ts` + `lib/actions/quotes.ts`)
- `loadQuotes(modelId): Promise<QuoteWithLines[]>`, `saveQuote(...)`, `deleteQuote(id)`, `saveQuoteLines(quoteId, lines)`.
- Server actions Zod-validate input; all under the user's RLS session (quotes are org-scoped via the model → project → org policy chain from Phase 0).

---

## 6. Data flow

**Entry:** `/models/[id]/compare` → "Add quote" → `quote-form` (+ optional `quote-line-editor`) → `saveQuoteAction` → reload.
**Comparison:** page loads model nodes + live rollup (or selected version snapshot) + quotes → `buildComparison(nodes, rollup, activeQuote)` → renders `comparison-matrix`, `gap-waterfall`, `insight-cards`. Switching the active quote or baseline version recomputes client-side (pure functions).

---

## 7. Data model

Uses existing `quotes(id, model_id, supplier_name, currency, incoterm, payment_terms, quoted_total, received_at)` and `quote_lines(id, quote_id, cost_node_id?, description, amount)` — all money in minor units. RLS already scopes both via the model→project→org chain (Phase 0 policies `q_all`, `ql_all`). Optional `0006` adds helpful indexes.

---

## 8. Definition of done (Phase 2)

- Add/edit/delete supplier quotes on a model; optional line-level amounts mapped to CBS lines.
- Comparison matrix shows should-cost vs each quote per line + total, with correct integer-minor gaps and gap %.
- Gap waterfall renders should-cost → per-line gaps → quote total for the selected quote, inside `ChartContainer`.
- Insight cards surface the headline gap, top over-quoted lines, favorable lines, and implied margin.
- TypeScript strict, zero `any`; Zod on every mutation; money as integers.
- Unit + component tests green; one e2e (add quote → comparison renders) passes.
- Renders at 375/768/1440; WCAG AA; tabular figures on all numbers.
- No placeholder metrics; empty states teach (no quotes yet → "Add your first supplier quote").

---

## 9. Risks & open items

- **Quote currency vs model currency.** Assumed same currency or converted via the model `fx_rate`; per-quote FX is deferred. Confirm this is acceptable.
- **Baseline choice.** Comparing against the live rollup vs a frozen version — default live; a version selector is included but the UX should be confirmed.
- **Insight rule tuning.** Thresholds (e.g. 10% lever) are practitioner judgment; the rules are pure and easily tuned, and should get a domain-expert pass like the seed content.
- **Waterfall readability** for models with many small gaps — mitigated by top-N + "Other" grouping.

---

## 10. Next step

On confirmation of the Section 0 assumptions and written-spec review, invoke **writing-plans** to produce the Phase 2 implementation plan (waves: A comparison/waterfall/insights pure logic → B quote persistence + entry UI → C comparison page + matrix → D waterfall + insight cards → E QA), which the executor carries out.
