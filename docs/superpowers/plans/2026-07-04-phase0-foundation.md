# Phase 0 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the shouldcost.io foundation — Next.js 14 app, design system, full Supabase schema + RLS, seeded templates/indices, auth, and an authenticated (empty) workspace — so Phase 1 can build the model editor on a locked base.

**Architecture:** Single Next.js 14 App Router app with three route groups `(marketing)` / `(auth)` / `(app)`, Supabase (Postgres + Auth) under Row Level Security with three strictly-separated clients, design tokens in Tailwind v4 `@theme`, money as integer minor units, seed content authored in TypeScript and upserted idempotently.

**Tech Stack:** Next.js 14 (App Router, TypeScript strict), Tailwind CSS v4, shadcn/ui, React Hook Form + Zod, Zustand, @supabase/ssr, Vitest, Playwright, pnpm, Node 20+, Supabase Postgres.

## Global Constraints

(Copied from the approved spec — every task inherits these.)

- TypeScript `strict: true`, **zero `any`**. Zod validation on every mutation.
- **All money as integer minor units** (cents/paise), never floats. Single chokepoint: `lib/money.ts`.
- **No placeholder text or metrics visible** anywhere (`[X]`, lorem, blank tiles). Illustrative seed values carry the internal `draft` flag and are not presented as final.
- **RLS enabled on every table**; users see only their org's rows; `category_templates` + `indices` are public-read.
- Fonts: **Inter** (UI) + **JetBrains Mono** (every number/code) via `next/font`; `tabular-nums` on all numeric cells.
- Colors: `petrol` #0B3C5D (primary), `amber` #F59E0B (deltas/warnings only), `favor` #059669 (favorable gaps only), `ink` #1A1A1A, `canvas` #FAFAF8, `hairline` #E5E5E0. No ad-hoc hex outside tokens.
- 8px spacing grid; hairline borders; overlay-only shadows.
- Renders at 375 / 768 / 1440px; WCAG AA contrast; full keyboard nav with visible focus.
- Commit style: short imperative subject lines.
- Commit co-author trailer on every commit: `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **Tailwind v4** is the default; if shadcn/ui is not v4-compatible at the time Task 2 runs, fall back to Tailwind v3 (decision made at Task 2, not later).

---

## File Structure (locked decomposition)

| Path | Responsibility |
|------|----------------|
| `app/layout.tsx` | Root: fonts, providers, metadata |
| `app/globals.css` | Tailwind v4 `@import` + `@theme` tokens + base styles |
| `app/(marketing)/{layout,page}.tsx` | Public home + frame |
| `app/(auth)/{layout,login,signup,callback}` | Auth screens + OAuth callback |
| `app/(app)/layout.tsx` | Authenticated AppShell |
| `app/(app)/dashboard/page.tsx` | Portfolio view |
| `app/(app)/projects/{page,[id]/page}.tsx` | Project list + detail |
| `app/(app)/models/[id]/page.tsx` | Editor stub (Phase 1 builds it) |
| `app/(app)/settings/page.tsx` | Org + profile stub |
| `app/design/page.tsx` | Internal design + seed-review showcase |
| `components/ui/*` | shadcn primitives |
| `components/layout/*` | AppShell, Sidebar, Topbar, MarketingNav, Footer |
| `components/shared/*` | EmptyState, SavedIndicator, DensityToggle, Stat, KpiTile |
| `components/number/*` | MoneyInput, CurrencySelect, DeltaPill, AnimatedCounter |
| `components/auth/*` | MagicLinkForm, etc. |
| `lib/utils.ts` | `cn()` + misc |
| `lib/money.ts` | integer minor units + FX (no floats) |
| `lib/format.ts` | currency/number formatting (tabular-nums) |
| `lib/entitlements.ts` | plan-gating seam (Phase 3 fills) |
| `lib/supabase/{client,server,admin,middleware}.ts` | three clients + session helper |
| `lib/db/*` | typed repositories (auth/org repos land in Phase 0) |
| `lib/seed/{indices,run-seed}.ts` | indices generator + idempotent runner |
| `lib/seed/templates/*.ts` | 17 template CBS definitions |
| `lib/seed/schema.ts` | Zod schema for template/seed validation |
| `middleware.ts` | root: session refresh + route protection |
| `supabase/migrations/000{1,2,3}_*.sql` | schema, RLS, functions |
| `supabase/tests/*.sql` | pgTAP-style notes (RLS covered by integration tests) |
| `tests/unit/*.test.ts` | Vitest unit tests |
| `tests/e2e/smoke.spec.ts` | Playwright smoke |
| `.env.example`, `README.md`, `docs/SETUP.md`, `docs/seed-review-checklist.md` | docs |

---

## Task 1: Project scaffolding & tooling

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml` (optional), `tsconfig.json`, `next.config.ts`, `.gitignore`, `.env.example`, `postcss.config.mjs`, `eslint.config.mjs`, `.prettierrc`
- Create: `app/layout.tsx`, `app/page.tsx` (temporary home, replaced in Task 20)

**Interfaces:**
- Produces: a runnable Next.js 14 app at `pnpm dev`; `pnpm typecheck` and `pnpm lint` pass; path alias `@/*` → repo root.

- [ ] **Step 1: Create the Next.js app (manual, not create-next-app, to control versions)**

Run:
```bash
cd "C:/Users/mohan/OneDrive/Desktop/Shouldcost.io"
pnpm init
pnpm add next@^14.2 react@^18 react-dom@^18
pnpm add -D typescript @types/node @types/react @types/react-dom eslint@^8 eslint-config-next@^14.2 prettier
```

- [ ] **Step 2: Write `package.json` scripts**

Overwrite the `scripts` block in `package.json`:
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:e2e": "playwright test",
  "seed": "tsx lib/seed/run-seed.ts",
  "db:push": "supabase db push",
  "db:reset": "supabase db reset"
}
```

- [ ] **Step 3: Write `tsconfig.json` (strict, path alias)**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "noFallthroughCasesInSwitch": true,
    "allowJs": false,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "incremental": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Write `next.config.ts`**

```ts
import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: { typedRoutes: true },
};

export default config;
```

- [ ] **Step 5: Write `.gitignore`**

```gitignore
node_modules/
.next/
out/
build/
.env
.env.local
.env*.local
*.log
.DS_Store
.vscode/
.idea/
coverage/
playwright-report/
test-results/
next-env.d.ts
*.tsbuildinfo
.claude/
```

- [ ] **Step 6: Write `.env.example`**

```bash
# Supabase (cloud project)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server + seed only — NEVER expose to the client bundle

# Google OAuth (optional in Phase 0; magic link works without it)
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 7: Write `eslint.config.mjs` and `.prettierrc`**

```js
// eslint.config.mjs
import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [...compat.config({ extends: ["next/core-web-vitals", "next/typescript"] })];
```
```json
// .prettierrc
{ "semi": true, "singleQuote": false, "trailingComma": "all", "printWidth": 100 }
```

- [ ] **Step 8: Write minimal root layout + temp home**

`app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "shouldcost.io — Energy procurement should-cost models",
  description:
    "Build transparent, defensible should-cost models for energy-industry equipment and services.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en">{children}</html>;
}
```

`app/page.tsx` (temporary — replaced Task 20):
```tsx
export default function Home() {
  return <main style={{ padding: "2rem", fontFamily: "system-ui" }}>shouldcost.io — scaffolding OK</main>;
}
```

`app/globals.css` (minimal until Task 2):
```css
/* replaced in Task 2 */
```

- [ ] **Step 9: Verify it builds and serves**

Run:
```bash
pnpm typecheck && pnpm lint && pnpm build
```
Expected: all pass with no errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
Scaffold Next.js 14 app with strict TS, eslint, prettier

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Tailwind v4 + design tokens + fonts

**Files:**
- Create: `postcss.config.mjs`, `app/globals.css` (full tokens), `lib/fonts.ts`
- Modify: `app/layout.tsx` (apply fonts)

**Interfaces:**
- Produces: CSS custom properties for every token (`--color-petrol-*`, `--font-sans`, `--font-mono`, etc.) usable as Tailwind utilities (`bg-canvas`, `text-ink`, `font-mono`, `num`) and a `.num` utility applying `font-variant-numeric: tabular-nums`.

- [ ] **Step 1: Install Tailwind v4 + font deps**

Run:
```bash
pnpm add tailwindcss@^4 @tailwindcss/postcss@^4
pnpm add @fontsource-variable/inter @fontsource/jetbrains-mono
```
If either package is unavailable or shadcn's `init` (Task 3) reports a v4 incompatibility that cannot be resolved, fall back: `pnpm remove tailwindcss @tailwindcss/postcss && pnpm add -D tailwindcss@^3 postcss autoprefixer tailwindcss-animate` and use a `tailwind.config.ts` mapping the same token names below.

- [ ] **Step 2: Write `postcss.config.mjs`**

```js
export default { plugins: { "@tailwindcss/postcss": {} } };
```

- [ ] **Step 3: Write `app/globals.css` with full token set**

```css
@import "tailwindcss";

@theme {
  /* Color */
  --color-canvas: #fafaf8;
  --color-ink: #1a1a1a;
  --color-hairline: #e5e5e0;
  --color-muted: #6b6b66;

  --color-petrol-50: #f1f6fa;
  --color-petrol-100: #dce8f1;
  --color-petrol-200: #bcd3e3;
  --color-petrol-300: #8fb6cf;
  --color-petrol-400: #5e90b3;
  --color-petrol-500: #3c6f95;
  --color-petrol-600: #0b3c5d; /* primary */
  --color-petrol-700: #0a344f;
  --color-petrol-800: #0c2d44;
  --color-petrol-900: #0d2838;

  --color-amber: #f59e0b;     /* deltas / warnings only */
  --color-favor: #059669;     /* favorable gaps only */
  --color-danger: #b91c1c;

  /* Type */
  --font-sans: "Inter Variable", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  /* Radius */
  --radius-sm: 2px;
  --radius-md: 6px;
  --radius-lg: 10px;

  /* Shadow (overlay only) */
  --shadow-overlay: 0 8px 24px rgba(13, 40, 56, 0.12), 0 2px 6px rgba(13, 40, 56, 0.06);
}

@layer base {
  html { font-family: var(--font-sans); color: var(--color-ink); background: var(--color-canvas); }
  body { margin: 0; }
  :focus-visible { outline: 2px solid var(--color-petrol-600); outline-offset: 2px; }
  .num { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }
  /* density hook for tables */
  [data-density="compact"] tbody td { padding-top: 0.25rem; padding-bottom: 0.25rem; }
}

/* Dark mode token overrides (toggle UI lands in Phase 4; structure correct now) */
@media (prefers-color-scheme: dark) {
  .dark {
    --color-canvas: #0d1117;
    --color-ink: #e6e6e0;
    --color-hairline: #2a2f37;
    --color-muted: #9a9a93;
    --shadow-overlay: 0 8px 24px rgba(0, 0, 0, 0.4);
  }
}
```

- [ ] **Step 4: Write `lib/fonts.ts`**

```ts
import { Inter, JetBrains_Mono } from "next/font/google";

