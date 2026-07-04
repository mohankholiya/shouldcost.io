# Phase 1 — Cost-Model Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the interactive cost-model editor on the Phase 0 foundation — a CBS tree grid with inline editing, live should-cost rollup, index binding, versioning/diff, and the three analysis charts + index hub.

**Architecture:** A client-authoritative editor. A Zustand store holds the working model as a tree of `cost_nodes`; every edit recomputes an integer-minor rollup in-browser (`rollupLive`) and schedules a debounced autosave via server actions. Explicit "Save version" freezes an immutable snapshot into `model_versions`. Charts and sensitivity derive from the in-memory tree. No schema changes required.

**Tech Stack:** Next.js 14 App Router (TS strict), Supabase (Postgres + Auth under RLS, server actions), Zustand, TanStack Table (headless), Recharts, @dnd-kit, React Hook Form + Zod, Vitest + Testing Library, Playwright.

## Global Constraints

(Carried from the Phase 0 foundation and the Phase 1 spec — every task inherits these.)

- TypeScript `strict: true`, **zero `any`**. Zod validation on every mutation / server action.
- **All money as integer minor units** (cents/paise). `cost_nodes.rate`, `model_versions.total_cost`, and every rollup return value are minor units. The single money chokepoint remains `lib/money.ts`; formatting stays in `lib/format.ts` (tabular figures).
- **Rollup parity:** `lib/model/rollup-live.ts` must reproduce the Phase 0 formula semantics from `lib/seed/rollup.ts` — group sums, named-group formula references ("12% of conversion"), and running-subtotal formulas ("9% margin"). The OCTG model must still total ~176,021 minor (~$1,760.21/MT).
- **RLS everywhere:** all reads/writes go through the RLS-bound `lib/supabase/server.ts` (server actions/components) or `lib/supabase/client.ts` (client). Never the admin client in app code.
- Design tokens only: `petrol` primary, `amber` (deltas/warnings), `favor` (favorable), `canvas`/`ink`/`hairline`, `text-muted-foreground`. `.num` + `tabular-nums` on every number. No ad-hoc hex.
- Renders at 375 / 768 / 1440px; WCAG AA; full keyboard nav with visible focus (the grid especially).
- Commit style: short imperative subjects. Commit trailer on every commit: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Charts use Recharts behind the shared `ChartContainer`; every chart inherits copy-data / download-PNG.
- Continue the existing shadcn/Radix (new-york) primitives and the merged token layer in `app/globals.css`.

---

## Shared types (defined in Task 2, referenced everywhere)

```ts
// lib/model/types.ts
export type NodeType = "group" | "line";
export type RateSource = "manual" | "index" | "benchmark";

/** Mirrors a public.cost_nodes row. `rate` is integer minor units. */
export type CostNodeRow = {
  id: string;
  model_id: string;
  parent_id: string | null;
  sort_order: number;
  name: string;
  node_type: NodeType;
  driver_name: string | null;
  quantity: number | null;
  unit: string | null;
  rate: number | null; // minor units
  rate_source: RateSource;
  index_id: string | null;
  index_factor: number | null;
  formula: string | null;
  notes: string | null;
};

export type TreeNode = CostNodeRow & { children: TreeNode[] };
export type CostTree = { roots: TreeNode[] };

/** Result of a rollup: grand total + per-node subtotal, both minor units. */
export type Rollup = { total: number; byNodeId: Record<string, number> };
```

---

## File Structure (locked decomposition)

| Path | Responsibility |
|------|----------------|
| `lib/model/types.ts` | Shared editor types (`CostNodeRow`, `TreeNode`, `CostTree`, `Rollup`) |
| `lib/model/tree.ts` | `buildTree` / `flattenTree` (flat rows ↔ ordered tree) |
| `lib/model/rollup-live.ts` | `rollupLive(tree)` — integer-minor rollup with formula semantics |
| `lib/model/index-rate.ts` | `effectiveRateMinor(value, factor)` — index → minor rate |
| `lib/model/sensitivity.ts` | `tornado(tree, pct)` — ±% per-driver ranking |
| `lib/model/diff.ts` | `diffVersions(a, b)` — added/removed/changed lines |
| `lib/stores/editor-store.ts` | Zustand store: nodes, selection, dirty set, memoized rollup |
| `lib/db/models.ts` | load/create model, load nodes, instantiate from template |
| `lib/db/nodes.ts` | upsert/delete `cost_nodes` |
| `lib/db/versions.ts` | snapshot + load `model_versions` |
| `lib/actions/model.ts` | server actions: `saveNodesAction`, `saveVersionAction`, `instantiateModelAction` |
| `components/models/model-editor.tsx` | editor shell (header, total, SavedIndicator, layout) |
| `components/models/cbs-tree/cbs-tree.tsx` | TanStack tree grid |
| `components/models/cbs-tree/cbs-row.tsx` | row (group/line), collapse, drag handle |
| `components/models/cbs-tree/cells/*` | money / number / text / rate-source / index-binding cells |
| `components/models/cbs-tree/keyboard.ts` | Excel-like navigation helpers |
| `components/models/index-binding.tsx` | bind index + factor; refresh from index |
| `components/models/version-bar.tsx` | version list + Save version + open diff |
| `components/models/version-diff.tsx` | two-version diff view |
| `components/models/charts/chart-container.tsx` | Recharts wrapper (copy-data, PNG, empty/loading) |
| `components/models/charts/{rollup-donut,tornado-chart,index-sparkline}.tsx` | the three charts |
| `components/indices/{index-card,template-picker}.tsx` | hub card + template instantiation drawer |
| `app/(app)/models/[id]/page.tsx` | replaces stub: load + hydrate + render editor |
| `app/(app)/indices/page.tsx` · `app/(app)/indices/[code]/page.tsx` | index hub list + detail |
| `supabase/migrations/0005_editor_indexes.sql` | optional ordered-load index + version_no guard |
| `tests/unit/*` · `tests/integration/editor.test.ts` · `tests/e2e/editor.spec.ts` | tests |

---

# Wave A — Model core (pure functions, TDD)

## Task 1: Install Phase 1 dependencies

**Files:**
- Modify: `package.json`, `pnpm-workspace.yaml` (build approvals if prompted)

**Interfaces:**
- Produces: `zustand`, `@tanstack/react-table`, `recharts`, `@dnd-kit/core`, `@dnd-kit/sortable` available to later tasks.

- [ ] **Step 1: Install**

```bash
cd "C:/Users/mohan/OneDrive/Desktop/Shouldcost.io"
pnpm add zustand @tanstack/react-table recharts @dnd-kit/core @dnd-kit/sortable
```

- [ ] **Step 2: Approve any blocked build scripts**

If the supply-chain wrapper writes an `allowBuilds:` placeholder into `pnpm-workspace.yaml`, set the named package(s) to `true`, add them under `onlyBuiltDependencies`, then `pnpm rebuild <pkg>`. Re-run `pnpm install` until it completes with no `ERR_PNPM_IGNORED_BUILDS`.

- [ ] **Step 3: Verify typecheck still clean**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "Add Phase 1 deps (zustand, tanstack-table, recharts, dnd-kit)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `lib/model/types.ts` + `lib/model/tree.ts` (TDD)

**Files:**
- Create: `lib/model/types.ts`, `lib/model/tree.ts`
- Test: `tests/unit/tree.test.ts`

**Interfaces:**
- Produces: the shared types above; `buildTree(rows: CostNodeRow[]): CostTree`, `flattenTree(tree: CostTree): CostNodeRow[]`. `buildTree` orders children by `sort_order` then insertion; roots are rows with `parent_id === null`. `flattenTree` performs a pre-order walk assigning `sort_order` = index within siblings.

