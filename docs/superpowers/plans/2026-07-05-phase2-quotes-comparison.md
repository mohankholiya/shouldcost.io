# Phase 2 — Quotes & Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a cost model, a buyer adds supplier quotes and immediately sees a should-cost-vs-quote comparison matrix, a gap waterfall, and rule-based negotiation insight cards.

**Architecture:** Three pure, unit-tested modules (`comparison`, `waterfall`, `insights`) compute everything client-side from the model's live rollup + a quote. A thin Supabase repository (`lib/db/quotes.ts`) + server actions (`lib/actions/quotes.ts`) persist quotes under existing RLS. A new server route `/models/[id]/compare` loads model nodes + quotes and renders client components (quote list/form, matrix, waterfall, insight cards). No schema migration required; an optional index migration is included but non-blocking.

**Tech Stack:** Next.js 14 App Router (server + client components), TypeScript strict, Supabase (`@supabase/ssr` server client), Zod, React Hook Form, Recharts (behind existing `ChartContainer`), Zustand (existing editor store, read-only here), Vitest + Testing Library, Playwright.

## Global Constraints

- **Money is integer minor units end-to-end.** Never store or compute money as floats. `gap = quoted - shouldCost` in minor units. Verbatim from spec §5.1.
- **Positive gap = quote above should-cost = a buyer-favorable negotiation lever** (reads green via existing `DeltaPill`). Verbatim from spec / `components/number/delta-pill.tsx`.
- **TypeScript strict, zero `any`. Zod-validate every server-action mutation.** Verbatim from spec §8.
- **Same-currency assumption:** quotes are in the model currency (per-quote FX deferred to a later phase). Verbatim from spec §1 / §9.
- **Pure logic lives in `lib/model/*.ts` and takes plain data, returns plain data** — no React, no Supabase imports. Matches Phase 1 (`rollup-live.ts`, `sensitivity.ts`).
- **Reuse existing primitives:** `formatCurrency`/`formatPercent` (`lib/format.ts`), `DeltaPill` (`components/number/delta-pill.tsx`), `ChartContainer` (`components/models/charts/chart-container.tsx`), `EmptyState` (`components/shared/empty-state.tsx`), `PageHeader`, `Currency`/`CURRENCIES` (`components/number/currency-select.tsx`), UI primitives in `components/ui/*`.
- **DB access pattern:** `const supabase = await createServerClient()` from `@/lib/supabase/server`; check `error` and `throw`; cast rows to typed shapes. Matches `lib/db/versions.ts`.
- **No placeholder metrics; empty states teach.** No quotes yet → `EmptyState` with next steps. Verbatim from spec §8.
- **Renders at 375 / 768 / 1440; WCAG AA; tabular figures** (`num` class) on every number. Verbatim from spec §8.

**Existing verified facts this plan relies on (do not re-derive):**
- `CostNodeRow` (`lib/model/types.ts`): `{ id, model_id, parent_id, sort_order, name, node_type: "group"|"line", driver_name, quantity, unit, rate, rate_source, index_id, index_factor, formula, notes }`. `rate` is minor units.
- `Rollup = { total: number; byNodeId: Record<string, number> }` — `byNodeId` holds a subtotal for **every** node id (leaves and groups). `rollupLive(tree: CostTree): Rollup` in `lib/model/rollup-live.ts`.
- `buildTree(rows: CostNodeRow[]): CostTree` and `TreeNode = CostNodeRow & { children: TreeNode[] }` in `lib/model/tree.ts`. A **leaf line** = `node_type === "line" && children.length === 0`.
- Quotes schema (already migrated, `0001_init_schema.sql`): `quotes(id, model_id, supplier_name, currency default 'USD', incoterm, payment_terms, quoted_total bigint default 0, received_at timestamptz default now())`; `quote_lines(id, quote_id, cost_node_id nullable, description, amount bigint default 0)`. RLS policies `q_all` / `ql_all` already scope both via the model→org chain.
- `formatCurrency(minor: number, currency: Currency): string`, `formatPercent(n: number): string` in `lib/format.ts`. `Currency = "USD"|"EUR"|"INR"|"GBP"|"SAR"|"AED"`.
- Test scripts: `pnpm test` (= `vitest run`), `pnpm typecheck` (= `tsc --noEmit`), `pnpm lint` (= `next lint`), `pnpm test:e2e` (= `playwright test`). Run a single file with `pnpm vitest run <path>`.
- **Env note (from project memory):** `pnpm` here is wrapped by a supply-chain policy; installs may need build approval, but this plan adds **no new dependencies**, so no approval step is expected. E2E needs a seeded auth session and is env-gated like the existing `tests/e2e/*.spec.ts`.

---

### Task 1: Comparison pure logic

**Files:**
- Create: `lib/model/comparison.ts`
- Test: `tests/unit/comparison.test.ts`

