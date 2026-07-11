# AI Should-Cost Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add a Claude-powered assistant to the should-cost app across three touchpoints — explain a quote gap, suggest a node's driver/rate, and draft a model from a description — with every AI value a labelled draft for review.

**Architecture:** Shared server-only AI backend (`lib/ai/*`) guarded on `ANTHROPIC_API_KEY`; three `/api/ai/*` route handlers; three client components. Pure logic (rate-limit, schema validation) is unit-tested. Deployable inert (features hidden) until the key is set.

**Tech Stack:** Next.js 14 App Router, `@anthropic-ai/sdk`, Claude Opus 4.8, zod, Vitest.

## Global Constraints

- TypeScript strict, zero `any`. Server-only AI code (`import "server-only"` in `lib/ai/client.ts`); key never in a client bundle.
- Default model `claude-opus-4-8`; overridable via `SHOULDCOST_AI_MODEL`. `new Anthropic()` auto-resolves `ANTHROPIC_API_KEY`.
- Every AI surface shows "AI-generated estimate — verify before use". AI never writes committed numbers without user accept.
- No DB migration, no other new required env vars. Build with `NEXT_TELEMETRY_DISABLED=1`; vitest with `--pool=threads`.
- Keep the suite green.

---

### Task 1: Shared AI backend (deps, client guard, rate-limit)

**Files:**
- Modify: `package.json` (add `@anthropic-ai/sdk`)
- Create: `lib/ai/client.ts`
- Create: `lib/ai/rate-limit.ts`
- Create: `tests/unit/ai-rate-limit.test.ts`

**Interfaces:**
- Produces: `isAiEnabled(): boolean`, `getAnthropic(): Anthropic` (throws if no key), `AI_MODEL: string`.
- Produces: `checkRateLimit(state, orgId, now): { allowed: boolean; retryAfterMs: number }` where
  `state` is a `Map<string, number[]>` of recent call timestamps.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/ai-rate-limit.test.ts
import { describe, expect, it } from "vitest";
import { checkRateLimit, RATE_LIMIT } from "@/lib/ai/rate-limit";