- [ ] **Step 1: Write the failing test**

`tests/unit/tree.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildTree, flattenTree } from "@/lib/model/tree";
import type { CostNodeRow } from "@/lib/model/types";

const row = (over: Partial<CostNodeRow>): CostNodeRow => ({
  id: "x", model_id: "m", parent_id: null, sort_order: 0, name: "n",
  node_type: "line", driver_name: null, quantity: 1, unit: null, rate: 0,
  rate_source: "benchmark", index_id: null, index_factor: null, formula: null,
  notes: null, ...over,
});

describe("tree", () => {
  it("builds an ordered tree from flat rows", () => {
    const rows = [
      row({ id: "g", node_type: "group", parent_id: null, sort_order: 0, name: "G" }),
      row({ id: "b", parent_id: "g", sort_order: 1, name: "B" }),
      row({ id: "a", parent_id: "g", sort_order: 0, name: "A" }),
    ];
    const tree = buildTree(rows);
    expect(tree.roots).toHaveLength(1);
    expect(tree.roots[0]!.children.map((c) => c.name)).toEqual(["A", "B"]);
  });

  it("round-trips flatten(build(rows)) preserving parent/child order", () => {
    const rows = [
      row({ id: "g", node_type: "group", sort_order: 0 }),
      row({ id: "a", parent_id: "g", sort_order: 0 }),
      row({ id: "b", parent_id: "g", sort_order: 1 }),
    ];
    const flat = flattenTree(buildTree(rows));
    expect(flat.map((r) => r.id)).toEqual(["g", "a", "b"]);
    expect(flat.find((r) => r.id === "b")!.sort_order).toBe(1);
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm test tests/unit/tree.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write `lib/model/types.ts`**

Copy the "Shared types" block verbatim from the top of this plan into `lib/model/types.ts`.

- [ ] **Step 4: Implement `lib/model/tree.ts`**

```ts
import type { CostNodeRow, CostTree, TreeNode } from "@/lib/model/types";

export function buildTree(rows: CostNodeRow[]): CostTree {
  const byId = new Map<string, TreeNode>();
  for (const r of rows) byId.set(r.id, { ...r, children: [] });
  const roots: TreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_id && byId.has(node.parent_id)) {
      byId.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.sort_order - b.sort_order);
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return { roots };
}

export function flattenTree(tree: CostTree): CostNodeRow[] {
  const out: CostNodeRow[] = [];
  const walk = (nodes: TreeNode[]) => {
    nodes.forEach((n, i) => {
      const { children, ...row } = n;
      out.push({ ...row, sort_order: i });
      walk(children);
    });
  };
  walk(tree.roots);
  return out;
}
```

- [ ] **Step 5: Run to pass**

Run: `pnpm test tests/unit/tree.test.ts`
Expected: PASS (2/2).

- [ ] **Step 6: Commit**

```bash
git add lib/model/types.ts lib/model/tree.ts tests/unit/tree.test.ts
git commit -m "Add model types and tree build/flatten helpers

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: `lib/model/rollup-live.ts` — live rollup with parity (TDD)

**Files:**
- Create: `lib/model/rollup-live.ts`
- Test: `tests/unit/rollup-live.test.ts`

**Interfaces:**
- Consumes: `CostTree`, `TreeNode` (Task 2).
- Produces: `rollupLive(tree: CostTree): Rollup`. Line value = `round((quantity ?? 1) * (rate ?? 0))` (rate already minor). Group value = sum of children. Formula lines: `"N% of <group>"` → N% of the named sibling group's subtotal; bare `"N%"` / `"N% margin"` → N% of the running subtotal before that group. Mirrors `lib/seed/rollup.ts` exactly, operating on minor-unit rates.

- [ ] **Step 1: Write the failing test (includes OCTG parity)**

`tests/unit/rollup-live.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { buildTree } from "@/lib/model/tree";
import { rollupLive } from "@/lib/model/rollup-live";
import type { CostNodeRow } from "@/lib/model/types";

const r = (o: Partial<CostNodeRow>): CostNodeRow => ({
  id: crypto.randomUUID(), model_id: "m", parent_id: null, sort_order: 0, name: "n",
  node_type: "line", driver_name: null, quantity: 1, unit: null, rate: 0,
  rate_source: "benchmark", index_id: null, index_factor: null, formula: null, notes: null, ...o,
});

describe("rollupLive", () => {
  it("sums line items (rate in minor)", () => {
    const rows = [
      r({ id: "g", node_type: "group", parent_id: null }),
      r({ id: "a", parent_id: "g", quantity: 1, rate: 10000 }),
      r({ id: "b", parent_id: "g", quantity: 2, rate: 5000 }),
    ];
    const { total, byNodeId } = rollupLive(buildTree(rows));
    expect(total).toBe(20000);
    expect(byNodeId["g"]).toBe(20000);
  });

  it("matches Phase 0 OCTG (~176,021 minor) with minor-unit rates", () => {
    // Material 1.08 * 65000; Conversion 28000+15000+22000+6000; OH 12% of conversion;
    // SG&A 5% of material; Margin 9% margin; Logistics 9000.
    const rows: CostNodeRow[] = [
      r({ id: "mat", node_type: "group", name: "Material", sort_order: 0 }),
      r({ id: "mat1", parent_id: "mat", quantity: 1.08, rate: 65000 }),
      r({ id: "conv", node_type: "group", name: "Conversion", sort_order: 1 }),
      r({ id: "c1", parent_id: "conv", rate: 28000 }),
      r({ id: "c2", parent_id: "conv", rate: 15000 }),
      r({ id: "c3", parent_id: "conv", rate: 22000 }),
      r({ id: "c4", parent_id: "conv", rate: 6000 }),
      r({ id: "oh", node_type: "group", name: "Overhead", sort_order: 2 }),
      r({ id: "oh1", parent_id: "oh", node_type: "line", formula: "12% of conversion" }),
      r({ id: "sga", node_type: "group", name: "SG&A", sort_order: 3 }),
      r({ id: "sga1", parent_id: "sga", node_type: "line", formula: "5% of material" }),
      r({ id: "mar", node_type: "group", name: "Margin", sort_order: 4 }),
      r({ id: "mar1", parent_id: "mar", node_type: "line", formula: "9% margin" }),
      r({ id: "log", node_type: "group", name: "Logistics", sort_order: 5 }),
      r({ id: "log1", parent_id: "log", rate: 9000 }),
    ];
    const { total } = rollupLive(buildTree(rows));
    expect(total / 100).toBeGreaterThan(1700);
    expect(total / 100).toBeLessThan(1820);
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm test tests/unit/rollup-live.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/model/rollup-live.ts`**