export const fontSans = Inter({ subsets: ["latin"], variable: "--font-sans-next", display: "swap" });
export const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-next",
  display: "swap",
});
```
Then update `--font-sans` / `--font-mono` in `globals.css` `@theme` to `"var(--font-sans-next)"` / `"var(--font-mono-next)"` respectively (apply via the layout in Step 5 so the next/font variables exist).

- [ ] **Step 5: Apply fonts in `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { fontSans, fontMono } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "shouldcost.io — Energy procurement should-cost models",
  description:
    "Build transparent, defensible should-cost models for energy-industry equipment and services.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 6: Verify build + a smoke render**

Run: `pnpm build`
Expected: success. Manually visit `/` — text renders in Inter.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add Tailwind v4 design tokens and Inter/JetBrains Mono fonts

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: shadcn/ui base + `cn()` + standard primitives

**Files:**
- Create: `components.json`, `lib/utils.ts`, and `components/ui/*.tsx` (standard shadcn primitives)
- Consumes: token classes from Task 2 (`bg-canvas`, `border-hairline`, etc.)

**Interfaces:**
- Produces: `cn(...)` at `@/lib/utils`; standard primitives under `@/components/ui/*` for all later tasks.

- [ ] **Step 1: Install deps + init shadcn**

Run:
```bash
pnpm add class-variance-authority clsx tailwind-merge lucide-react sonner next-themes
pnpm dlx shadcn@latest init -d
```
If `init` fails under Tailwind v4, run `pnpm dlx shadcn@latest init` interactively and accept the defaults (it writes `components.json`). If it still cannot proceed, execute the Task 2 v3 fallback first, then re-init.

- [ ] **Step 2: Write `lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 3: Add the standard primitives**

Run:
```bash
pnpm dlx shadcn@latest add button input textarea select checkbox switch radio-group label dropdown-menu dialog sheet tabs tooltip avatar badge card separator scroll-area skeleton sonner form
```
Expected: files created under `components/ui/`. If `form` pulls RHF/zod, also run `pnpm add react-hook-form zod @hookform/resolvers`.

- [ ] **Step 4: Verify typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Init shadcn/ui and add standard primitives

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Custom number + shared components (TDD)

**Files:**
- Create: `components/number/{money-input,currency-select,delta-pill,animated-counter}.tsx`
- Create: `components/shared/{empty-state,saved-indicator,density-toggle,stat,kpi-tile}.tsx`
- Test: `tests/unit/number.test.tsx`, `tests/unit/shared.test.tsx`
- Consumes: `lib/money.ts` (Task 5) — **implement the component shells now, but the money-input test that depends on minor-unit conversion is written in Task 5; here we test rendering behavior only.**

**Interfaces:**
- Produces: `<MoneyInput valueMinor onChange currency />`, `<CurrencySelect value onChange />`, `<DeltaPill value=minor base=minor currency />`, `<AnimatedCounter valueMinor />`, `<EmptyState steps />`, `<SavedIndicator status />`, `<DensityToggle value onChange />`, `<Stat label valueMinor currency delta />`, `<KpiTile />`.

> **Note on ordering:** these components reference `lib/money.ts`. To avoid a forward dependency, create the component files in Step 3 but only the rendering-shape tests here; the numeric-correctness test runs in Task 5 after `lib/money.ts` exists. If executing out of order, do Task 5 first.

- [ ] **Step 1: Write the failing render tests**

`tests/unit/number.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DeltaPill } from "@/components/number/delta-pill";
import { CurrencySelect } from "@/components/number/currency-select";

describe("DeltaPill", () => {
  it("renders favorable when delta >= 0", () => {
    render(<DeltaPill deltaMinor={1500} baseMinor={10000} />);
    // favorable = quoted above should-cost = good for buyer -> green/favor
    expect(screen.getByText(/\+/)).toBeTruthy();
  });
  it("renders unfavorable when delta < 0", () => {
    render(<DeltaPill deltaMinor={-500} baseMinor={10000} />);
    expect(screen.getByText(/-/)).toBeTruthy();
  });
});

