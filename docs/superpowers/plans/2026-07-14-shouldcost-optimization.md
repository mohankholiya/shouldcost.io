# Shouldcost.io Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship six workstreams — navigation, performance, chart correctness + polish, embedded export charts, Compare hardening, and a 1-free-AI-draft token gate with billing turned on — as independently testable, committable phases.

**Architecture:** Next.js 14 App Router + React 18 + Zustand + Recharts + ExcelJS + Supabase + Anthropic + Stripe. Money is integer minor units throughout. The single `useEditorStore` stays the source of truth; latency is fixed by localizing re-renders (stable TanStack columns + debounced chart snapshot), not by throttling the live rollup. The monetization gate is authoritative server-side (a `security definer` RPC) with a client intercept for UX, layered onto the already-built Stripe/entitlements stack.

**Tech Stack:** Next.js 14, TypeScript (strict), Tailwind v4, shadcn/ui + Radix, Zustand, TanStack Table, Recharts, ExcelJS, `sharp` (new), Supabase (Postgres + RLS), `@anthropic-ai/sdk`, `stripe`, `next-themes`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-14-shouldcost-optimization-design.md`

## Global Constraints

- Money is integer minor units (bigint/int) everywhere; format to major only at the edges via `formatCurrency(minor, currency)` / `fromMinor`.
- No placeholder text or metrics anywhere; no `TODO`/`TBD` in shipped copy.
- WCAG 2.1 AA: semantic landmarks, visible focus, chart contrast relief via labels + table view, `role="img"` + `aria-label` on chart SVGs.
- Fully responsive at 375 / 768 / 1440 px.
- Lighthouse ≥ 90 on Performance / Accessibility / Best Practices / SEO.
- Chart palette must pass `node <dataviz>/scripts/validate_palette.js` for `--mode light` and `--mode dark`.
- Tone: senior, consulting-native ("engagement", "category", "should-cost", "cost-out"). No hype.
- Commit style: short imperative subjects.
- Currency type is `Currency` from `@/components/number/currency-select` (`"USD"|"EUR"|"GBP"|"SAR"|"AED"|"INR"`).
- The `Currency` type is imported where money is formatted; cast `model.currency as Currency` at page boundaries.

## Refinements vs. the spec (lower-risk, same goals)

- **Tornado perf:** keep the proven `tornado()` algorithm (already returns `low`/`high`/`swing`); kill per-keystroke recomputation with a debounced snapshot + memoization. No coefficient rewrite.
- **Chart memoization:** one `useDebouncedEditorSnapshot()` hook replaces the separate store `rev` counter.

---

## Phase 1 — Navigation (Workstream B)

### Task 1: Extend `PageHeader` with back + breadcrumbs slots

**Files:**
- Modify: `components/shared/page-header.tsx`

**Interfaces:**
- Produces: `PageHeader({ title, subtitle?, actions?, back?, breadcrumbs? })` where `back?: { href: string; label: string }` and `breadcrumbs?: React.ReactNode`.

- [ ] **Step 1: Replace `components/shared/page-header.tsx`**

```tsx
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
  breadcrumbs,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  breadcrumbs?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        {breadcrumbs && <div className="mb-1">{breadcrumbs}</div>}
        {back && (
          <Link
            href={back.href}
            className="mb-1 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {back.label}
          </Link>
        )}
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS (additive optional props).

- [ ] **Step 3: Commit**

```bash
git add components/shared/page-header.tsx
git commit -m "Add back + breadcrumbs slots to PageHeader"
```

---

### Task 2: `Breadcrumbs` component

**Files:**
- Create: `components/layout/breadcrumbs.tsx`
- Test: `tests/unit/breadcrumbs.test.tsx`

**Interfaces:**
- Produces: `Breadcrumbs({ items: { label: string; href?: string }[] })` — last item renders as plain text, others as Next `Link`s, separated by a chevron in muted ink.

- [ ] **Step 1: Write the failing test** `tests/unit/breadcrumbs.test.tsx`

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