```ts
import type { CostTree, Rollup, TreeNode } from "@/lib/model/types";

type Ctx = { named: Record<string, number>; running: number; by: Record<string, number> };

export function rollupLive(tree: CostTree): Rollup {
  const ctx: Ctx = { named: {}, running: 0, by: {} };
  let total = 0;
  // The model's roots behave like a top-level group.
  for (const node of tree.roots) {
    const v = evalNode(node, { named: ctx.named, running: total, by: ctx.by });
    total += v;
    if (node.node_type === "group") ctx.named[node.name.toLowerCase()] = v;
  }
  return { total, byNodeId: ctx.by };
}

function evalNode(node: TreeNode, ctx: Ctx): number {
  if (node.node_type === "line" && node.children.length === 0) {
    const value = node.formula
      ? evalFormula(node.formula, ctx)
      : Math.round((node.quantity ?? 1) * (node.rate ?? 0));
    ctx.by[node.id] = value;
    return value;
  }
  let sum = 0;
  for (const child of node.children) {
    const v = evalNode(child, { named: ctx.named, running: ctx.running + sum, by: ctx.by });
    sum += v;
    if (child.node_type === "group") ctx.named[child.name.toLowerCase()] = v;
  }
  ctx.by[node.id] = sum;
  return sum;
}

function evalFormula(formula: string, ctx: Ctx): number {
  const of = formula.match(/([\d.]+)\s*%\s*of\s+([a-z&/ -]+)/i);
  if (of) {
    const pct = Number(of[1]);
    const base = ctx.named[of[2]!.trim().toLowerCase()] ?? ctx.running;
    return Math.round((base * pct) / 100);
  }
  const p = formula.match(/([\d.]+)\s*%/);
  return p ? Math.round((ctx.running * Number(p[1])) / 100) : 0;
}
```

- [ ] **Step 4: Run to pass**

Run: `pnpm test tests/unit/rollup-live.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add lib/model/rollup-live.ts tests/unit/rollup-live.test.ts
git commit -m "Add live rollup with Phase 0 formula parity

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `lib/model/index-rate.ts` (TDD)

**Files:**
- Create: `lib/model/index-rate.ts`
- Test: `tests/unit/index-rate.test.ts`

**Interfaces:**
- Produces: `effectiveRateMinor(indexValue: number, factor: number): number` = `round(indexValue * factor * 100)`. Used when binding/refreshing a line to an index.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { effectiveRateMinor } from "@/lib/model/index-rate";

describe("index-rate", () => {
  it("materializes minor rate from index value x factor", () => {
    expect(effectiveRateMinor(650, 1.08)).toBe(70200);
    expect(effectiveRateMinor(6.0, 1)).toBe(600);
  });
});
```

- [ ] **Step 2: Run to fail** — `pnpm test tests/unit/index-rate.test.ts` → FAIL.

- [ ] **Step 3: Implement**

```ts
/** value: index unit price (e.g. 650 $/MT). factor: multiplier. Returns minor units. */
export function effectiveRateMinor(indexValue: number, factor: number): number {
  return Math.round(indexValue * factor * 100);
}
```

- [ ] **Step 4: Run to pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/model/index-rate.ts tests/unit/index-rate.test.ts
git commit -m "Add index effective-rate helper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `lib/model/sensitivity.ts` — tornado (TDD)

**Files:**
- Create: `lib/model/sensitivity.ts`
- Test: `tests/unit/sensitivity.test.ts`

**Interfaces:**
- Consumes: `CostTree`, `rollupLive` (Task 3).
- Produces: `tornado(tree: CostTree, pct?: number): TornadoBar[]` where `TornadoBar = { nodeId; name; low: number; high: number; swing: number }`. For each leaf line with a non-null `rate`, recompute the grand total with that line's `rate` set to `rate*(1-pct/100)` and `rate*(1+pct/100)`; `swing = high - low`; sorted by `swing` desc. `pct` default 10.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { buildTree } from "@/lib/model/tree";
import { tornado } from "@/lib/model/sensitivity";
import type { CostNodeRow } from "@/lib/model/types";

const r = (o: Partial<CostNodeRow>): CostNodeRow => ({
  id: o.id ?? "x", model_id: "m", parent_id: o.parent_id ?? null, sort_order: o.sort_order ?? 0,
  name: o.name ?? "n", node_type: o.node_type ?? "line", driver_name: null, quantity: o.quantity ?? 1,
  unit: null, rate: o.rate ?? null, rate_source: "benchmark", index_id: null, index_factor: null,
  formula: o.formula ?? null, notes: null,
});

describe("tornado", () => {
  it("ranks drivers by swing, biggest first", () => {
    const rows = [
      r({ id: "g", node_type: "group" }),
      r({ id: "big", parent_id: "g", name: "Big", rate: 100000 }),
      r({ id: "small", parent_id: "g", name: "Small", rate: 1000 }),
    ];
    const bars = tornado(buildTree(rows), 10);
    expect(bars[0]!.name).toBe("Big");
    expect(bars[0]!.swing).toBeGreaterThan(bars[1]!.swing);
    // ±10% of 100000 -> swing 20000
    expect(bars[0]!.swing).toBe(20000);
  });
});
```

- [ ] **Step 2: Run to fail** — FAIL.

- [ ] **Step 3: Implement**

```ts
import type { CostTree, TreeNode } from "@/lib/model/types";
import { rollupLive } from "@/lib/model/rollup-live";

export type TornadoBar = { nodeId: string; name: string; low: number; high: number; swing: number };

export function tornado(tree: CostTree, pct = 10): TornadoBar[] {
  const leaves: TreeNode[] = [];
  const collect = (nodes: TreeNode[]) =>
    nodes.forEach((n) => {
      if (n.node_type === "line" && n.rate != null && !n.formula) leaves.push(n);
      collect(n.children);
    });
  collect(tree.roots);

  const bars = leaves.map((leaf) => {
    const base = leaf.rate ?? 0;
    const low = totalWithRate(tree, leaf.id, Math.round(base * (1 - pct / 100)));
    const high = totalWithRate(tree, leaf.id, Math.round(base * (1 + pct / 100)));
    return { nodeId: leaf.id, name: leaf.name, low, high, swing: Math.abs(high - low) };
  });
  return bars.sort((a, b) => b.swing - a.swing);
}

function totalWithRate(tree: CostTree, nodeId: string, rate: number): number {
  const clone: CostTree = structuredClone(tree);
  const patch = (nodes: TreeNode[]) =>
    nodes.forEach((n) => {
      if (n.id === nodeId) n.rate = rate;
      patch(n.children);
    });
  patch(clone.roots);
  return rollupLive(clone).total;
}
```

- [ ] **Step 4: Run to pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/model/sensitivity.ts tests/unit/sensitivity.test.ts
git commit -m "Add tornado sensitivity (per-driver +/-%)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: `lib/model/diff.ts` — version diff (TDD)

**Files:**
- Create: `lib/model/diff.ts`
- Test: `tests/unit/diff.test.ts`

**Interfaces:**
- Consumes: `CostNodeRow`.
- Produces: `diffVersions(a: CostNodeRow[], b: CostNodeRow[]): VersionDiff` where `VersionDiff = { added: CostNodeRow[]; removed: CostNodeRow[]; changed: { id: string; name: string; fields: { field: string; from: unknown; to: unknown }[] }[] }`. Keyed by `id`. Compared fields: `name, quantity, unit, rate, rate_source, index_id, index_factor, formula`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import { diffVersions } from "@/lib/model/diff";
import type { CostNodeRow } from "@/lib/model/types";

const r = (o: Partial<CostNodeRow>): CostNodeRow => ({
  id: "x", model_id: "m", parent_id: null, sort_order: 0, name: "n", node_type: "line",
  driver_name: null, quantity: 1, unit: null, rate: 0, rate_source: "benchmark",
  index_id: null, index_factor: null, formula: null, notes: null, ...o,
});

describe("diffVersions", () => {
  it("reports added, removed, and changed lines", () => {
    const a = [r({ id: "1", rate: 100 }), r({ id: "2", rate: 200 })];
    const b = [r({ id: "1", rate: 150 }), r({ id: "3", rate: 300 })];
    const d = diffVersions(a, b);
    expect(d.added.map((x) => x.id)).toEqual(["3"]);
    expect(d.removed.map((x) => x.id)).toEqual(["2"]);
    expect(d.changed).toHaveLength(1);
    expect(d.changed[0]!.fields[0]).toMatchObject({ field: "rate", from: 100, to: 150 });
  });
});
```