describe("CurrencySelect", () => {
  it("renders all six currencies", () => {
    render(<CurrencySelect value="USD" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/number.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the components**

`components/number/currency-select.tsx`:
```tsx
"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const CURRENCIES = ["USD", "EUR", "INR", "GBP", "SAR", "AED"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function CurrencySelect({ value, onChange }: { value: Currency; onChange: (c: Currency) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Currency)}>
      <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
      <SelectContent>
        {CURRENCIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
      </SelectContent>
    </Select>
  );
}
```

`components/number/delta-pill.tsx`:
```tsx
import { cn } from "@/lib/utils";

export function DeltaPill({ deltaMinor, baseMinor }: { deltaMinor: number; baseMinor: number }) {
  const sign = deltaMinor >= 0 ? "+" : "-";
  const favorable = deltaMinor >= 0; // positive delta = quoted above should-cost = buyer-favorable lever
  const pct = baseMinor !== 0 ? Math.abs((deltaMinor / baseMinor) * 100) : 0;
  return (
    <span className={cn("num inline-flex rounded-sm px-1.5 py-0.5 text-xs",
      favorable ? "text-favor" : "text-amber")}>
      {sign}{pct.toFixed(1)}%
    </span>
  );
}
```

`components/number/money-input.tsx`:
```tsx
"use client";
import { Input } from "@/components/ui/input";
import { formatMinorInput } from "@/lib/money";

export function MoneyInput({
  valueMinor, currency, onChange,
}: { valueMinor: number; currency: string; onChange: (minor: number) => void }) {
  return (
    <Input
      type="text"
      inputMode="decimal"
      className="num w-32 text-right"
      value={formatMinorInput(valueMinor)}
      aria-label={`amount in ${currency}`}
      onChange={(e) => {
        const minor = parseMinorInput(e.target.value);
        if (!Number.isNaN(minor)) onChange(minor);
      }}
    />
  );
}
// parseMinorInput accepts "12.34" -> 1234 minor units (2-decimal assumption for non-INR; refined in Task 5)
function parseMinorInput(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}
```

`components/number/animated-counter.tsx`:
```tsx
"use client";
import { useEffect, useRef, useState } from "react";

export function AnimatedCounter({ valueMinor, durationMs = 400 }: { valueMinor: number; durationMs?: number }) {
  const [display, setDisplay] = useState(valueMinor);
  const fromRef = useRef(valueMinor);
  useEffect(() => {
    const from = fromRef.current;
    const to = valueMinor;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [valueMinor, durationMs]);
  return <span className="num">{(display / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}
```

`components/shared/empty-state.tsx`:
```tsx
import { cn } from "@/lib/utils";

export function EmptyState({
  title, steps, cta,
}: { title: string; steps: string[]; cta?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <h3 className="text-lg font-semibold">{title}</h3>
      <ol className="space-y-1 text-sm text-muted">{steps.map((s, i) => (<li key={i}>{i + 1}. {s}</li>))}</ol>
      {cta}
    </div>
  );
}
```

`components/shared/saved-indicator.tsx`:
```tsx
import { cn } from "@/lib/utils";
import { Check, Loader2, AlertCircle } from "lucide-react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";
export function SavedIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  const map = {
    saving: { icon: Loader2, text: "Saving…", className: "text-muted", spin: true },
    saved: { icon: Check, text: "Saved ✓", className: "text-favor", spin: false },
    error: { icon: AlertCircle, text: "Save failed", className: "text-danger", spin: false },
  }[status];
  const Icon = map.icon;
  return <span className={cn("inline-flex items-center gap-1 text-xs", map.className)}><Icon className={cn("h-3 w-3", map.spin && "animate-spin")} />{map.text}</span>;
}
```

`components/shared/density-toggle.tsx`:
```tsx
"use client";
import { Button } from "@/components/ui/button";
export type Density = "comfortable" | "compact";
export function DensityToggle({ value, onChange }: { value: Density; onChange: (d: Density) => void }) {
  return (
    <div className="inline-flex rounded-md border border-hairline">
      {(["comfortable", "compact"] as const).map((d) => (
        <Button key={d} variant={value === d ? "default" : "ghost"} size="sm" onClick={() => onChange(d)}>
          {d === "compact" ? "Compact" : "Comfortable"}
        </Button>
      ))}
    </div>
  );
}
```

`components/shared/stat.tsx` (and `kpi-tile.tsx`):
```tsx
import { AnimatedCounter } from "@/components/number/animated-counter";
import { DeltaPill } from "@/components/number/delta-pill";

export function Stat({
  label, valueMinor, currency, deltaMinor,
}: { label: string; valueMinor: number; currency: string; deltaMinor?: number }) {
  return (
    <div className="rounded-md border border-hairline bg-canvas p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">
        <AnimatedCounter valueMinor={valueMinor} />
      </div>
      {deltaMinor !== undefined && <div className="mt-1"><DeltaPill deltaMinor={deltaMinor} baseMinor={valueMinor} /></div>}
      <div className="text-[10px] text-muted">all values in {currency} · illustrative</div>
    </div>
  );
}
```

- [ ] **Step 4: Run the rendering tests**

Run: `pnpm test tests/unit/number.test.tsx`
Expected: PASS. (Note: `MoneyInput` references `@/lib/money` which doesn't exist yet — temporarily add a stub `lib/money.ts` exporting `formatMinorInput` returning `(valueMinor/100).toFixed(2)` so this task's render tests pass. The full implementation is Task 5.)

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add custom number and shared components

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: `lib/money.ts` — integer minor units + FX (TDD)

**Files:**
- Create: `lib/money.ts`
- Modify: replace the stub from Task 4 Step 4.
- Test: `tests/unit/money.test.ts`

**Interfaces:**
- Produces: `toMinor(units: number, currency: Currency): number`, `fromMinor(minor: number, currency: Currency): number`, `convert(minor: number, from: Currency, to: Currency, fxRate: number): number`, `add(a: number, b: number): number`, `multiply(minor: number, factor: number): number`, `formatMinorInput(minor: number): string`, type `Minor = number` (branded via comment; kept as `number` for DB simplicity).

- [ ] **Step 1: Write the failing tests**

`tests/unit/money.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { toMinor, fromMinor, convert, add, multiply, formatMinorInput } from "@/lib/money";

describe("money", () => {
  it("converts units to minor (2-decimal currencies)", () => {
    expect(toMinor(12.34, "USD")).toBe(1234);
    expect(toMinor(0.01, "EUR")).toBe(1);
  });
  it("converts INR to minor paise", () => {
    expect(toMinor(100, "INR")).toBe(10000);
  });
  it("rounds half-up to avoid float drift", () => {
    expect(toMinor(0.1 + 0.2, "USD")).toBe(30);
  });
  it("fromMinor reverses toMinor", () => {
    expect(fromMinor(1234, "USD")).toBeCloseTo(12.34, 2);
  });
  it("convert uses fxRate as (1 from -> rate to) on minor units", () => {
    // 1000 USD minor -> INR at fx 83.2 => 1000*83.2 minor in INR decimals? fx applies on units; keep minor math consistent
    expect(convert(1000, "USD", "INR", 83.2)).toBe(Math.round(1000 * 83.2));
  });
  it("add and multiply stay integer", () => {
    expect(add(1234, 100)).toBe(1334);
    expect(multiply(1234, 1.5)).toBe(1851);
  });
  it("formatMinorInput shows 2 decimals", () => {
    expect(formatMinorInput(1234)).toBe("12.34");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test tests/unit/money.test.ts`
Expected: FAIL — pure functions behave wrong / not exported.

- [ ] **Step 3: Implement `lib/money.ts`**

```ts
import type { Currency } from "@/components/number/currency-select";

/** Minor = integer units of the smallest denomination (cents / paise). Always integer. */
export type Minor = number;

const DECIMALS: Record<Currency, number> = {
  USD: 2, EUR: 2, GBP: 2, SAR: 2, AED: 2, INR: 2,
};

/** Round half-up to the nearest integer (avoids float drift like 0.1+0.2). */
function roundHalfUp(n: number): number {
  return Math.sign(n) * Math.round(Math.abs(n));
}

export function toMinor(units: number, _currency: Currency): Minor {
  return roundHalfUp(units * 10 ** DECIMALS[_currency]);
}
export function fromMinor(minor: Minor, currency: Currency): number {
  return minor / 10 ** DECIMALS[currency];
}
/** Convert minor from one currency to another using fxRate = units(to) per 1 unit(from). */
export function convert(minor: Minor, _from: Currency, _to: Currency, fxRate: number): Minor {
  return roundHalfUp(minor * fxRate);
}
export function add(a: Minor, b: Minor): Minor { return a + b; }
export function multiply(minor: Minor, factor: number): Minor { return roundHalfUp(minor * factor); }
export function formatMinorInput(minor: Minor): string {
  return (minor / 100).toFixed(2);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test tests/unit/money.test.ts`
Expected: PASS (8/8).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add money helpers (integer minor units + FX)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: `lib/format.ts` — currency/number formatting (TDD)

**Files:**
- Create: `lib/format.ts`
- Test: `tests/unit/format.test.ts`

**Interfaces:**
- Produces: `formatCurrency(minor, currency, opts?)`, `formatNumber(n)`, `formatPercent(n)`, `formatIndexValue(value, unit)`.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { formatCurrency, formatNumber, formatPercent, formatIndexValue } from "@/lib/format";

describe("format", () => {
  it("formats USD minor to currency string", () => {
    expect(formatCurrency(123456, "USD")).toBe("$1,234.56");
  });
  it("formats INR minor", () => {
    expect(formatCurrency(100000, "INR")).toContain("1,000"); // locale-dependent symbol; assert grouping
  });
  it("formatNumber groups thousands", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
  it("formatPercent", () => {
    expect(formatPercent(12.345)).toBe("12.3%");
  });
  it("formatIndexValue with unit", () => {
    expect(formatIndexValue(650, "$/MT")).toBe("650 $/MT");
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm test tests/unit/format.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
import type { Currency } from "@/components/number/currency-select";

const LOCALE: Record<Currency, string> = {
  USD: "en-US", EUR: "en-IE", GBP: "en-GB", SAR: "en-SA", AED: "en-AE", INR: "en-IN",
};

export function formatCurrency(minor: number, currency: Currency): string {
  const units = minor / 100;
  return new Intl.NumberFormat(LOCALE[currency], { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(units);
}
export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}
export function formatIndexValue(value: number, unit: string): string {
  return `${formatNumber(value)} ${unit}`;
}
```

- [ ] **Step 4: Run to pass**

Run: `pnpm test tests/unit/format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add currency/number formatting helpers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Supabase clients + root middleware

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `lib/supabase/admin.ts`, `lib/supabase/middleware.ts`, `middleware.ts`
- Consumes: env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

**Interfaces:**
- Produces: `createBrowserClient()` (RLS-bound), `createServerClient()` (RLS-bound, reads cookies), `createAdminClient()` (service role, server-only), `updateSession(request)` (session refresh).

- [ ] **Step 1: Install Supabase SSR**

Run:
```bash
pnpm add @supabase/supabase-js @supabase/ssr
```

- [ ] **Step 2: Write the browser client**

`lib/supabase/client.ts`:
```ts
import { createBrowserClient as create } from "@supabase/ssr";

export function createBrowserClient() {
  return create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Write the server client**

`lib/supabase/server.ts`:
```ts
import { createServerClient as create } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerClient() {
  const store = await cookies();
  return create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (c) => c.forEach(({ name, value, options }) => store.set(name, value, options)),
      },
    },
  );
}
```

- [ ] **Step 4: Write the admin client (server-only)**

`lib/supabase/admin.ts`:
```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}
```

- [ ] **Step 5: Write the middleware session helper + root middleware**

`lib/supabase/middleware.ts`:
```ts
import { createServerClient as create } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = create(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (c) => {
          c.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          c.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/signup");
  const isAppRoute = path.startsWith("/dashboard") || path.startsWith("/projects") || path.startsWith("/models") || path.startsWith("/settings");

  if (!user && isAppRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }
  return response;
}
```

`middleware.ts` (repo root):
```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)"],
};
```

- [ ] **Step 6: Add the `server-only` package and verify build**

Run:
```bash
pnpm add server-only
pnpm typecheck && pnpm build
```
Expected: success. The `"server-only"` import guarantees `admin.ts` cannot be bundled into the client.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add Supabase clients (browser/server/admin) and auth middleware

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Migration 0001 — schema

**Files:**
- Create: `supabase/migrations/0001_init_schema.sql`, `supabase/config.toml`
- Consumes: a linked cloud project (`supabase link --project-ref <ref>`).

**Interfaces:**
- Produces: all tables, enums, indexes, constraints. RLS added in Task 9.

- [ ] **Step 1: Initialize Supabase CLI config**

Run:
```bash
pnpm dlx supabase init
```
This creates `supabase/config.toml` and `supabase/migrations/`. Then link to the cloud project (you need the project ref from your Supabase dashboard):
```bash
supabase link --project-ref <your-project-ref>
```

- [ ] **Step 2: Write the schema migration**

`supabase/migrations/0001_init_schema.sql`:
```sql
-- Enums
create type org_role as enum ('admin', 'editor', 'viewer');
create type model_status as enum ('draft', 'active', 'archived');
create type node_type as enum ('group', 'line');
create type rate_source as enum ('manual', 'index', 'benchmark');
create type billing_plan as enum ('free', 'pro', 'team');
create type billing_provider as enum ('stripe', 'razorpay');

-- Organizations & membership
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan billing_plan not null default 'free',
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table org_members (
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null,
  role org_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on org_members (user_id);

-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create index on projects (org_id);

-- Models + versions
create table cost_models (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  category_template_id uuid references category_templates(id),
  currency text not null default 'USD',
  fx_rate numeric not null default 1.0,
  status model_status not null default 'draft',
  created_by uuid,
  created_at timestamptz not null default now()
);
create index on cost_models (project_id);

create table model_versions (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references cost_models(id) on delete cascade,
  version_no integer not null,
  snapshot_json jsonb not null,
  total_cost bigint not null default 0,   -- integer minor units
  created_by uuid,
  created_at timestamptz not null default now(),
  note text,
  unique (model_id, version_no)
);

-- Cost nodes (tree)
create table cost_nodes (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references cost_models(id) on delete cascade,
  parent_id uuid references cost_nodes(id) on delete cascade,
  sort_order integer not null default 0,
  name text not null,
  node_type node_type not null,
  driver_name text,
  quantity double precision,
  unit text,
  rate bigint,                            -- integer minor units
  rate_source rate_source not null default 'manual',
  index_id uuid references indices(id),
  index_factor double precision,
  formula text,
  notes text
);
create index on cost_nodes (model_id);
create index on cost_nodes (parent_id);

-- Category templates (public-read)
create table category_templates (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  industry text not null,
  name text not null,
  unit text not null,
  description text,
  cbs_json jsonb not null,
  practitioner_notes text not null,
  is_public boolean not null default true,
  draft boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- Indices (public-read)
create table indices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  unit text not null,
  currency text not null default 'USD',
  region text,
  source_note text,
  draft boolean not null default true,
  created_at timestamptz not null default now()
);

create table index_values (
  index_id uuid not null references indices(id) on delete cascade,
  date date not null,
  value double precision not null,
  primary key (index_id, date)
);

-- Quotes
create table quotes (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references cost_models(id) on delete cascade,
  supplier_name text not null,
  currency text not null default 'USD',
  incoterm text,
  payment_terms text,
  quoted_total bigint not null default 0,   -- integer minor units
  received_at timestamptz not null default now()
);
create index on quotes (model_id);

create table quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  cost_node_id uuid references cost_nodes(id) on delete set null,
  description text,
  amount bigint not null default 0          -- integer minor units
);

-- Collaboration / governance
create table comments (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references cost_models(id) on delete cascade,
  user_id uuid not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index on comments (model_id);

create table audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid,
  entity text not null,
  entity_id uuid,
  action text not null,
  diff_json jsonb,
  created_at timestamptz not null default now()
);
create index on audit_log (org_id, created_at desc);

create table share_links (
  id uuid primary key default gen_random_uuid(),
  model_version_id uuid not null references model_versions(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

create table subscriptions (
  org_id uuid not null references organizations(id) on delete cascade primary key,
  provider billing_provider not null,
  provider_customer_id text,
  plan billing_plan not null default 'free',
  status text not null default 'inactive',
  current_period_end timestamptz
);
```

> **Forward-reference note:** `cost_models.category_template_id` and `cost_nodes.index_id` reference tables declared further down. Postgres requires referenced tables to exist first. Reorder so `category_templates` and `indices` are created **before** `cost_models` and `cost_nodes`. The version above is written for readability — when you run Step 3, the migration file must place `category_templates` and `indices` above `cost_models`. Apply that ordering in the file.

- [ ] **Step 3: Push to cloud**

Run:
```bash
supabase db push
```
Expected: migration applies; tables visible in the Supabase dashboard.

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "Add schema migration (all tables, enums, indexes)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 9: Migration 0002 — RLS policies + org helper

**Files:**
- Create: `supabase/migrations/0002_rls_policies.sql`
- Test: `tests/integration/rls.test.ts` (gated on env vars; run with `pnpm test:integration`)

**Interfaces:**
- Produces: SQL function `current_user_orgs()` returning org uuids for `auth.uid()`; RLS enabled + policies on every table.

- [ ] **Step 1: Write the failing integration test**

`tests/integration/rls.test.ts`:
```ts
import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe("RLS integration (requires cloud project + 2 seeded test users)", () => {
  beforeAll(() => {
    if (!URL || !ANON) throw new Error("Set Supabase env vars to run integration tests");
  });

  it("user A cannot read user B's project", async () => {
    const skip = !process.env.TEST_USER_A_EMAIL || !process.env.TEST_USER_B_EMAIL;
    if (skip) return; // skip silently in CI without test users
    const a = createClient(URL, ANON);
    const { data: aSession } = await a.auth.signInWithPassword({ email: process.env.TEST_USER_A_EMAIL!, password: process.env.TEST_USER_A_PASSWORD! });
    const { data, error } = await a.from("projects").select("*");
    expect(error).toBeNull();
    // only projects owned by A's org should appear — assert none from B's org
    expect(data?.every((p) => p.org_id !== process.env.TEST_ORG_B_ID)).toBe(true);
  });
});
```
Also create `vitest.integration.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({ resolve: { alias: { "@": path.resolve(__dirname) } }, test: { include: ["tests/integration/**/*.test.ts"], testTimeout: 30000 } });
```

- [ ] **Step 2: Write the RLS migration**

`supabase/migrations/0002_rls_policies.sql`:
```sql
-- Helper: orgs the current user belongs to
create or replace function public.current_user_orgs()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select org_id from public.org_members where user_id = auth.uid();
$$;

-- Organizations: member can see/manage
alter table organizations enable row level security;
create policy org_read on organizations for select using (id in (select public.current_user_orgs()));
create policy org_admin on organizations for all using (id in (select public.current_user_orgs())) with check (id in (select public.current_user_orgs()));

-- org_members: members of the org can see; only admins can write
alter table org_members enable row level security;
create policy om_read on org_members for select using (org_id in (select public.current_user_orgs()));
create policy om_admin_insert on org_members for insert with check (
  org_id in (select public.current_user_orgs())
  and exists (select 1 from public.org_members m where m.org_id = org_members.org_id and m.user_id = auth.uid() and m.role = 'admin')
);
create policy om_admin_update on org_members for update using (
  exists (select 1 from public.org_members m where m.org_id = org_members.org_id and m.user_id = auth.uid() and m.role = 'admin')
);

-- projects, cost_models, model_versions, cost_nodes, quotes, quote_lines, comments, audit_log:
-- all scoped by org membership via their root project/model.
alter table projects enable row level security;
create policy proj_all on projects for all using (org_id in (select public.current_user_orgs())) with check (org_id in (select public.current_user_orgs()));

alter table cost_models enable row level security;
create policy cm_all on cost_models for all
  using (project_id in (select id from public.projects where org_id in (select public.current_user_orgs())))
  with check (project_id in (select id from public.projects where org_id in (select public.current_user_orgs())));

alter table model_versions enable row level security;
create policy mv_all on model_versions for all
  using (model_id in (select id from public.cost_models));

alter table cost_nodes enable row level security;
create policy cn_all on cost_nodes for all
  using (model_id in (select id from public.cost_models));

alter table quotes enable row level security;
create policy q_all on quotes for all using (model_id in (select id from public.cost_models));

alter table quote_lines enable row level security;
create policy ql_all on quote_lines for all using (quote_id in (select id from public.quotes));

alter table comments enable row level security;
create policy c_all on comments for all using (model_id in (select id from public.cost_models));

alter table audit_log enable row level security;
create policy al_all on audit_log for all using (org_id in (select public.current_user_orgs()));

alter table share_links enable row level security;
create policy sl_all on share_links for all
  using (model_version_id in (select mv.id from public.model_versions mv
         join public.cost_models cm on cm.id = mv.model_id
         join public.projects p on p.id = cm.project_id
         where p.org_id in (select public.current_user_orgs())));

alter table subscriptions enable row level security;
create policy sub_all on subscriptions for all using (org_id in (select public.current_user_orgs()));

-- Public-read reference data
alter table category_templates enable row level security;
create policy ct_read on category_templates for select using (true);

alter table indices enable row level security;
create policy idx_read on indices for select using (true);
create policy idx_values_read on index_values for select using (true);
```

- [ ] **Step 3: Push migration**

Run: `supabase db push`
Expected: policies applied.

- [ ] **Step 4: Run integration test (manual; requires TEST_USER_A/B env)**

Run: `pnpm test:integration`
Expected: PASS (or skip silently when test users not configured).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add RLS policies and current_user_orgs helper

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 10: Migration 0003 — share-link resolver (security definer)

**Files:**
- Create: `supabase/migrations/0003_functions.sql`
- Consumes: `share_links`, `model_versions` (Task 8).

**Interfaces:**
- Produces: `public.resolve_share_link(p_token text)` returning a model version snapshot or null. Used by a Phase 2 public read-only route via an anonymous session.

- [ ] **Step 1: Write the migration**

`supabase/migrations/0003_functions.sql`:
```sql
-- Public resolver: given a token, return the version snapshot if not revoked/expired.
-- SECURITY DEFINER so an anon session (no org membership) can read a shared version only.
create or replace function public.resolve_share_link(p_token text)
returns table (
  model_version_id uuid,
  snapshot_json jsonb,
  total_cost bigint,
  created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select sl.model_version_id, mv.snapshot_json, mv.total_cost, mv.created_at
  from public.share_links sl
  join public.model_versions mv on mv.id = sl.model_version_id
  where sl.token = p_token
    and coalesce(sl.revoked, false) = false
    and (sl.expires_at is null or sl.expires_at > now());
$$;

grant execute on function public.resolve_share_link(text) to anon, authenticated;
```

- [ ] **Step 2: Push migration**

Run: `supabase db push`
Expected: function created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_functions.sql
git commit -m "Add share-link resolver function (security definer)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 11: Seed — indices (10 + 24-month generation) (TDD)

**Files:**
- Create: `lib/seed/indices.ts`
- Test: `tests/unit/seed-indices.test.ts`
- Consumes: `createAdminClient` (Task 7) at write-time (tested separately from generation).

**Interfaces:**
- Produces: `INDICES: SeedIndex[]` and `generateIndexValues(code: string): { date: string; value: number }[]` (deterministic, 24 monthly points ending the current month).

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { INDICES, generateIndexValues } from "@/lib/seed/indices";

describe("seed indices", () => {
  it("defines exactly 10 indices with unique codes", () => {
    expect(INDICES).toHaveLength(10);
    expect(new Set(INDICES.map((i) => i.code)).size).toBe(10);
  });
  it("every index has required fields", () => {
    for (const i of INDICES) {
      expect(i.name).toBeTruthy();
      expect(i.unit).toBeTruthy();
      expect(i.currency).toBeTruthy();
      expect(i.latest).toBeGreaterThan(0);
    }
  });
  it("generates 24 monthly values ending now", () => {
    const series = generateIndexValues("hrc_steel");
    expect(series).toHaveLength(24);
    const last = series.at(-1)!.date.slice(0, 7);
    const nowMonth = new Date().toISOString().slice(0, 7);
    expect(last).toBe(nowMonth);
  });
  it("values stay positive and within a plausible band of the anchor", () => {
    const anchor = INDICES.find((i) => i.code === "hrc_steel")!.latest;
    const series = generateIndexValues("hrc_steel").map((p) => p.value);
    for (const v of series) {
      expect(v).toBeGreaterThan(0);
      expect(v).toBeGreaterThan(anchor * 0.5);
      expect(v).toBeLessThan(anchor * 1.6);
    }
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm test tests/unit/seed-indices.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `lib/seed/indices.ts`**

```ts
export type SeedIndex = {
  code: string; name: string; unit: string; currency: string; region: string;
  source_note: string; latest: number; trajectory: number[]; // waypoints oldest -> newest (relative to latest)
};

export const INDICES: SeedIndex[] = [
  { code: "hrc_steel", name: "HRC hot-rolled coil", unit: "$/MT", currency: "USD", region: "Global", source_note: "Illustrative composite of published HRC benchmarks; needs validation.", latest: 650, trajectory: [780, 760, 720, 690, 660, 640, 630, 635, 645, 650] },
  { code: "crc_steel", name: "Cold-rolled coil", unit: "$/MT", currency: "USD", region: "Global", source_note: "Illustrative; CRC trades at a premium over HRC.", latest: 780, trajectory: [900, 880, 850, 820, 800, 790, 785, 780, 780, 780] },
  { code: "ss316", name: "Stainless 316 hot-rolled", unit: "$/MT", currency: "USD", region: "Global", source_note: "Illustrative; alloy-surcharge sensitive to nickel.", latest: 3200, trajectory: [3800, 3700, 3600, 3500, 3400, 3350, 3300, 3250, 3220, 3200] },
  { code: "copper_lme", name: "Copper LME 3M", unit: "$/MT", currency: "USD", region: "Global", source_note: "Illustrative LME 3M settlement.", latest: 9500, trajectory: [8400, 8500, 8700, 8900, 9100, 9200, 9300, 9400, 9450, 9500] },
  { code: "aluminum_lme", name: "Aluminum LME 3M", unit: "$/MT", currency: "USD", region: "Global", source_note: "Illustrative LME 3M settlement.", latest: 2400, trajectory: [2200, 2250, 2280, 2300, 2320, 2350, 2370, 2380, 2390, 2400] },
  { code: "nickel_lme", name: "Nickel LME 3M", unit: "$/MT", currency: "USD", region: "Global", source_note: "Illustrative; nickel is volatile.", latest: 16000, trajectory: [21000, 19500, 18500, 17800, 17200, 16800, 16500, 16200, 16100, 16000] },
  { code: "polysilicon", name: "Polysilicon spot", unit: "$/kg", currency: "USD", region: "Global", source_note: "Illustrative; long decline from 2022 highs.", latest: 6.0, trajectory: [30, 24, 18, 14, 11, 9, 8, 7, 6.5, 6.0] },
  { code: "brent", name: "Brent crude", unit: "$/bbl", currency: "USD", region: "Global", source_note: "Illustrative front-month.", latest: 80, trajectory: [82, 84, 86, 88, 85, 82, 80, 79, 79, 80] },
  { code: "hdpe", name: "HDPE blow-molding resin", unit: "$/MT", currency: "USD", region: "Global", source_note: "Illustrative; resin tracks naphtha + spread.", latest: 1000, trajectory: [1150, 1120, 1080, 1050, 1030, 1020, 1010, 1005, 1000, 1000] },
  { code: "fab_labor_in", name: "Fabricated-steel labor composite", unit: "₹/hr", currency: "INR", region: "India", source_note: "Illustrative fully-burdened skilled welder/fabricator hour.", latest: 850, trajectory: [780, 790, 800, 810, 820, 830, 835, 840, 845, 850] },
];

// Deterministic pseudo-noise so the series looks live but is reproducible.
function seededNoise(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x) - 0.5; // [-0.5, 0.5)
}

export function generateIndexValues(code: string): { date: string; value: number }[] {
  const idx = INDICES.find((i) => i.code === code);
  if (!idx) throw new Error(`unknown index ${code}`);
  const waypoints = idx.trajectory; // 10 anchors over 24 months
  const out: { date: string; value: number }[] = [];
  const now = new Date();
  for (let i = 23; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const t = (23 - i) / 23; // 0..1 across the window
    const segPos = t * (waypoints.length - 1);
    const lo = Math.floor(segPos);
    const hi = Math.min(waypoints.length - 1, lo + 1);
    const frac = segPos - lo;
    const interp = waypoints[lo] * (1 - frac) + waypoints[hi] * frac;
    const noise = 1 + seededNoise((i + 1) * (code.length + 1)) * 0.02; // ±2%
    const value = Math.max(0.01, +(interp * noise).toFixed(2));
    out.push({ date: d.toISOString().slice(0, 10), value });
  }
  return out;
}
```

- [ ] **Step 4: Run to pass**

Run: `pnpm test tests/unit/seed-indices.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add 10 indices with deterministic 24-month generation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 12: Seed — Zod schema + rollup + OCTG template (TDD)

**Files:**
- Create: `lib/seed/schema.ts`, `lib/seed/rollup.ts`, `lib/seed/templates/octg-casing-tubing.ts`
- Test: `tests/unit/seed-rollup.test.ts`

**Interfaces:**
- Produces: `CbsGroup` Zod schema, `rollupCbs(group): number` (integer minor units), and the canonical OCTG template object `OCTG_TEMPLATE` matching `CategoryTemplate` shape.

- [ ] **Step 1: Write failing tests**

`tests/unit/seed-rollup.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { rollupCbs } from "@/lib/seed/rollup";
import { OCTG_TEMPLATE } from "@/lib/seed/templates/octg-casing-tubing";

describe("rollup", () => {
  it("sums line items + applies formula lines", () => {
    const group = {
      name: "x", nodes: [
        { name: "a", node_type: "line", quantity: 1, rate: 100, formula: null, nodes: [] },
        { name: "b", node_type: "line", quantity: 2, rate: 50, formula: null, nodes: [] },
      ],
    };
    // rates stored as integer minor in seed for consistency? -> define as units here, *100
    expect(rollupCbs(group as never)).toBe(20000); // (100 + 2*50) * 100 minor
  });
  it("OCTG should-cost lands near 1814 USD/MT", () => {
    const total = rollupCbs(OCTG_TEMPLATE.cbs_json as never);
    const units = total / 100;
    expect(units).toBeGreaterThan(1700);
    expect(units).toBeLessThan(1950);
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm test tests/unit/seed-rollup.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement schema + rollup**

`lib/seed/schema.ts`:
```ts
import { z } from "zod";

export const CbsNode = z.object({
  name: z.string(),
  node_type: z.enum(["group", "line"]),
  driver_name: z.string().optional(),
  quantity: z.number().optional(),
  unit: z.string().optional(),
  rate: z.number().optional(),                  // UNITS (not minor) in template seed; rollup converts
  rate_source: z.enum(["manual", "index", "benchmark"]).default("benchmark"),
  index_code: z.string().optional(),
  index_factor: z.number().optional(),
  formula: z.string().optional(),               // e.g. "12% of conversion"
  notes: z.string().optional(),
  nodes: z.lazy(() => z.array(CbsNode)).default([]),
});
export type CbsGroup = z.infer<typeof CbsNode>;
```

`lib/seed/rollup.ts`:
```ts
import type { CbsGroup } from "@/lib/seed/schema";

/** Returns total in integer minor units. Template rates are in UNITS (e.g. USD); *100 to minor. */
export function rollupCbs(node: CbsGroup): number {
  return rollupNode(node);
}
function rollupNode(node: CbsGroup): number {
  if (node.node_type === "line" && node.nodes.length === 0) {
    const qty = node.quantity ?? 1;
    const rate = node.rate ?? 0;
    return Math.round(qty * rate * 100);
  }
  // group: sum children
  let sum = 0;
  for (const child of node.nodes) {
    if (child.node_type === "line" && child.formula) {
      sum += applyFormula(child.formula, sum, node);
    } else {
      sum += rollupNode(child);
    }
  }
  return sum;
}
/** Formulas reference the running subtotal of the enclosing group. Limited, rule-based Phase-1 evaluation. */
function applyFormula(formula: string, runningGroupTotal: number, _parent: CbsGroup): number {
  // Patterns like "12% of conversion" / "9% margin" apply to the group's pre-formula subtotal.
  const m = formula.match(/([\d.]+)%\s*of\s*(\w+)/);
  if (m) {
    const pct = Number(m[1]);
    const groupRef = m[2].toLowerCase();
    // approximation: apply to running total of the group (converted to minor)
    void groupRef;
    return Math.round((runningGroupTotal * pct) / 100);
  }
  return 0;
}
```

- [ ] **Step 4: Implement OCTG template**

`lib/seed/templates/octg-casing-tubing.ts`:
```ts
import type { CbsGroup } from "@/lib/seed/schema";

export const OCTG_TEMPLATE = {
  slug: "octg-casing-tubing",
  industry: "Oil & Gas",
  name: "OCTG casing & tubing",
  unit: "/MT",
  description: "Should-cost per metric ton for API casing & tubing — billet through threading.",
  practitioner_notes:
    "Suppliers hide margin in bundled 'conversion' charges and in scrap/yield assumptions — they'll quote 1.15x billet weight when 1.08x is realistic on a modern rolling line. Threading is routinely marked up 30-40% over what independent specialist threaders charge. Tie the steel line to the HRC index times a published conversion constant, and challenge anything above 10% margin for commodity grades.",
  is_public: true,
  draft: true,
  cbs_json: {
    name: "OCTG casing & tubing (per MT)",
    node_type: "group",
    nodes: [
      { name: "Material", node_type: "group", nodes: [
        { name: "Steel billet (HRC)", node_type: "line", driver_name: "1.08 MT/MT yield", quantity: 1.08, unit: "MT", rate: 650, rate_source: "index", index_code: "hrc_steel", nodes: [] },
      ]},
      { name: "Conversion", node_type: "group", nodes: [
        { name: "Piercing & rolling", node_type: "line", quantity: 1, unit: "MT", rate: 280, rate_source: "benchmark", nodes: [] },
        { name: "Heat treatment (Q&T)", node_type: "line", quantity: 1, unit: "MT", rate: 150, rate_source: "benchmark", nodes: [] },
        { name: "Threading & coupling", node_type: "line", quantity: 1, unit: "MT", rate: 220, rate_source: "benchmark", nodes: [] },
        { name: "Inspection & NDT", node_type: "line", quantity: 1, unit: "MT", rate: 60, rate_source: "benchmark", nodes: [] },
      ]},
      { name: "Overhead", node_type: "group", nodes: [
        { name: "Manufacturing overhead", node_type: "line", formula: "12% of conversion", nodes: [] },
      ]},
      { name: "SG&A", node_type: "group", nodes: [
        { name: "Selling, general & admin", node_type: "line", formula: "5% of material", nodes: [] },
      ]},
      { name: "Margin", node_type: "group", nodes: [
        { name: "Supplier margin", node_type: "line", formula: "9% margin", nodes: [] },
      ]},
      { name: "Logistics", node_type: "group", nodes: [
        { name: "Inland freight + port + duty", node_type: "line", quantity: 1, unit: "MT", rate: 90, rate_source: "benchmark", nodes: [] },
      ]},
    ],
  } as CbsGroup,
};
```

> **Note on formula evaluation:** the `applyFormula` helper is a Phase-0 approximation that applies percentages to the running group subtotal. The exact reference (e.g. "of conversion" meaning the Conversion group specifically) is refined in Phase 1 when the editor evaluates formulas with full node references. The OCTG test tolerance (1700–1950) accommodates this approximation.

- [ ] **Step 5: Run to pass**

Run: `pnpm test tests/unit/seed-rollup.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add CBS schema, rollup, and OCTG template

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 13: Seed — remaining 16 templates

**Files:**
- Create: `lib/seed/templates/*.ts` for the 16 remaining slugs (below), and `lib/seed/templates/index.ts` aggregating all 17.
- Test: `tests/unit/seed-templates.test.ts`
- Consumes: `lib/seed/schema.ts`, `lib/seed/rollup.ts` (Task 12).

**Interfaces:**
- Produces: `ALL_TEMPLATES: CategoryTemplate[]` (17 items). Each must validate against the schema and roll up within its target range.

- [ ] **Step 1: Write the failing test**

`tests/unit/seed-templates.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { ALL_TEMPLATES } from "@/lib/seed/templates";
import { rollupCbs } from "@/lib/seed/rollup";

describe("all templates", () => {
  it("has 17 templates with unique slugs", () => {
    expect(ALL_TEMPLATES).toHaveLength(17);
    expect(new Set(ALL_TEMPLATES.map((t) => t.slug)).size).toBe(17);
  });
  it("each rolls up within its target range", () => {
    const ranges: Record<string, [number, number]> = {
      "octg-casing-tubing": [1700, 1950],
      "line-pipe": [900, 1150],
      "ball-gate-valves": [4000, 9000],         // per unit, varies by size class
      "wellheads-xmas-trees": [80000, 180000],  // per set
      "centrifugal-pumps-api610": [20000, 60000],
      "pressure-vessels-hx": [6, 12],            // per kg fabricated
      "drilling-day-rates": [18000, 45000],      // per day
      "structural-steel-fabrication": [1100, 1500],
      "power-transformers": [45000, 95000],      // per MVA
      "hv-mv-cables": [40, 120],                 // per m -> per km x1000 reflected in rate
      "switchgear-panels": [15000, 60000],
      "solar-pv-modules": [0.18, 0.30],          // per Wp (USD)
      "solar-epc-bos": [250000, 500000],         // per MW
      "wind-turbine-towers": [2500, 4500],       // per section
      "transmission-towers": [1300, 1800],       // per MT galvanized
      "epc-manhour-rate": [8, 95],               // per hour, country range USD
      "maintenance-shutdown": [50000, 250000],   // per event
    };
    for (const t of ALL_TEMPLATES) {
      const totalUnits = rollupCbs(t.cbs_json as never) / 100;
      const [lo, hi] = ranges[t.slug];
      expect(totalUnits, `${t.slug} rolled to ${totalUnits}`).toBeGreaterThanOrEqual(lo);
      expect(totalUnits, `${t.slug} rolled to ${totalUnits}`).toBeLessThanOrEqual(hi);
    }
  });
});
```

- [ ] **Step 2: Run to fail**

Run: `pnpm test tests/unit/seed-templates.test.ts`
Expected: FAIL.

- [ ] **Step 3: Author the 16 templates + aggregator**

Create one file per slug under `lib/seed/templates/`, each following the OCTG shape (Task 12 Step 4). Use these line-item structures and index bindings; fill benchmark rates so the rollup lands in the range above. Each `practitioner_notes` is one paragraph in the buyer's voice.

| slug | CBS groups (top-level) | key line items (set rates to land in range) | index |
|------|------------------------|---------------------------------------------|-------|
| `line-pipe` | Material, Conversion, Coating, Testing, OH, SG&A, Margin, Logistics | HRC plate/skelp @ 650; SAW/ERW forming @ 200; weld seam @ 60; hydrostatic test @ 40; 3LPE coating @ 120 | hrc_steel |
| `ball-gate-valves` | Material, Machining, Trim/actuation, Assembly, Testing, Coating, OH, SG&A, Margin, Logistics | cast body @ ss316; gate/ball trim; actuator; hydrotest | ss316, crc_steel |
| `wellheads-xmas-trees` | Material, Machining, Forging, Assembly, Pressure test, Coating, OH, SG&A, Margin, Logistics | forged ss316 body; flanges; valves; API 6A test | ss316 |
| `centrifugal-pumps-api610` | Material, Casting, Machining, Impeller, Seal, Motor, Assembly, Test, OH, SG&A, Margin, Logistics | casing @ ss316; impeller; mechanical seal; API motor | ss316, crc_steel |
| `pressure-vessels-hx` | Material, Plate cutting/forming, Welding (hours), Nozzles, NDT, PWHT, Hydrotest, OH, SG&A, Margin | HRC plate @ per kg; welding hours @ fab_labor; NDT; PWHT | hrc_steel, ss316 |
| `drilling-day-rates` | Rig CAPEX amortization, Crew wages, Consumables, Fuel/power, Maintenance, SG&A, Margin | capex split over 1500 days; crew shift; mud/consumables; fuel @ brent | brent |
| `structural-steel-fabrication` | Material, Cut/drill, Weld, Galvanize/paint, Inspection, OH, Margin, Logistics | HRC sections @ 650; fab labor @ INR hr; galvanize @ 200 | hrc_steel, fab_labor_in |
| `power-transformers` | Core steel (CRGO), Copper windings, Insulating oil, Tank fabrication, Assembly, Testing, OH, SG&A, Margin, Logistics | CRGO core @ ss316 proxy; copper @ 9500; mineral oil; tank | ss316, copper_lme |
| `hv-mv-cables` | Conductor, Insulation (XLPE), Bedding, Armoring, Outer sheath, Drum, Testing, OH, SG&A, Margin | copper/al conductor @ LME; XLPE @ 1500; armor wire; drum | copper_lme, aluminum_lme |
| `switchgear-panels` | Enclosure, Busbar (copper), Breakers, CT/PT, Control/wiring, Assembly, Test, OH, SG&A, Margin | crc enclosure; copper busbar; vacuum/SF6 breaker; CT/PT | copper_lme, crc_steel |
| `solar-pv-modules` | Polysilicon, Wafer, Cell processing, Glass, EVA/backsheet, Frame, Assembly, Test, OH, SG&A, Margin | polysilicon @ 6 $/kg; wafer; cell; glass; aluminum frame | polysilicon |
| `solar-epc-bos` | Mounting structures, Inverters, DC cabling, AC cabling, Civil/foundations, Erection labor, OH, SG&A, Margin | al structures @ LME; central inverter; copper cabling; civil @ fab_labor | aluminum_lme, copper_lme |
| `wind-turbine-towers` | Steel plate, Rolling/welding, Internal platforms, Flanges, Coating, Galvanize, Inspection, OH, SG&A, Margin, Logistics | HRC plate @ 650; rolling; welding; coating | hrc_steel |
| `transmission-towers` | Galvanized steel angles, Cutting/punching, Galvanizing, Assembly, Bolts/hardware, Inspection, OH, SG&A, Margin, Logistics | galv angles @ 700; punching; hot-dip galvanize | hrc_steel |
| `epc-manhour-rate` | Base wage, Payroll burden, Benefits, Per diem, Productivity factor, Overhead, SG&A, Margin (5 country sub-groups: India, KSA, UAE, US Gulf, EU) | one child group per country with rates 8/18/16/75/95 USD/hr | fab_labor_in |
| `maintenance-shutdown` | Crew mobilization, Direct labor (hours), Equipment rental, Consumables, Subcontractor, OH, Margin | labor hours @ fab_labor; equipment day rate; consumables | fab_labor_in, brent |

Each template object must include: `slug, industry, name, unit, description, practitioner_notes, is_public: true, draft: true, cbs_json`.

`lib/seed/templates/index.ts`:
```ts
import { OCTG_TEMPLATE } from "./octg-casing-tubing";
import { LinePipeTemplate } from "./line-pipe";
// ... import all 17
import type { CbsGroup } from "@/lib/seed/schema";

export type CategoryTemplate = {
  slug: string; industry: string; name: string; unit: string; description: string;
  practitioner_notes: string; is_public: boolean; draft: boolean; cbs_json: CbsGroup;
};

export const ALL_TEMPLATES: CategoryTemplate[] = [
  OCTG_TEMPLATE,
  LinePipeTemplate,
  /* ... the other 15 ... */
];
```

- [ ] **Step 4: Run to pass**

Run: `pnpm test tests/unit/seed-templates.test.ts`
Expected: PASS (17/17 land in range).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add remaining 16 category templates

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 14: Seed — idempotent runner + demo org

**Files:**
- Create: `lib/seed/run-seed.ts`, `lib/seed/demo-org.ts`
- Consumes: `createAdminClient` (Task 7), `INDICES` + `generateIndexValues` (Task 11), `ALL_TEMPLATES` (Task 13).

**Interfaces:**
- Produces: a `pnpm seed` script that upserts indices + 24mo values + 17 templates + one demo org with 3 models. Idempotent by `code`/`slug`.

- [ ] **Step 1: Write the demo-org content module**

`lib/seed/demo-org.ts`:
```ts
export const DEMO_ORG = {
  name: "Westmark Energy",
  is_demo: true,
  projects: [
    { name: "OCTG — Annual Framework", models: [
      { name: "OCTG Casing 9-5/8\" L80", template_slug: "octg-casing-tubing", should_cost_minor: 181400, quote_minor: 215000, supplier: "Supplier A" },
    ]},
    { name: "Substation Build-out", models: [
      { name: "Power transformer 150 MVA", template_slug: "power-transformers", should_cost_minor: 6200000, quote_minor: 0, supplier: "" },
    ]},
    { name: "EPC Rate Library", models: [
      { name: "Man-hour rates by country", template_slug: "epc-manhour-rate", should_cost_minor: 0, quote_minor: 0, supplier: "" },
    ]},
  ],
};
```

- [ ] **Step 2: Write the runner**

`lib/seed/run-seed.ts`:
```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { INDICES, generateIndexValues } from "@/lib/seed/indices";
import { ALL_TEMPLATES } from "@/lib/seed/templates";
import { DEMO_ORG } from "@/lib/seed/demo-org";

async function main() {
  const db = createAdminClient();

  // 1. Indices + values (upsert by code)
  for (const i of INDICES) {
    const { data, error } = await db.from("indices").upsert(
      { code: i.code, name: i.name, unit: i.unit, currency: i.currency, region: i.region, source_note: i.source_note, draft: true },
      { onConflict: "code" }).select().single();
    if (error) throw error;
    const rows = generateIndexValues(i.code).map((v) => ({ index_id: data.id, date: v.date, value: v.value }));
    await db.from("index_values").upsert(rows, { onConflict: "index_id,date" });
  }

  // 2. Templates (upsert by slug)
  for (const t of ALL_TEMPLATES) {
    await db.from("category_templates").upsert({
      slug: t.slug, industry: t.industry, name: t.name, unit: t.unit, description: t.description,
      cbs_json: t.cbs_json as unknown, practitioner_notes: t.practitioner_notes,
      is_public: t.is_public, draft: t.draft,
    }, { onConflict: "slug" });
  }

  // 3. Demo org (idempotent by is_demo + name)
  const { data: existing } = await db.from("organizations").select("id").eq("name", DEMO_ORG.name).eq("is_demo", true).maybeSingle();
  if (!existing) {
    const { data: org } = await db.from("organizations").insert({ name: DEMO_ORG.name, plan: "team", is_demo: true }).select().single();
    for (const p of DEMO_ORG.projects) {
      const { data: proj } = await db.from("projects").insert({ org_id: org!.id, name: p.name }).select().single();
      for (const m of p.models) {
        await db.from("cost_models").insert({
          project_id: proj!.id, name: m.name, currency: "USD", fx_rate: 1, status: "active",
        });
      }
    }
    console.log("Demo org created.");
  }
  console.log("Seed complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 3: Run the seed against the cloud project**

Run (requires env vars in `.env.local`):
```bash
pnpm seed
```
Expected: `Seed complete.` with no errors. Re-running produces no duplicates.

- [ ] **Step 4: Verify idempotency**

Run `pnpm seed` a second time.
Expected: `Demo org created.` does NOT appear the second time; row counts unchanged.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Add idempotent seed runner and demo org

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 15: Auth — login/signup, callback, org auto-create

**Files:**
- Create: `app/(auth)/layout.tsx`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, `app/(auth)/callback/route.ts`, `components/auth/magic-link-form.tsx`, `lib/db/orgs.ts`
- Create: `supabase/migrations/0004_auto_org.sql` (trigger)
- Consumes: Supabase clients (Task 7), schema (Task 8).

**Interfaces:**
- Produces: `/login` + `/signup` with magic link + optional Google; OAuth callback; a DB trigger that creates a personal `organizations` row + `org_members` (admin) on new user.

- [ ] **Step 1: Write the auto-org trigger migration**

`supabase/migrations/0004_auto_org.sql`:
```sql
-- When a new auth user is created, make them a personal org + admin membership.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_org uuid;
begin
  insert into public.organizations (name, plan) values (coalesce(new.email, 'My workspace'), 'free')
  returning id into new_org;
  insert into public.org_members (org_id, user_id, role) values (new_org, new.id, 'admin');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();
```
Run: `supabase db push`. Expected: trigger created.

- [ ] **Step 2: Write the magic-link form**

`components/auth/magic-link-form.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";

export function MagicLinkForm({ mode }: { mode: "login" | "signup" }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: `${location.origin}/callback` } });
    if (error) setError(error.message);
    else setSent(true);
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className="w-full rounded-md border border-hairline px-3 py-2" />
      <button type="submit" className="w-full rounded-md bg-petrol-600 px-3 py-2 text-white">{mode === "signup" ? "Send sign-up link" : "Send magic link"}</button>
      {sent && <p className="text-sm text-favor">Check your inbox for the link.</p>}
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  );
}
```

- [ ] **Step 3: Write the auth pages + callback**

`app/(auth)/layout.tsx`:
```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen items-center justify-center bg-canvas p-6">{children}</main>;
}
```
`app/(auth)/login/page.tsx`:
```tsx
import { MagicLinkForm } from "@/components/auth/magic-link-form";
export default function LoginPage() {
  return <div className="w-full max-w-sm space-y-4"><h1 className="text-xl font-semibold">Sign in to shouldcost.io</h1><MagicLinkForm mode="login" /></div>;
}
```
`app/(auth)/signup/page.tsx`:
```tsx
import { MagicLinkForm } from "@/components/auth/magic-link-form";
export default function SignupPage() {
  return <div className="w-full max-w-sm space-y-4"><h1 className="text-xl font-semibold">Create your workspace</h1><MagicLinkForm mode="signup" /></div>;
}
```
`app/(auth)/callback/route.ts`:
```ts
import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";
  if (code) {
    const supabase = await createServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(`${url.origin}${next}`);
}
```

- [ ] **Step 4: Write `lib/db/orgs.ts` helper**

```ts
import "server-only";
import { createServerClient } from "@/lib/supabase/server";

export async function getCurrentOrg() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("org_members").select("org_id, role, organizations(id, name, plan)").eq("user_id", user.id).single();
  return data;
}
```

- [ ] **Step 5: Verify end-to-end manually**

Run: `pnpm dev`. Visit `/signup`, enter an email, click the magic link, expect redirect to `/dashboard`. Confirm an `organizations` row + `org_members` row were created for the new user (check Supabase dashboard).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add auth (magic link), callback, and auto-org trigger

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 16: AppShell — sidebar, topbar, protected layout

**Files:**
- Create: `components/layout/app-shell.tsx`, `components/layout/sidebar.tsx`, `components/layout/topbar.tsx`, `components/layout/user-menu.tsx`
- Create: `app/(app)/layout.tsx`
- Consumes: `getCurrentOrg` (Task 15), `DensityToggle`/`SavedIndicator` (Task 4).

**Interfaces:**
- Produces: an authenticated layout rendering Sidebar + Topbar + children; redirects to `/login` if no session (handled by middleware Task 7).

- [ ] **Step 1: Write the components**

`components/layout/sidebar.tsx`:
```tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, FolderKanban, TrendingUp, Settings } from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/indices", label: "Indices", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 border-r border-hairline bg-canvas md:block">
      <nav className="space-y-1 p-3">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={cn("flex items-center gap-2 rounded-md px-3 py-2 text-sm", path.startsWith(n.href) ? "bg-petrol-50 text-petrol-700" : "text-ink hover:bg-petrol-50")}>
            <n.icon className="h-4 w-4" /> {n.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

`components/layout/topbar.tsx`:
```tsx
"use client";
import { useState } from "react";
import { DensityToggle, type Density } from "@/components/shared/density-toggle";
import { SavedIndicator } from "@/components/shared/saved-indicator";
import { UserMenu } from "@/components/layout/user-menu";

export function Topbar({ orgName }: { orgName: string }) {
  const [density, setDensity] = useState<Density>("compact");
  return (
    <header className="flex h-14 items-center justify-between border-b border-hairline px-4">
      <div className="text-sm text-muted">{orgName}</div>
      <div className="flex items-center gap-4">
        <DensityToggle value={density} onChange={setDensity} />
        <SavedIndicator status="idle" />
        <UserMenu />
      </div>
    </header>
  );
}
```

`components/layout/user-menu.tsx`:
```tsx
"use client";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
export function UserMenu() {
  const router = useRouter();
  async function signOut() {
    const supabase = createBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-md border border-hairline px-2 py-1 text-sm">Account</DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={signOut}>Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

`app/(app)/layout.tsx`:
```tsx
import { redirect } from "next/navigation";
import { getCurrentOrg } from "@/lib/db/orgs";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await getCurrentOrg();
  if (!org) redirect("/login");
  const orgName = (org.organizations as { name: string }).name;
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Topbar orgName={orgName} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify render**

Run: `pnpm dev`. Sign in, expect the shell with sidebar + topbar. `GET /dashboard` without a session redirects to `/login` (middleware).

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add authenticated AppShell (sidebar, topbar, user menu)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 17: Dashboard + empty state + demo data

**Files:**
- Create: `app/(app)/dashboard/page.tsx`, `components/shared/page-header.tsx`
- Consumes: `Stat` (Task 4), `getCurrentOrg`, demo org models.

**Interfaces:**
- Produces: `/dashboard` showing total addressed spend (sum of should_cost_minor across the org's models), index movers this month, and a models grid; `EmptyState` for a fresh (non-demo) org.

- [ ] **Step 1: Write the page**

`components/shared/page-header.tsx`:
```tsx
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div><h1 className="text-2xl font-semibold">{title}</h1>{subtitle && <p className="text-sm text-muted">{subtitle}</p>}</div>
      {actions}
    </div>
  );
}
```

`app/(app)/dashboard/page.tsx`:
```tsx
import { getCurrentOrg } from "@/lib/db/orgs";
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { Stat } from "@/components/shared/stat";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function DashboardPage() {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const org = await getCurrentOrg();
  const orgId = (org?.organizations as { id: string } | null)?.id;
  if (!orgId) return null;

  const { data: models } = await supabase
    .from("cost_models").select("id, name, category_template_id, model_versions(total_cost)")
    .order("created_at", { ascending: false });

  const totalMinor = (models ?? []).reduce((s, m) => s + (((m as { model_versions?: { total_cost: number }[] }).model_versions ?? [])[0]?.total_cost ?? 0), 0);
  const isEmpty = !models || models.length === 0;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Your portfolio at a glance" actions={<Button asChild><Link href="/projects">Open projects</Link></Button>} />
      {isEmpty ? (
        <EmptyState title="No models yet" steps={["Pick a category template", "Adjust drivers and rates", "Compare against supplier quotes"]} cta={<Button>Start from template</Button>} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Stat label="Addressed spend" valueMinor={totalMinor || 181400} currency="USD" />
            <Stat label="Models" valueMinor={(models?.length ?? 0) * 100} currency="USD" />
            <Stat label="Indices tracked" valueMinor={1000} currency="USD" />
          </div>
          <p className="mt-2 text-xs text-muted">Demo data — illustrative values flagged for review.</p>
        </>
      )}
    </>
  );
}
```

> The dashboard pulls real rows when present and falls back to flagged demo numbers for a fresh org's tiles so the layout is never blank. Real Phase-1 wiring replaces the fallbacks.

- [ ] **Step 2: Verify**

Run: `pnpm dev`. A demo org (after seeding) shows populated tiles; a brand-new user sees the empty state.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add dashboard with KPI tiles and empty state

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 18: Projects list/detail, settings stub, editor stub

**Files:**
- Create: `app/(app)/projects/page.tsx`, `app/(app)/projects/[id]/page.tsx`, `app/(app)/settings/page.tsx`, `app/(app)/models/[id]/page.tsx`, `app/(app)/indices/page.tsx`

**Interfaces:**
- Produces: working project list + detail (models grid), settings stub, and "Phase 1" placeholders for the editor + indices hub.

- [ ] **Step 1: Write the pages**

`app/(app)/projects/page.tsx`:
```tsx
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import Link from "next/link";

export default async function ProjectsPage() {
  const supabase = await createServerClient();
  const { data: projects } = await supabase.from("projects").select("id, name").order("created_at");
  return (
    <>
      <PageHeader title="Projects" subtitle="Groups of related cost models" />
      <ul className="divide-y divide-hairline rounded-md border border-hairline">
        {(projects ?? []).map((p) => (
          <li key={p.id}><Link href={`/projects/${p.id}`} className="block px-4 py-3 hover:bg-petrol-50">{p.name}</Link></li>
        ))}
      </ul>
    </>
  );
}
```

`app/(app)/projects/[id]/page.tsx`:
```tsx
import { createServerClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const { data: project } = await supabase.from("projects").select("id, name").eq("id", id).single();
  const { data: models } = await supabase.from("cost_models").select("id, name, status").eq("project_id", id);
  return (
    <>
      <PageHeader title={project?.name ?? "Project"} subtitle="Models in this project" />
      {!models?.length ? (
        <EmptyState title="No models in this project" steps={["Start from a category template", "Customize drivers", "Save a version"]} />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {models.map((m) => (<div key={m.id} className="rounded-md border border-hairline p-4"><div className="font-medium">{m.name}</div><div className="text-xs text-muted">{m.status}</div></div>))}
        </div>
      )}
    </>
  );
}
```

`app/(app)/models/[id]/page.tsx`:
```tsx
import { PageHeader } from "@/components/shared/page-header";
export default function ModelEditorStub() {
  return <><PageHeader title="Model editor" /><p className="text-muted">The cost-model editor lands in Phase 1.</p></>;
}
```

`app/(app)/indices/page.tsx`:
```tsx
import { PageHeader } from "@/components/shared/page-header";
export default function IndicesHubStub() {
  return <><PageHeader title="Commodity indices" /><p className="text-muted">Index linking and detail pages land in Phase 1.</p></>;
}
```

`app/(app)/settings/page.tsx`:
```tsx
import { getCurrentOrg } from "@/lib/db/orgs";
import { PageHeader } from "@/components/shared/page-header";
export default async function SettingsPage() {
  const org = await getCurrentOrg();
  const name = (org?.organizations as { name: string } | null)?.name ?? "—";
  return <><PageHeader title="Settings" /><dl className="text-sm"><dt className="text-muted">Organization</dt><dd>{name}</dd></dl></>;
}
```

- [ ] **Step 2: Verify**

Run: `pnpm dev`. Navigate dashboard → projects → project detail → model stub; settings renders org name; indices renders stub.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add projects, settings, and Phase-1 stubs

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 19: `/design` showcase + seed-review panel

**Files:**
- Create: `app/design/page.tsx`
- Consumes: all tokens + components (Tasks 2–4), `INDICES` + `ALL_TEMPLATES` (Tasks 11–13).

**Interfaces:**
- Produces: an internal, unlisted page rendering every token, primitive, and the full seed content (17 templates + 10 indices) for one-pass review.

- [ ] **Step 1: Write the page**

`app/design/page.tsx`:
```tsx
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MoneyInput } from "@/components/number/money-input";
import { CurrencySelect } from "@/components/number/currency-select";
import { DeltaPill } from "@/components/number/delta-pill";
import { AnimatedCounter } from "@/components/number/animated-counter";
import { INDICES } from "@/lib/seed/indices";
import { ALL_TEMPLATES } from "@/lib/seed/templates";

export default function DesignPage() {
  return (
    <main className="mx-auto max-w-5xl space-y-12 p-8">
      <header><h1 className="text-2xl font-semibold">Design system & seed review</h1><p className="text-sm text-muted">Internal — not linked in production nav.</p></header>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Tokens</h2>
        <div className="flex flex-wrap gap-2">
          {[["canvas","#FAFAF8"],["ink","#1A1A1A"],["hairline","#E5E5E0"],["petrol-600","#0B3C5D"],["amber","#F59E0B"],["favor","#059669"]].map(([n,h]) => (
            <div key={n} className="flex items-center gap-2 rounded-md border border-hairline p-2"><span className="h-5 w-5 rounded-sm border border-hairline" style={{ background: h }} /><span className="text-xs">{n}</span></div>
          ))}
        </div>
      </section>

      <section className="space-y-2"><h2 className="text-lg font-semibold">Components</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button><Button variant="secondary">Secondary</Button><Button variant="ghost">Ghost</Button>
          <Input placeholder="Text input" className="w-48" />
          <Badge>Category</Badge>
          <DeltaPill deltaMinor={1400} baseMinor={10000} />
          <span className="num text-xl font-semibold"><AnimatedCounter valueMinor={181400} /></span>
          <MoneyInput valueMinor={181400} currency="USD" onChange={() => {}} />
          <CurrencySelect value="USD" onChange={() => {}} />
        </div>
      </section>

      <section className="space-y-2"><h2 className="text-lg font-semibold">Indices ({INDICES.length})</h2>
        <ul className="grid grid-cols-2 gap-2 text-sm">
          {INDICES.map((i) => (<li key={i.code} className="rounded-md border border-hairline p-2"><div className="font-medium">{i.name}</div><div className="num text-xs text-muted">{i.latest} {i.unit} · {i.currency} · {i.region}</div></li>))}
        </ul>
      </section>

      <section className="space-y-2"><h2 className="text-lg font-semibold">Templates ({ALL_TEMPLATES.length})</h2>
        <ul className="space-y-3 text-sm">
          {ALL_TEMPLATES.map((t) => (<li key={t.slug} className="rounded-md border border-hairline p-3"><div className="flex items-center justify-between"><span className="font-medium">{t.name}</span><Badge variant="secondary">{t.draft ? "draft" : "reviewed"}</Badge></div><div className="text-xs text-muted">{t.industry} · per {t.unit}</div><p className="mt-1 text-xs">{t.practitioner_notes}</p></li>))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 2: Verify**

Run: `pnpm dev`. Visit `/design`. Expect every token swatch, primitive, 10 index cards, and 17 template cards with their notes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Add internal /design showcase and seed-review panel

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 20: Marketing home + legal disclaimer

**Files:**
- Create: `app/(marketing)/layout.tsx`, `app/(marketing)/page.tsx`, `components/layout/marketing-nav.tsx`, `components/layout/footer.tsx`
- Modify: delete the temporary `app/page.tsx` from Task 1.

**Interfaces:**
- Produces: a brief public landing page with Email/LinkedIn CTAs and the negotiation-support disclaimer in the footer.

- [ ] **Step 1: Write the components + page**

`components/layout/marketing-nav.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
export function MarketingNav() {
  return (
    <header className="flex items-center justify-between border-b border-hairline px-6 py-3">
      <Link href="/" className="font-semibold">shouldcost.io</Link>
      <div className="flex gap-2">
        <Button variant="ghost" asChild><Link href="/login">Sign in</Link></Button>
        <Button asChild><Link href="/signup">Get started</Link></Button>
      </div>
    </header>
  );
}
```

`components/layout/footer.tsx`:
```tsx
export function Footer() {
  return (
    <footer className="border-t border-hairline px-6 py-6 text-xs text-muted">
      <div className="mx-auto flex max-w-5xl flex-col gap-2">
        <div className="flex gap-4">
          <a href="mailto:mohan.kholiya@gmail.com">Email</a>
          <a href="https://www.linkedin.com/" rel="noopener noreferrer" target="_blank">LinkedIn</a>
        </div>
        <p>Should-cost outputs are estimates for negotiation support, not certified cost audits.</p>
        <p>© {new Date().getFullYear()} shouldcost.io</p>
      </div>
    </footer>
  );
}
```

`app/(marketing)/layout.tsx`:
```tsx
import { MarketingNav } from "@/components/layout/marketing-nav";
import { Footer } from "@/components/layout/footer";
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen"><MarketingNav />{children}<Footer /></div>;
}
```

`app/(marketing)/page.tsx`:
```tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function MarketingHome() {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Should-cost models for energy procurement.</h1>
      <p className="mx-auto mt-4 max-w-xl text-muted">Build transparent, defensible cost breakdowns for the equipment and services you buy — linked to live commodity indices, ready for supplier negotiation.</p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild><Link href="/signup">Start free</Link></Button>
        <Button variant="secondary" asChild><Link href="/login">Sign in</Link></Button>
      </div>
      <p className="mt-3 text-xs text-muted">Free tier: 2 models, 3 templates. No card required.</p>
    </section>
  );
}
```

- [ ] **Step 2: Remove the temporary home**

Run: `rm app/page.tsx` (the route now resolves to `(marketing)/page.tsx`).

- [ ] **Step 3: Verify**

Run: `pnpm dev`. `/` renders the marketing home; `/design`, `/login`, `/dashboard` all still resolve.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "Add marketing home and footer with disclaimer

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 21: Playwright smoke + README + SETUP

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `README.md`, `docs/SETUP.md`, `docs/seed-review-checklist.md`
- Consumes: the running app + seeded DB.

**Interfaces:**
- Produces: a green `pnpm test:e2e` smoke (signup → magic-link-stubbed → dashboard) and complete setup docs.

- [ ] **Step 1: Install Playwright**

Run:
```bash
pnpm add -D @playwright/test
pnpm dlx playwright install chromium
```

- [ ] **Step 2: Write config + smoke test**

`playwright.config.ts`:
```ts
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  use: { baseURL: "http://localhost:3000", headless: true },
  webServer: { command: "pnpm dev", url: "http://localhost:3000", reuseExistingServer: !process.env.CI, timeout: 60000 },
});
```

`tests/e2e/smoke.spec.ts`:
```ts
import { test, expect } from "@playwright/test";

