# Phase 4 (lean) + Free Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the should-cost product live and fully free, adding dark mode, a command palette, an onboarding checklist, Google sign-in, and magic-link rate-limit mitigation — then merge Phases 0–4 and deploy to production.

**Architecture:** Next.js 14 App Router. Pure, testable logic lives in `lib/*` (onboarding step derivation, command-item building, rate-limit detection); thin client/server components consume it. Dark mode activates already-present `next-themes` + `.dark` token infra. Google OAuth reuses the existing PKCE `code` callback. No database migration.

**Tech Stack:** Next.js 14, TypeScript strict, Tailwind v4, shadcn/Radix, next-themes, cmdk, lucide-react, Supabase Auth, Vitest.

## Global Constraints

- TypeScript strict, zero `any`. Match existing file/component patterns (DensityToggle, Surface, EmptyState).
- Migration-free: no new DB tables/columns. No new required env vars.
- Keep the full suite green (currently 129/129). Run vitest with the threads pool if the default forks pool throws `spawn UNKNOWN` on this Windows box.
- Build with `NEXT_TELEMETRY_DISABLED=1` (telemetry-on hangs the sandboxed build).
- WCAG 2.1 AA: visible focus, semantic landmarks, contrast — including dark mode. Lighthouse 90+ preserved.
- Money/currency untouched. Free-launch (`FREE_LAUNCH = true`) stays on.

---

### Task 1: Dark-mode theme provider + toggle

**Files:**
- Create: `components/theme/theme-provider.tsx`
- Create: `components/theme/theme-toggle.tsx`
- Modify: `app/layout.tsx` (mount provider, `suppressHydrationWarning`)
- Modify: `components/layout/topbar.tsx` (add toggle)

**Interfaces:**
- Produces: `ThemeProvider` (client wrapper), `ThemeToggle` (client button).

- [ ] **Step 1: Create the theme provider**

```tsx
// components/theme/theme-provider.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

- [ ] **Step 2: Mount it in the root layout**

Modify `app/layout.tsx`: add `suppressHydrationWarning` to `<html>`, wrap `{children}` + `<Toaster />` in `<ThemeProvider>`.

```tsx
import { ThemeProvider } from "@/components/theme/theme-provider";
// ...
    <html lang="en" suppressHydrationWarning className={`${fontSans.variable} ${fontMono.variable}`}>
      <body>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
```

- [ ] **Step 3: Create the toggle**

```tsx
// components/theme/theme-toggle.tsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Cycles light ⇄ dark. Renders a stable placeholder until mounted to avoid hydration mismatch. */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={mounted ? (isDark ? "Switch to light mode" : "Switch to dark mode") : "Toggle theme"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      {mounted && isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
```

- [ ] **Step 4: Add the toggle to the topbar**

Modify `components/layout/topbar.tsx`: import `ThemeToggle`, render it before `DensityToggle` in the right-hand `div`.

- [ ] **Step 5: Verify build + dark tokens**

Run: `NEXT_TELEMETRY_DISABLED=1 npx next lint` → clean. Manually confirm `app/globals.css` `.dark` block covers surface/foreground/border tokens used by Surface/Table; fill any obvious gaps.

- [ ] **Step 6: Commit**

```bash
git add components/theme app/layout.tsx components/layout/topbar.tsx app/globals.css
git commit -m "Add dark-mode theme provider and toggle"
```

---

### Task 2: Command palette (⌘K)

**Files:**
- Modify: `package.json` (add `cmdk`)
- Create: `components/ui/command.tsx` (shadcn command primitive)
- Create: `lib/command/items.ts` (pure item builder)
- Create: `tests/unit/command-items.test.ts`
- Create: `components/command/command-palette.tsx`
- Modify: `app/(app)/layout.tsx` (mount palette, pass recent models)

**Interfaces:**
- Produces: `buildCommandItems({ recentModels }): CommandGroup[]` where
  `type CommandGroup = { heading: string; items: { label: string; href: string }[] }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/command-items.test.ts
import { describe, expect, it } from "vitest";
import { buildCommandItems } from "@/lib/command/items";