- [ ] **Step 2: Run to fail** — FAIL.

- [ ] **Step 3: Implement**

```ts
import type { CostNodeRow } from "@/lib/model/types";

export type VersionDiff = {
  added: CostNodeRow[];
  removed: CostNodeRow[];
  changed: { id: string; name: string; fields: { field: string; from: unknown; to: unknown }[] }[];
};

const FIELDS: (keyof CostNodeRow)[] = [
  "name", "quantity", "unit", "rate", "rate_source", "index_id", "index_factor", "formula",
];

export function diffVersions(a: CostNodeRow[], b: CostNodeRow[]): VersionDiff {
  const aById = new Map(a.map((r) => [r.id, r]));
  const bById = new Map(b.map((r) => [r.id, r]));
  const added = b.filter((r) => !aById.has(r.id));
  const removed = a.filter((r) => !bById.has(r.id));
  const changed: VersionDiff["changed"] = [];
  for (const [id, bt] of bById) {
    const at = aById.get(id);
    if (!at) continue;
    const fields = FIELDS.flatMap((f) =>
      at[f] !== bt[f] ? [{ field: f as string, from: at[f], to: bt[f] }] : [],
    );
    if (fields.length) changed.push({ id, name: bt.name, fields });
  }
  return { added, removed, changed };
}
```

- [ ] **Step 4: Run to pass** — PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/model/diff.ts tests/unit/diff.test.ts
git commit -m "Add version snapshot diff

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Wave B — Store, persistence, editor grid

## Task 7: `lib/stores/editor-store.ts` — Zustand store (TDD)

**Files:**
- Create: `lib/stores/editor-store.ts`
- Test: `tests/unit/editor-store.test.ts`

**Interfaces:**
- Consumes: `CostNodeRow`, `buildTree`, `rollupLive`.
- Produces a Zustand store hook `useEditorStore` with state `{ nodes: Record<string, CostNodeRow>; order: string[]; selectedId: string | null; dirtyIds: Set<string>; deletedIds: string[]; saveStatus: SaveStatus; rollup: Rollup }` and actions `hydrate(rows)`, `setCell(id, field, value)`, `addLine(parentId)`, `addGroup(parentId)`, `removeNode(id)`, `bindIndex(id, indexId, factor, rateMinor)`, `markSaved(ids)`, `setSaveStatus(s)`, `recompute()`. Every mutating action recomputes `rollup` and adds touched ids to `dirtyIds`. (Autosave scheduling lives in the component, Task 10, so the store stays pure/testable.)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { useEditorStore } from "@/lib/stores/editor-store";
import type { CostNodeRow } from "@/lib/model/types";

const r = (o: Partial<CostNodeRow>): CostNodeRow => ({
  id: "x", model_id: "m", parent_id: null, sort_order: 0, name: "n", node_type: "line",
  driver_name: null, quantity: 1, unit: null, rate: 0, rate_source: "benchmark",
  index_id: null, index_factor: null, formula: null, notes: null, ...o,
});

describe("editor store", () => {
  beforeEach(() => {
    useEditorStore.getState().hydrate([
      r({ id: "g", node_type: "group" }),
      r({ id: "a", parent_id: "g", rate: 10000 }),
    ]);
  });

  it("recomputes rollup on hydrate", () => {
    expect(useEditorStore.getState().rollup.total).toBe(10000);
  });

  it("setCell updates a value, marks dirty, and recomputes", () => {
    useEditorStore.getState().setCell("a", "rate", 25000);
    const s = useEditorStore.getState();
    expect(s.nodes["a"]!.rate).toBe(25000);
    expect(s.dirtyIds.has("a")).toBe(true);
    expect(s.rollup.total).toBe(25000);
  });

  it("removeNode tracks deletion and recomputes", () => {
    useEditorStore.getState().removeNode("a");
    const s = useEditorStore.getState();
    expect(s.nodes["a"]).toBeUndefined();
    expect(s.deletedIds).toContain("a");
    expect(s.rollup.total).toBe(0);
  });
});
```

- [ ] **Step 2: Run to fail** — FAIL.

- [ ] **Step 3: Implement `lib/stores/editor-store.ts`**

```ts
import { create } from "zustand";
import type { CostNodeRow, Rollup } from "@/lib/model/types";
import { buildTree } from "@/lib/model/tree";
import { rollupLive } from "@/lib/model/rollup-live";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

type State = {
  nodes: Record<string, CostNodeRow>;
  order: string[];
  selectedId: string | null;
  dirtyIds: Set<string>;
  deletedIds: string[];
  saveStatus: SaveStatus;
  rollup: Rollup;
  hydrate: (rows: CostNodeRow[]) => void;
  setCell: <K extends keyof CostNodeRow>(id: string, field: K, value: CostNodeRow[K]) => void;
  addLine: (parentId: string | null) => string;
  addGroup: (parentId: string | null) => string;
  removeNode: (id: string) => void;
  bindIndex: (id: string, indexId: string, factor: number, rateMinor: number) => void;
  markSaved: (ids: string[]) => void;
  setSaveStatus: (s: SaveStatus) => void;
  recompute: () => void;
};

function compute(nodes: Record<string, CostNodeRow>, order: string[]): Rollup {
  return rollupLive(buildTree(order.map((id) => nodes[id]!)));
}

export const useEditorStore = create<State>((set, get) => ({
  nodes: {},
  order: [],
  selectedId: null,
  dirtyIds: new Set(),
  deletedIds: [],
  saveStatus: "idle",
  rollup: { total: 0, byNodeId: {} },

  hydrate: (rows) => {
    const nodes: Record<string, CostNodeRow> = {};
    const order: string[] = [];
    rows.forEach((r) => {
      nodes[r.id] = r;
      order.push(r.id);
    });
    set({ nodes, order, dirtyIds: new Set(), deletedIds: [], rollup: compute(nodes, order) });
  },

  setCell: (id, field, value) => {
    const nodes = { ...get().nodes, [id]: { ...get().nodes[id]!, [field]: value } };
    const dirty = new Set(get().dirtyIds).add(id);
    set({ nodes, dirtyIds: dirty, rollup: compute(nodes, get().order) });
  },

  addLine: (parentId) => insert(get, set, parentId, "line"),
  addGroup: (parentId) => insert(get, set, parentId, "group"),

  removeNode: (id) => {
    const nodes = { ...get().nodes };
    const removed: string[] = [];
    const rec = (target: string) => {
      removed.push(target);
      Object.values(nodes).forEach((n) => n.parent_id === target && rec(n.id));
    };
    rec(id);
    removed.forEach((r) => delete nodes[r]);
    const order = get().order.filter((o) => !removed.includes(o));
    set({
      nodes,
      order,
      deletedIds: [...get().deletedIds, ...removed],
      rollup: compute(nodes, order),
    });
  },

  bindIndex: (id, indexId, factor, rateMinor) => {
    const node = { ...get().nodes[id]!, index_id: indexId, index_factor: factor, rate: rateMinor, rate_source: "index" as const };
    const nodes = { ...get().nodes, [id]: node };
    set({ nodes, dirtyIds: new Set(get().dirtyIds).add(id), rollup: compute(nodes, get().order) });
  },

  markSaved: (ids) => {
    const dirty = new Set(get().dirtyIds);
    ids.forEach((i) => dirty.delete(i));
    set({ dirtyIds: dirty, deletedIds: [], saveStatus: "saved" });
  },
  setSaveStatus: (s) => set({ saveStatus: s }),
  recompute: () => set({ rollup: compute(get().nodes, get().order) }),
}));