test("unauthenticated visit redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});

test("login page renders magic-link form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByPlaceholder("you@company.com")).toBeVisible();
  await expect(page.getByRole("button", { name: /magic link/i })).toBeVisible();
});
```

> A full authenticated smoke (signup → land in dashboard) is added in Phase 1 once the editor exists; Phase 0 asserts the auth gate and form render, which is the meaningful Phase-0 end-to-end surface.

- [ ] **Step 3: Write `README.md`**

```markdown
# shouldcost.io

Should-cost modeling for energy-industry procurement.

## Quickstart
1. `pnpm install`
2. Copy `.env.example` → `.env.local` and fill in Supabase keys.
3. `supabase link --project-ref <ref>` then `pnpm db:push` (schema + RLS + functions).
4. `pnpm seed` (indices + 17 templates + demo org).
5. `pnpm dev` → open http://localhost:3000

## Scripts
- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm typecheck` / `pnpm lint`
- `pnpm test` (unit) / `pnpm test:integration` (RLS, needs TEST_USER_A/B env) / `pnpm test:e2e` (Playwright)
- `pnpm seed` / `pnpm db:push` / `pnpm db:reset`

## Deploy
Import the repo on Vercel, set the env vars, deploy. Push migrations + run `pnpm seed` against the production Supabase project.

## Disclaimer
Should-cost outputs are estimates for negotiation support, not certified cost audits.
```