describe("checkRateLimit", () => {
  it("allows up to the limit then denies within the window", () => {
    const state = new Map<string, number[]>();
    const now = 1_000_000;
    for (let i = 0; i < RATE_LIMIT.max; i++) {
      expect(checkRateLimit(state, "org1", now).allowed).toBe(true);
    }
    const denied = checkRateLimit(state, "org1", now);
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);
  });

  it("forgets calls older than the window", () => {
    const state = new Map<string, number[]>();
    checkRateLimit(state, "org1", 0);
    expect(checkRateLimit(state, "org1", RATE_LIMIT.windowMs + 1).allowed).toBe(true);
  });

  it("scopes per org", () => {
    const state = new Map<string, number[]>();
    for (let i = 0; i < RATE_LIMIT.max; i++) checkRateLimit(state, "a", 0);
    expect(checkRateLimit(state, "b", 0).allowed).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/ai-rate-limit.test.ts --pool=threads` → FAIL (module missing).

- [ ] **Step 3: Implement the rate limiter**

```ts
// lib/ai/rate-limit.ts
export const RATE_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 } as const;

/** Sliding-window per-org limiter. `state` is caller-owned (module singleton in the route). */
export function checkRateLimit(
  state: Map<string, number[]>,
  orgId: string,
  now: number,
): { allowed: boolean; retryAfterMs: number } {
  const cutoff = now - RATE_LIMIT.windowMs;
  const hits = (state.get(orgId) ?? []).filter((t) => t > cutoff);
  if (hits.length >= RATE_LIMIT.max) {
    const retryAfterMs = hits[0] + RATE_LIMIT.windowMs - now;
    state.set(orgId, hits);
    return { allowed: false, retryAfterMs };
  }
  hits.push(now);
  state.set(orgId, hits);
  return { allowed: true, retryAfterMs: 0 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/ai-rate-limit.test.ts --pool=threads` → PASS (3).

- [ ] **Step 5: Add the SDK and the client factory**

Run: `pnpm add @anthropic-ai/sdk`. Create:

```ts
// lib/ai/client.ts
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export const AI_MODEL = process.env.SHOULDCOST_AI_MODEL ?? "claude-opus-4-8";

/** True when an Anthropic key is configured. UI/routes use this to stay inert without a key. */
export function isAiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

let client: Anthropic | null = null;
export function getAnthropic(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("AI is not configured (ANTHROPIC_API_KEY missing).");
  }
  client ??= new Anthropic();
  return client;
}
```

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml lib/ai tests/unit/ai-rate-limit.test.ts
git commit -m "Add shared AI backend: client guard + per-org rate limiter"
```

---

### Task 2: Slice C — Explain the gap (route + UI)

**Files:**
- Create: `app/api/ai/explain-gap/route.ts`
- Create: `components/ai/explain-gap-panel.tsx`
- Modify: `components/quotes/compare-view.tsx` (mount the panel when a quote is active)

**Interfaces:**
- Consumes: `getAnthropic`, `AI_MODEL`, `isAiEnabled` (Task 1), `checkRateLimit` (Task 1).
- Consumes existing: `buildComparison`, `waterfallData`/`evaluateInsights` shapes already used in `compare-view.tsx`.
- Produces: `POST /api/ai/explain-gap` — body `{ modelId, quoteId }`, streams `text/plain`.

- [ ] **Step 1: Implement the route (streamed)**

```ts
// app/api/ai/explain-gap/route.ts
import { NextResponse } from "next/server";
import { getCurrentOrg } from "@/lib/db/orgs";
import { loadModel } from "@/lib/db/models";
import { loadNodes } from "@/lib/db/nodes";
import { loadQuotes } from "@/lib/db/quotes";
import { buildTree } from "@/lib/model/tree";
import { rollupLive } from "@/lib/model/rollup-live";
import { buildComparison } from "@/lib/model/comparison";
import { fromMinor } from "@/lib/money";
import { getAnthropic, AI_MODEL, isAiEnabled } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/rate-limit";

export const runtime = "nodejs";
const rl = new Map<string, number[]>();

export async function POST(req: Request) {
  if (!isAiEnabled()) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const gate = checkRateLimit(rl, org.org_id, Date.now());
  if (!gate.allowed) return NextResponse.json({ error: "Rate limit" }, { status: 429 });

  const { modelId, quoteId } = (await req.json()) as { modelId?: string; quoteId?: string };
  if (!modelId || !quoteId) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const model = await loadModel(modelId);
  if (!model) return NextResponse.json({ error: "Not found" }, { status: 404 }); // RLS-null → cross-org
  const [nodes, quotes] = await Promise.all([loadNodes(modelId), loadQuotes(modelId)]);
  const quote = quotes.find((q) => q.id === quoteId);
  if (!quote) return NextResponse.json({ error: "Quote not found" }, { status: 404 });

  const rollup = rollupLive(buildTree(nodes));
  const comparison = buildComparison(nodes, rollup, quote);
  const cur = model.currency;
  const lines = comparison.rows
    .map((r) => `${r.name}: should-cost ${fromMinor(r.shouldCost, cur)}, quoted ${fromMinor(r.quoted, cur)}`)
    .join("\n");

  const anthropic = getAnthropic();
  const stream = anthropic.messages.stream({
    model: AI_MODEL,
    max_tokens: 1200,
    system:
      "You are a procurement should-cost analyst. Given a should-cost baseline and a supplier quote, " +
      "explain in 4-6 sentences where the quote is high or low vs should-cost, the likely reasons, and " +
      "concrete negotiation levers. Be specific and grounded in the numbers. These are estimates for the " +
      "user to verify — do not present them as certified figures.",
    messages: [
      {
        role: "user",
        content: `Currency ${cur}. Supplier: ${quote.supplier_name}.\nLine comparison:\n${lines}`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      stream.on("text", (t) => controller.enqueue(encoder.encode(t)));
      await stream.finalMessage().catch(() => {});
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
```

> Verify field names against `components/quotes/compare-view.tsx` + `lib/model/comparison.ts` when implementing (`comparison.rows[].shouldCost/quoted/name`, `model.currency`, `quote.supplier_name`); adjust to the actual shapes.

- [ ] **Step 2: Implement the panel**

```tsx
// components/ai/explain-gap-panel.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/ui/surface";

export function ExplainGapPanel({ modelId, quoteId }: { modelId: string; quoteId: string }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setText("");
    try {
      const res = await fetch("/api/ai/explain-gap", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modelId, quoteId }),
      });
      if (!res.ok || !res.body) {
        setError(res.status === 503 ? "AI isn’t enabled yet." : "Couldn’t generate an explanation.");
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setText((t) => t + dec.decode(value, { stream: true }));
      }
    } catch {
      setError("Couldn’t generate an explanation.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Surface padding="lg" radius="lg" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">AI gap analysis</div>
        <Button size="sm" variant="outline" onClick={run} disabled={loading}>
          {loading ? "Analysing…" : "Explain with AI"}
        </Button>
      </div>
      {text && <p className="text-sm whitespace-pre-wrap">{text}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
      {text && (
        <p className="text-xs text-muted-foreground">AI-generated estimate — verify before use.</p>
      )}
    </Surface>
  );
}
```

- [ ] **Step 3: Mount in compare-view**

In `components/quotes/compare-view.tsx`, when `active` (the selected quote) is set, render `<ExplainGapPanel modelId={modelId} quoteId={active.id} />` in the comparison column (near `InsightCards`). Import it at top.

- [ ] **Step 4: Gate green**

Run: `npx tsc --noEmit` → 0; `NEXT_TELEMETRY_DISABLED=1 npx next lint` → clean; `npx vitest run --pool=threads` → all pass; `NEXT_TELEMETRY_DISABLED=1 npx next build` → clean (new route `/api/ai/explain-gap`).

- [ ] **Step 5: Commit**

```bash
git add app/api/ai components/ai/explain-gap-panel.tsx components/quotes/compare-view.tsx
git commit -m "Add AI gap explainer on the compare view (slice C)"
```

---

### Task 3: Slice B — Suggest driver/rate for a node

**Files:**
- Create: `lib/ai/schemas.ts` (add `NodeSuggestionSchema`)
- Create: `tests/unit/ai-schemas.test.ts`
- Create: `app/api/ai/suggest-node/route.ts`
- Create: `components/ai/suggest-node.tsx`
- Modify: the node editor to mount the suggest control (confirm exact file when implementing — the CBS grid under `components/models/`)

**Interfaces:**
- Produces: `NodeSuggestionSchema` (zod) = `{ driver: string, unit: string, rate_low: number, rate_high: number, rationale: string }`.
- Produces: `POST /api/ai/suggest-node` — body `{ modelId, nodeName, parentName?, currency }` → validated `NodeSuggestion` JSON.

- [ ] **Step 1: Write the failing schema test**

```ts
// tests/unit/ai-schemas.test.ts
import { describe, expect, it } from "vitest";
import { NodeSuggestionSchema } from "@/lib/ai/schemas";

describe("NodeSuggestionSchema", () => {
  it("accepts a well-formed suggestion", () => {
    const ok = NodeSuggestionSchema.safeParse({
      driver: "machining hours", unit: "hr", rate_low: 40, rate_high: 80, rationale: "shop rate",
    });
    expect(ok.success).toBe(true);
  });
  it("rejects a malformed suggestion", () => {
    expect(NodeSuggestionSchema.safeParse({ driver: "x" }).success).toBe(false);
    expect(NodeSuggestionSchema.safeParse({ driver: "x", unit: "hr", rate_low: "a", rate_high: 1, rationale: "" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `npx vitest run tests/unit/ai-schemas.test.ts --pool=threads` → FAIL.

- [ ] **Step 3: Implement the schema**

```ts
// lib/ai/schemas.ts
import { z } from "zod";

export const NodeSuggestionSchema = z.object({
  driver: z.string().min(1),
  unit: z.string().min(1),
  rate_low: z.number(),
  rate_high: z.number(),
  rationale: z.string().min(1),
});
export type NodeSuggestion = z.infer<typeof NodeSuggestionSchema>;
```

- [ ] **Step 4: Run to pass**

Run: `npx vitest run tests/unit/ai-schemas.test.ts --pool=threads` → PASS (2).

- [ ] **Step 5: Implement the route (structured output)**

```ts
// app/api/ai/suggest-node/route.ts
import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getCurrentOrg } from "@/lib/db/orgs";
import { getAnthropic, AI_MODEL, isAiEnabled } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { NodeSuggestionSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";
const rl = new Map<string, number[]>();

export async function POST(req: Request) {
  if (!isAiEnabled()) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRateLimit(rl, org.org_id, Date.now()).allowed)
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });

  const { nodeName, parentName, currency } = (await req.json()) as {
    nodeName?: string; parentName?: string; currency?: string;
  };
  if (!nodeName || !currency) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const res = await getAnthropic().messages.parse({
    model: AI_MODEL,
    max_tokens: 600,
    system:
      "You are a should-cost estimator. For the given cost line, propose the most likely cost driver, " +
      "its unit, and a realistic rate range (low/high) in the given currency, with a one-line rationale. " +
      "Values are approximate estimates for the user to verify.",
    messages: [
      { role: "user", content: `Currency ${currency}. Cost line: "${nodeName}"${parentName ? ` (under "${parentName}")` : ""}.` },
    ],
    output_config: { format: zodOutputFormat(NodeSuggestionSchema) },
  });
  if (!res.parsed_output) return NextResponse.json({ error: "No suggestion" }, { status: 502 });
  return NextResponse.json(res.parsed_output);
}
```

- [ ] **Step 6: Implement the client control**

```tsx
// components/ai/suggest-node.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { NodeSuggestion } from "@/lib/ai/schemas";