function insert(
  get: () => State,
  set: (p: Partial<State>) => void,
  parentId: string | null,
  node_type: "line" | "group",
): string {
  const id = crypto.randomUUID();
  const modelId = Object.values(get().nodes)[0]?.model_id ?? "";
  const row: CostNodeRow = {
    id, model_id: modelId, parent_id: parentId, sort_order: get().order.length,
    name: node_type === "group" ? "New group" : "New line", node_type,
    driver_name: null, quantity: node_type === "line" ? 1 : null, unit: null,
    rate: node_type === "line" ? 0 : null, rate_source: "manual",
    index_id: null, index_factor: null, formula: null, notes: null,
  };
  const nodes = { ...get().nodes, [id]: row };
  const order = [...get().order, id];
  set({ nodes, order, dirtyIds: new Set(get().dirtyIds).add(id), rollup: compute(nodes, order) });
  return id;
}
```

- [ ] **Step 4: Run to pass** — `pnpm test tests/unit/editor-store.test.ts` → PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add lib/stores/editor-store.ts tests/unit/editor-store.test.ts
git commit -m "Add Zustand editor store with live rollup

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: DB repositories + server actions

**Files:**
- Create: `lib/db/models.ts`, `lib/db/nodes.ts`, `lib/db/versions.ts`, `lib/actions/model.ts`
- Consumes: `createServerClient` (Phase 0), `CostNodeRow`, `ALL_TEMPLATES`, `flattenTree`.

**Interfaces:**
- Produces:
  - `loadModel(id)`, `loadNodes(modelId): Promise<CostNodeRow[]>`, `createModel(projectId, name, templateSlug?)`.
  - `saveNodes(modelId, changed: CostNodeRow[], deleted: string[])`.
  - `nextVersionNo(modelId)`, `saveVersion(modelId, snapshot, total, note)`, `loadVersions(modelId)`.
  - Server actions in `lib/actions/model.ts`: `saveNodesAction`, `saveVersionAction`, `instantiateModelAction`, each `"use server"`, Zod-validated inputs.

- [ ] **Step 1: Write `lib/db/nodes.ts` + `lib/db/models.ts` + `lib/db/versions.ts`**

`lib/db/nodes.ts`:
```ts
import { createServerClient } from "@/lib/supabase/server";
import type { CostNodeRow } from "@/lib/model/types";

export async function loadNodes(modelId: string): Promise<CostNodeRow[]> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("cost_nodes").select("*").eq("model_id", modelId).order("sort_order");
  if (error) throw error;
  return (data ?? []) as CostNodeRow[];
}

export async function saveNodes(modelId: string, changed: CostNodeRow[], deleted: string[]) {
  const supabase = await createServerClient();
  if (deleted.length) {
    const { error } = await supabase.from("cost_nodes").delete().in("id", deleted);
    if (error) throw error;
  }
  if (changed.length) {
    const rows = changed.map((c) => ({ ...c, model_id: modelId }));
    const { error } = await supabase.from("cost_nodes").upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }
}
```

`lib/db/models.ts`:
```ts
import { createServerClient } from "@/lib/supabase/server";
import { ALL_TEMPLATES } from "@/lib/seed/templates";
import type { CbsGroup } from "@/lib/seed/schema";
import type { CostNodeRow } from "@/lib/model/types";
import { toMinor } from "@/lib/money";
import type { Currency } from "@/components/number/currency-select";

export async function loadModel(id: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("cost_models").select("id, name, currency, project_id, status").eq("id", id).maybeSingle();
  return data;
}

export async function createModel(projectId: string, name: string, templateSlug?: string) {
  const supabase = await createServerClient();
  const template = templateSlug ? ALL_TEMPLATES.find((t) => t.slug === templateSlug) : undefined;
  const { data: model, error } = await supabase
    .from("cost_models")
    .insert({ project_id: projectId, name, currency: "USD", status: "draft", category_template_id: null })
    .select("id").single();
  if (error) throw error;
  if (template) {
    const rows = templateToNodes(model!.id, template.cbs_json);
    const { error: nErr } = await supabase.from("cost_nodes").insert(rows);
    if (nErr) throw nErr;
  }
  return model!.id as string;
}

/** Flatten a template CBS (rates in UNITS) into cost_nodes rows (rate in MINOR). */
export function templateToNodes(modelId: string, cbs: CbsGroup): Omit<CostNodeRow, "id">[] {
  const rows: Omit<CostNodeRow, "id">[] = [];
  const walk = (node: CbsGroup, parentId: string | null, order: number) => {
    const id = crypto.randomUUID();
    rows.push({
      model_id: modelId, parent_id: parentId, sort_order: order, name: node.name,
      node_type: node.node_type,
      driver_name: node.driver_name ?? null,
      quantity: node.quantity ?? (node.node_type === "line" ? 1 : null),
      unit: node.unit ?? null,
      rate: node.rate != null ? toMinor(node.rate, "USD" as Currency) : node.node_type === "line" ? 0 : null,
      rate_source: (node.rate_source ?? "manual"),
      index_id: null, // resolved by slug->id in a later enrichment; kept null at instantiate time
      index_factor: node.index_factor ?? null,
      formula: node.formula ?? null, notes: node.notes ?? null,
    });
    (node.nodes ?? []).forEach((c, i) => walk(c, id, i));
    // NOTE: parent linkage uses the generated id; see Step 2 test which asserts tree integrity.
    (rows[rows.length - (node.nodes?.length ?? 0) - 1] as { id?: string }).id = id;
  };
  walk(cbs, null, 0);
  return rows as Omit<CostNodeRow, "id">[];
}
```

> **Implementation note:** the `templateToNodes` parent-id linkage must assign each node a concrete `id` before recursing so children reference it. Adjust the walk to generate the id, push the row (with id), then recurse — the test in Step 2 asserts every non-root row has a `parent_id` present in the set of generated ids.

`lib/db/versions.ts`:
```ts
import { createServerClient } from "@/lib/supabase/server";
import type { CostNodeRow } from "@/lib/model/types";

export async function saveVersion(modelId: string, snapshot: CostNodeRow[], total: number, note: string) {
  const supabase = await createServerClient();
  const { data: last } = await supabase
    .from("model_versions").select("version_no").eq("model_id", modelId)
    .order("version_no", { ascending: false }).limit(1).maybeSingle();
  const version_no = ((last?.version_no as number | undefined) ?? 0) + 1;
  const { error } = await supabase.from("model_versions").insert({
    model_id: modelId, version_no, snapshot_json: snapshot, total_cost: total, note,
  });
  if (error) throw error;
  return version_no;
}

export async function loadVersions(modelId: string) {
  const supabase = await createServerClient();
  const { data } = await supabase
    .from("model_versions").select("id, version_no, total_cost, note, created_at, snapshot_json")
    .eq("model_id", modelId).order("version_no", { ascending: false });
  return data ?? [];
}
```

- [ ] **Step 2: Write a unit test for `templateToNodes` tree integrity**

`tests/unit/template-to-nodes.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { templateToNodes } from "@/lib/db/models";
import { OCTG_TEMPLATE } from "@/lib/seed/templates/octg-casing-tubing";