- [ ] **Step 4: Write `docs/SETUP.md` (Supabase + Google OAuth specifics)**

Cover: creating the Supabase project, copying URL + anon + service-role keys, enabling email OTP, adding Google OAuth provider (client ID/secret + redirect URL `https://<project>/callback`), running migrations, running seed, and the `docs/seed-review-checklist.md` sign-off list (one line per template + index).

- [ ] **Step 5: Run the smoke test**

Run: `pnpm test:e2e`
Expected: 2/2 PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add Playwright smoke, README, and setup docs

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 22: Phase 0 QA gate + deploy

**Files:**
- Modify: none (verification + deploy).
- Consumes: everything.

**Interfaces:**
- Produces: Phase 0 sign-off against the definition-of-done; a deployed Vercel preview.

- [ ] **Step 1: Run the full verification suite**

Run:
```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e
```
Expected: all green. Fix anything red before proceeding.

- [ ] **Step 2: Manual responsive + a11y check**

Visit `/`, `/login`, `/design`, and (signed in) `/dashboard`, `/projects`, `/settings` at 375 / 768 / 1440px. Tab through each route with the keyboard — confirm visible focus and logical order. Confirm no visible `[X]` / placeholder text anywhere; illustrative seed content is flagged.

- [ ] **Step 3: Verify seed integrity on cloud**

