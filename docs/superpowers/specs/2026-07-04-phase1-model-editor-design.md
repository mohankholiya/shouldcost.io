# Phase 1 — Cost-Model Editor (Design Spec)

**Project:** shouldcost.io
**Phase:** 1 of 5
**Status:** Approved (pending written-spec review)
**Date:** 2026-07-04
**Builds on:** Phase 0 (Foundation) — Next.js 14 app, design system, Supabase schema + RLS, seeded templates/indices, auth, app shell.

---

## 1. Purpose

Phase 0 delivered a structurally real but non-interactive product: a user can sign in, land in a workspace, and browse seeded templates/indices — but there is no way to build or edit a should-cost model. **Phase 1 makes the product do its core job:** open a cost model, build its cost-breakdown structure (CBS) from a template or scratch, edit drivers and rates inline with a live should-cost total, bind line rates to commodity indices, analyse sensitivity, and save versions.

At the end of Phase 1 a user can instantiate a model from a category template, edit it in an Excel-like tree grid with an always-current rollup total, bind lines to indices, see the cost composition and driver sensitivity in charts, browse the index hub, and freeze/compare versions.

### Phase 1 scope boundary

**In scope:**
- **CBS tree editor** at `/models/[id]`: TanStack-Table tree grid, inline cell editing, Excel-like keyboard navigation, add/remove nodes, group collapse, drag-drop reorder.
- **Live recompute:** client-side rollup of the working model (integer minor units), instant total via `AnimatedCounter`; per-group subtotals.
- **Persistence:** debounced autosave of edited nodes (server actions), reflected by `SavedIndicator`.
- **Versioning:** explicit "Save version" snapshots into `model_versions`; a version list and a two-version **diff view** (added / removed / changed lines).
- **Index binding & recalc:** bind a line to an index + factor; effective rate = latest `index_value` × factor; "refresh from index" re-materializes rates.
- **Charts** (Recharts, behind a reusable `ChartContainer`): rollup **donut** (composition by top-level group), **tornado** sensitivity (±X% per driver, ranked), index **sparkline** (24-month series).
- **Index hub** at `/indices`: list with sparklines + a `/indices/[code]` detail page (series + models using it).
- **Template instantiation:** picker drawer that clones a `category_templates.cbs_json` into `cost_nodes` for a new model; blank-model option.
- **Tests:** unit (live rollup, sensitivity, diff, effective-rate), component (grid editing/keyboard/add-remove), integration (autosave + snapshot under RLS), one E2E (template → edit → total updates → save version).

**Explicitly out of scope (deferred):**
- Quote entry, quote-comparison matrix, gap waterfall, rule-based insights, PDF/XLSX export, share links → **Phase 2**.
- Billing, plan gating, marketing site, public SEO calculators, template gallery → **Phase 3**.
- Command palette, dark-mode toggle UI, audit-log UI, comments, onboarding, Sentry/analytics → **Phase 4**.
- Real-time multi-user collaboration and live index data feeds (indices remain seeded until a later phase).

---

## 2. Confirmed decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Phase 1 scope | Full: editor + index binding/recalc + versioning/diff + 3 charts + index hub | User-confirmed; quote comparison stays in Phase 2 |
| Editor architecture | Client-authoritative Zustand store + live in-browser rollup; server persistence | Excel-like editing must feel instant; the rollup is cheap and already written |
| Save & versioning | Debounced autosave of the working model + explicit named version snapshots | Never lose work; user controls the version timeline; matches Phase 0 `SavedIndicator` + `model_versions` |
| Sensitivity | ±X% per driver (default ±10%, configurable), ranked tornado | Classic, defensible, easy to explain to a supplier |
| Grid | TanStack Table (headless) + custom cells | Fixed by Phase 0 spec §5.G; full control over inline editing/keyboard |
| Charts | Recharts behind a `ChartContainer` wrapper (copy-data / download-PNG) | Fixed by Phase 0 spec; every chart inherits the wrapper affordance |
| Reorder / DnD | `@dnd-kit` | Accessible drag-drop with keyboard support |
| State | Zustand | Fixed by stack; installed in this phase |
| Money | Integer minor units everywhere via `lib/money.ts`; rollup returns minor | Continues Phase 0 discipline; no floats |
| Index recalc | Bound line stores `index_id` + `index_factor`; `rate` is materialized (latest value × factor) so snapshots are self-contained; explicit refresh re-pulls | Deterministic snapshots; predictable rollups |

---

## 3. Tech stack (delta over Phase 0)