describe("Breadcrumbs", () => {
  it("renders links then a plain final label", () => {
    render(
      <Breadcrumbs
        items={[
          { label: "Home", href: "/dashboard" },
          { label: "Projects", href: "/projects" },
          { label: "Turbine RFP" },
        ]}
      />,
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent("Home");
    expect(screen.getByText("Turbine RFP")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test breadcrumbs`
Expected: FAIL ("Cannot find module '@/components/layout/breadcrumbs'").

- [ ] **Step 3: Create `components/layout/breadcrumbs.tsx`**

```tsx
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center text-xs text-muted-foreground">
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center">
            {i > 0 && <ChevronRight className="mx-1 h-3 w-3" aria-hidden="true" />}
            {item.href && !last ? (
              <Link href={item.href} className="hover:text-foreground focus-visible:outline-none focus-visible:underline">
                {item.label}
              </Link>
            ) : (
              <span className={last ? "text-foreground" : undefined}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test breadcrumbs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/layout/breadcrumbs.tsx tests/unit/breadcrumbs.test.tsx
git commit -m "Add Breadcrumbs component"
```

---

### Task 3: Load project name; wire editor breadcrumb + back

**Files:**
- Modify: `lib/db/models.ts`
- Modify: `app/(app)/models/[id]/page.tsx`
- Modify: `components/models/model-editor.tsx`

**Interfaces:**
- Produces: `ModelHeader` gains `project_name: string`. `ModelEditor` gains `projectName: string` prop and renders breadcrumb + back.

- [ ] **Step 1: Extend `loadModel` in `lib/db/models.ts`**

Change the `ModelHeader` type and the select to include the parent project name:

```ts
export type ModelHeader = {
  id: string;
  name: string;
  currency: string;
  project_id: string;
  project_name: string;
  status: string;
};

export async function loadModel(id: string): Promise<ModelHeader | null> {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("cost_models")
    .select("id, name, currency, project_id, status, projects(name)")
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as Omit<ModelHeader, "project_name"> & { projects: { name: string } | null };
  return { ...row, project_name: row.projects?.name ?? "Project" };
}
```

(Leave `createModel`, `templateToNodes`, `countModelsByOrg` unchanged.)

- [ ] **Step 2: Thread `projectName` into `ModelEditor`** — modify `components/models/model-editor.tsx`

Add the import and prop, then pass `back` + `breadcrumbs` to `PageHeader`:

```tsx
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
// …inside the component signature:
export function ModelEditor({
  model,
  nodes,
  indices,
  versions,
  plan,
}: {
  model: ModelHeader;
  nodes: CostNodeRow[];
  indices: IndexWithLatest[];
  versions: ModelVersion[];
  plan: Plan;
}) {
```

Replace the `<PageHeader …/>` opening to add navigation:

```tsx
      <PageHeader
        title={model.name}
        subtitle="Cost-model editor"
        back={{ href: `/projects/${model.project_id}`, label: "Back to Project" }}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Home", href: "/dashboard" },
              { label: "Projects", href: "/projects" },
              { label: model.project_name, href: `/projects/${model.project_id}` },
              { label: model.name },
            ]}
          />
        }
        actions={
```

(The rest of the `actions` block stays unchanged.)

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/db/models.ts components/models/model-editor.tsx
git commit -m "Add project breadcrumb + back-to-project in model editor"
```

---

### Task 4: Wire Compare breadcrumb + back

**Files:**
- Modify: `app/(app)/models/[id]/compare/page.tsx`
- Modify: `components/quotes/compare-view.tsx`

**Interfaces:**
- Consumes: `compare-view.tsx` already receives `modelId`; add `modelName: string` and `projectId: string` props threaded from the page (which already loads the model).

- [ ] **Step 1: Read the current compare page** to confirm it loads the model. Run `cat "app/(app)/models/[id]/compare/page.tsx"` and note the `loadModel` call already present; pass `modelName` + `projectId` into `<CompareView …/>`.

- [ ] **Step 2: Extend `CompareView` props** in `components/quotes/compare-view.tsx` — add `modelName: string; projectId: string` to the props destructuring, import `PageHeader` + `Breadcrumbs`, and wrap the existing header so it reads:

```tsx
      <PageHeader
        title="Compare quotes"
        subtitle={modelName}
        back={{ href: `/models/${modelId}`, label: "Back to Model" }}
        breadcrumbs={
          <Breadcrumbs
            items={[
              { label: "Home", href: "/dashboard" },
              { label: "Projects", href: "/projects" },
              { label: modelName, href: `/projects/${projectId}` },
              { label: "Compare quotes" },
            ]}
          />
        }
      />
```

(Keep the existing tabs/matrix/waterfall/insights/export unchanged.)

- [ ] **Step 3: Thread props from the page** — in `app/(app)/models/[id]/compare/page.tsx`, pass `modelName={model.name}` and `projectId={model.project_id}` to `<CompareView …/>`.

- [ ] **Step 4: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/models/[id]/compare/page.tsx components/quotes/compare-view.tsx
git commit -m "Add breadcrumb + back-to-model on compare page"
```

---

## Phase 2 — Performance (Workstream A)

### Task 5: `useDebouncedEditorSnapshot` hook

**Files:**
- Create: `components/models/charts/use-debounced-editor-snapshot.ts`
- Test: `tests/unit/use-debounced-editor-snapshot.test.tsx`

**Interfaces:**
- Produces: `useDebouncedEditorSnapshot(delayMs = 200): { nodes: CostNodeRow[]; rollup: Rollup }` — subscribes to the store, emits a snapshot at most every `delayMs`, and always emits the latest on unmount-free idle. Identity of the returned object is stable across re-renders that carry no value change.

- [ ] **Step 1: Write the failing test** `tests/unit/use-debounced-editor-snapshot.test.tsx`

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useDebouncedEditorSnapshot } from "@/components/models/charts/use-debounced-editor-snapshot";

describe("useDebouncedEditorSnapshot", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useEditorStore.setState({
      nodes: {},
      order: [],
      rollup: { total: 0, byNodeId: {} },
    });
  });
  afterEach(() => vi.useRealTimers());

  it("returns the latest snapshot after the debounce window", () => {
    const { result } = renderHook(() => useDebouncedEditorSnapshot(200));
    expect(result.current.rollup.total).toBe(0);

    act(() => {
      useEditorStore.setState({
        nodes: { a: { id: "a", rate: 100, quantity: 2, node_type: "line" } } as never,
        order: ["a"],
        rollup: { total: 200, byNodeId: { a: 200 } },
      });
    });
    // not yet
    expect(result.current.rollup.total).toBe(0);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.rollup.total).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test use-debounced-editor-snapshot`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `components/models/charts/use-debounced-editor-snapshot.ts`**

```tsx
"use client";
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import type { CostNodeRow, Rollup } from "@/lib/model/types";

export type EditorSnapshot = { nodes: CostNodeRow[]; rollup: Rollup };

function readSnapshot(): EditorSnapshot {
  const s = useEditorStore.getState();
  const nodes = s.order.map((id) => s.nodes[id]).filter(Boolean) as CostNodeRow[];
  return { nodes, rollup: s.rollup };
}

/** Debounced view of the editor tree + rollup, so charts recompute at most every `delayMs`. */
export function useDebouncedEditorSnapshot(delayMs = 200): EditorSnapshot {
  const [snap, setSnap] = useState<EditorSnapshot>(() => readSnapshot());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = useEditorStore.subscribe(() => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setSnap(readSnapshot()), delayMs);
    });
    return () => {
      unsub();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [delayMs]);

  return snap;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test use-debounced-editor-snapshot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/models/charts/use-debounced-editor-snapshot.ts tests/unit/use-debounced-editor-snapshot.test.tsx
git commit -m "Add debounced editor snapshot hook for charts"
```

---

### Task 6: Stabilize CbsTree columns + live total cells

**Files:**
- Modify: `components/models/cbs-tree/cbs-tree.tsx`
- Create: `components/models/cbs-tree/total-cell.tsx`
- Create: `components/models/cbs-tree/grand-total.tsx`

**Goal:** Remove `rollup` from the `columns` useMemo deps so editing one cell no longer re-renders every row. The per-row Total and the footer grand-total move into components that subscribe to their own rollup slice.

**Interfaces:**
- Produces: `TotalCell({ id, currency })` and `GrandTotal({ currency })`, both reading `useEditorStore`.

- [ ] **Step 1: Create `components/models/cbs-tree/total-cell.tsx`**

```tsx
"use client";
import { memo } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/components/number/currency-select";

export const TotalCell = memo(function TotalCell({ id, currency }: { id: string; currency: Currency }) {
  const value = useEditorStore((s) => s.rollup.byNodeId[id] ?? 0);
  return <span className="num">{formatCurrency(value, currency)}</span>;
});
```

- [ ] **Step 2: Create `components/models/cbs-tree/grand-total.tsx`**

```tsx
"use client";
import { useEditorStore } from "@/lib/stores/editor-store";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/components/number/currency-select";

export function GrandTotal({ currency }: { currency: Currency }) {
  const total = useEditorStore((s) => s.rollup.total);
  return <span className="num">{formatCurrency(total, currency)}</span>;
}
```

- [ ] **Step 3: Update `components/models/cbs-tree/cbs-tree.tsx`**

Add imports and a `currency` prop; replace the `total` column cell and the footer; stabilize `columns` deps.

Add to imports:

```tsx
import { useCallback } from "react";
import { TotalCell } from "./total-cell";
import { GrandTotal } from "./grand-total";
import type { Currency } from "@/components/number/currency-select";
```

Change the component signature to accept currency:

```tsx
export function CbsTree({ currency = "USD" }: { currency?: Currency }) {
```

Drop the `rollup` selector line (no longer read directly in columns). Make `toggle` stable:

```tsx
  const toggle = useCallback((id: string) => {
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
```

Replace the `total` column `cell` body with:

```tsx
      col.display({
        id: "total",
        header: "Total",
        cell: ({ row }) => <TotalCell id={row.original.node.id} currency={currency} />,
      }),
```

Change the `columns` useMemo closing deps to:

```tsx
    [collapsed, toggle, currency],
```

(Remove the `rollup` dep and the eslint-disable.) Replace the footer total cell:

```tsx
            <td className="num px-2 py-2"><GrandTotal currency={currency} /></td>
```

- [ ] **Step 4: Thread `currency` from `ModelEditor`** — in `components/models/model-editor.tsx`, change `<CbsTree />` to `<CbsTree currency={model.currency as Currency} />` (add `import type { Currency }` is already present).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/models/cbs-tree/total-cell.tsx components/models/cbs-tree/grand-total.tsx components/models/cbs-tree/cbs-tree.tsx components/models/model-editor.tsx
git commit -m "Stabilize CBS columns; per-row + footer totals subscribe live"
```

---

### Task 7: Wire debounced snapshot + memoized charts into the editor

**Files:**
- Modify: `components/models/charts/rollup-donut.tsx`
- Modify: `components/models/charts/tornado-chart.tsx`
- Modify: `components/models/model-editor.tsx`

**Interfaces:**
- Produces: `RollupDonut({ currency })` and `TornadoChart({ currency })` — both read the debounced snapshot themselves (no more `nodes`/`rollup` props from the parent). `ModelEditor` stops computing `currentNodes`/passing chart props.

- [ ] **Step 1: Convert `RollupDonut` to self-subscribe** — in `components/models/charts/rollup-donut.tsx`, replace the signature and data line:

```tsx
import { useMemo } from "react";
import { useDebouncedEditorSnapshot } from "./use-debounced-editor-snapshot";
import type { Currency } from "@/components/number/currency-select";

export function RollupDonut({ currency = "USD" }: { currency?: Currency }) {
  const { nodes, rollup } = useDebouncedEditorSnapshot();
  const data = useMemo(() => donutData(nodes, rollup), [nodes, rollup]);
  const total = rollup.total || 1;
```

Replace every `formatCurrency(x, "USD")` in this file with `formatCurrency(x, currency)`.

- [ ] **Step 2: Convert `TornadoChart` to self-subscribe** — in `components/models/charts/tornado-chart.tsx`, replace the signature and data line:

```tsx
import { useMemo } from "react";
import { useDebouncedEditorSnapshot } from "./use-debounced-editor-snapshot";
import type { Currency } from "@/components/number/currency-select";

export function TornadoChart({ currency = "USD" }: { currency?: Currency }) {
  const [pct, setPct] = useState(10);
  const { nodes, rollup } = useDebouncedEditorSnapshot();
  const bars = useMemo(() => tornado(buildTree(nodes), pct).slice(0, 8), [nodes, pct]);
  const baseline = rollup.total;
```

(The visual upgrade to the diverging form happens in Task 12; this task only decouples it from per-keystroke parent re-renders. Leave the existing JSX, but replace `formatCurrency(b.swing, "USD")` with `formatCurrency(b.swing, currency)`.)

- [ ] **Step 3: Simplify `ModelEditor` chart wiring** — in `components/models/model-editor.tsx`, remove the now-unused `nodesMap`, `order`, `rollup`, and `currentNodes` lines used only for charts (keep `total` for the header counter and `status`). Change the chart grid to:

```tsx
      <div className="grid gap-4 lg:grid-cols-2">
        <RollupDonut currency={model.currency as Currency} />
        <TornadoChart currency={model.currency as Currency} />
      </div>
```

- [ ] **Step 4: Typecheck + unit tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS (existing chart tests still pass; they call `donutData`/`tornado` directly, unaffected).

- [ ] **Step 5: Commit**

```bash
git add components/models/charts/rollup-donut.tsx components/models/charts/tornado-chart.tsx components/models/model-editor.tsx
git commit -m "Charts consume debounced snapshot; decouple from per-keystroke re-renders"
```

---

## Phase 3 — Chart correctness + polish (Workstream C)

### Task 8: Rework chart palette + dark steps + `useChartColors`

**Files:**
- Modify: `lib/chart-palette.ts`
- Create: `components/models/charts/use-chart-colors.ts`
- Test: (validation is a script run, asserted manually in this task and re-run in Task 16's DoD)

**Interfaces:**
- Produces: `CHART_CATEGORICAL_LIGHT`, `CHART_CATEGORICAL_DARK`, `DIVERGING_LIGHT`, `DIVERGING_DARK`, and `useChartColors()` → `{ categorical: string[]; diverging: { up: string; down: string; mid: string } }`.

- [ ] **Step 1: Validate the candidate palettes** (light + dark). Run:

```bash
cd "C:/Users/mohan/AppData/Local/Temp/claude/bundled-skills/2.1.204/bb4780e84ab5714f64310e407fd3e15c/dataviz"
node scripts/validate_palette.js "#2a78d6,#1baf7a,#eda100,#008300,#4a3aa7,#e34948" --mode light
node scripts/validate_palette.js "#3987e5,#199e70,#c98500,#008300,#9085e9,#e66767" --mode dark --surface "#1a1a19"
node scripts/validate_palette.js "#b45309,#059669" --mode light
```

Expected: each prints `→ ALL CHECKS PASS` (the light categorical has a known contrast WARN that is satisfied by the side legend — acceptable). If any FAILs, adjust the offending hex to the nearest passing step and re-run until pass.

- [ ] **Step 2: Append the new tokens to `lib/chart-palette.ts`** (keep existing tokens for the waterfall + primary accent; the donut/tornado switch to these):

```ts
/** Validated categorical palette for the composition donut (light). CVD ΔE 24.2; the
 *  aqua/yellow contrast WARN is satisfied by the always-present side legend + table view. */
export const CHART_CATEGORICAL_LIGHT = [
  "#2a78d6", "#1baf7a", "#eda100", "#008300", "#4a3aa7", "#e34948",
] as const;

/** Same hues stepped for the dark surface (#1a1a19). */
export const CHART_CATEGORICAL_DARK = [
  "#3987e5", "#199e70", "#c98500", "#008300", "#9085e9", "#e66767",
] as const;

/** Validated diverging pair for the sensitivity tornado (amber up / green down). CVD ΔE 32.3. */
export const DIVERGING_LIGHT = { up: "#b45309", down: "#059669", mid: "#c3c2b7" } as const;
export const DIVERGING_DARK = { up: "#b45309", down: "#059669", mid: "#383835" } as const;

export const CHART_SURFACE = { light: "#fcfcfb", dark: "#1a1a19" } as const;
```

- [ ] **Step 3: Create `components/models/charts/use-chart-colors.ts`**

```tsx
"use client";
import { useTheme } from "next-themes";
import {
  CHART_CATEGORICAL_LIGHT,
  CHART_CATEGORICAL_DARK,
  DIVERGING_LIGHT,
  DIVERGING_DARK,
} from "@/lib/chart-palette";

export function useChartColors() {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return {
    categorical: dark ? CHART_CATEGORICAL_DARK : CHART_CATEGORICAL_LIGHT,
    diverging: dark ? DIVERGING_DARK : DIVERGING_LIGHT,
  };
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/chart-palette.ts components/models/charts/use-chart-colors.ts
git commit -m "Add validated categorical + diverging chart palettes (light/dark)"
```

---

### Task 9: `donutData` "Other" fold + diagnostic empty states

**Files:**
- Modify: `components/models/charts/rollup-donut.tsx`
- Modify: `components/models/charts/chart-container.tsx`
- Test: `tests/unit/charts.test.tsx`

**Interfaces:**
- Produces: `donutData(nodes, rollup, max = 6)` → at most `max` named slices plus one optional `{ name: "Other", value }` aggregating the tail. `ChartContainer({ title, data, emptyMessage? })`.

- [ ] **Step 1: Update the donut-data tests** in `tests/unit/charts.test.tsx` — add cases for the fold and keep the existing positive-only case. Example additions:

```tsx
it("folds roots beyond the cap into Other", () => {
  const roots = Array.from({ length: 9 }, (_, i) => ({
    id: `r${i}`, model_id: "m", parent_id: null, sort_order: i,
    name: `G${i}`, node_type: "group" as const, driver_name: null,
    quantity: null, unit: null, rate: null, rate_source: "manual" as const,
    index_id: null, index_factor: null, formula: null, notes: null,
  }));
  const rollup = { total: 90, byNodeId: Object.fromEntries(roots.map((r) => [r.id, 10])) };
  const slices = donutData(roots, rollup, 6);
  expect(slices).toHaveLength(7); // 6 named + Other
  expect(slices.at(-1)!.name).toBe("Other");
  expect(slices.at(-1)!.value).toBe(30); // 3 folded roots × 10
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test charts`
Expected: FAIL (`donutData` still returns all roots).

- [ ] **Step 3: Update `donutData` in `components/models/charts/rollup-donut.tsx`**

```tsx
export type Slice = { name: string; value: number };

/** Composition by top-level node (group or line), minor units, positive only.
 *  Folds roots beyond `max` into a single "Other" slice. */
export function donutData(nodes: CostNodeRow[], rollup: Rollup, max = 6): Slice[] {
  const tree = buildTree(nodes);
  const all = tree.roots
    .map((n) => ({ name: n.name, value: rollup.byNodeId[n.id] ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  if (all.length <= max) return all;
  const head = all.slice(0, max);
  const other = all.slice(max).reduce((s, d) => s + d.value, 0);
  return [...head, { name: "Other", value: other }];
}
```

- [ ] **Step 4: Add a `emptyMessage` prop to `ChartContainer`** in `components/models/charts/chart-container.tsx`:

```tsx
export function ChartContainer({
  title,
  data,
  children,
  emptyMessage = "No data yet.",
}: {
  title: string;
  data: Record<string, unknown>[];
  children?: React.ReactNode;
  emptyMessage?: string;
}) {
```

…and change the empty-state line to `{emptyMessage}`.

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test charts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/models/charts/rollup-donut.tsx components/models/charts/chart-container.tsx tests/unit/charts.test.tsx
git commit -m "Donut folds tail into Other; ChartContainer supports a diagnostic empty message"
```

---

### Task 10: `RollupDonut` — gaps, tooltip, currency, a11y, diagnostic empty

**Files:**
- Modify: `components/models/charts/rollup-donut.tsx`

- [ ] **Step 1: Rewrite the `RollupDonut` JSX** to use the validated palette, a 2 px surface gap (`paddingAngle` + `stroke` = surface), a Recharts `Tooltip`, and a diagnostic empty state. The full component body (imports first):

```tsx
"use client";

import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { ChartContainer } from "./chart-container";
import { useDebouncedEditorSnapshot } from "./use-debounced-editor-snapshot";
import { useChartColors } from "./use-chart-colors";
import { donutData, type Slice } from "./rollup-donut";
import { formatCurrency } from "@/lib/format";
import { CHART_SURFACE } from "@/lib/chart-palette";
import { useTheme } from "next-themes";
import type { CostNodeRow, Rollup } from "@/lib/model/types";
import type { Currency } from "@/components/number/currency-select";

export type Slice = { name: string; value: number };

export function donutData(nodes: CostNodeRow[], rollup: Rollup, max = 6): Slice[] {
  const tree = buildTree(nodes);
  const all = tree.roots
    .map((n) => ({ name: n.name, value: rollup.byNodeId[n.id] ?? 0 }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  if (all.length <= max) return all;
  const head = all.slice(0, max);
  const other = all.slice(max).reduce((s, d) => s + d.value, 0);
  return [...head, { name: "Other", value: other }];
}
```

> NOTE: `buildTree` import (`import { buildTree } from "@/lib/model/tree";`) and the `useChartColors` import must be present. The `Slice` type and `donutData` stay exported from this file (Task 9 added them here). Drop the now-duplicate `Slice`/`donutData` declaration if Task 9 already wrote them — keep exactly one copy.

```tsx
export function RollupDonut({ currency = "USD" }: { currency?: Currency }) {
  const { nodes, rollup } = useDebouncedEditorSnapshot();
  const { categorical } = useChartColors();
  const { resolvedTheme } = useTheme();
  const surface = resolvedTheme === "dark" ? CHART_SURFACE.dark : CHART_SURFACE.light;
  const data = useMemo(() => donutData(nodes, rollup), [nodes, rollup]);
  const total = rollup.total || 1;
  const color = (i: number) => categorical[i % categorical.length];

  return (
    <ChartContainer
      title="Cost composition"
      data={data}
      emptyMessage="Add rate-carrying line items (or fill in rates) to see cost composition."
    >
      <div className="flex items-center gap-4">
        <div
          className="h-40 w-40 shrink-0"
          role="img"
          aria-label={`Cost composition donut chart, total ${formatCurrency(rollup.total, currency)}`}
        >
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={2}
                stroke={surface}
                strokeWidth={2}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={color(i)} />
                ))}
              </Pie>
              <Tooltip
                formatter={(v: number, n) => [formatCurrency(v, currency), String(n)]}
                contentStyle={{ borderRadius: 6, border: "1px solid #e1e0d9", fontSize: 12 }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-1 text-xs">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-sm" style={{ background: color(i) }} />
              <span>{d.name}</span>
              <span className="num text-muted-foreground">
                {formatCurrency(d.value, currency)} · {Math.round((d.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartContainer>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/models/charts/rollup-donut.tsx
git commit -m "RollupDonut: validated palette, surface gaps, tooltip, currency, a11y"
```

---

### Task 11: `TornadoChart` — diverging form with baseline + delta labels

**Files:**
- Modify: `components/models/charts/tornado-chart.tsx`

- [ ] **Step 1: Rewrite `TornadoChart`** as a diverging tornado: baseline reference line at `rollup.total`, amber bar to `high`, green bar to `low`, direct delta labels, visible currency axis, tooltip, a11y.

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  ReferenceLine,
  Cell,
} from "recharts";
import { ChartContainer } from "./chart-container";
import { useDebouncedEditorSnapshot } from "./use-debounced-editor-snapshot";
import { useChartColors } from "./use-chart-colors";
import { tornado } from "@/lib/model/sensitivity";
import { buildTree } from "@/lib/model/tree";
import { formatCurrency } from "@/lib/format";
import type { Currency } from "@/components/number/currency-select";

export function TornadoChart({ currency = "USD" }: { currency?: Currency }) {
  const [pct, setPct] = useState(10);
  const { nodes, rollup } = useDebouncedEditorSnapshot();
  const { diverging } = useChartColors();
  const baseline = rollup.total;

  const bars = useMemo(() => tornado(buildTree(nodes), pct).slice(0, 8), [nodes, pct]);

  // One row per driver: low (left of baseline) and high (right of baseline), minor units.
  const data = useMemo(
    () =>
      bars.map((b) => ({
        name: b.name,
        low: b.low - baseline, // negative => bar extends left
        high: b.high - baseline, // positive => bar extends right
        baseline,
        swing: b.swing,
      })),
    [bars, baseline],
  );

  return (
    <ChartContainer
      title="Driver sensitivity"
      data={data}
      emptyMessage="Add rate-carrying line items (no formula) to see driver sensitivity."
    >
      <div className="mb-2 flex items-center gap-2 text-xs">
        <label htmlFor="tornado-pct" className="text-muted-foreground">
          Perturbation ±
        </label>
        <input
          id="tornado-pct"
          type="number"
          value={pct}
          onChange={(e) => setPct(Number(e.target.value) || 10)}
          className="w-14 rounded-sm border border-hairline px-1"
        />
        % <span className="text-muted-foreground">· baseline {formatCurrency(baseline, currency)}</span>
      </div>
      <div
        className="h-48 w-full"
        role="img"
        aria-label="Driver sensitivity tornado chart, diverging from the baseline total"
      >
        <ResponsiveContainer>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis
              type="number"
              tickFormatter={(v) => formatCurrency(baseline + v, currency)}
              tick={{ fontSize: 10 }}
              stroke="#898781"
            />
            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} stroke="#898781" />
            <ReferenceLine x={0} stroke="#898781" strokeWidth={1} />
            <Tooltip
              formatter={(v: number, _n, p) => {
                const total = baseline + v;
                const sign = v >= 0 ? "+" : "−";
                return [`${sign}${formatCurrency(Math.abs(v), currency)} → ${formatCurrency(total, currency)}`, p?.payload?.name ?? ""];
              }}
              contentStyle={{ borderRadius: 6, border: "1px solid #e1e0d9", fontSize: 12 }}
            />
            <Bar dataKey="low" radius={2}>
              {data.map((d, i) => (
                <Cell key={`l-${i}`} fill={diverging.down} />
              ))}
            </Bar>
            <Bar dataKey="high" radius={2}>
              {data.map((d, i) => (
                <Cell key={`h-${i}`} fill={diverging.up} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-1 space-y-0.5 text-xs">
        {bars.map((b) => (
          <li key={b.nodeId} className="flex justify-between tabular-nums">
            <span>{b.name}</span>
            <span className="num text-muted-foreground">
              <span style={{ color: diverging.down }}>−{formatCurrency(baseline - b.low, currency)}</span>
              {" / "}
              <span style={{ color: diverging.up }}>+{formatCurrency(b.high - baseline, currency)}</span>
            </span>
          </li>
        ))}
      </ul>
    </ChartContainer>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Manual visual check** — `pnpm dev`, open a model with several rate-carrying lines, confirm: baseline reference line at center, green bars left (low), amber bars right (high), currency axis visible, tooltip works, dark mode renders the dark palette.

- [ ] **Step 4: Commit**

```bash
git add components/models/charts/tornado-chart.tsx
git commit -m "TornadoChart: diverging baseline form, delta labels, currency, a11y"
```

---

## Phase 4 — Embedded export charts (Workstream E)

### Task 12: `chart-svg.ts` — pure SVG builders

**Files:**
- Create: `lib/export/chart-svg.ts`
- Test: `tests/unit/chart-svg.test.ts`

**Interfaces:**
- Produces: `renderDonutSvg(data: Slice[], currency: Currency, opts?: { width?: number }): string` and `renderTornadoSvg(bars: TornadoBar[], baseline: number, currency: Currency, opts?: { width?: number }): string`. Both emit self-contained `<svg>…</svg>` strings on the light surface using the validated light palette.

- [ ] **Step 1: Write the failing test** `tests/unit/chart-svg.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { renderDonutSvg, renderTornadoSvg } from "@/lib/export/chart-svg";
import type { Slice } from "@/components/models/charts/rollup-donut";
import type { TornadoBar } from "@/lib/model/sensitivity";

describe("chart-svg", () => {
  it("renders a well-formed donut SVG with arcs", () => {
    const svg = renderDonutSvg(
      [{ name: "Material", value: 6000 }, { name: "Labour", value: 4000 }] as Slice[],
      "USD",
    );
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect((svg.match(/<path /g) ?? []).length).toBe(2); // one arc per slice
  });

  it("renders a tornado SVG with one low + one high bar per driver", () => {
    const bars: TornadoBar[] = [
      { nodeId: "a", name: "Steel", low: 9000, high: 11000, swing: 2000 },
    ];
    const svg = renderTornadoSvg(bars, 10000, "USD");
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<rect /g) ?? []).length).toBe(2);
    expect(svg).toContain("#059669"); // down color
    expect(svg).toContain("#b45309"); // up color
  });

  it("renders an empty-state SVG for no data", () => {
    expect(renderDonutSvg([], "USD")).toContain("No data");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test chart-svg`
Expected: FAIL (module missing).

- [ ] **Step 3: Create `lib/export/chart-svg.ts`**

```ts
import { CHART_CATEGORICAL_LIGHT, DIVERGING_LIGHT, CHART_SURFACE } from "@/lib/chart-palette";
import { formatCurrency } from "@/lib/format";
import type { Slice } from "@/components/models/charts/rollup-donut";
import type { TornadoBar } from "@/lib/model/sensitivity";
import type { Currency } from "@/components/number/currency-select";

const SURFACE = CHART_SURFACE.light;
const INK = "#0b0b0b";
const MUTED = "#52514e";

function money(minor: number, c: Currency) {
  return formatCurrency(minor, c);
}

/** Donut as a standalone SVG (light surface). */
export function renderDonutSvg(data: Slice[], currency: Currency, opts?: { width?: number }): string {
  const W = opts?.width ?? 480;
  const H = 240;
  const cx = 120;
  const cy = H / 2;
  const r = 80;
  const ir = 48;
  const total = data.reduce((s, d) => s + d.value, 0);

  if (total <= 0) {
    return svgWrap(W, H, `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${MUTED}" font-size="13">No data</text>`);
  }

  let angle = -Math.PI / 2; // start at top
  const arcs: string[] = [];
  data.forEach((d, i) => {
    const slice = (d.value / total) * Math.PI * 2;
    const a0 = angle;
    const a1 = angle + slice;
    angle = a1;
    const fill = CHART_CATEGORICAL_LIGHT[i % CHART_CATEGORICAL_LIGHT.length]!;
    arcs.push(`<path d="${donutArcPath(cx, cy, r, ir, a0, a1)}" fill="${fill}" stroke="${SURFACE}" stroke-width="2" />`);
  });

  const legend = data
    .map(
      (d, i) =>
        `<g transform="translate(240, ${24 + i * 22})"><rect width="10" height="10" fill="${CHART_CATEGORICAL_LIGHT[i % CHART_CATEGORICAL_LIGHT.length]!}" /><text x="16" y="9" fill="${INK}" font-size="12">${escapeXml(d.name)} — ${money(d.value, currency)} · ${Math.round((d.value / total) * 100)}%</text></g>`,
    )
    .join("");

  return svgWrap(W, H, arcs.join("") + legend);
}

function donutArcPath(cx: number, cy: number, r: number, ir: number, a0: number, a1: number): string {
  const large = a1 - a0 > Math.PI ? 1 : 0;
  const p = (rad: number, rr: number) => [cx + rr * Math.cos(rad), cy + rr * Math.sin(rad)];
  const [x0, y0] = p(a0, r);
  const [x1, y1] = p(a1, r);
  const [x2, y2] = p(a1, ir);
  const [x3, y3] = p(a0, ir);
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${x2} ${y2} A ${ir} ${ir} 0 ${large} 0 ${x3} ${y3} Z`;
}

/** Tornado as a standalone diverging SVG (light surface). */
export function renderTornadoSvg(
  bars: TornadoBar[],
  baseline: number,
  currency: Currency,
  opts?: { width?: number },
): string {
  const W = opts?.width ?? 560;
  const rowH = 26;
  const padTop = 28;
  const labelW = 150;
  const plotW = W - labelW - 24;
  const midX = labelW + plotW / 2;
  const H = padTop + Math.max(bars.length, 1) * rowH + 8;

  if (bars.length === 0) {
    return svgWrap(W, H, `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="${MUTED}" font-size="13">No data</text>`);
  }

  const maxAbsDelta = Math.max(...bars.map((b) => Math.max(baseline - b.low, b.high - baseline)), 1);
  const scale = plotW / 2 / maxAbsDelta;
  const body = bars
    .map((b, i) => {
      const y = padTop + i * rowH;
      const lowDelta = baseline - b.low; // >=0
      const highDelta = b.high - baseline; // >=0
      const lowW = lowDelta * scale;
      const highW = highDelta * scale;
      const lowRect = `<rect x="${midX - lowW}" y="${y}" width="${lowW}" height="14" fill="${DIVERGING_LIGHT.down}" />`;
      const highRect = `<rect x="${midX}" y="${y}" width="${highW}" height="14" fill="${DIVERGING_LIGHT.up}" />`;
      const lowLbl = `<text x="${midX - lowW - 4}" y="${y + 11}" text-anchor="end" fill="${INK}" font-size="10">−${money(lowDelta, currency)}</text>`;
      const highLbl = `<text x="${midX + highW + 4}" y="${y + 11}" fill="${INK}" font-size="10">+${money(highDelta, currency)}</text>`;
      const name = `<text x="${labelW - 8}" y="${y + 11}" text-anchor="end" fill="${INK}" font-size="11">${escapeXml(b.name)}</text>`;
      return lowRect + highRect + lowLbl + highLbl + name;
    })
    .join("");

  const baselineLine = `<line x1="${midX}" y1="${padTop - 8}" x2="${midX}" y2="${H - 6}" stroke="${DIVERGING_LIGHT.mid}" stroke-width="1" /><text x="${midX}" y="${padTop - 12}" text-anchor="middle" fill="${MUTED}" font-size="10">baseline ${money(baseline, currency)}</text>`;

  return svgWrap(W, H, baselineLine + body);
}

function svgWrap(W: number, H: number, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="background:${SURFACE}"><rect width="${W}" height="${H}" fill="${SURFACE}" />${inner}</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === '"' ? "&quot;" : "&#39;",
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test chart-svg`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/export/chart-svg.ts tests/unit/chart-svg.test.ts
git commit -m "Add pure SVG builders for donut + tornado (export path)"
```

---

### Task 13: `sharp` rasterize + embed charts in the XLSX export

**Files:**
- Modify: `package.json` (`+ sharp`)
- Create: `lib/export/rasterize.ts`
- Modify: `lib/export/xlsx-model.ts`
- Modify: `app/api/models/[id]/export/route.ts`

**Interfaces:**
- Produces: `svgToPng(svg: string): Promise<Buffer>` (throws on failure; caller falls back). `buildModelXlsx` accepts an optional `chartImages?: { donut?: Buffer; tornado?: Buffer }`.

- [ ] **Step 1: Add `sharp`** — run `pnpm add sharp`. Confirm it imports on this platform: `node -e "require('sharp'); console.log('ok')"`.

- [ ] **Step 2: Create `lib/export/rasterize.ts`**

```ts
import "server-only";
import sharp from "sharp";

/** Rasterize an SVG string to a PNG buffer at 2× scale for crisp embedding. */
export async function svgToPng(svg: string): Promise<Buffer> {
  // Read intrinsic size from the <svg width=… height=…>; render at 2× for retina fidelity.
  const wMatch = svg.match(/width="(\d+)"/);
  const hMatch = svg.match(/height="(\d+)"/);
  const w = wMatch ? Number(wMatch[1]) : 480;
  const h = hMatch ? Number(hMatch[1]) : 240;
  return sharp(Buffer.from(svg)).resize(w * 2, h * 2, { fit: "fill" }).png().toBuffer();
}
```

- [ ] **Step 3: Extend `buildModelXlsx` to embed images** — in `lib/export/xlsx-model.ts`, add an optional field to the input and embed after the table. Modify the interface:

```ts
export interface BuildModelXlsxInput {
  modelName: string;
  currency: Currency;
  nodes: CostNodeRow[];
  rollup: Rollup;
  chartImages?: { donut?: Buffer; tornado?: Buffer };
}
```

Just before `return wb;`, add:

```ts
  // Embed rendered charts below the breakdown (formulas above are untouched).
  const lastRow = HEADER_ROWS + rows.length + 1;
  const placeImage = (buf: Buffer, anchorRow: number, label: string) => {
    ws.getCell(anchorRow, 1).value = label;
    const imageId = wb.addImage({ buffer: buf, extension: "png" });
    ws.addImage(imageId, {
      tl: { col: 0, row: anchorRow + 1 },
      ext: { width: 480, height: 240 },
    });
  };
  let cursor = lastRow + 1;
  if (input.chartImages?.donut) {
    placeImage(input.chartImages.donut, cursor, "Cost composition");
    cursor += 14;
  }
  if (input.chartImages?.tornado) {
    placeImage(input.chartImages.tornado, cursor, "Driver sensitivity");
  }
```

Add `input` to the destructure at the top of `buildModelXlsx` (currently `const { modelName, currency, nodes, rollup } = input;` stays valid; `input` is already in scope).

- [ ] **Step 4: Render + pass images from the export route** — in `app/api/models/[id]/export/route.ts`. Add imports near the existing model/export imports (line 9 already imports `buildTree`; `rollupLive` is line 10):

```ts
import { donutData } from "@/components/models/charts/rollup-donut";
import { tornado } from "@/lib/model/sensitivity";
import { renderDonutSvg, renderTornadoSvg } from "@/lib/export/chart-svg";
import { svgToPng } from "@/lib/export/rasterize";
```

After line 77 (`const rollup = rollupLive(buildTree(nodes));`) and before the `let wb` block, compute the images (guarded so export never 500s on a render failure):

```ts
  // Render the on-screen charts to PNG for embedding. Failures fall back to a
  // formulas-only workbook (still fully functional) — export must never 500.
  let chartImages: { donut?: Buffer; tornado?: Buffer } = {};
  try {
    const tree = buildTree(nodes);
    const donutSvg = renderDonutSvg(donutData(nodes, rollup), currency);
    const tornadoSvg = renderTornadoSvg(tornado(tree).slice(0, 8), rollup.total, currency);
    chartImages = { donut: await svgToPng(donutSvg), tornado: await svgToPng(tornadoSvg) };
  } catch (err) {
    console.warn("export: chart-image render skipped", err);
  }
```

Then pass `chartImages` only in the model (non-quote) branch — change line 97 from:

```ts
    wb = buildModelXlsx({ modelName: model.name, currency, nodes, rollup });
```

to:

```ts
    wb = buildModelXlsx({ modelName: model.name, currency, nodes, rollup, chartImages });
```

(The comparison branch is left unchanged; embedding the waterfall there is optional and out of scope for this task.)

- [ ] **Step 5: Typecheck + unit tests**

Run: `pnpm typecheck && pnpm test`
Expected: PASS.

- [ ] **Step 6: Manual check** — `pnpm dev`, export a model with data, open the `.xlsx`, confirm the breakdown sheet still has live formulas AND the donut + tornado images appear below the table.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml lib/export/rasterize.ts lib/export/xlsx-model.ts app/api/models/[id]/export/route.ts
git commit -m "Embed rendered donut + tornado images in XLSX export (sharp)"
```

---

## Phase 5 — Compare hardening (Workstream D)

### Task 14: Replace throwaway quote derivation with `leafLines`

**Files:**
- Modify: `lib/model/comparison.ts`
- Modify: `components/quotes/compare-view.tsx`

**Interfaces:**
- Produces: exported `leafLines(nodes: CostNodeRow[]): CostNodeRow[]` (currently module-private).

- [ ] **Step 1: Export `leafLines`** — in `lib/model/comparison.ts`, change `function leafLines(...)` to `export function leafLines(...)`.

- [ ] **Step 2: Use it in the compare view** — in `components/quotes/compare-view.tsx`, find the block (~line 46) that builds `leafLines` via `buildComparison(nodes, rollup, { quoted_total: 0, lines: [] })` and replace it with:

```tsx
import { leafLines } from "@/lib/model/comparison";
// …
const leafLineRows = useMemo(() => leafLines(nodes), [nodes]);
```

(Adjust downstream usages that consumed the previous projection to read from `leafLineRows`; each entry is a `CostNodeRow` with `id` and `name`.)

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add lib/model/comparison.ts components/quotes/compare-view.tsx
git commit -m "Compare: derive leaf lines from the dedicated helper"
```

---

## Phase 6 — Token-based freemium (Workstream F)

### Task 15: Migration `0008_ai_credits.sql`

**Files:**
- Create: `supabase/migrations/0008_ai_credits.sql`

- [ ] **Step 1: Create the migration** with the column + the two `security definer` RPCs, including an ownership guard so a member can only decrement their own org:

```sql
-- One free "Draft with AI" per workspace. Pro/team are unlimited via plan, not this counter.
alter table organizations
  add column ai_draft_credits integer not null default 1;

-- Atomically reserve one credit before the Anthropic call. The ownership guard
-- (id in current_user_orgs()) prevents a caller from touching another org.
-- Returns the new balance, or NULL when the org had no credits left.
create or replace function public.dec_ai_credit(p_org_id uuid)
returns integer language sql security definer set search_path = public as $$
  update public.organizations
    set ai_draft_credits = ai_draft_credits - 1
    where id = p_org_id
      and id in (select public.current_user_orgs())
      and ai_draft_credits > 0
    returning ai_draft_credits;
$$;
grant execute on function public.dec_ai_credit(uuid) to authenticated;

-- Refund one credit on a failed/aborted draft.
create or replace function public.inc_ai_credit(p_org_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.organizations
    set ai_draft_credits = ai_draft_credits + 1
    where id = p_org_id
      and id in (select public.current_user_orgs());
$$;
grant execute on function public.inc_ai_credit(uuid) to authenticated;
```

- [ ] **Step 2: Apply locally and verify**

Run: `pnpm db:push`
Expected: migration applies; `\df public.dec_ai_credit` exists (verify via Supabase studio or `pnpm dlx supabase db sql "select count(*) from organizations;"`).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0008_ai_credits.sql
git commit -m "Add ai_draft_credits column + atomic reserve/refund RPCs"
```

---

### Task 16: Entitlements — add AI credits + flip `FREE_LAUNCH`

**Files:**
- Modify: `lib/entitlements.ts`
- Modify: `lib/db/orgs.ts`
- Test: `tests/unit/entitlements.test.ts`

**Interfaces:**
- Produces: `Entitlement.aiDraftCredits: number | null`; `aiDraftCreditsFor(plan)`, `canDraftWithAi(plan, creditsRemaining)`; `FREE_LAUNCH = false`. `CurrentOrg.organizations.ai_draft_credits: number`.

- [ ] **Step 1: Extend tests** in `tests/unit/entitlements.test.ts` (create if absent):

```ts
import { describe, it, expect } from "vitest";
import { ENTITLEMENTS, aiDraftCreditsFor, canDraftWithAi, FREE_LAUNCH } from "@/lib/entitlements";

describe("AI draft entitlements", () => {
  it("free gets 1 credit; pro/team are unlimited", () => {
    expect(aiDraftCreditsFor("free")).toBe(1);
    expect(aiDraftCreditsFor("pro")).toBeNull();
    expect(aiDraftCreditsFor("team")).toBeNull();
  });
  it("free with a remaining credit can draft; zero cannot", () => {
    expect(canDraftWithAi("free", 1)).toBe(true);
    expect(canDraftWithAi("free", 0)).toBe(false);
  });
  it("paid plans can always draft regardless of counter", () => {
    expect(canDraftWithAi("pro", 0)).toBe(true);
  });
  it("FREE_LAUNCH is off", () => {
    expect(FREE_LAUNCH).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test entitlements`
Expected: FAIL (helpers missing).

- [ ] **Step 3: Edit `lib/entitlements.ts`** — add the field to the interface and each plan, the helpers, and flip the flag:

Add to `Entitlement`:
```ts
  aiDraftCredits: number | null; // null = unlimited
```

Set in the catalog: `free: { … aiDraftCredits: 1, … }`, `pro: { … aiDraftCredits: null, … }`, `team: { … aiDraftCredits: null, … }`.

Change `export const FREE_LAUNCH = true;` → `export const FREE_LAUNCH = false;`.

Add helpers near `canCreateModel`:
```ts
export function aiDraftCreditsFor(plan: Plan): number | null {
  return ENTITLEMENTS[plan].aiDraftCredits;
}

export function canDraftWithAi(plan: Plan, creditsRemaining: number): boolean {
  if (plan !== "free") return true; // pro/team: unlimited
  return creditsRemaining > 0;
}
```

- [ ] **Step 4: Add the column to the org read** — in `lib/db/orgs.ts`, update the type and select:

```ts
export type CurrentOrg = {
  org_id: string;
  role: string;
  organizations: { id: string; name: string; plan: string; is_demo: boolean; ai_draft_credits: number } | null;
};

// in the query:
.select("org_id, role, organizations(id, name, plan, is_demo, ai_draft_credits)")
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm test entitlements`
Expected: PASS.

- [ ] **Step 6: Typecheck** — Run: `pnpm typecheck` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/entitlements.ts lib/db/orgs.ts tests/unit/entitlements.test.ts
git commit -m "Add AI-draft credits to entitlements; turn FREE_LAUNCH off"
```

---

### Task 17: Server gate in the Draft-with-AI route (reserve / refund)

**Files:**
- Modify: `app/api/ai/draft-model/route.ts`
- Test: `tests/unit/ai-credit.test.ts`

**Interfaces:**
- Consumes: `dec_ai_credit` / `inc_ai_credit` RPCs (Task 15), `resolveEffectivePlan`, `findActiveSubscriptionByOrg`, `toSnapshot`, `getCurrentOrg`.
- Produces: the route returns `402 { error: "AI_CREDITS_EXHAUSTED", requiredPlan: "pro" }` when a free org has no credits, reserves a credit before the Anthropic call, and refunds on failure.

- [ ] **Step 1: Write the failing test** `tests/unit/ai-credit.test.ts` focused on the credit-decision helper (the route's HTTP path is covered by the e2e in Task 20). Add a pure helper to keep it testable:

```ts
import { describe, it, expect } from "vitest";
import { decideAiDraftAccess } from "@/app/api/ai/draft-model/route";

describe("decideAiDraftAccess", () => {
  it("allows paid plans without touching credits", () => {
    expect(decideAiDraftAccess("pro", 0)).toEqual({ allowed: true, reserveCredit: false });
    expect(decideAiDraftAccess("team", 0)).toEqual({ allowed: true, reserveCredit: false });
  });
  it("allows free with a credit and requires reservation", () => {
    expect(decideAiDraftAccess("free", 1)).toEqual({ allowed: true, reserveCredit: true });
  });
  it("blocks free with zero credits", () => {
    expect(decideAiDraftAccess("free", 0)).toEqual({ allowed: false, reserveCredit: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test ai-credit`
Expected: FAIL (helper missing).

- [ ] **Step 3: Rewrite `app/api/ai/draft-model/route.ts`** with the gate:

```ts
import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getCurrentOrg } from "@/lib/db/orgs";
import { findActiveSubscriptionByOrg, toSnapshot } from "@/lib/db/subscriptions";
import { getAnthropic, AI_MODEL, isAiEnabled } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { ModelDraftSchema } from "@/lib/ai/schemas";
import { resolveEffectivePlan, type Plan } from "@/lib/entitlements";
import { createServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
const rl = new Map<string, number[]>();

export function decideAiDraftAccess(plan: Plan, creditsRemaining: number): {
  allowed: boolean;
  reserveCredit: boolean;
} {
  if (plan !== "free") return { allowed: true, reserveCredit: false };
  return creditsRemaining > 0
    ? { allowed: true, reserveCredit: true }
    : { allowed: false, reserveCredit: false };
}

export async function POST(req: Request) {
  if (!isAiEnabled()) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRateLimit(rl, org.org_id, Date.now()).allowed) {
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });
  }

  const sub = await findActiveSubscriptionByOrg(org.org_id);
  const plan = resolveEffectivePlan({
    subscription: toSnapshot(sub),
    isDemo: Boolean(org.organizations?.is_demo),
  });
  const credits = org.organizations?.ai_draft_credits ?? 0;
  const decision = decideAiDraftAccess(plan, credits);
  if (!decision.allowed) {
    return NextResponse.json(
      { error: "AI_CREDITS_EXHAUSTED", requiredPlan: "pro" },
      { status: 402 },
    );
  }

  const supabase = await createServerClient();
  if (decision.reserveCredit) {
    const { data: remaining } = await supabase.rpc("dec_ai_credit", { p_org_id: org.org_id });
    if (remaining === null || remaining === undefined) {
      return NextResponse.json(
        { error: "AI_CREDITS_EXHAUSTED", requiredPlan: "pro" },
        { status: 402 },
      );
    }
  }

  const { description, currency } = (await req.json().catch(() => ({}))) as {
    description?: string;
    currency?: string;
  };
  if (!description || !currency) {
    if (decision.reserveCredit) await supabase.rpc("inc_ai_credit", { p_org_id: org.org_id });
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  try {
    const res = await getAnthropic().messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      thinking: { type: "adaptive" },
      system:
        "You are a should-cost estimator. From a plain-language part or service description, draft a cost " +
        "breakdown (material, process/machining, labour, overhead, margin) as structured nodes with a driver, " +
        "quantity, unit, and approximate rate in integer minor units of the given currency. Values are " +
        "approximate estimates for the user to refine — do not imply certified precision.",
      messages: [{ role: "user", content: `Currency ${currency}. Describe: ${description}` }],
      output_config: { format: zodOutputFormat(ModelDraftSchema) },
    });
    if (!res.parsed_output) {
      if (decision.reserveCredit) await supabase.rpc("inc_ai_credit", { p_org_id: org.org_id });
      return NextResponse.json({ error: "No draft" }, { status: 502 });
    }
    return NextResponse.json(res.parsed_output);
  } catch (err) {
    if (decision.reserveCredit) await supabase.rpc("inc_ai_credit", { p_org_id: org.org_id });
    return NextResponse.json({ error: "Draft failed" }, { status: 502 });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test ai-credit`
Expected: PASS.

- [ ] **Step 5: Typecheck** — Run: `pnpm typecheck` — Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/ai/draft-model/route.ts tests/unit/ai-credit.test.ts
git commit -m "Gate Draft-with-AI: reserve/refund credit, 402 when exhausted"
```

---

### Task 18: `UpgradeAiDraftsModal`

**Files:**
- Create: `components/ai/upgrade-ai-drafts-modal.tsx`

**Interfaces:**
- Produces: `UpgradeAiDraftsModal({ open, onOpenChange })` — a Radix Dialog reusing `PlanCard plan="pro"`.

- [ ] **Step 1: Create the modal**

```tsx
"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { PlanCard } from "@/components/billing/plan-card";
import { useGetCurrentPlan } from "@/components/billing/use-current-plan"; // see note

export function UpgradeAiDraftsModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const current = useGetCurrentPlan(); // "free" | "pro" | "team"
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-hairline bg-card p-6 shadow-lg focus:outline-none">
          <Dialog.Title className="text-lg font-semibold">You’ve used your free AI draft</Dialog.Title>
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">
            Upgrade to Pro for unlimited AI drafts — and unlock export, version history, share links, and
            unlimited models.
          </Dialog.Description>
          <div className="mt-4">
            <PlanCard plan="pro" current={current} />
          </div>
          <div className="mt-4 flex justify-end">
            <Dialog.Close asChild>
              <button className="text-sm text-muted-foreground hover:text-foreground">Maybe later</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

> NOTE: if `components/billing/use-current-plan` does not exist, create a tiny hook that reads the plan from the nearest server-provided context. Simpler alternative: pass `current` as a prop from the project page (`<UpgradeAiDraftsModal current={plan} …/>`) and drop the hook. Use the prop form if the hook doesn't exist — update the signature to `{ open, onOpenChange, current }: { …; current: Plan }`.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/ai/upgrade-ai-drafts-modal.tsx
git commit -m "Add upgrade modal for exhausted AI drafts"
```

---

### Task 19: Client intercept + thread `aiDraftCredits` from the project page

**Files:**
- Modify: `app/(app)/projects/[id]/page.tsx`
- Modify: `components/ai/draft-model.tsx`

**Interfaces:**
- Consumes: `canDraftWithAi`, `Plan`, `UpgradeAiDraftsModal`.
- Produces: `<DraftModel projectId plan aiDraftCredits />` opens the modal instead of fetching when blocked.

- [ ] **Step 1: Thread credits from the project page** — in `app/(app)/projects/[id]/page.tsx`, the page already computes `plan`; pass the org's credit count:

```tsx
        <DraftModel
          projectId={id}
          plan={plan}
          aiDraftCredits={org?.organizations?.ai_draft_credits ?? 0}
        />
```

- [ ] **Step 2: Update `components/ai/draft-model.tsx`** to intercept and to show the remaining-credit hint:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createModelFromDraftAction } from "@/lib/actions/model";
import { canDraftWithAi, type Plan } from "@/lib/entitlements";
import { UpgradeAiDraftsModal } from "./upgrade-ai-drafts-modal";
import type { ModelDraft } from "@/lib/ai/schemas";

export function DraftModel({
  projectId,
  plan,
  aiDraftCredits,
}: {
  projectId: string;
  plan: Plan;
  aiDraftCredits: number;
}) {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const blocked = !canDraftWithAi(plan, aiDraftCredits);

  async function run() {
    if (!description.trim()) return;
    if (blocked) {
      setUpgradeOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/draft-model", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ description, currency: "USD" }),
      });
      if (res.status === 402) {
        setUpgradeOpen(true);
        return;
      }
      if (!res.ok) {
        setError(
          res.status === 503
            ? "AI isn’t enabled yet."
            : res.status === 429
              ? "Too many AI requests — try again later."
              : "Couldn’t draft a model. Try rephrasing.",
        );
        return;
      }
      const draft = (await res.json()) as ModelDraft;
      const created = await createModelFromDraftAction({ projectId, draft });
      if ("error" in created) {
        setError("Model limit reached for this workspace.");
        return;
      }
      router.push(`/models/${created.id}`);
    } catch {
      setError("Couldn’t draft a model. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Describe a part or service — e.g. “CNC-machined steel valve body, ~12 kg, low volume”"
        rows={3}
      />
      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={loading || !description.trim()}>
          {loading ? "Drafting…" : "Draft with AI"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {plan === "free"
            ? blocked
              ? "Free AI draft used — upgrade for unlimited drafts."
              : `${aiDraftCredits} free AI draft${aiDraftCredits === 1 ? "" : "s"} remaining.`
            : "Unlimited AI drafts on your plan."}
        </span>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
      <UpgradeAiDraftsModal open={upgradeOpen} onOpenChange={setUpgradeOpen} current={plan} />
    </div>
  );
}
```

(If Task 18 used the prop form for `current`, the modal call above already matches. If it used the hook, drop `current={plan}`.)

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/projects/[id]/page.tsx components/ai/draft-model.tsx
git commit -m "Intercept Draft-with-AI when credits are exhausted; show upgrade modal"
```

---

### Task 20: End-to-end + DoD verification

**Files:**
- Test: `tests/e2e/ai-credits.spec.ts` (create)

- [ ] **Step 1: Write the e2e** `tests/e2e/ai-credits.spec.ts` (follow the existing `tests/e2e/compare.spec.ts` auth setup):

```ts
import { test, expect } from "@playwright/test";

test("free workspace gets one AI draft, then the upgrade modal", async ({ page }) => {
  // Sign in as TEST_USER_A (free org) per existing e2e auth helper.
  await page.goto("/projects"); // adjust to a project route that exists for the test user
  // First draft succeeds (route returns a draft; assert navigation to /models/:id).
  // Second draft click opens the upgrade modal without an API call.
  await expect(page.getByText(/used your free AI draft/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the suite**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm test:integration && pnpm test:e2e`
Expected: all PASS. (Integration tests need `TEST_USER_A/B`; e2e needs the Playwright server.)

- [ ] **Step 3: Final palette validation (DoD)**

Run:
```bash
cd "C:/Users/mohan/AppData/Local/Temp/claude/bundled-skills/2.1.204/bb4780e84ab5714f64310e407fd3e15c/dataviz"
node scripts/validate_palette.js "#2a78d6,#1baf7a,#eda100,#008300,#4a3aa7,#e34948" --mode light
node scripts/validate_palette.js "#3987e5,#199e70,#c98500,#008300,#9085e9,#e66767" --mode dark --surface "#1a1a19"
node scripts/validate_palette.js "#b45309,#059669" --mode light
```
Expected: each prints `→ ALL CHECKS PASS`.

- [ ] **Step 4: Manual DoD sweep** — `pnpm dev`:
  - Back-arrow + breadcrumb navigate Home → Projects → Model → Compare and back at 375 / 768 / 1440 px.
  - A manually-built model with filled rates renders the donut + tornado (not blank); an empty model shows the diagnostic empty messages.
  - Editing a deep cell no longer re-renders the whole table (React DevTools profiler shows only the edited row + header total).
  - Export `.xlsx` has live formulas AND embedded donut + tornado images.
  - Free workspace: first Draft works; second opens the upgrade modal.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/ai-credits.spec.ts
git commit -m "Add e2e for the 1-free-AI-draft gate"
```

---

## Self-review notes

- **Spec coverage:** Navigation §5.2 → Tasks 1–4. Performance §5.1 → Tasks 5–7 (debounced snapshot + stable columns; coefficient walk intentionally dropped per refinements, latency goal met). Charts §5.3 → Tasks 8–11. Export §5.5 → Tasks 12–13. Compare §5.4 → Task 14. Monetization §5.6 → Tasks 15–19. Testing/DoD §6–7 → Task 20.
- **Two refinements vs. spec** are flagged at the top of this plan and in §5.1's task notes; both reduce risk without changing the user-facing goals.
- **Type consistency:** `canDraftWithAi`, `aiDraftCreditsFor`, `dec_ai_credit`/`inc_ai_credit`, `decideAiDraftAccess`, `donutData`, `tornado`, `renderDonutSvg`/`renderTornadoSvg`, `useDebouncedEditorSnapshot`, `useChartColors`, `TotalCell`/`GrandTotal` — names and signatures match across the tasks that consume them.
- **Currency threading:** every chart and the export now use the runtime `currency` (cast at page boundaries) instead of the `"USD"` hardcode.
- **Security:** the credit RPCs include an ownership guard (`id in (select public.current_user_orgs())`) so a caller cannot decrement another org's credits; the route reserves before the paid Anthropic call and refunds on any failure.