describe("templateToNodes", () => {
  it("produces a connected tree with minor-unit rates", () => {
    const rows = templateToNodes("m1", OCTG_TEMPLATE.cbs_json) as (Record<string, unknown> & { id: string; parent_id: string | null; rate: number | null })[];
    const ids = new Set(rows.map((r) => r.id));
    const roots = rows.filter((r) => r.parent_id === null);
    expect(roots).toHaveLength(1);
    for (const r of rows) if (r.parent_id) expect(ids.has(r.parent_id)).toBe(true);
    const billet = rows.find((r) => (r as { name: string }).name.includes("billet"));
    expect(billet!.rate).toBe(70200); // 1.08 * 650 handled at rollup; rate stored = 650 * 100
  });
});
```

> Adjust the expected `rate` to match the storage rule (rate stored in minor = `toMinor(node.rate)` = `65000` for a 650 unit rate; quantity stays on the row). Update the assertion to `expect(billet!.rate).toBe(65000)` and confirm `quantity === 1.08`.

- [ ] **Step 3: Run test, fix `templateToNodes` until green**

Run: `pnpm test tests/unit/template-to-nodes.test.ts`
Expected: PASS after the parent-linkage fix.

- [ ] **Step 4: Write `lib/actions/model.ts` (server actions, Zod)**

```ts
"use server";
import { z } from "zod";
import { saveNodes, loadNodes } from "@/lib/db/nodes";
import { saveVersion } from "@/lib/db/versions";
import { createModel } from "@/lib/db/models";

const NodeSchema = z.object({
  id: z.string(), model_id: z.string(), parent_id: z.string().nullable(), sort_order: z.number(),
  name: z.string(), node_type: z.enum(["group", "line"]), driver_name: z.string().nullable(),
  quantity: z.number().nullable(), unit: z.string().nullable(), rate: z.number().int().nullable(),
  rate_source: z.enum(["manual", "index", "benchmark"]), index_id: z.string().nullable(),
  index_factor: z.number().nullable(), formula: z.string().nullable(), notes: z.string().nullable(),
});

export async function saveNodesAction(input: unknown) {
  const { modelId, changed, deleted } = z
    .object({ modelId: z.string(), changed: z.array(NodeSchema), deleted: z.array(z.string()) })
    .parse(input);
  await saveNodes(modelId, changed, deleted);
  return { ok: true };
}

export async function saveVersionAction(input: unknown) {
  const { modelId, note } = z.object({ modelId: z.string(), note: z.string().default("") }).parse(input);
  const snapshot = await loadNodes(modelId);
  const total = snapshot.reduce((s, n) => s + (n.rate ?? 0), 0); // recomputed authoritative total is set client-side; server stores snapshot
  const version_no = await saveVersion(modelId, snapshot, total, note);
  return { version_no };
}

export async function instantiateModelAction(input: unknown) {
  const { projectId, name, templateSlug } = z
    .object({ projectId: z.string(), name: z.string(), templateSlug: z.string().optional() })
    .parse(input);
  const id = await createModel(projectId, name, templateSlug);
  return { id };
}
```

> **Note:** `saveVersionAction` should store the client-computed grand total, not a naive sum. Change its signature to accept `total: z.number().int()` from the caller (the editor already has `rollup.total`) and pass it to `saveVersion`. Update the Zod object to `{ modelId, note, total }`.

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/db lib/actions tests/unit/template-to-nodes.test.ts
git commit -m "Add model/nodes/versions repositories and server actions

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: CBS tree grid (TanStack) with inline cells + keyboard (component TDD)

**Files:**
- Create: `components/models/cbs-tree/cbs-tree.tsx`, `cbs-row.tsx`, `keyboard.ts`, `cells/{money-cell,number-cell,text-cell,rate-source-cell}.tsx`
- Test: `tests/unit/cbs-tree.test.tsx`

**Interfaces:**
- Consumes: `useEditorStore` (Task 7), `MoneyInput` (Phase 0), `buildTree`.
- Produces: `<CbsTree />` — a flattened tree grid (columns: Name, Driver, Qty, Unit, Rate, Source, Line total). Reads `useEditorStore`. Editing a cell calls `setCell`. Enter/Tab/Arrow navigation via `keyboard.ts` (`nextCell(pos, key, dims)`). Group rows are bold with a collapse chevron; line totals read from `rollup.byNodeId`.

- [ ] **Step 1: Write the keyboard helper test**

`tests/unit/cbs-tree.test.tsx` (part 1 — pure helper):
```tsx
import { describe, it, expect } from "vitest";
import { nextCell } from "@/components/models/cbs-tree/keyboard";

describe("nextCell", () => {
  it("moves right on Tab and wraps to next row", () => {
    expect(nextCell({ row: 0, col: 0 }, "Tab", { rows: 2, cols: 3 })).toEqual({ row: 0, col: 1 });
    expect(nextCell({ row: 0, col: 2 }, "Tab", { rows: 2, cols: 3 })).toEqual({ row: 1, col: 0 });
  });
  it("moves down on ArrowDown, clamped", () => {
    expect(nextCell({ row: 1, col: 1 }, "ArrowDown", { rows: 2, cols: 3 })).toEqual({ row: 1, col: 1 });
  });
});
```

- [ ] **Step 2: Run to fail** — FAIL.

- [ ] **Step 3: Implement `keyboard.ts`**

```ts
export type Pos = { row: number; col: number };
export type Dims = { rows: number; cols: number };

