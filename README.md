# shouldcost.io

Should-cost modeling for energy-industry procurement — build transparent, defensible
cost breakdowns for the equipment and services you buy, linked to commodity indices and
ready for supplier negotiation.

Next.js 14 (App Router, strict TypeScript) · Tailwind v4 · shadcn/ui (Radix) · Supabase
(Postgres + Auth under RLS) · Vitest + Playwright.

## Quickstart

1. `pnpm install`
2. Copy `.env.example` → `.env.local` and fill in your Supabase keys (see `docs/SETUP.md`).
3. Link and push the database:
   ```bash
   pnpm dlx supabase login          # or set SUPABASE_ACCESS_TOKEN
   pnpm dlx supabase link --project-ref <your-project-ref>
   pnpm db:push                     # migrations 0001–0004 (schema, RLS, functions, auto-org)
   ```
4. `pnpm seed` — 10 indices (24 months each) + 17 category templates + a demo org.
5. `pnpm dev` → http://localhost:3000

## Scripts

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm typecheck` / `pnpm lint`
- `pnpm test` (unit) · `pnpm test:integration` (RLS — needs `TEST_USER_A/B` env) · `pnpm test:e2e` (Playwright)
- `pnpm seed` · `pnpm db:push` · `pnpm db:reset`

> First-time Playwright run: `pnpm dlx playwright install chromium`.

## Project layout

- `app/(marketing|auth|app)/` — public site, auth screens, authenticated workspace
- `app/design/` — internal design-system + seed-review showcase (not linked in nav)
- `components/{ui,layout,number,shared,auth}/` — primitives and app components
- `lib/{supabase,db,seed}/`, `lib/money.ts`, `lib/format.ts` — clients, repositories, seed, money
- `supabase/migrations/` — schema, RLS, functions, auto-org trigger

## Deploy

Import the repo on Vercel, set the same env vars, and deploy. Push migrations and run
`pnpm seed` against the production Supabase project.

## Disclaimer

Should-cost outputs are estimates for negotiation support, not certified cost audits.