New dependencies: **`zustand`**, **`@tanstack/react-table`**, **`recharts`**, **`@dnd-kit/core`** + **`@dnd-kit/sortable`**. Everything else continues from Phase 0 (Next.js 14 App Router, TS strict, Tailwind v4, shadcn/Radix, RHF + Zod, Supabase clients under RLS, Vitest + Playwright).

No new backend services. Editing uses **server actions** (already available via `lib/supabase/server.ts`) writing to the existing `cost_nodes` / `model_versions` tables under RLS. No schema changes are required; a small optional migration `0005` may add helpful indexes/constraints (see §7) but Phase 1 does not depend on it.

---

## 4. File / folder structure (delta)

```
app/(app)/
├── models/[id]/page.tsx          # REPLACES stub: load model + nodes, hydrate store, render editor
├── indices/page.tsx              # REPLACES stub: hub list with sparklines
└── indices/[code]/page.tsx       # NEW: index detail (series + models using it)

components/models/
├── model-editor.tsx              # editor shell: header (name, total, SavedIndicator, Save version), layout
├── cbs-tree/
│   ├── cbs-tree.tsx              # TanStack Table tree grid
│   ├── cbs-row.tsx               # a row (group or line), collapse, drag handle
│   ├── cells/{money,number,text,rate-source,index-binding}-cell.tsx
│   └── keyboard.ts               # Excel-like navigation helpers
├── index-binding.tsx            # bind index + factor; refresh from index
├── version-bar.tsx              # version list + "Save version" + open diff
├── version-diff.tsx             # two-version added/removed/changed view
└── charts/
    ├── chart-container.tsx      # Recharts wrapper: title, copy-data, download-PNG, empty/loading
    ├── rollup-donut.tsx
    ├── tornado-chart.tsx
    └── index-sparkline.tsx

components/indices/
├── index-card.tsx               # hub list item with sparkline
└── template-picker.tsx          # drawer: choose template or blank -> instantiate

lib/
├── stores/editor-store.ts       # Zustand: nodes, selection, dirty set, memoized rollup
├── model/
│   ├── tree.ts                  # flat cost_nodes[] <-> tree; ordering
│   ├── rollup-live.ts           # rollup over the live tree -> per-node + grand total (minor)
│   ├── sensitivity.ts           # ±X% per-driver tornado ranking
│   ├── diff.ts                  # version snapshot diff (added/removed/changed)
│   └── index-rate.ts            # effective rate = latest index_value * factor
├── db/
│   ├── models.ts                # load/create model, load nodes, instantiate from template
│   ├── nodes.ts                 # upsert/delete cost_nodes (autosave)
│   └── versions.ts              # snapshot + load versions
└── actions/                     # server actions: save-nodes, save-version, instantiate-model

supabase/migrations/
└── 0005_editor_indexes.sql      # OPTIONAL: indexes/constraints for editor queries (non-blocking)

tests/
├── unit/{rollup-live,sensitivity,diff,index-rate,tree}.test.ts
├── unit/cbs-tree.test.tsx        # inline edit + keyboard + add/remove (render)
├── integration/editor.test.ts    # autosave + snapshot under RLS (env-gated)
└── e2e/editor.spec.ts            # template -> edit rate -> total updates -> save version
```

---

## 5. Core units & interfaces

Each unit is independently testable with a clear boundary.

### 5.1 Tree + live rollup (`lib/model/`)
- `buildTree(nodes: CostNodeRow[]): CostTree` — assemble a tree from flat rows via `parent_id` + `sort_order`.
- `flattenTree(tree): CostNodeRow[]` — inverse, for persistence.
- `rollupLive(tree): { total: Minor; byNodeId: Record<string, Minor> }` — integer-minor rollup; reuses Phase 0 formula semantics (named-group references + running subtotal) and index-materialized rates. Pure; the editor's single source of truth for numbers.

### 5.2 Editor store (`lib/stores/editor-store.ts`, Zustand)
- State: `nodes`, `selectedId`, `dirtyIds: Set<string>`, `saveStatus`, derived `rollup`.
- Actions: `setCell(id, field, value)`, `addLine(parentId)`, `addGroup(parentId)`, `removeNode(id)`, `reorder(id, toParentId, toIndex)`, `bindIndex(id, indexId, factor)`, `refreshFromIndex(id)`, `markSaved(ids)`. Every mutation recomputes `rollup` synchronously and schedules a debounced autosave of `dirtyIds`.

### 5.3 Sensitivity (`lib/model/sensitivity.ts`)
- `tornado(tree, pct = 10): { nodeId; name; low: Minor; high: Minor; swing: Minor }[]` — for each leaf driver, recompute the grand total with its rate (and quantity where applicable) at ±pct%, sorted by `swing` desc. Pure and unit-tested.