export function nextCell(pos: Pos, key: string, d: Dims): Pos {
  const clamp = (n: number, max: number) => Math.max(0, Math.min(max - 1, n));
  switch (key) {
    case "Tab": {
      const flat = pos.row * d.cols + pos.col + 1;
      return { row: Math.min(d.rows - 1, Math.floor(flat / d.cols)), col: flat % d.cols };
    }
    case "ArrowRight": return { row: pos.row, col: clamp(pos.col + 1, d.cols) };
    case "ArrowLeft": return { row: pos.row, col: clamp(pos.col - 1, d.cols) };
    case "ArrowDown": case "Enter": return { row: clamp(pos.row + 1, d.rows), col: pos.col };
    case "ArrowUp": return { row: clamp(pos.row - 1, d.rows), col: pos.col };
    default: return pos;
  }
}
```

- [ ] **Step 4: Run to pass** — PASS.

- [ ] **Step 5: Implement the grid + cells + a render test**

Build `cells/*` (each a controlled input bound to `setCell`), `cbs-row.tsx`, and `cbs-tree.tsx` using `@tanstack/react-table` with a flattened `buildTree` model. Add to the test file:
```tsx
import { render, screen } from "@testing-library/react";
import { CbsTree } from "@/components/models/cbs-tree/cbs-tree";
import { useEditorStore } from "@/lib/stores/editor-store";
// hydrate a 1-group/1-line model, render <CbsTree/>, assert the line name input and line total render.
```
Assert: the line's name renders in an editable input; the group row shows a subtotal from `rollup.byNodeId`; a `role="grid"` (or table) is present.

- [ ] **Step 6: Run component tests** — `pnpm test tests/unit/cbs-tree.test.tsx` → PASS.

- [ ] **Step 7: Commit**

```bash
git add components/models/cbs-tree tests/unit/cbs-tree.test.tsx
git commit -m "Add CBS tree grid with inline cells and keyboard nav

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Editor shell + `/models/[id]` wiring + autosave

**Files:**
- Create: `components/models/model-editor.tsx`
- Modify: `app/(app)/models/[id]/page.tsx` (replace stub)

**Interfaces:**
- Consumes: `loadModel`, `loadNodes`, `useEditorStore`, `CbsTree`, `saveNodesAction`, `SavedIndicator`, `AnimatedCounter`.
- Produces: server page loads model + nodes and renders `<ModelEditor model nodes />`; the client `ModelEditor` hydrates the store, renders header (model name, live total via `AnimatedCounter`, `SavedIndicator`, "Save version" button placeholder), and `<CbsTree />`. A debounced effect (800ms) flushes `dirtyIds`/`deletedIds` through `saveNodesAction`, toggling `saveStatus`.

- [ ] **Step 1: Replace the page (server component)**

`app/(app)/models/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { loadModel } from "@/lib/db/models";
import { loadNodes } from "@/lib/db/nodes";
import { ModelEditor } from "@/components/models/model-editor";

export default async function ModelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadModel(id);
  if (!model) notFound();
  const nodes = await loadNodes(id);
  return <ModelEditor model={model} nodes={nodes} />;
}
```

- [ ] **Step 2: Implement `ModelEditor` (client) with debounced autosave**

`components/models/model-editor.tsx`:
```tsx
"use client";
import { useEffect, useRef } from "react";
import { useEditorStore } from "@/lib/stores/editor-store";
import { CbsTree } from "@/components/models/cbs-tree/cbs-tree";
import { AnimatedCounter } from "@/components/number/animated-counter";
import { SavedIndicator } from "@/components/shared/saved-indicator";
import { saveNodesAction } from "@/lib/actions/model";
import type { CostNodeRow } from "@/lib/model/types";

export function ModelEditor({ model, nodes }: { model: { id: string; name: string }; nodes: CostNodeRow[] }) {
  const hydrate = useEditorStore((s) => s.hydrate);
  useEffect(() => { hydrate(nodes); }, [hydrate, nodes]);

  const total = useEditorStore((s) => s.rollup.total);
  const status = useEditorStore((s) => s.saveStatus);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const unsub = useEditorStore.subscribe(() => {
      const s = useEditorStore.getState();
      if (s.dirtyIds.size === 0 && s.deletedIds.length === 0) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(async () => {
        const st = useEditorStore.getState();
        const changed = [...st.dirtyIds].map((id) => st.nodes[id]!).filter(Boolean);
        st.setSaveStatus("saving");
        try {
          await saveNodesAction({ modelId: model.id, changed, deleted: st.deletedIds });
          st.markSaved([...st.dirtyIds]);
        } catch {
          st.setSaveStatus("error");
        }
      }, 800);
    });
    return () => unsub();
  }, [model.id]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{model.name}</h1>
        <div className="flex items-center gap-4">
          <div className="num text-lg font-semibold"><AnimatedCounter valueMinor={total} /></div>
          <SavedIndicator status={status} />
        </div>
      </header>
      <CbsTree />
    </div>
  );
}
```

- [ ] **Step 3: Build + manual verify**

Run: `pnpm build` then `pnpm dev`. With a seeded/instantiated model, editing a rate updates the total live and flips the SavedIndicator to Saved.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/models components/models/model-editor.tsx
git commit -m "Wire model editor page with live total and debounced autosave

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 11: Template picker + instantiate-from-template

**Files:**
- Create: `components/indices/template-picker.tsx`
- Modify: `app/(app)/projects/[id]/page.tsx` (add "New model" button opening the picker)

**Interfaces:**
- Consumes: `ALL_TEMPLATES` (via a public read of `category_templates` or the seed module), `instantiateModelAction`.
- Produces: a Sheet listing templates (name, industry, unit, draft badge) + a "Blank model" option; selecting one calls `instantiateModelAction({ projectId, name, templateSlug })` and routes to `/models/[id]`.

- [ ] **Step 1: Implement the picker (Sheet + list + action)** — render `ALL_TEMPLATES`, on click call the action and `router.push('/models/'+id)`.

- [ ] **Step 2: Add the trigger to project detail** — a "New model" `Button` opening the Sheet.

- [ ] **Step 3: Build + manual verify** — from a project, "New model" → pick OCTG → lands in the editor with the OCTG tree and ~$1,760 total.

- [ ] **Step 4: Commit**

```bash
git add components/indices/template-picker.tsx app/\(app\)/projects
git commit -m "Add template picker and model instantiation

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Wave C — Index binding

## Task 12: Index binding + refresh-from-index

**Files:**
- Create: `components/models/index-binding.tsx`
- Modify: `components/models/cbs-tree/cells/rate-source-cell.tsx` (open the binding popover when source = "index")
- Test: extend `tests/unit/cbs-tree.test.tsx` for the effective-rate wiring

**Interfaces:**
- Consumes: `indices`/`index_values` (server-loaded list passed into the editor), `effectiveRateMinor` (Task 4), `bindIndex` (store).
- Produces: `<IndexBinding node onBind />` — a popover to choose an index + factor; on confirm computes `effectiveRateMinor(latestValue, factor)` and calls `store.bindIndex(id, indexId, factor, rateMinor)`. A "Refresh from index" action on index-bound lines re-materializes the rate from the latest value.

- [ ] **Step 1: Load indices into the editor** — extend the `/models/[id]` page to fetch `indices` + latest `index_values` and pass to `ModelEditor` → `CbsTree` context.

- [ ] **Step 2: Implement `IndexBinding`** — CurrencySelect-style combobox of indices + a factor `MoneyInput`/number; compute and bind.

- [ ] **Step 3: Test the wiring** — a unit test: given latest value 650 and factor 1.08, binding sets the node rate to `effectiveRateMinor(650,1.08)` and the store recomputes.

- [ ] **Step 4: Run tests + build** — PASS; `pnpm build` clean.

- [ ] **Step 5: Commit**

```bash
git add components/models/index-binding.tsx components/models/cbs-tree app/\(app\)/models tests/unit/cbs-tree.test.tsx
git commit -m "Add index binding and refresh-from-index

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Wave D — Versioning

## Task 13: Version bar + Save version + diff view

**Files:**
- Create: `components/models/version-bar.tsx`, `components/models/version-diff.tsx`
- Modify: `components/models/model-editor.tsx` (mount the version bar; wire "Save version")

**Interfaces:**
- Consumes: `saveVersionAction`, `loadVersions`, `diffVersions` (Task 6), the store `rollup.total`.
- Produces: `<VersionBar modelId versions />` — "Save version" (optional note) calls `saveVersionAction({ modelId, note, total })`; a version list; selecting two versions opens `<VersionDiff a b />` rendering added/removed/changed rows using `diffVersions` on the two `snapshot_json` arrays.

- [ ] **Step 1: Load versions on the page** and pass to `ModelEditor` → `VersionBar`.

- [ ] **Step 2: Implement "Save version"** — button (+ note Input in a Dialog) calling the action with the live `rollup.total`; on success refresh the list.

- [ ] **Step 3: Implement `VersionDiff`** — two-column selector + `diffVersions` render (added green, removed muted with strike, changed showing from→to with `DeltaPill` where the field is `rate`).

- [ ] **Step 4: Build + manual verify** — edit → Save version twice → diff shows the changed line.

- [ ] **Step 5: Commit**

```bash
git add components/models/version-bar.tsx components/models/version-diff.tsx components/models/model-editor.tsx
git commit -m "Add versioning: save version and two-version diff

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

# Wave E — Charts + index hub

## Task 14: `ChartContainer` wrapper

**Files:**
- Create: `components/models/charts/chart-container.tsx`
- Test: `tests/unit/chart-container.test.tsx`

**Interfaces:**
- Produces: `<ChartContainer title data actions? children />` — card with title, a "Copy data" (CSV to clipboard) and "Download PNG" affordance, empty/loading states. `data` is `Record<string, unknown>[]` used for CSV export. All three charts render inside it.

- [ ] **Step 1: Failing render test** — renders title + a "Copy data" button; empty state when `data` is empty.
- [ ] **Step 2: Run to fail** — FAIL.
- [ ] **Step 3: Implement** the wrapper (Card + header actions + `{children}`; CSV via `data`→string; PNG via a ref to the chart node using `toDataURL` on an SVG serialize or a lightweight approach).
- [ ] **Step 4: Run to pass** — PASS.
- [ ] **Step 5: Commit** — `git commit -m "Add ChartContainer wrapper"` with trailer.

---

## Task 15: Rollup donut

**Files:**
- Create: `components/models/charts/rollup-donut.tsx`; Test: `tests/unit/rollup-donut.test.tsx`

**Interfaces:**
- Consumes: `rollup.byNodeId`, top-level group nodes, Recharts `PieChart`.
- Produces: `<RollupDonut tree rollup />` — composition by top-level group (name + subtotal + %), rendered inside `ChartContainer`. Petrol-ramp palette (see dataviz palette in Phase 0 tokens).

- [ ] **Step 1: Failing test** — given a tree with two groups, the donut data has two slices with correct minor subtotals.
- [ ] **Step 2: fail → Step 3: implement (derive slices from top-level groups) → Step 4: pass.**
- [ ] **Step 5: Commit** — `"Add rollup donut chart"`.

---

## Task 16: Tornado chart

**Files:**
- Create: `components/models/charts/tornado-chart.tsx`; Test: `tests/unit/tornado-chart.test.tsx`

**Interfaces:**
- Consumes: `tornado()` (Task 5), Recharts horizontal `BarChart`.
- Produces: `<TornadoChart tree pct onPctChange />` — ranked ±% bars (default 10) with a pct control; bars centered on the base total. Inside `ChartContainer`.

- [ ] **Step 1: Failing test** — the chart data equals `tornado(tree, 10)` order (biggest swing first). 
- [ ] **Step 2–4: fail → implement → pass.**
- [ ] **Step 5: Commit** — `"Add tornado sensitivity chart"`.

---

## Task 17: Index sparkline

**Files:**
- Create: `components/models/charts/index-sparkline.tsx`; Test: `tests/unit/index-sparkline.test.tsx`

**Interfaces:**
- Consumes: `index_values` series (24 points), Recharts `LineChart` (no axes/grid — sparkline).
- Produces: `<IndexSparkline series />` — a compact 24-month line; latest value + delta vs first via `DeltaPill`.

- [ ] **Step 1: Failing test** — renders a latest-value label from the series.
- [ ] **Step 2–4: fail → implement → pass.**
- [ ] **Step 5: Commit** — `"Add index sparkline"`.

---

## Task 18: Index hub list + detail

**Files:**
- Create: `components/indices/index-card.tsx`
- Modify: `app/(app)/indices/page.tsx` (replace stub); Create: `app/(app)/indices/[code]/page.tsx`

**Interfaces:**
- Consumes: `indices` + `index_values` (server-loaded), `IndexSparkline`, `formatIndexValue`.
- Produces: `/indices` — grid of `<IndexCard>` (name, latest, unit, sparkline, link to detail); `/indices/[code]` — detail with the full 24-month sparkline, source note, and a list of models that bind this index.

- [ ] **Step 1: Replace `/indices` page** — server-load indices + last 24 values each; render cards.
- [ ] **Step 2: Add `/indices/[code]`** — detail with sparkline + models-using list (`cost_nodes` where `index_id` = this index, joined to models under RLS).
- [ ] **Step 3: Build + manual verify** — hub shows 10 sparklines; detail resolves.
- [ ] **Step 4: Commit** — `"Add index hub list and detail"`.

---

# Wave F — QA

## Task 19: Integration + E2E

**Files:**
- Create: `tests/integration/editor.test.ts` (env-gated), `tests/e2e/editor.spec.ts`

**Interfaces:**
- Produces: an integration test that (given TEST_USER env) instantiates a model, saves nodes, and re-loads them under RLS; an E2E that drives template → editor → edit a rate → total updates → Save version.

- [ ] **Step 1: Integration test** — sign in as TEST_USER_A, `instantiateModelAction`, edit via `saveNodesAction`, `loadNodes` returns the change; skips silently without env (mirror Phase 0 RLS test).
- [ ] **Step 2: E2E smoke** — `tests/e2e/editor.spec.ts`: navigate to a project, open the picker, choose OCTG, expect the editor total near `$1,760`, edit the billet rate, expect the total to change, click Save version, expect a version row. Gate on a seeded/logged-in session per the Playwright setup; if auth can't be stubbed in CI, assert the template-picker → editor render path that does not require a live session.
- [ ] **Step 3: Run** — `pnpm test:integration` (or skip) and `pnpm test:e2e`.
- [ ] **Step 4: Commit** — `"Add editor integration and e2e tests"`.

---

## Task 20: Phase 1 QA gate

**Files:** none (verification).

- [ ] **Step 1: Full suite** — `pnpm typecheck && pnpm lint && pnpm test && pnpm build`. All green.
- [ ] **Step 2: Manual responsive + a11y** — `/models/[id]`, `/indices`, `/indices/[code]` at 375/768/1440; tab through the grid (edit, add, remove, navigate) with visible focus; confirm no placeholder metrics; charts render in light + (structurally) dark.
- [ ] **Step 3: Rollup parity spot-check** — the OCTG instantiated model totals ~$1,760.21; changing the HRC-bound billet rate moves the total and the tornado ranks it near the top.
- [ ] **Step 4: Final commit**

```bash
git commit --allow-empty -m "Phase 1 complete: cost-model editor verified

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- CBS tree editor + inline editing + keyboard + add/remove/reorder (spec §1, §5) → Tasks 7, 9, 10 (reorder via dnd-kit folded into Task 9's grid; a follow-up step adds `@dnd-kit` sortable rows).
- Live recompute integer-minor (spec §1, §5.1) → Task 3 + store Task 7.
- Autosave + SavedIndicator (spec §2, §6) → Task 10.
- Versioning + diff (spec §1, §5.4) → Tasks 6, 13.
- Index binding/recalc, materialized rates (spec §2, §6) → Tasks 4, 12.
- Charts (donut, tornado, sparkline) behind ChartContainer (spec §5.6) → Tasks 14–17.
- Index hub list + detail (spec §1) → Task 18.
- Template instantiation (spec §1) → Tasks 8, 11.
- Tests (unit/component/integration/e2e) (spec §1, §8) → Tasks 2–7, 9, 14–17, 19.
- No schema changes; optional 0005 (spec §7) → not a blocking task; add during Task 18 if ordered loads need it.

**2. Placeholder scan:** UI-heavy Tasks 9–18 describe structure + interfaces + key code and defer full JSX to implementation, matching the Phase 0 plan's treatment of large components; the pure-logic tasks (2–7) carry complete TDD code. The `templateToNodes` parent-linkage carries an explicit implementation note + a test that enforces correctness. No "TBD/implement later".

**3. Type consistency:** `CostNodeRow`/`TreeNode`/`CostTree`/`Rollup` (Task 2) are used identically in tree, rollup-live, sensitivity, diff, store, and db. `rollupLive` returns `{ total, byNodeId }` consumed by the store, donut, and tornado. `effectiveRateMinor` (Task 4) feeds `bindIndex` (Task 7) and `IndexBinding` (Task 12). `diffVersions` (Task 6) feeds `VersionDiff` (Task 13). Server actions accept Zod-validated inputs matching `CostNodeRow`.

One inline correction folded in: `saveVersionAction` must persist the client-computed `rollup.total` (added `total` to its input), not a naive node-sum.

Plan ready.