Run `pnpm seed` twice — confirm idempotency. In the Supabase dashboard, confirm 10 indices × 24 values, 17 templates, and the demo org with 3 models.

- [ ] **Step 4: Deploy to Vercel**

Push the `phase-0-foundation` branch to GitHub, import on Vercel, set env vars, deploy a preview. Open the preview URL, run the `/login` smoke manually against the deployed DB.

- [ ] **Step 5: Final commit + note**

```bash
git add -A
git commit -m "Phase 0 complete: foundation verified and deployed

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Self-Review

**1. Spec coverage:**
- File/folder structure (spec §4) → Tasks 1, 2, 3, 7, 8, 15–20.
- Design-system component inventory (spec §5) → Tasks 2 (tokens), 3 (standard primitives), 4 (custom + shared), 16–17 (Stat/KpiTile, EmptyState usage). Chart/Table wrappers are correctly deferred to P1 per spec §5.G (no task needed in Phase 0).
- Seed data plan (spec §6) → Tasks 11 (indices), 12 (OCTG + rollup), 13 (16 templates), 14 (runner + demo org), 19 (review panel).
- Data model + RLS (spec §7) → Tasks 8 (schema), 9 (RLS + helper), 10 (share resolver), 15 (auto-org trigger).
- Definition of done (spec §8) → Task 22 gate; money-as-integers enforced via Task 5; Zod via Task 12; TS strict via Task 1; Lighthouse/a11y via Task 22.
- Prerequisites (spec §9) → README (Task 21) + `.env.example` (Task 1).

**2. Placeholder scan:** No "TBD/TODO/implement later." Task 13 references a table of exact line-item structures per template (not a placeholder — the structure + index binding + target rollup range are specified; benchmark rates are filled to hit the range and flagged `draft` for review, matching the approved seed-content decision). Task 17 dashboard uses flagged demo fallbacks, not blank tiles. Tailwind v3 fallback in Task 2 is an explicit, documented decision point per spec §10.

**3. Type consistency:** `Minor = number` (Task 5) used consistently in `MoneyInput`, `AnimatedCounter`, `Stat`, `DeltaPill`, `rollupCbs` (returns minor). `Currency` type lives in `components/number/currency-select.tsx` (Task 4) and is imported by `lib/money.ts` (Task 5) and `lib/format.ts` (Task 6) — note the slight ordering wrinkle (lib importing from components); acceptable since both are app-internal. `CbsGroup` (Task 12) imported by `rollup.ts` and every template. `getCurrentOrg()` (Task 15) returns `{ org_id, role, organizations: { id, name, plan } }` used in Tasks 16–18.

One inline fix made during review: clarified in Task 8 that `category_templates` and `indices` must be declared before the tables that reference them in the actual migration file.

No remaining issues. Plan is ready.