### 5.4 Diff (`lib/model/diff.ts`)
- `diffVersions(a: Snapshot, b: Snapshot): { added; removed; changed: { field; from; to }[] }` — keyed by stable node identity (path or id).

### 5.5 Persistence (`lib/db/*` + `lib/actions/*`)
- `instantiateFromTemplate(modelId, templateSlug)` — clone `cbs_json` into `cost_nodes` (admin-free; runs under the user's RLS session).
- `saveNodes(modelId, changed: CostNodeRow[], deleted: string[])` — server action; upsert/delete; returns saved ids for the store to clear dirty flags.
- `saveVersion(modelId, snapshot, total, note)` — insert into `model_versions` with the next `version_no`.

### 5.6 Charts (`components/models/charts/*`)
- `ChartContainer` — title + actions (copy data as CSV, download PNG) + empty/loading states; all three charts render inside it. Recharts under the hood; numbers formatted via `lib/format.ts` with tabular figures.

---

## 6. Data flow

**Editing:** `cell edit → store.setCell → rollupLive recompute → UI updates (total AnimatedCounter, donut, tornado) → debounce(800ms) → saveNodes server action → markSaved → SavedIndicator "Saved"`. Errors set `saveStatus = "error"` and retain dirty flags for retry.

**Instantiate:** template picker → `instantiateFromTemplate` writes nodes → navigate to `/models/[id]` → store hydrates.

**Versioning:** "Save version" → snapshot current tree + grand total → `saveVersion`. Version bar lists versions; selecting two opens `version-diff`.

**Index recalc:** binding a line stores `index_id` + `index_factor` and materializes `rate = latestValue(index) × factor`; "refresh from index" re-materializes bound rates from current `index_values`. Rollup always reads the materialized `rate`, so snapshots are reproducible.

---

## 7. Data model

**No breaking schema changes.** Phase 1 uses the existing `cost_nodes` (tree via `parent_id`, `sort_order`, `rate` minor, `rate_source`, `index_id`, `index_factor`, `formula`), `model_versions` (`snapshot_json`, `total_cost` minor, `version_no`), `indices` / `index_values`, and `category_templates`.

Optional migration `0005_editor_indexes.sql` (non-blocking): a composite index on `cost_nodes(model_id, parent_id, sort_order)` for ordered tree loads, and a `check (version_no > 0)` guard. Phase 1 functions correctly without it.

---

## 8. Definition of done (Phase 1)

- Instantiate a model from any seeded template; edit it inline with correct, live integer-minor rollup totals.
- Excel-like keyboard nav (tab/enter/arrows), add/remove/reorder nodes, group collapse — all keyboard-accessible with visible focus.
- Debounced autosave persists edits under RLS; `SavedIndicator` reflects saving/saved/error; refresh restores the saved model.
- "Save version" snapshots; version list + two-version diff render correctly.
- Index binding materializes rates; "refresh from index" updates them; rollup stays integer-minor.
- Rollup donut, tornado (±X%, default 10), and index sparkline render inside `ChartContainer` with copy-data/PNG; numbers use tabular figures.
- Index hub list + detail render seeded series.
- TypeScript strict, zero `any`; Zod on every mutation/server action; money as integers.
- Unit + component + integration tests green; one E2E (template → edit → total → save version) passes.
- Renders at 375 / 768 / 1440px; WCAG AA; Lighthouse ≥ 90 on the editor route (interactive, so a11y/best-practices/SEO targeted; perf measured on a representative model).

---

## 9. Risks & open items

- **Tree editing complexity.** Inline editing + keyboard + drag-drop in a tree grid is the hardest UI in the product. Mitigation: build the grid on TanStack Table headless primitives, cover keyboard/edit/add-remove with component tests early, land drag-drop last behind the working grid.
- **Formula semantics parity.** The live rollup must match Phase 0's named-group + running-subtotal evaluation exactly, now over flat DB rows. Mitigation: shared test vectors between `lib/seed/rollup.ts` and `lib/model/rollup-live.ts` (OCTG must still land ~1,760/MT).
- **Autosave races.** Rapid edits + debounced writes can race. Mitigation: last-write-wins per node with a dirty set cleared only on confirmed save; version snapshots are explicit and immutable.
- **Large trees.** Very large models could stress the client rollup/render. Not a Phase 1 blocker; virtualization is a later optimization.

---

## 10. Next step

On written-spec approval, invoke the **writing-plans** skill to produce the Phase 1 implementation plan (task breakdown with dependencies, ordered for incremental shippability), which the executor then carries out — likely in waves: (A) tree + live rollup + store, (B) editor grid + autosave, (C) index binding + recalc, (D) versioning + diff, (E) charts + index hub, (F) QA gate.
