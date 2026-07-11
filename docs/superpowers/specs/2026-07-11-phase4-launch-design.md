# Phase 4 (lean) + Free Launch — Design Spec

**Phase:** 4 of 5 (lean slice)
**Status:** Approved (2026-07-11) — proceed autonomously through plan → implement → merge → deploy.
**Date:** 2026-07-11
**Plan:** `docs/superpowers/plans/2026-07-11-phase4-launch.md` (to be written next)

## 1. Goal

Ship the should-cost product **live to production, fully free**, with a lean, high-value slice
of Phase 4 polish plus two auth improvements. Billing stays deferred (free-launch mode already
elevates every org to `pro`). No production database migration is required.

## 2. Scope (in)

Five deliverables, each **migration-free** and shippable today:

1. **Dark-mode toggle** — activate the existing (but unmounted) `next-themes` + `.dark` token infra.
2. **Command palette (⌘K / Ctrl-K)** — fast navigation + actions.
3. **Onboarding checklist** — dashboard nudge, completion derived from real data.
4. **Google (Gmail) sign-in** — `signInWithOAuth` button on login + signup; reuses the existing callback.
5. **Magic-link rate-limit mitigation** — client cooldown + friendly 429 handling; Google as the
   no-email alternative. (True email-cap fix = custom SMTP, a dashboard action — see §7.)

## 3. Out of scope (Phase 4B fast-follow)

Comments, audit-log UI, Sentry + analytics — these need prod migrations and/or external accounts.

## 4. Design detail

### 4.1 Dark-mode toggle
`next-themes ^0.4.6` is already a dependency and `globals.css` already defines `.dark` tokens
(`@custom-variant dark (&:is(.dark *))`, `.dark { … }`). No `ThemeProvider` is mounted, so it is
currently inert.

- `components/theme/theme-provider.tsx` (client): wraps next-themes with `attribute="class"`,
  `defaultTheme="system"`, `enableSystem`, `disableTransitionOnChange`.
- Mount in `app/layout.tsx`; add `suppressHydrationWarning` to `<html>`.
- `components/theme/theme-toggle.tsx`: Sun/Moon button (lucide), mirrors the `DensityToggle`
  pattern; placed in `Topbar` beside `DensityToggle`.
- Audit `.dark` token coverage for surfaces in active use; fill gaps if any.

### 4.2 Command palette
- Add `cmdk` dependency + shadcn `components/ui/command.tsx`.
- `components/command/command-palette.tsx` (client), mounted in `app/(app)/layout.tsx`,
  Dialog-based, opened by a global ⌘K / Ctrl-K listener (and closable via Esc).
- Groups: **Navigation** (Dashboard, Projects, Indices, Settings), **Recent models**
  (reuse the sidebar recent-models query, threaded from the layout server component),
  **Actions** (New project, Toggle theme). Uses `router.push`.

### 4.3 Onboarding checklist
- `components/onboarding/onboarding-checklist.tsx` on the dashboard, above the KPI tiles.
- Steps, completion **derived from DB** (no new table):
  1. Create your first cost model → `models.length > 0`
  2. Add a supplier quote → any quote row exists for the org
  3. Run a comparison → reachable once a quote exists
- Renders only while incomplete; dismissible via `localStorage`. Existing `EmptyState` stays for
  the truly-empty dashboard.

### 4.4 Google (Gmail) sign-in
- `components/auth/google-button.tsx` (client): `supabase.auth.signInWithOAuth({ provider: "google",
  options: { redirectTo: \`${location.origin}/callback\` } })`.
- Add to `app/(auth)/login/page.tsx` and `app/(auth)/signup/page.tsx` with an "or" divider above
  the magic-link form.
- **No callback change needed** — `app/(auth)/callback/route.ts` already exchanges the PKCE `code`.

### 4.5 Magic-link rate-limit mitigation (code side)
- `MagicLinkForm`: after a successful send, disable resend with a **60s cooldown** countdown.
- Detect rate-limit errors (HTTP 429 / message contains "rate limit") and show:
  "Too many email requests — try **Continue with Google**, or wait a minute." with Google as the
  visible alternative.
- Prevents accidental repeat sends; the structural fix (custom SMTP / raised auth limits) is §7.

## 5. Merge & launch

- Branch `phase-4` cut from `phase-free-launch` (carries the free-launch unlock).
- Green gate: `pnpm test`, `tsc` typecheck, `next lint`, `NEXT_TELEMETRY_DISABLED=1 next build`
  (telemetry-off avoids the sandbox build hang noted in project memory).
- Merge `phase-4` → `phase-0-foundation` (live default branch).
- Deploy `vercel --prod`.
- **Launch safety:** free-launch hides billing and elevates every org to `pro`, so no Stripe prod
  env is exercised and the billing-stack rollback condition from Jul-10/11 does **not** apply. The
  `subscriptions` table exists from migration `0001` (already in prod), so plan resolution works
  without `0007`. `0006`/`0007` remain optional (webhook idempotency + perf indexes) and are only
  needed when billing is re-enabled.
- Smoke test: `/`, `/login`, dashboard, create-a-model, ⌘K, dark-mode toggle, XLSX export,
  Google-button renders.

## 6. Testing

- Unit: onboarding step-completion logic (pure), theme-toggle render, command-palette item build,
  magic-link cooldown/429 branch. Keep the existing suite green (129/129).
- Manual: dark mode at 375/768/1440, keyboard nav + visible focus (WCAG AA per CLAUDE.md),
  ⌘K open/close/navigate, Google button renders and initiates OAuth.

## 7. Required post-deploy dashboard actions (user — activates auth features)

These are external and cannot be done from code; the site launches without them, but the two auth
features only fully function once done:

1. **Google provider (Supabase):** create a Google Cloud OAuth 2.0 client (Web), add authorized
   redirect `https://<project-ref>.supabase.co/auth/v1/callback`; in Supabase → Authentication →
   Providers → Google, paste client ID + secret, enable. Add the production site URL to Supabase
   Auth → URL Configuration (Site URL + redirect allowlist including `https://shouldcost-io.vercel.app/callback`).
2. **Email rate limit (magic link):** configure **custom SMTP** (e.g. Resend/SendGrid) in Supabase
   → Authentication → Emails, which removes the tiny built-in shared-SMTP cap; or raise the auth
   rate limits. Until then, the built-in provider throttles after a couple of sends.
3. Verify no unintended preview/prod cross-deploy fired.

## 8. Non-negotiables (from CLAUDE.md)

Lighthouse 90+ (all four), WCAG 2.1 AA (semantic landmarks, alt text, visible focus, contrast —
including in dark mode), responsive at 375/768/1440, no placeholder text/metrics.