**Interfaces:**
- Consumes: `CostNodeRow`, `Rollup` (`lib/model/types.ts`); `buildTree` (`lib/model/tree.ts`); `QuoteWithLines` (defined in Task 4 — for Task 1 declare the minimal shape inline as shown so this task compiles independently, then Task 4's exported type structurally matches it).
- Produces:
  - `type CompRow = { nodeId: string; name: string; shouldCost: number; quoted: number | null; gap: number | null; gapPct: number | null }`
  - `type Comparison = { rows: CompRow[]; shouldCostTotal: number; quoteTotal: number; gapTotal: number; gapPct: number }`
  - `function buildComparison(nodes: CostNodeRow[], rollup: Rollup, quote: QuoteInput): Comparison`
  - `type QuoteInput = { quoted_total: number; lines: { cost_node_id: string | null; amount: number }[] }` (structural subset of `QuoteWithLines`).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/comparison.test.ts
import { describe, it, expect } from "vitest";
import { buildComparison } from "@/lib/model/comparison";
import type { CostNodeRow, Rollup } from "@/lib/model/types";

const r = (o: Partial<CostNodeRow>): CostNodeRow => ({
  id: o.id ?? "x",
  model_id: "m",
  parent_id: o.parent_id ?? null,
  sort_order: o.sort_order ?? 0,
  name: o.name ?? "n",
  node_type: o.node_type ?? "line",
  driver_name: null,
  quantity: o.quantity ?? 1,
  unit: null,
  rate: o.rate ?? null,
  rate_source: "manual",
  index_id: null,
  index_factor: null,
  formula: o.formula ?? null,
  notes: null,
});

// Group G with two leaf lines: steel (100000) and threading (50000).
const nodes: CostNodeRow[] = [
  r({ id: "g", node_type: "group", name: "G", sort_order: 0 }),
  r({ id: "steel", parent_id: "g", name: "Steel", sort_order: 0 }),
  r({ id: "thread", parent_id: "g", name: "Threading", sort_order: 1 }),
];
const rollup: Rollup = { total: 150000, byNodeId: { g: 150000, steel: 100000, thread: 50000 } };

describe("buildComparison", () => {
  it("computes per-leaf and total gaps in minor units; unmapped leaf is null", () => {
    const quote = {
      quoted_total: 180000,
      lines: [{ cost_node_id: "steel", amount: 130000 }], // threading unmapped
    };
    const c = buildComparison(nodes, rollup, quote);

    expect(c.rows.map((x) => x.nodeId)).toEqual(["steel", "thread"]); // leaves only, tree order
    const steel = c.rows.find((x) => x.nodeId === "steel")!;
    expect(steel.shouldCost).toBe(100000);
    expect(steel.quoted).toBe(130000);
    expect(steel.gap).toBe(30000);
    expect(steel.gapPct).toBeCloseTo(30, 5);

    const thread = c.rows.find((x) => x.nodeId === "thread")!;
    expect(thread.quoted).toBeNull();
    expect(thread.gap).toBeNull();
    expect(thread.gapPct).toBeNull();

    expect(c.shouldCostTotal).toBe(150000);
    expect(c.quoteTotal).toBe(180000);
    expect(c.gapTotal).toBe(30000);
    expect(c.gapPct).toBeCloseTo(20, 5);
  });

  it("sums multiple quote lines mapped to the same node", () => {
    const quote = {
      quoted_total: 150000,
      lines: [
        { cost_node_id: "steel", amount: 60000 },
        { cost_node_id: "steel", amount: 60000 },
      ],
    };
    const c = buildComparison(nodes, rollup, quote);
    expect(c.rows.find((x) => x.nodeId === "steel")!.quoted).toBe(120000);
  });

  it("guards divide-by-zero: zero should-cost yields null gapPct on the row and 0 overall", () => {
    const zeroRollup: Rollup = { total: 0, byNodeId: { g: 0, steel: 0, thread: 0 } };
    const c = buildComparison(nodes, zeroRollup, { quoted_total: 0, lines: [] });
    expect(c.rows.every((x) => x.gapPct === null || x.gap === null)).toBe(true);
    expect(c.gapPct).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/comparison.test.ts`
Expected: FAIL — cannot resolve `@/lib/model/comparison`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/model/comparison.ts
import type { CostNodeRow, Rollup } from "@/lib/model/types";
import { buildTree, type TreeNode } from "@/lib/model/tree"; // TreeNode re-exported from types via tree

export type CompRow = {
  nodeId: string;
  name: string;
  shouldCost: number;
  quoted: number | null;
  gap: number | null;
  gapPct: number | null;
};

export type Comparison = {
  rows: CompRow[];
  shouldCostTotal: number;
  quoteTotal: number;
  gapTotal: number;
  gapPct: number;
};

/** Minimal structural view of a quote this module needs; QuoteWithLines (Task 4) matches. */
export type QuoteInput = {
  quoted_total: number;
  lines: { cost_node_id: string | null; amount: number }[];
};

function pct(part: number, base: number): number | null {
  return base !== 0 ? (part / base) * 100 : null;
}

/** Leaf lines in tree (sort) order — a `line` node with no children. */
function leafLines(nodes: CostNodeRow[]): CostNodeRow[] {
  const { roots } = buildTree(nodes);
  const out: CostNodeRow[] = [];
  const walk = (ns: TreeNode[]) =>
    ns.forEach((n) => {
      if (n.node_type === "line" && n.children.length === 0) out.push(n);
      walk(n.children);
    });
  walk(roots);
  return out;
}

export function buildComparison(
  nodes: CostNodeRow[],
  rollup: Rollup,
  quote: QuoteInput,
): Comparison {
  const quotedByNode = new Map<string, number>();
  for (const line of quote.lines) {
    if (!line.cost_node_id) continue;
    quotedByNode.set(line.cost_node_id, (quotedByNode.get(line.cost_node_id) ?? 0) + line.amount);
  }

  const rows: CompRow[] = leafLines(nodes).map((n) => {
    const shouldCost = rollup.byNodeId[n.id] ?? 0;
    const quoted = quotedByNode.has(n.id) ? quotedByNode.get(n.id)! : null;
    const gap = quoted === null ? null : quoted - shouldCost;
    return {
      nodeId: n.id,
      name: n.name,
      shouldCost,
      quoted,
      gap,
      gapPct: gap === null ? null : pct(gap, shouldCost),
    };
  });

  const shouldCostTotal = rollup.total;
  const quoteTotal = quote.quoted_total;
  const gapTotal = quoteTotal - shouldCostTotal;
  return { rows, shouldCostTotal, quoteTotal, gapTotal, gapPct: pct(gapTotal, shouldCostTotal) ?? 0 };
}
```

> Note: `tree.ts` does not currently re-export `TreeNode`. If the import `{ buildTree, type TreeNode }` fails typecheck, import `TreeNode` from `@/lib/model/types` instead: `import type { CostNodeRow, Rollup, TreeNode } from "@/lib/model/types";` and `import { buildTree } from "@/lib/model/tree";`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/comparison.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/model/comparison.ts tests/unit/comparison.test.ts
git commit -m "Add should-cost vs quote comparison logic"
```

---

### Task 2: Gap waterfall pure logic

**Files:**
- Create: `lib/model/waterfall.ts`
- Test: `tests/unit/waterfall.test.ts`

**Interfaces:**
- Consumes: `Comparison`, `CompRow` (Task 1).
- Produces:
  - `type WaterfallBar = { label: string; delta: number; cumulative: number; kind: "base" | "increase" | "decrease" | "total" }`
  - `function waterfallData(c: Comparison, topN?: number): WaterfallBar[]` — first bar `kind:"base"` at `shouldCostTotal`; then the top-N mapped per-line gaps by magnitude; an `"Other"` bar absorbing the remainder so the running total closes exactly on `quoteTotal`; final bar `kind:"total"` at `quoteTotal`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/waterfall.test.ts
import { describe, it, expect } from "vitest";
import { waterfallData } from "@/lib/model/waterfall";
import type { Comparison } from "@/lib/model/comparison";

const comp = (over: Partial<Comparison>): Comparison => ({
  rows: [],
  shouldCostTotal: 100000,
  quoteTotal: 130000,
  gapTotal: 30000,
  gapPct: 30,
  ...over,
});

describe("waterfallData", () => {
  it("starts at should-cost, ends exactly at quote total, closing the gap", () => {
    const c = comp({
      rows: [
        { nodeId: "a", name: "Steel", shouldCost: 60000, quoted: 80000, gap: 20000, gapPct: 33.3 },
        { nodeId: "b", name: "Threading", shouldCost: 40000, quoted: 50000, gap: 10000, gapPct: 25 },
      ],
    });
    const bars = waterfallData(c, 6);
    expect(bars[0]).toMatchObject({ label: "Should-cost", kind: "base", cumulative: 100000 });
    expect(bars.at(-1)).toMatchObject({ label: "Quote", kind: "total", cumulative: 130000 });
    // cumulative is monotonic through the mapped gaps
    expect(bars[1]).toMatchObject({ label: "Steel", delta: 20000, cumulative: 120000, kind: "increase" });
    expect(bars[2]).toMatchObject({ label: "Threading", delta: 10000, cumulative: 130000, kind: "increase" });
  });

  it("groups beyond topN into an 'Other' bar and still closes on quote total", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      nodeId: `n${i}`,
      name: `L${i}`,
      shouldCost: 10000,
      quoted: 10000 + (i + 1) * 1000,
      gap: (i + 1) * 1000, // 1000,2000,3000,4000,5000 => sum 15000
      gapPct: 10,
    }));
    const c = comp({ rows, shouldCostTotal: 50000, quoteTotal: 65000, gapTotal: 15000, gapPct: 30 });
    const bars = waterfallData(c, 2); // keep top 2 (5000,4000), other = 15000-9000=6000
    const other = bars.find((b) => b.label === "Other")!;
    expect(other.delta).toBe(6000);
    expect(bars.at(-1)!.cumulative).toBe(65000);
  });

  it("emits a downward bar for a favorable (negative) line gap", () => {
    const c = comp({
      shouldCostTotal: 100000,
      quoteTotal: 95000,
      gapTotal: -5000,
      gapPct: -5,
      rows: [{ nodeId: "a", name: "Coating", shouldCost: 20000, quoted: 15000, gap: -5000, gapPct: -25 }],
    });
    const bars = waterfallData(c);
    expect(bars.find((b) => b.label === "Coating")).toMatchObject({ delta: -5000, kind: "decrease" });
    expect(bars.at(-1)!.cumulative).toBe(95000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/waterfall.test.ts`
Expected: FAIL — cannot resolve `@/lib/model/waterfall`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/model/waterfall.ts
import type { Comparison } from "@/lib/model/comparison";

export type WaterfallBar = {
  label: string;
  delta: number;
  cumulative: number;
  kind: "base" | "increase" | "decrease" | "total";
};

export function waterfallData(c: Comparison, topN = 6): WaterfallBar[] {
  const mapped = c.rows.filter((r): r is typeof r & { gap: number } => r.gap !== null);
  const ranked = [...mapped].sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  const top = ranked.slice(0, topN);
  const topSum = top.reduce((s, r) => s + r.gap, 0);
  const other = c.gapTotal - topSum;

  const bars: WaterfallBar[] = [];
  let cumulative = c.shouldCostTotal;
  bars.push({ label: "Should-cost", delta: c.shouldCostTotal, cumulative, kind: "base" });

  for (const r of top) {
    cumulative += r.gap;
    bars.push({
      label: r.name,
      delta: r.gap,
      cumulative,
      kind: r.gap >= 0 ? "increase" : "decrease",
    });
  }

  if (other !== 0) {
    cumulative += other;
    bars.push({ label: "Other", delta: other, cumulative, kind: other >= 0 ? "increase" : "decrease" });
  }

  bars.push({ label: "Quote", delta: c.quoteTotal, cumulative: c.quoteTotal, kind: "total" });
  return bars;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/waterfall.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/model/waterfall.ts tests/unit/waterfall.test.ts
git commit -m "Add gap waterfall data builder"
```

---

### Task 3: Insight rule engine

**Files:**
- Create: `lib/model/insights.ts`
- Test: `tests/unit/insights.test.ts`

**Interfaces:**
- Consumes: `Comparison`, `CompRow` (Task 1); `Currency` (`components/number/currency-select.tsx`); `formatCurrency`, `formatPercent` (`lib/format.ts`).
- Produces:
  - `type InsightCard = { id: string; severity: "lever" | "info" | "concede"; title: string; detail: string }`
  - `function evaluateInsights(c: Comparison, currency: Currency): InsightCard[]`

> Refinement over spec §5.3: the engine takes `currency` (a pure `Intl` format input) so `detail` strings are display-ready, and reads the margin line from the comparison rows rather than re-walking `nodes` — the spec's `nodes` arg is unnecessary since `CompRow.name` already carries it. Rules 1–4 are otherwise exactly as specced. The 10% lever threshold is a tunable constant.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/insights.test.ts
import { describe, it, expect } from "vitest";
import { evaluateInsights } from "@/lib/model/insights";
import type { Comparison } from "@/lib/model/comparison";

const base: Comparison = {
  rows: [
    { nodeId: "steel", name: "Steel", shouldCost: 60000, quoted: 80000, gap: 20000, gapPct: 33.3 },
    { nodeId: "coat", name: "Coating", shouldCost: 20000, quoted: 15000, gap: -5000, gapPct: -25 },
    { nodeId: "margin", name: "Margin", shouldCost: 20000, quoted: 25000, gap: 5000, gapPct: 25 },
  ],
  shouldCostTotal: 100000,
  quoteTotal: 120000,
  gapTotal: 20000,
  gapPct: 20,
};

describe("evaluateInsights", () => {
  it("always emits a headline card describing the total gap direction", () => {
    const cards = evaluateInsights(base, "USD");
    const headline = cards.find((x) => x.id === "headline")!;
    expect(headline.severity).toBe("lever"); // quote above should-cost
    expect(headline.title).toContain("20.0%");
    expect(headline.title.toLowerCase()).toContain("above");
  });

  it("flags over-quoted lines above the 10% threshold as levers", () => {
    const cards = evaluateInsights(base, "USD");
    const lever = cards.find((x) => x.id === "lever-steel");
    expect(lever?.severity).toBe("lever");
  });

  it("frames lines quoted below should-cost as concede", () => {
    const cards = evaluateInsights(base, "USD");
    const concede = cards.find((x) => x.id === "concede-coat");
    expect(concede?.severity).toBe("concede");
  });

  it("reports implied margin when a line name mentions margin", () => {
    const cards = evaluateInsights(base, "USD");
    const margin = cards.find((x) => x.id === "margin")!;
    expect(margin.severity).toBe("info");
    expect(margin.title).toContain("20.0%"); // 20000 / 100000
  });

  it("headline reads 'below' and info severity when quote is under should-cost", () => {
    const under: Comparison = { ...base, quoteTotal: 90000, gapTotal: -10000, gapPct: -10, rows: [] };
    const headline = evaluateInsights(under, "USD").find((x) => x.id === "headline")!;
    expect(headline.severity).toBe("info");
    expect(headline.title.toLowerCase()).toContain("below");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/insights.test.ts`
Expected: FAIL — cannot resolve `@/lib/model/insights`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/model/insights.ts
import type { Comparison } from "@/lib/model/comparison";
import type { Currency } from "@/components/number/currency-select";
import { formatCurrency } from "@/lib/format";

export type InsightCard = {
  id: string;
  severity: "lever" | "info" | "concede";
  title: string;
  detail: string;
};

const LEVER_PCT = 10; // tunable: a line quoted >10% over should-cost is a lever

export function evaluateInsights(c: Comparison, currency: Currency): InsightCard[] {
  const cards: InsightCard[] = [];
  const money = (m: number) => formatCurrency(m, currency);

  // 1. Headline gap — always present.
  const above = c.gapTotal >= 0;
  cards.push({
    id: "headline",
    severity: above ? "lever" : "info",
    title: `Quote is ${Math.abs(c.gapPct).toFixed(1)}% ${above ? "above" : "below"} should-cost`,
    detail: `Total gap of ${money(c.gapTotal)} across ${c.rows.length} line${c.rows.length === 1 ? "" : "s"}.`,
  });

  // 2. Top over-quoted lines (levers), up to 3, largest absolute gap first.
  const levers = c.rows
    .filter((r) => r.gapPct !== null && r.gapPct > LEVER_PCT && r.gap !== null)
    .sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))
    .slice(0, 3);
  for (const r of levers) {
    cards.push({
      id: `lever-${r.nodeId}`,
      severity: "lever",
      title: `${r.name} is ${r.gapPct!.toFixed(1)}% over`,
      detail: `Quoted ${money(r.quoted!)} vs should-cost ${money(r.shouldCost)} — primary negotiation lever.`,
    });
  }

  // 3. Favorable lines (quote below should-cost) → concede.
  for (const r of c.rows.filter((r) => r.gap !== null && r.gap < 0)) {
    cards.push({
      id: `concede-${r.nodeId}`,
      severity: "concede",
      title: `${r.name} is competitive`,
      detail: `Quoted ${money(r.quoted!)}, below should-cost ${money(r.shouldCost)} — concede here to trade for levers.`,
    });
  }

  // 4. Implied margin — a leaf line whose name mentions "margin".
  const margin = c.rows.find((r) => /margin/i.test(r.name));
  if (margin && c.shouldCostTotal !== 0) {
    const share = (margin.shouldCost / c.shouldCostTotal) * 100;
    cards.push({
      id: "margin",
      severity: "info",
      title: `Margin is ${share.toFixed(1)}% of should-cost`,
      detail:
        margin.quoted !== null
          ? `Supplier prices margin at ${money(margin.quoted)} vs ${money(margin.shouldCost)}.`
          : `Supplier did not itemise margin; benchmark against ${money(margin.shouldCost)}.`,
    });
  }

  return cards;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/insights.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/model/insights.ts tests/unit/insights.test.ts
git commit -m "Add rule-based negotiation insight engine"
```

---

### Task 4: Quote repository (persistence)

**Files:**
- Create: `lib/db/quotes.ts`

**Interfaces:**
- Consumes: `createServerClient` (`@/lib/supabase/server`).
- Produces:
  - `type QuoteLineRow = { id: string; quote_id: string; cost_node_id: string | null; description: string | null; amount: number }`
  - `type QuoteRow = { id: string; model_id: string; supplier_name: string; currency: string; incoterm: string | null; payment_terms: string | null; quoted_total: number; received_at: string }`
  - `type QuoteWithLines = QuoteRow & { lines: QuoteLineRow[] }`
  - `type QuoteInputData = { supplier_name: string; currency: string; incoterm: string | null; payment_terms: string | null; quoted_total: number; lines: { cost_node_id: string | null; description: string | null; amount: number }[] }`
  - `async function loadQuotes(modelId: string): Promise<QuoteWithLines[]>`
  - `async function saveQuote(modelId: string, data: QuoteInputData, quoteId?: string): Promise<string>`
  - `async function deleteQuote(quoteId: string): Promise<void>`

> `QuoteWithLines` is structurally a superset of Task 1's `QuoteInput` (it has `quoted_total` and `lines[].{cost_node_id, amount}`), so `buildComparison(nodes, rollup, quote)` accepts it directly.

- [ ] **Step 1: Write the implementation** (repository code is exercised via the action test in Task 5 and the e2e in Task 13; no isolated unit test — it only wraps Supabase calls, matching `lib/db/versions.ts` which is likewise untested in isolation)

```typescript
// lib/db/quotes.ts
import { createServerClient } from "@/lib/supabase/server";

export type QuoteLineRow = {
  id: string;
  quote_id: string;
  cost_node_id: string | null;
  description: string | null;
  amount: number;
};

export type QuoteRow = {
  id: string;
  model_id: string;
  supplier_name: string;
  currency: string;
  incoterm: string | null;
  payment_terms: string | null;
  quoted_total: number;
  received_at: string;
};

export type QuoteWithLines = QuoteRow & { lines: QuoteLineRow[] };

export type QuoteInputData = {
  supplier_name: string;
  currency: string;
  incoterm: string | null;
  payment_terms: string | null;
  quoted_total: number;
  lines: { cost_node_id: string | null; description: string | null; amount: number }[];
};

export async function loadQuotes(modelId: string): Promise<QuoteWithLines[]> {
  const supabase = await createServerClient();
  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, model_id, supplier_name, currency, incoterm, payment_terms, quoted_total, received_at")
    .eq("model_id", modelId)
    .order("received_at", { ascending: false });
  if (error) throw error;

  const rows = (quotes ?? []) as QuoteRow[];
  if (rows.length === 0) return [];

  const { data: lines, error: lErr } = await supabase
    .from("quote_lines")
    .select("id, quote_id, cost_node_id, description, amount")
    .in("quote_id", rows.map((q) => q.id));
  if (lErr) throw lErr;

  const byQuote = new Map<string, QuoteLineRow[]>();
  for (const l of (lines ?? []) as QuoteLineRow[]) {
    const list = byQuote.get(l.quote_id) ?? [];
    list.push(l);
    byQuote.set(l.quote_id, list);
  }
  return rows.map((q) => ({ ...q, lines: byQuote.get(q.id) ?? [] }));
}

/** Upsert a quote and replace its lines. Returns the quote id. */
export async function saveQuote(
  modelId: string,
  data: QuoteInputData,
  quoteId?: string,
): Promise<string> {
  const supabase = await createServerClient();
  const payload = {
    model_id: modelId,
    supplier_name: data.supplier_name,
    currency: data.currency,
    incoterm: data.incoterm,
    payment_terms: data.payment_terms,
    quoted_total: data.quoted_total,
  };

  let id = quoteId;
  if (id) {
    const { error } = await supabase.from("quotes").update(payload).eq("id", id);
    if (error) throw error;
    const { error: dErr } = await supabase.from("quote_lines").delete().eq("quote_id", id);
    if (dErr) throw dErr;
  } else {
    const { data: inserted, error } = await supabase
      .from("quotes")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw error;
    id = inserted!.id as string;
  }

  if (data.lines.length) {
    const { error: lErr } = await supabase.from("quote_lines").insert(
      data.lines.map((l) => ({
        quote_id: id,
        cost_node_id: l.cost_node_id,
        description: l.description,
        amount: l.amount,
      })),
    );
    if (lErr) throw lErr;
  }
  return id;
}

export async function deleteQuote(quoteId: string): Promise<void> {
  const supabase = await createServerClient();
  const { error } = await supabase.from("quotes").delete().eq("id", quoteId);
  if (error) throw error; // quote_lines cascade on delete (FK)
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/db/quotes.ts
git commit -m "Add quotes repository with line replacement"
```

---

### Task 5: Quote server actions

**Files:**
- Create: `lib/actions/quotes.ts`
- Test: `tests/unit/quote-actions.test.ts`

**Interfaces:**
- Consumes: `saveQuote`, `deleteQuote`, `QuoteInputData` (Task 4); `zod`.
- Produces:
  - `const QuoteInputSchema` (exported Zod schema — the test asserts validation independently of Supabase)
  - `async function saveQuoteAction(input: unknown): Promise<{ id: string }>`
  - `async function deleteQuoteAction(input: unknown): Promise<{ ok: true }>`

- [ ] **Step 1: Write the failing test** (validation only — pure Zod, no DB)

```typescript
// tests/unit/quote-actions.test.ts
import { describe, it, expect } from "vitest";
import { QuoteInputSchema } from "@/lib/actions/quotes";

describe("QuoteInputSchema", () => {
  it("accepts a valid total-only quote with integer minor amounts", () => {
    const parsed = QuoteInputSchema.parse({
      modelId: "m1",
      supplier_name: "Acme",
      currency: "USD",
      incoterm: null,
      payment_terms: null,
      quoted_total: 180000,
      lines: [],
    });
    expect(parsed.quoted_total).toBe(180000);
  });

  it("rejects non-integer money (minor units must be integers)", () => {
    expect(() =>
      QuoteInputSchema.parse({
        modelId: "m1",
        supplier_name: "Acme",
        currency: "USD",
        incoterm: null,
        payment_terms: null,
        quoted_total: 180000.5,
        lines: [],
      }),
    ).toThrow();
  });

  it("rejects an empty supplier name", () => {
    expect(() =>
      QuoteInputSchema.parse({
        modelId: "m1",
        supplier_name: "",
        currency: "USD",
        incoterm: null,
        payment_terms: null,
        quoted_total: 0,
        lines: [],
      }),
    ).toThrow();
  });

  it("accepts line-level amounts mapped to nodes", () => {
    const parsed = QuoteInputSchema.parse({
      modelId: "m1",
      supplier_name: "Acme",
      currency: "USD",
      incoterm: "DAP",
      payment_terms: "Net 30",
      quoted_total: 180000,
      lines: [{ cost_node_id: "n1", description: "Steel", amount: 130000 }],
    });
    expect(parsed.lines[0]!.amount).toBe(130000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/quote-actions.test.ts`
Expected: FAIL — cannot resolve `@/lib/actions/quotes`.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/actions/quotes.ts
"use server";
import { z } from "zod";
import { saveQuote, deleteQuote, type QuoteInputData } from "@/lib/db/quotes";

const money = z.number().int();

export const QuoteInputSchema = z.object({
  modelId: z.string().min(1),
  supplier_name: z.string().min(1),
  currency: z.string().min(1),
  incoterm: z.string().nullable(),
  payment_terms: z.string().nullable(),
  quoted_total: money,
  lines: z.array(
    z.object({
      cost_node_id: z.string().nullable(),
      description: z.string().nullable(),
      amount: money,
    }),
  ),
  quoteId: z.string().optional(),
});

export async function saveQuoteAction(input: unknown): Promise<{ id: string }> {
  const { modelId, quoteId, ...rest } = QuoteInputSchema.parse(input);
  const data: QuoteInputData = rest;
  const id = await saveQuote(modelId, data, quoteId);
  return { id };
}

export async function deleteQuoteAction(input: unknown): Promise<{ ok: true }> {
  const { quoteId } = z.object({ quoteId: z.string().min(1) }).parse(input);
  await deleteQuote(quoteId);
  return { ok: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/quote-actions.test.ts`
Expected: PASS (4 tests).

> If Vitest errors on the `"use server"` directive, the existing `tests/unit` suite already imports from `lib/actions/model.ts` patterns — but `model.ts` is not unit-tested. If the directive causes a transform error, split the schema into `lib/actions/quotes-schema.ts` (no directive) and import it from both `quotes.ts` and the test. Prefer the single-file version first; only split if the run fails on the directive.

- [ ] **Step 5: Commit**

```bash
git add lib/actions/quotes.ts tests/unit/quote-actions.test.ts
git commit -m "Add quote server actions with Zod validation"
```

---

### Task 6: Optional index migration (non-blocking)

**Files:**
- Create: `supabase/migrations/0006_quote_indexes.sql`

**Interfaces:** none (DB only). Phase 2 works without applying it.

- [ ] **Step 1: Write the migration**

```sql
-- 0006_quote_indexes.sql — optional performance indexes for Phase 2 quotes.
-- Non-blocking: the app functions without these; apply via `supabase migration up --linked`.
create index if not exists quote_lines_quote_id_idx on quote_lines (quote_id);
create index if not exists quote_lines_cost_node_id_idx on quote_lines (cost_node_id);
-- quotes(model_id) index already exists from 0001_init_schema.sql.
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0006_quote_indexes.sql
git commit -m "Add optional quote index migration"
```

---

### Task 7: Quote form + optional line editor (client)

**Files:**
- Create: `components/quotes/quote-form.tsx`
- Test: `tests/unit/quote-form.test.tsx`

**Interfaces:**
- Consumes: `CostNodeRow` (`lib/model/types.ts`); `Currency`, `CURRENCIES` (`components/number/currency-select.tsx`); UI primitives (`Input`, `Button`, `Label`, `Select*`, `Dialog*`); `MoneyInput` (`components/number/money-input.tsx`) if its props match (see note); `saveQuoteAction` (Task 5).
- Produces:
  - `type QuoteFormValues = { supplier_name: string; currency: Currency; incoterm: string; payment_terms: string; quoted_total: number; lines: { cost_node_id: string | null; description: string; amount: number } [] }`
  - `function QuoteForm(props: { modelId: string; currency: Currency; leafLines: { id: string; name: string }[]; initial?: QuoteWithLines; onSaved: () => void }): JSX.Element`

> Read `components/number/money-input.tsx` before using it. If its prop shape differs from `{ valueMinor, onChangeMinor }`, use a plain numeric `<input>` that stores minor units (parse the entered major-unit value with the existing `toMinor(value, currency)` from `@/lib/money`), to keep money integer.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/quote-form.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuoteForm } from "@/components/quotes/quote-form";

describe("QuoteForm", () => {
  it("renders supplier and total fields and a submit button", () => {
    render(
      <QuoteForm
        modelId="m1"
        currency="USD"
        leafLines={[{ id: "steel", name: "Steel" }]}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/supplier/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/total/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save quote/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/quote-form.test.tsx`
Expected: FAIL — cannot resolve `@/components/quotes/quote-form`.

- [ ] **Step 3: Write the implementation** (React Hook Form; supplier/currency/incoterm/terms/total, plus an optional collapsible per-leaf line grid; on submit calls `saveQuoteAction` then `onSaved`)

```tsx
// components/quotes/quote-form.tsx
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CurrencySelect, type Currency } from "@/components/number/currency-select";
import { toMinor, fromMinor } from "@/lib/money";
import { saveQuoteAction } from "@/lib/actions/quotes";
import type { QuoteWithLines } from "@/lib/db/quotes";

export type QuoteFormValues = {
  supplier_name: string;
  incoterm: string;
  payment_terms: string;
  quoted_total_major: number; // major units in the form; converted to minor on submit
};

export function QuoteForm({
  modelId,
  currency: modelCurrency,
  leafLines,
  initial,
  onSaved,
}: {
  modelId: string;
  currency: Currency;
  leafLines: { id: string; name: string }[];
  initial?: QuoteWithLines;
  onSaved: () => void;
}) {
  const [currency, setCurrency] = useState<Currency>((initial?.currency as Currency) ?? modelCurrency);
  const [lineMode, setLineMode] = useState(Boolean(initial?.lines.length));
  const [lineMajor, setLineMajor] = useState<Record<string, number>>(() => {
    const seed: Record<string, number> = {};
    for (const l of initial?.lines ?? []) if (l.cost_node_id) seed[l.cost_node_id] = fromMinor(l.amount, (initial!.currency as Currency));
    return seed;
  });
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit } = useForm<QuoteFormValues>({
    defaultValues: {
      supplier_name: initial?.supplier_name ?? "",
      incoterm: initial?.incoterm ?? "",
      payment_terms: initial?.payment_terms ?? "",
      quoted_total_major: initial ? fromMinor(initial.quoted_total, initial.currency as Currency) : 0,
    },
  });

  async function onSubmit(v: QuoteFormValues) {
    setSaving(true);
    try {
      const lines = lineMode
        ? leafLines
            .filter((n) => lineMajor[n.id] != null && lineMajor[n.id] !== 0)
            .map((n) => ({
              cost_node_id: n.id,
              description: n.name,
              amount: toMinor(lineMajor[n.id]!, currency),
            }))
        : [];
      await saveQuoteAction({
        modelId,
        quoteId: initial?.id,
        supplier_name: v.supplier_name,
        currency,
        incoterm: v.incoterm || null,
        payment_terms: v.payment_terms || null,
        quoted_total: toMinor(Number(v.quoted_total_major) || 0, currency),
        lines,
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="supplier_name">Supplier</Label>
          <Input id="supplier_name" {...register("supplier_name", { required: true })} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="quoted_total_major">Total ({currency})</Label>
          <Input
            id="quoted_total_major"
            type="number"
            step="0.01"
            className="num"
            {...register("quoted_total_major", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1">
          <Label>Currency</Label>
          <CurrencySelect value={currency} onChange={setCurrency} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="incoterm">Incoterm</Label>
          <Input id="incoterm" placeholder="e.g. DAP" {...register("incoterm")} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="payment_terms">Payment terms</Label>
          <Input id="payment_terms" placeholder="e.g. Net 30" {...register("payment_terms")} />
        </div>
      </div>

      <div className="rounded-md border border-hairline p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={lineMode} onChange={(e) => setLineMode(e.target.checked)} />
          Enter line-by-line amounts (unlocks the per-line matrix &amp; waterfall)
        </label>
        {lineMode && (
          <div className="mt-3 space-y-2">
            {leafLines.map((n) => (
              <div key={n.id} className="flex items-center justify-between gap-3">
                <span className="text-sm">{n.name}</span>
                <Input
                  type="number"
                  step="0.01"
                  className="num w-32"
                  aria-label={`Amount for ${n.name}`}
                  value={lineMajor[n.id] ?? ""}
                  onChange={(e) =>
                    setLineMajor((m) => ({ ...m, [n.id]: Number(e.target.value) }))
                  }
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : "Save quote"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/quote-form.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add components/quotes/quote-form.tsx tests/unit/quote-form.test.tsx
git commit -m "Add supplier quote form with optional line entry"
```

---

### Task 8: Comparison matrix (client)

**Files:**
- Create: `components/quotes/comparison-matrix.tsx`
- Test: `tests/unit/comparison-matrix.test.tsx`

**Interfaces:**
- Consumes: `Comparison`, `CompRow` (Task 1); `formatCurrency` (`lib/format.ts`); `DeltaPill` (`components/number/delta-pill.tsx`); `Currency`.
- Produces: `function ComparisonMatrix(props: { comparison: Comparison; currency: Currency }): JSX.Element`.

- [ ] **Step 1: Write the failing test**

```tsx
// tests/unit/comparison-matrix.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComparisonMatrix } from "@/components/quotes/comparison-matrix";
import type { Comparison } from "@/lib/model/comparison";

const c: Comparison = {
  rows: [
    { nodeId: "steel", name: "Steel", shouldCost: 100000, quoted: 130000, gap: 30000, gapPct: 30 },
    { nodeId: "thread", name: "Threading", shouldCost: 50000, quoted: null, gap: null, gapPct: null },
  ],
  shouldCostTotal: 150000,
  quoteTotal: 180000,
  gapTotal: 30000,
  gapPct: 20,
};

describe("ComparisonMatrix", () => {
  it("renders one row per line, the total row, and an em dash for unmapped quotes", () => {
    render(<ComparisonMatrix comparison={c} currency="USD" />);
    expect(screen.getByText("Steel")).toBeInTheDocument();
    expect(screen.getByText("Threading")).toBeInTheDocument();
    expect(screen.getByText(/total/i)).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument(); // unmapped quoted cell
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/unit/comparison-matrix.test.tsx`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the implementation**

```tsx
// components/quotes/comparison-matrix.tsx
"use client";

import { formatCurrency } from "@/lib/format";
import { DeltaPill } from "@/components/number/delta-pill";
import type { Comparison } from "@/lib/model/comparison";
import type { Currency } from "@/components/number/currency-select";

export function ComparisonMatrix({
  comparison,
  currency,
}: {
  comparison: Comparison;
  currency: Currency;
}) {
  const { rows, shouldCostTotal, quoteTotal, gapTotal } = comparison;
  return (
    <div className="overflow-x-auto rounded-md border border-hairline">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">Line</th>
            <th className="px-3 py-2 text-right font-medium">Should-cost</th>
            <th className="px-3 py-2 text-right font-medium">Quoted</th>
            <th className="px-3 py-2 text-right font-medium">Gap</th>
            <th className="px-3 py-2 text-right font-medium">Δ%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.nodeId} className="border-b border-hairline last:border-0">
              <td className="px-3 py-2">{r.name}</td>
              <td className="num px-3 py-2 text-right">{formatCurrency(r.shouldCost, currency)}</td>
              <td className="num px-3 py-2 text-right">
                {r.quoted === null ? "—" : formatCurrency(r.quoted, currency)}
              </td>
              <td className="num px-3 py-2 text-right">
                {r.gap === null ? "—" : formatCurrency(r.gap, currency)}
              </td>
              <td className="px-3 py-2 text-right">
                {r.gap === null ? "—" : <DeltaPill deltaMinor={r.gap} baseMinor={r.shouldCost} />}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-hairline font-medium">
            <td className="px-3 py-2">Total</td>
            <td className="num px-3 py-2 text-right">{formatCurrency(shouldCostTotal, currency)}</td>
            <td className="num px-3 py-2 text-right">{formatCurrency(quoteTotal, currency)}</td>
            <td className="num px-3 py-2 text-right">{formatCurrency(gapTotal, currency)}</td>
            <td className="px-3 py-2 text-right">
              <DeltaPill deltaMinor={gapTotal} baseMinor={shouldCostTotal} />
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run tests/unit/comparison-matrix.test.tsx`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add components/quotes/comparison-matrix.tsx tests/unit/comparison-matrix.test.tsx
git commit -m "Add should-cost vs quote comparison matrix"
```

---

### Task 9: Gap waterfall chart (client)

**Files:**
- Create: `components/quotes/gap-waterfall.tsx`

**Interfaces:**
- Consumes: `waterfallData`, `WaterfallBar` (Task 2); `Comparison` (Task 1); `ChartContainer` (`components/models/charts/chart-container.tsx`); Recharts; `formatCurrency`; `Currency`.
- Produces: `function GapWaterfall(props: { comparison: Comparison; currency: Currency }): JSX.Element`.

> Mirror `components/models/charts/tornado-chart.tsx`: a `"use client"` component wrapping a Recharts `BarChart` inside `ChartContainer`, `h-40 w-full` `ResponsiveContainer`, accent fill `#0b3c5d`. Implement the waterfall as a stacked bar with a transparent base offset so each bar floats between `cumulative - delta` and `cumulative`.

- [ ] **Step 1: Write the implementation**

```tsx
// components/quotes/gap-waterfall.tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer } from "recharts";
import { ChartContainer } from "@/components/models/charts/chart-container";
import { waterfallData } from "@/lib/model/waterfall";
import { formatCurrency } from "@/lib/format";
import type { Comparison } from "@/lib/model/comparison";
import type { Currency } from "@/components/number/currency-select";

const FILL: Record<string, string> = {
  base: "#0b3c5d",
  increase: "#b45309", // amber: quote above should-cost
  decrease: "#15803d", // green: favorable
  total: "#0b3c5d",
};

export function GapWaterfall({ comparison, currency }: { comparison: Comparison; currency: Currency }) {
  const bars = waterfallData(comparison);
  // Floating-bar encoding: `offset` (transparent) lifts each bar to its start; `span` is the visible magnitude.
  const data = bars.map((b) => {
    const start = b.kind === "base" || b.kind === "total" ? 0 : b.cumulative - b.delta;
    const end = b.kind === "base" || b.kind === "total" ? b.cumulative : b.cumulative;
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    return { label: b.label, offset: low, span: high - low, kind: b.kind, value: b.delta / 100 };
  });

  return (
    <ChartContainer title="Gap waterfall" data={data}>
      <div className="h-40 w-full">
        <ResponsiveContainer>
          <BarChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={48} />
            <YAxis hide />
            <Bar dataKey="offset" stackId="w" fill="transparent" />
            <Bar dataKey="span" stackId="w" radius={2}>
              {data.map((d, i) => (
                <Cell key={i} fill={FILL[d.kind] ?? "#0b3c5d"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs">
        {bars.map((b) => (
          <li key={b.label} className="flex justify-between">
            <span>{b.label}</span>
            <span className="num text-muted-foreground">{formatCurrency(b.delta, currency)}</span>
          </li>
        ))}
      </ul>
    </ChartContainer>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/quotes/gap-waterfall.tsx
git commit -m "Add gap waterfall chart"
```

---

### Task 10: Insight cards (client)

**Files:**
- Create: `components/quotes/insight-cards.tsx`

**Interfaces:**
- Consumes: `evaluateInsights`, `InsightCard` (Task 3); `Comparison` (Task 1); `Currency`.
- Produces: `function InsightCards(props: { comparison: Comparison; currency: Currency }): JSX.Element`.

- [ ] **Step 1: Write the implementation**

```tsx
// components/quotes/insight-cards.tsx
"use client";

import { evaluateInsights, type InsightCard } from "@/lib/model/insights";
import type { Comparison } from "@/lib/model/comparison";
import type { Currency } from "@/components/number/currency-select";
import { cn } from "@/lib/utils";

const TONE: Record<InsightCard["severity"], string> = {
  lever: "border-amber/40 bg-amber/5",
  concede: "border-favor/40 bg-favor/5",
  info: "border-hairline bg-card",
};
const LABEL: Record<InsightCard["severity"], string> = {
  lever: "Lever",
  concede: "Concede",
  info: "Info",
};

export function InsightCards({ comparison, currency }: { comparison: Comparison; currency: Currency }) {
  const cards = evaluateInsights(comparison, currency);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {cards.map((card) => (
        <div key={card.id} className={cn("rounded-md border p-3", TONE[card.severity])}>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {LABEL[card.severity]}
            </span>
          </div>
          <h4 className="text-sm font-medium">{card.title}</h4>
          <p className="mt-1 text-xs text-muted-foreground">{card.detail}</p>
        </div>
      ))}
    </div>
  );
}
```

> If `text-favor` / `text-amber` / `border-amber` etc. are not defined utility classes, confirm against `components/number/delta-pill.tsx` (which already uses `text-favor` and `text-amber`) — those tokens exist. If `border-amber/40`/`bg-amber/5` opacity variants don't resolve, fall back to `border-hairline` for all three tones and keep the `LABEL` chip as the differentiator.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/quotes/insight-cards.tsx
git commit -m "Add negotiation insight cards"
```

---

### Task 11: Quote list + compare view shell (client)

**Files:**
- Create: `components/quotes/quote-list.tsx`
- Create: `components/quotes/compare-view.tsx`

**Interfaces:**
- Consumes: everything above — `QuoteForm` (7), `ComparisonMatrix` (8), `GapWaterfall` (9), `InsightCards` (10), `buildComparison` (1); `deleteQuoteAction` (5); `QuoteWithLines` (4); `CostNodeRow`, `Rollup` (types); `rollupLive` + `buildTree`; `EmptyState`, `PageHeader`, `Dialog*`, `Button`; `useRouter` from `next/navigation`.
- Produces:
  - `function QuoteList(props: { quotes: QuoteWithLines[]; activeId: string | null; onSelect: (id: string) => void; onEdit: (q: QuoteWithLines) => void; onDeleted: () => void }): JSX.Element`
  - `function CompareView(props: { modelId: string; modelName: string; currency: Currency; nodes: CostNodeRow[]; quotes: QuoteWithLines[] }): JSX.Element` — owns active-quote state, computes `rollup = rollupLive(buildTree(nodes))` once, calls `buildComparison`, renders matrix + waterfall + insight cards; hosts the add/edit `QuoteForm` in a `Dialog`; empty state when no quotes.

- [ ] **Step 1: Write `quote-list.tsx`**

```tsx
// components/quotes/quote-list.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { deleteQuoteAction } from "@/lib/actions/quotes";
import type { QuoteWithLines } from "@/lib/db/quotes";
import type { Currency } from "@/components/number/currency-select";
import { cn } from "@/lib/utils";

export function QuoteList({
  quotes,
  activeId,
  currency,
  onSelect,
  onEdit,
  onDeleted,
}: {
  quotes: QuoteWithLines[];
  activeId: string | null;
  currency: Currency;
  onSelect: (id: string) => void;
  onEdit: (q: QuoteWithLines) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  async function remove(id: string) {
    setBusy(id);
    try {
      await deleteQuoteAction({ quoteId: id });
      onDeleted();
    } finally {
      setBusy(null);
    }
  }
  return (
    <ul className="space-y-2">
      {quotes.map((q) => (
        <li
          key={q.id}
          className={cn(
            "flex items-center justify-between rounded-md border px-3 py-2",
            q.id === activeId ? "border-foreground/30 bg-card" : "border-hairline",
          )}
        >
          <button className="text-left" onClick={() => onSelect(q.id)}>
            <div className="text-sm font-medium">{q.supplier_name}</div>
            <div className="num text-xs text-muted-foreground">
              {formatCurrency(q.quoted_total, (q.currency as Currency) ?? currency)}
              {q.lines.length > 0 && ` · ${q.lines.length} lines`}
            </div>
          </button>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={() => onEdit(q)}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" disabled={busy === q.id} onClick={() => remove(q.id)}>
              Delete
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Write `compare-view.tsx`**

```tsx
// components/quotes/compare-view.tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { QuoteList } from "@/components/quotes/quote-list";
import { QuoteForm } from "@/components/quotes/quote-form";
import { ComparisonMatrix } from "@/components/quotes/comparison-matrix";
import { GapWaterfall } from "@/components/quotes/gap-waterfall";
import { InsightCards } from "@/components/quotes/insight-cards";
import { buildComparison } from "@/lib/model/comparison";
import { rollupLive } from "@/lib/model/rollup-live";
import { buildTree } from "@/lib/model/tree";
import type { CostNodeRow } from "@/lib/model/types";
import type { QuoteWithLines } from "@/lib/db/quotes";
import type { Currency } from "@/components/number/currency-select";

export function CompareView({
  modelId,
  modelName,
  currency,
  nodes,
  quotes,
}: {
  modelId: string;
  modelName: string;
  currency: Currency;
  nodes: CostNodeRow[];
  quotes: QuoteWithLines[];
}) {
  const router = useRouter();
  const [activeId, setActiveId] = useState<string | null>(quotes[0]?.id ?? null);
  const [editing, setEditing] = useState<QuoteWithLines | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const rollup = useMemo(() => rollupLive(buildTree(nodes)), [nodes]);
  const leafLines = useMemo(
    () => buildComparison(nodes, rollup, { quoted_total: 0, lines: [] }).rows.map((r) => ({ id: r.nodeId, name: r.name })),
    [nodes, rollup],
  );
  const active = quotes.find((q) => q.id === activeId) ?? null;
  const comparison = active ? buildComparison(nodes, rollup, active) : null;

  function refresh() {
    setOpen(false);
    setEditing(undefined);
    router.refresh();
  }

  const addButton = (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(undefined); }}>
      <DialogTrigger asChild>
        <Button onClick={() => setEditing(undefined)}>Add quote</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit quote" : "Add supplier quote"}</DialogTitle>
        </DialogHeader>
        <QuoteForm
          modelId={modelId}
          currency={currency}
          leafLines={leafLines}
          initial={editing}
          onSaved={refresh}
        />
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      <PageHeader title={modelName} subtitle="Quotes &amp; comparison" actions={addButton} />

      {quotes.length === 0 ? (
        <EmptyState
          title="No quotes yet"
          steps={[
            "Add your first supplier quote (total, or line-by-line)",
            "See it compared against your should-cost, line by line",
            "Use the gap waterfall and insight cards to prepare the negotiation",
          ]}
          cta={addButton}
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <QuoteList
            quotes={quotes}
            activeId={activeId}
            currency={currency}
            onSelect={setActiveId}
            onEdit={(q) => { setEditing(q); setOpen(true); }}
            onDeleted={refresh}
          />
          {comparison && (
            <div className="space-y-6">
              <ComparisonMatrix comparison={comparison} currency={currency} />
              <div className="grid gap-4 lg:grid-cols-2">
                <GapWaterfall comparison={comparison} currency={currency} />
                <InsightCards comparison={comparison} currency={currency} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm typecheck && pnpm lint`
Expected: no errors. (If `Dialog*` subcomponent names differ, open `components/ui/dialog.tsx` and match the exported names.)

- [ ] **Step 4: Commit**

```bash
git add components/quotes/quote-list.tsx components/quotes/compare-view.tsx
git commit -m "Add quote list and compare view shell"
```

---

### Task 12: Compare route + editor link

**Files:**
- Create: `app/(app)/models/[id]/compare/page.tsx`
- Modify: `components/models/model-editor.tsx` (add a "Compare" link in the header actions)

**Interfaces:**
- Consumes: `loadModel` (`lib/db/models.ts`), `loadNodes` (`lib/db/nodes.ts`), `loadQuotes` (Task 4); `CompareView` (Task 11); `notFound` (`next/navigation`); `Link` (`next/link`).
- Produces: the `/models/[id]/compare` server route; a header link on the editor page.

- [ ] **Step 1: Write the server page** (mirror `app/(app)/models/[id]/page.tsx`)

```tsx
// app/(app)/models/[id]/compare/page.tsx
import { notFound } from "next/navigation";
import { loadModel } from "@/lib/db/models";
import { loadNodes } from "@/lib/db/nodes";
import { loadQuotes } from "@/lib/db/quotes";
import { CompareView } from "@/components/quotes/compare-view";
import type { Currency } from "@/components/number/currency-select";

export default async function ComparePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await loadModel(id);
  if (!model) notFound();
  const [nodes, quotes] = await Promise.all([loadNodes(id), loadQuotes(id)]);
  return (
    <CompareView
      modelId={model.id}
      modelName={model.name}
      currency={model.currency as Currency}
      nodes={nodes}
      quotes={quotes}
    />
  );
}
```

- [ ] **Step 2: Add the "Compare" link to the editor header**

In `components/models/model-editor.tsx`, add the import at the top:

```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
```

Then change the `actions` block of the `PageHeader` (currently the `<div className="flex items-center gap-4">…</div>`) to include the link before the should-cost readout:

```tsx
        actions={
          <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="sm">
              <Link href={`/models/${model.id}/compare`}>Compare quotes</Link>
            </Button>
            <div className="text-right">
              <div className="text-[10px] tracking-wide text-muted-foreground uppercase">
                Should-cost ({model.currency})
              </div>
              <div className="num text-2xl font-semibold">
                <AnimatedCounter valueMinor={total} />
              </div>
            </div>
            <SavedIndicator status={status} />
          </div>
        }
```

- [ ] **Step 3: Typecheck, lint, build**

Run: `pnpm typecheck && pnpm lint && pnpm build`
Expected: all green; the build lists `/models/[id]/compare` as a route. (`Button asChild` requires the Radix `Slot`-based Button variant already used across the app — if `asChild` is unsupported, wrap the `Link` without `asChild` and apply `className={buttonVariants({ variant: "outline", size: "sm" })}` instead; check `components/ui/button.tsx`.)

- [ ] **Step 4: Run the full unit suite (no regressions)**

Run: `pnpm test`
Expected: all prior tests plus the new Phase 2 unit tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/models/[id]/compare/page.tsx components/models/model-editor.tsx
git commit -m "Add compare route and editor link"
```

---

### Task 13: End-to-end happy path

**Files:**
- Create: `tests/e2e/compare.spec.ts`

**Interfaces:**
- Consumes: the running app + a seeded, authenticated session (same harness as `tests/e2e/editor.spec.ts`).

> Read `tests/e2e/editor.spec.ts` first and reuse its auth/setup helper (login/session bootstrap and how it navigates to a model). This e2e is env-gated exactly like the existing specs — it requires the seeded Supabase session and will be skipped/red without it (documented in project memory). Match the existing spec's setup precisely rather than inventing a new login flow.

- [ ] **Step 1: Write the e2e test** (adapt selectors/URLs to what `editor.spec.ts` establishes — the model id/route it already uses)

```typescript
// tests/e2e/compare.spec.ts
import { test, expect } from "@playwright/test";

// NOTE: reuse the auth/model-navigation setup from tests/e2e/editor.spec.ts.
// Replace MODEL_URL below with the same seeded model route that spec uses.
const MODEL_URL = "/models/REPLACE_WITH_SEEDED_MODEL_ID";

test("add a supplier quote and see the comparison", async ({ page }) => {
  await page.goto(`${MODEL_URL}/compare`);

  await page.getByRole("button", { name: /add quote/i }).first().click();
  await page.getByLabel(/supplier/i).fill("Acme Drilling");
  await page.getByLabel(/total/i).fill("1800.00");
  await page.getByRole("button", { name: /save quote/i }).click();

  // Comparison surfaces the supplier and a total row.
  await expect(page.getByText("Acme Drilling")).toBeVisible();
  await expect(page.getByText(/total/i)).toBeVisible();
});
```

- [ ] **Step 2: Run the e2e (if the seeded session is available)**

Run: `pnpm test:e2e tests/e2e/compare.spec.ts`
Expected: PASS with a seeded session; if the environment has no seeded session, confirm it fails only on auth/setup (same as the existing e2e), not on missing routes/selectors.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/compare.spec.ts
git commit -m "Add compare e2e happy path"
```

---

## Phase 2 Definition of Done (verify before declaring complete)

Run and confirm each:

- [ ] `pnpm test` — all unit/component tests green (comparison, waterfall, insights, quote-actions, quote-form, comparison-matrix + all Phase 0/1 tests).
- [ ] `pnpm typecheck` — zero errors, zero `any`.
- [ ] `pnpm lint` — clean.
- [ ] `pnpm build` — succeeds; `/models/[id]/compare` present in the route list.
- [ ] Manual (or e2e) walkthrough: add a total-only quote → headline gap shows; add a line-mapped quote → matrix rows + waterfall + insight cards populate; edit and delete work; empty state shows before the first quote.
- [ ] Money is integer minor units throughout; gaps and percentages correct on a hand-checked example.
- [ ] Renders at 375 / 768 / 1440; numbers use the `num` (tabular) class; no placeholder metrics.

---

## Self-Review (completed against the spec)

**Spec coverage:**
- §1 quote entry (add/edit/delete, total or line-level) → Tasks 4, 5, 7, 11. ✓
- §1/§5.1 comparison matrix (should-cost vs quote per line + total, gap %) → Tasks 1, 8. ✓
- §1/§5.2 gap waterfall (Recharts, top-N + Other, inside ChartContainer) → Tasks 2, 9. ✓
- §1/§5.3 insight cards (headline, levers, concede, implied margin) → Tasks 3, 10. ✓
- §4 file structure → all files created under the specced paths (`lib/model/*`, `lib/db/quotes.ts`, `lib/actions/quotes.ts`, `components/quotes/*`, `app/(app)/models/[id]/compare/page.tsx`, `supabase/migrations/0006_*`). ✓ (Spec listed `quote-line-editor.tsx` separately; folded into `quote-form.tsx` as an inline collapsible section — same capability, one fewer file. Noted deviation.)
- §5.4 persistence under RLS → Tasks 4, 5 (existing `q_all`/`ql_all` policies; no new policy needed). ✓
- §6 data flow (compare page loads nodes + quotes → buildComparison → renders) → Tasks 11, 12. ✓
- §7 uses existing tables, optional 0006 indexes → Task 6. ✓
- §8 DoD (tests, TS strict, Zod, integer money, responsive, empty states) → DoD checklist + per-task steps. ✓
- §3 no new runtime deps → confirmed (RHF, Zod, Recharts, Supabase all present). ✓

**Deviations from spec (intentional, all safe):**
1. `quote-line-editor.tsx` folded into `quote-form.tsx` (collapsible line grid) — reduces surface, same behavior.
2. `evaluateInsights` takes `currency` instead of `nodes` — makes `detail` display-ready and reads margin from comparison rows; the `nodes` arg was unused for the specced rules.
3. Baseline = model's **live rollup** only (spec's default). The optional saved-version selector (spec §2/§9 "included but confirm UX") is **deferred** — not in this plan; live rollup is the confirmed default and adding a version selector is a clean follow-up. If required, it slots into `CompareView` as a prop passing a chosen `model_version.snapshot_json` through `rollupLive`.

**Placeholder scan:** none — every code step is complete.

**Type consistency:** `Comparison`/`CompRow` (Task 1) consumed unchanged by Tasks 2, 3, 8, 9, 10, 11; `QuoteWithLines` (Task 4) structurally satisfies `QuoteInput` (Task 1) and is consumed by Tasks 7, 11, 12; `WaterfallBar` (Task 2) and `InsightCard` (Task 3) used only by their render components. Function names (`buildComparison`, `waterfallData`, `evaluateInsights`, `saveQuote`/`saveQuoteAction`, `deleteQuote`/`deleteQuoteAction`, `loadQuotes`) are consistent across producer and consumer tasks.