export function SuggestNode({
  modelId, nodeName, parentName, currency, onApply,
}: {
  modelId: string; nodeName: string; parentName?: string; currency: string;
  onApply: (s: NodeSuggestion) => void;
}) {
  const [s, setS] = useState<NodeSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/suggest-node", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ modelId, nodeName, parentName, currency }),
      });
      if (!res.ok) {
        setError(res.status === 503 ? "AI isn’t enabled yet." : "No suggestion available.");
        return;
      }
      setS((await res.json()) as NodeSuggestion);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button size="sm" variant="ghost" onClick={run} disabled={loading}>
        {loading ? "Thinking…" : "Suggest with AI"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
      {s && (
        <div className="rounded-md border border-hairline p-2 text-xs">
          <div><span className="font-medium">{s.driver}</span> · {s.rate_low}–{s.rate_high} {currency}/{s.unit}</div>
          <div className="text-muted-foreground">{s.rationale}</div>
          <div className="mt-1 flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onApply(s)}>Apply</Button>
            <span className="text-muted-foreground">AI estimate — verify.</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Wire into the node editor**

Locate the node-edit surface in the CBS grid (grep `components/models` for the row/detail editor). Mount `<SuggestNode modelId={...} nodeName={node.name} parentName={parent?.name} currency={currency} onApply={(s) => /* set driver/unit/rate fields */} />`. Keep it additive; nothing changes until Apply.

- [ ] **Step 8: Gate + commit**

Run the full green gate (tsc, lint, vitest, build). Then:

```bash
git add lib/ai/schemas.ts tests/unit/ai-schemas.test.ts app/api/ai/suggest-node components/ai/suggest-node.tsx components/models
git commit -m "Add AI node driver/rate suggestion (slice B)"
```

---

### Task 4: Slice A — Draft a model from a description

**Files:**
- Modify: `lib/ai/schemas.ts` (add `ModelDraftSchema`)
- Modify: `tests/unit/ai-schemas.test.ts` (add draft cases)
- Create: `app/api/ai/draft-model/route.ts`
- Create: `components/ai/draft-model.tsx`
- Modify: the project/new-model surface to mount "Draft with AI" (confirm file when implementing — `app/(app)/projects/[id]/page.tsx` / template picker)

**Interfaces:**
- Produces: `ModelDraftSchema` = `{ name: string, nodes: { name, category, driver, quantity, unit, rate_minor, note }[] }`.
- Produces: `POST /api/ai/draft-model` — body `{ description, currency }` → validated draft (route returns JSON; creating the model reuses the existing model/node insert path, so the client posts then calls the existing create action, OR the route creates and returns `{ modelId }`). Decide at implementation: prefer route returns the validated draft, client hands it to the existing model-create action to keep one insert path.

- [ ] **Step 1: Extend the schema test (failing)**

```ts
// add to tests/unit/ai-schemas.test.ts
import { ModelDraftSchema } from "@/lib/ai/schemas";
it("accepts a well-formed model draft", () => {
  const ok = ModelDraftSchema.safeParse({
    name: "Valve body", nodes: [
      { name: "Steel", category: "material", driver: "kg", quantity: 12, unit: "kg", rate_minor: 300, note: "bar stock" },
    ],
  });
  expect(ok.success).toBe(true);
});
it("rejects a draft with no nodes", () => {
  expect(ModelDraftSchema.safeParse({ name: "x", nodes: [] }).success).toBe(false);
});
```

- [ ] **Step 2: Run to fail**, then implement:

```ts
// add to lib/ai/schemas.ts
export const ModelDraftNodeSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  driver: z.string().min(1),
  quantity: z.number(),
  unit: z.string().min(1),
  rate_minor: z.number().int(),
  note: z.string(),
});
export const ModelDraftSchema = z.object({
  name: z.string().min(1),
  nodes: z.array(ModelDraftNodeSchema).min(1),
});
export type ModelDraft = z.infer<typeof ModelDraftSchema>;
```

- [ ] **Step 3: Run to pass** (`npx vitest run tests/unit/ai-schemas.test.ts --pool=threads`).

- [ ] **Step 4: Implement the route (structured output + adaptive thinking)**

```ts
// app/api/ai/draft-model/route.ts
import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { getCurrentOrg } from "@/lib/db/orgs";
import { getAnthropic, AI_MODEL, isAiEnabled } from "@/lib/ai/client";
import { checkRateLimit } from "@/lib/ai/rate-limit";
import { ModelDraftSchema } from "@/lib/ai/schemas";

export const runtime = "nodejs";
const rl = new Map<string, number[]>();

export async function POST(req: Request) {
  if (!isAiEnabled()) return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  const org = await getCurrentOrg();
  if (!org) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!checkRateLimit(rl, org.org_id, Date.now()).allowed)
    return NextResponse.json({ error: "Rate limit" }, { status: 429 });

  const { description, currency } = (await req.json()) as { description?: string; currency?: string };
  if (!description || !currency) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  const res = await getAnthropic().messages.parse({
    model: AI_MODEL,
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    system:
      "You are a should-cost estimator. From a plain-language part/service description, draft a cost " +
      "breakdown (material, process/machining, labour, overhead, margin) as structured nodes with a driver, " +
      "quantity, unit, and approximate rate in integer minor units of the given currency. Values are " +
      "approximate estimates for the user to refine — do not imply certified precision.",
    messages: [{ role: "user", content: `Currency ${currency}. Describe: ${description}` }],
    output_config: { format: zodOutputFormat(ModelDraftSchema) },
  });
  if (!res.parsed_output) return NextResponse.json({ error: "No draft" }, { status: 502 });
  return NextResponse.json(res.parsed_output);
}
```

- [ ] **Step 5: Implement the client + wire to model create**

`components/ai/draft-model.tsx`: a textarea + "Draft with AI" button that POSTs to `/api/ai/draft-model`, then passes the validated draft to the existing model-create path (reuse `lib/actions/model.ts` create + node insert; map `rate_minor`/`quantity` to the node fields), marks values as AI estimates, and routes to the new model editor. Confirm the exact create signature when implementing; do not invent a new insert path.

- [ ] **Step 6: Mount "Draft with AI"** on the project/new-model surface beside the template picker.

- [ ] **Step 7: Gate + commit**

Full green gate, then:

```bash
git add lib/ai/schemas.ts tests/unit/ai-schemas.test.ts app/api/ai/draft-model components/ai/draft-model.tsx "app/(app)/projects" lib/actions/model.ts
git commit -m "Add AI model drafter (slice A)"
```

---

### Task 5: Gate, merge, deploy

- [ ] **Step 1:** Full green gate — `npx tsc --noEmit`, `NEXT_TELEMETRY_DISABLED=1 npx next lint`, `npx vitest run --pool=threads`, `NEXT_TELEMETRY_DISABLED=1 npx next build`.
- [ ] **Step 2:** Merge `phase-ai-assistant` → `phase-0-foundation` (`git merge --no-ff`), push both.
- [ ] **Step 3:** Deploy `vercel --prod --yes`; if the domain doesn't move, `vercel promote <deployment>` (rollback-pin behaviour from prior deploys).
- [ ] **Step 4:** Verify prod healthy (`/`, `/login`, a model compare page). AI stays inert (buttons hidden/return 503) until the key is set.
- [ ] **Step 5:** Report the required user action: add `ANTHROPIC_API_KEY` to Vercel (Prod + Preview) + local `.env.local` to activate the AI features.