describe("buildCommandItems", () => {
  it("always includes core navigation", () => {
    const groups = buildCommandItems({ recentModels: [] });
    const nav = groups.find((g) => g.heading === "Navigation");
    expect(nav?.items.map((i) => i.href)).toEqual([
      "/dashboard",
      "/projects",
      "/indices",
      "/settings",
    ]);
  });

  it("adds a Recent models group only when models exist", () => {
    expect(buildCommandItems({ recentModels: [] }).some((g) => g.heading === "Recent models")).toBe(false);
    const groups = buildCommandItems({ recentModels: [{ id: "m1", name: "Pump skid" }] });
    const recent = groups.find((g) => g.heading === "Recent models");
    expect(recent?.items[0]).toEqual({ label: "Pump skid", href: "/models/m1" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/command-items.test.ts --pool=threads`
Expected: FAIL — cannot find module `@/lib/command/items`.

- [ ] **Step 3: Implement the builder**

```ts
// lib/command/items.ts
export type CommandItem = { label: string; href: string };
export type CommandGroup = { heading: string; items: CommandItem[] };

const NAV: CommandItem[] = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Projects", href: "/projects" },
  { label: "Indices", href: "/indices" },
  { label: "Settings", href: "/settings" },
];

export function buildCommandItems({
  recentModels,
}: {
  recentModels: { id: string; name: string }[];
}): CommandGroup[] {
  const groups: CommandGroup[] = [{ heading: "Navigation", items: NAV }];
  if (recentModels.length > 0) {
    groups.push({
      heading: "Recent models",
      items: recentModels.map((m) => ({ label: m.name, href: `/models/${m.id}` })),
    });
  }
  return groups;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/command-items.test.ts --pool=threads`
Expected: PASS (2 tests).

- [ ] **Step 5: Add cmdk and the shadcn command primitive**

Run: `pnpm add cmdk`. Create `components/ui/command.tsx` with the standard shadcn command wrapper (CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem) built on `cmdk` + the existing `Dialog` from `components/ui/dialog.tsx`. Match the project's Tailwind token classes (`bg-surface`, `text-muted-foreground`, `border-hairline`).

- [ ] **Step 6: Create the palette component**

```tsx
// components/command/command-palette.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { buildCommandItems } from "@/lib/command/items";

export function CommandPalette({
  recentModels,
}: {
  recentModels: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const groups = buildCommandItems({ recentModels });

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup key={group.heading} heading={group.heading}>
            {group.items.map((item) => (
              <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                {item.label}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
        <CommandGroup heading="Actions">
          <CommandItem value="New project" onSelect={() => go("/projects")}>
            New project
          </CommandItem>
          <CommandItem
            value="Toggle theme"
            onSelect={() => {
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
          >
            Toggle theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

- [ ] **Step 7: Mount in the app layout**

Modify `app/(app)/layout.tsx`: import `CommandPalette`, render `<CommandPalette recentModels={recentModels} />` just inside the outer `<div className="flex min-h-screen">` (it renders nothing until opened).

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-lock.yaml components/ui/command.tsx lib/command components/command tests/unit/command-items.test.ts "app/(app)/layout.tsx"
git commit -m "Add command palette with Cmd+K navigation"
```

---

### Task 3: Onboarding checklist

**Files:**
- Create: `lib/onboarding/steps.ts` (pure derivation)
- Create: `tests/unit/onboarding-steps.test.ts`
- Create: `components/onboarding/onboarding-checklist.tsx`
- Modify: `app/(app)/dashboard/page.tsx` (fetch quote count, render checklist)

**Interfaces:**
- Produces: `deriveOnboardingSteps({ modelCount, quoteCount }): OnboardingStep[]` where
  `type OnboardingStep = { id: string; label: string; done: boolean; href: string }`.
- Produces: `allComplete(steps): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/onboarding-steps.test.ts
import { describe, expect, it } from "vitest";
import { allComplete, deriveOnboardingSteps } from "@/lib/onboarding/steps";

describe("deriveOnboardingSteps", () => {
  it("marks create-model done once a model exists", () => {
    const steps = deriveOnboardingSteps({ modelCount: 1, quoteCount: 0 });
    expect(steps.find((s) => s.id === "create-model")?.done).toBe(true);
    expect(steps.find((s) => s.id === "add-quote")?.done).toBe(false);
  });

  it("marks quote + compare done once a quote exists", () => {
    const steps = deriveOnboardingSteps({ modelCount: 2, quoteCount: 3 });
    expect(steps.every((s) => s.done)).toBe(true);
    expect(allComplete(steps)).toBe(true);
  });

  it("is fully incomplete for a brand-new org", () => {
    const steps = deriveOnboardingSteps({ modelCount: 0, quoteCount: 0 });
    expect(steps.some((s) => s.done)).toBe(false);
    expect(allComplete(steps)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/onboarding-steps.test.ts --pool=threads`
Expected: FAIL — cannot find module `@/lib/onboarding/steps`.

- [ ] **Step 3: Implement the derivation**

```ts
// lib/onboarding/steps.ts
export type OnboardingStep = { id: string; label: string; done: boolean; href: string };

export function deriveOnboardingSteps({
  modelCount,
  quoteCount,
}: {
  modelCount: number;
  quoteCount: number;
}): OnboardingStep[] {
  const hasModel = modelCount > 0;
  const hasQuote = quoteCount > 0;
  return [
    { id: "create-model", label: "Create your first cost model", done: hasModel, href: "/projects" },
    { id: "add-quote", label: "Add a supplier quote", done: hasQuote, href: "/projects" },
    { id: "run-compare", label: "Run a quote comparison", done: hasQuote, href: "/projects" },
  ];
}

export function allComplete(steps: OnboardingStep[]): boolean {
  return steps.every((s) => s.done);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/onboarding-steps.test.ts --pool=threads`
Expected: PASS (3 tests).

- [ ] **Step 5: Create the checklist component**

```tsx
// components/onboarding/onboarding-checklist.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Surface } from "@/components/ui/surface";
import { Button } from "@/components/ui/button";
import { allComplete, type OnboardingStep } from "@/lib/onboarding/steps";

const DISMISS_KEY = "sc_onboarding_dismissed";

export function OnboardingChecklist({ steps }: { steps: OnboardingStep[] }) {
  const [dismissed, setDismissed] = useState(true); // default hidden until localStorage read (no flash)
  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (dismissed || allComplete(steps)) return null;
  const doneCount = steps.filter((s) => s.done).length;

  return (
    <Surface padding="lg" radius="lg" className="mb-4">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">Get started · {doneCount}/{steps.length}</div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
        >
          Dismiss
        </Button>
      </div>
      <ul className="mt-3 space-y-2">
        {steps.map((s) => (
          <li key={s.id} className="flex items-center gap-3 text-sm">
            <span
              aria-hidden
              className={`flex size-5 items-center justify-center rounded-full border ${
                s.done ? "border-favor bg-favor text-white" : "border-hairline text-transparent"
              }`}
            >
              <Check className="size-3" />
            </span>
            {s.done ? (
              <span className="text-muted-foreground line-through">{s.label}</span>
            ) : (
              <Link href={s.href} className="hover:underline">
                {s.label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Surface>
  );
}
```

- [ ] **Step 6: Wire into the dashboard**

Modify `app/(app)/dashboard/page.tsx`: after the models query, add a quote count query and render the checklist above the KPI grid.

```tsx
import { deriveOnboardingSteps } from "@/lib/onboarding/steps";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
// ... inside the component, after `const models = ...`:
  const { count: quoteCount } = await supabase
    .from("quotes")
    .select("id", { count: "exact", head: true });
  const steps = deriveOnboardingSteps({ modelCount: models.length, quoteCount: quoteCount ?? 0 });
// ... in JSX, immediately after <PageHeader ... />:
      <OnboardingChecklist steps={steps} />
```

- [ ] **Step 7: Run the suite**

Run: `npx vitest run --pool=threads`
Expected: PASS (existing + 5 new).

- [ ] **Step 8: Commit**

```bash
git add lib/onboarding components/onboarding tests/unit/onboarding-steps.test.ts "app/(app)/dashboard/page.tsx"
git commit -m "Add dashboard onboarding checklist"
```

---

### Task 4: Google (Gmail) sign-in

**Files:**
- Create: `components/auth/google-button.tsx`
- Modify: `app/(auth)/login/page.tsx`
- Modify: `app/(auth)/signup/page.tsx`

**Interfaces:**
- Produces: `GoogleButton` (client) that initiates `signInWithOAuth`. Callback is unchanged.

- [ ] **Step 1: Create the Google button**

```tsx
// components/auth/google-button.tsx
"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function GoogleButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setPending(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/callback` },
    });
    if (error) {
      setError(error.message);
      setPending(false);
    }
    // On success the browser is redirected to Google; no further state needed.
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full" onClick={onClick} disabled={pending}>
        {pending ? "Redirecting…" : "Continue with Google"}
      </Button>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Add button + divider to login and signup**

In `app/(auth)/login/page.tsx` and `app/(auth)/signup/page.tsx`, render `<GoogleButton />` above the existing `<MagicLinkForm .../>`, separated by a divider:

```tsx
import { GoogleButton } from "@/components/auth/google-button";
// ...
      <GoogleButton />
      <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-hairline" />
        or
        <span className="h-px flex-1 bg-hairline" />
      </div>
      <MagicLinkForm mode="login" />
```

- [ ] **Step 3: Verify build**

Run: `NEXT_TELEMETRY_DISABLED=1 npx next lint` → clean.

- [ ] **Step 4: Commit**

```bash
git add components/auth/google-button.tsx "app/(auth)/login/page.tsx" "app/(auth)/signup/page.tsx"
git commit -m "Add Google (Gmail) sign-in option"
```

---

### Task 5: Magic-link rate-limit mitigation

**Files:**
- Create: `lib/auth/rate-limit.ts` (pure detection)
- Create: `tests/unit/auth-rate-limit.test.ts`
- Modify: `components/auth/magic-link-form.tsx` (cooldown + 429 message)

**Interfaces:**
- Produces: `isRateLimitError(error): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/auth-rate-limit.test.ts
import { describe, expect, it } from "vitest";
import { isRateLimitError } from "@/lib/auth/rate-limit";

describe("isRateLimitError", () => {
  it("matches HTTP 429", () => {
    expect(isRateLimitError({ status: 429, message: "nope" })).toBe(true);
  });
  it("matches rate-limit messages regardless of case", () => {
    expect(isRateLimitError({ message: "Email rate limit exceeded" })).toBe(true);
    expect(isRateLimitError({ message: "over_email_send_rate_limit" })).toBe(true);
  });
  it("does not match unrelated errors", () => {
    expect(isRateLimitError({ status: 400, message: "invalid email" })).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/auth-rate-limit.test.ts --pool=threads`
Expected: FAIL — cannot find module `@/lib/auth/rate-limit`.

- [ ] **Step 3: Implement the detector**

```ts
// lib/auth/rate-limit.ts
/** True when a Supabase auth error is a rate-limit (HTTP 429 or an email-send-limit message). */
export function isRateLimitError(error: { status?: number; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.status === 429) return true;
  const msg = (error.message ?? "").toLowerCase();
  return msg.includes("rate limit") || msg.includes("rate_limit");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/auth-rate-limit.test.ts --pool=threads`
Expected: PASS (3 tests).

- [ ] **Step 5: Add cooldown + friendly message to the form**

Modify `components/auth/magic-link-form.tsx`:
- Add `const [cooldown, setCooldown] = useState(0);` and a `useEffect` that decrements it every second while `> 0`.
- On successful send, `setCooldown(60)`.
- Disable the submit button while `pending || cooldown > 0`; label it `Resend in ${cooldown}s` during cooldown.
- On error, if `isRateLimitError(error)` show: "Too many email requests — try **Continue with Google** above, or wait a minute." else show `error.message`. Also start the cooldown on a rate-limit error.

```tsx
import { isRateLimitError } from "@/lib/auth/rate-limit";
import { useEffect } from "react";
// ...
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
// ... in onSubmit, replace the error/else tail:
    if (error) {
      if (isRateLimitError(error)) {
        setError("Too many email requests — try “Continue with Google” above, or wait a minute.");
        setCooldown(60);
      } else {
        setError(error.message);
      }
    } else {
      setSent(true);
      setCooldown(60);
    }
// ... button:
      <Button type="submit" className="w-full" disabled={pending || cooldown > 0}>
        {pending ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : mode === "signup" ? "Send sign-up link" : "Send magic link"}
      </Button>
```

Keep the existing `sent` confirmation view.

- [ ] **Step 6: Run the suite**

Run: `npx vitest run --pool=threads`
Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add lib/auth/rate-limit.ts tests/unit/auth-rate-limit.test.ts components/auth/magic-link-form.tsx
git commit -m "Add magic-link cooldown and rate-limit handling"
```

---

### Task 6: Gate, merge, and deploy

**Files:** none (release task).

- [ ] **Step 1: Full green gate**

Run, all must pass clean:
- `npx tsc --noEmit`
- `NEXT_TELEMETRY_DISABLED=1 npx next lint`
- `npx vitest run --pool=threads`
- `NEXT_TELEMETRY_DISABLED=1 npx next build`

- [ ] **Step 2: Merge phase-4 into the live default branch**

```bash
git checkout phase-0-foundation
git merge --no-ff phase-4 -m "Merge Phase 4 (lean) + free launch into foundation"
```

- [ ] **Step 3: Push**

```bash
git push origin phase-0-foundation
git push origin phase-4
```

- [ ] **Step 4: Deploy to production**

```bash
NEXT_TELEMETRY_DISABLED=1 vercel --prod --yes
```

Safe because free-launch hides billing and elevates every org to `pro` — no Stripe prod env is exercised.

- [ ] **Step 5: Smoke test production**

Verify HTTP 200 / expected redirects on `/`, `/login` (Google button + magic-link form render), `/dashboard` (after auth). Confirm ⌘K opens the palette, dark-mode toggle flips the theme, and XLSX export downloads.

- [ ] **Step 6: Report the required Supabase dashboard actions**

Surface to the user (from spec §7): enable Google provider (Google Cloud OAuth client + Supabase Providers config + URL allowlist), and configure custom SMTP / raise auth rate limits to fully fix magic-link throttling.
