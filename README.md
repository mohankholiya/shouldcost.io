<div align="center">

# shouldcost.io

### Build transparent, defensible should-cost models — and win the negotiation.

Break any bought part or service down to its true cost drivers, link them to live commodity
indices, benchmark supplier quotes line-by-line, and let AI draft the first model for you.

**[▶ Live app](https://shouldcost-io.vercel.app) · [📊 How-to slides](https://shouldcost-io.vercel.app/how-to-use.html) · [Report an issue](https://github.com/mohankholiya/shouldcost.io/issues)**

<sub>Next.js 14 · TypeScript (strict) · Tailwind v4 · shadcn/ui + Radix · Supabase (Postgres + Auth, RLS) · Zustand · TanStack Table · Recharts · ExcelJS · Claude (Anthropic)</sub>

</div>

---

## What it is

**shouldcost.io** is a should-cost modeling workspace for procurement and sourcing teams. Instead of
accepting a supplier's price at face value, you rebuild what a part *should* cost from first
principles — material, process, labour, overhead, and margin — so every negotiation starts from
evidence, not a guess.

Every model is transparent (you can see and edit each driver), defensible (linked to real commodity
indices), and portable (export to Excel with the formulas intact).

> ⚠️ **Disclaimer:** should-cost outputs are estimates for negotiation support, not certified cost audits.

## Who it's for

| Role | What they get |
|---|---|
| **Procurement & category leaders** | A defensible cost baseline to anchor supplier negotiations and cost-out programmes |
| **Strategic sourcing / category managers** | Line-by-line should-cost vs quote comparison, gap waterfalls, and negotiation levers |
| **Cost engineers / estimators** | A structured CBS (cost breakdown structure) with live rollup, index binding, and versioning |
| **Consultants & expert-network advisors** | Fast, presentable models to size opportunities and support client recommendations |

## What you can do

- 🧱 **Build a cost model** — a CBS tree grid (inline edit, keyboard nav, add/remove, groups & lines) with a **live rollup** as you type.
- 📈 **Bind to commodity indices** — link drivers to indices so the model re-prices as markets move; see sensitivity via a tornado chart.
- 🗂️ **Version & diff** — snapshot a model and compare versions over time.
- 🤝 **Compare supplier quotes** — enter quotes (total or line-by-line), see a comparison matrix, a **gap waterfall**, and rule-based **insight cards** highlighting where a quote is high or low.
- 📤 **Export to Excel** — download the model or comparison as an `.xlsx` with **live formulas** (not just static values).
- 🤖 **AI assistant (Claude Opus 4.8)** — three assists, all producing *labelled drafts for review*:
  - **Draft with AI** — describe a part in plain English → an editable cost model.
  - **Suggest with AI** — get a likely cost driver + realistic rate range for a line.
  - **Explain with AI** — a plain-language negotiation brief for a quote gap.
- 🔐 **Auth** — sign in with **Google** or a **magic link**; every row is protected by Postgres Row-Level Security.
- 🎨 **Polish** — dark mode, a ⌘K command palette, and an onboarding checklist.

*Currently in **free-beta**: the full product is unlocked for everyone; billing is deferred.*

## How to use it (5 steps)

1. **Sign in** at [shouldcost-io.vercel.app](https://shouldcost-io.vercel.app) (Google or magic link).
2. **Create a model** — start from a category template, or type a description into **Draft with AI**.
3. **Refine the drivers** — edit quantities and rates in the tree, bind lines to indices, use **Suggest with AI** on any line.
4. **Add supplier quotes** — open **Compare quotes**, enter a quote, and read the gap waterfall + insights (or **Explain with AI**).
5. **Export & negotiate** — download the `.xlsx` and take a defensible baseline into the conversation.

> A visual walkthrough is live at **[shouldcost-io.vercel.app/how-to-use.html](https://shouldcost-io.vercel.app/how-to-use.html)** (animated, arrow-key navigable) — source in [`docs/how-to-use.html`](docs/how-to-use.html).

## Tech stack

- **Framework:** Next.js 14 (App Router), strict TypeScript
- **UI:** Tailwind v4, shadcn/ui (Radix), Recharts, Zustand, TanStack Table
- **Backend:** Supabase — Postgres + Auth (Google OAuth + magic link) + Row-Level Security
- **Exports:** ExcelJS (server-side, live formulas)
- **AI:** Anthropic Claude (Opus 4.8) via `@anthropic-ai/sdk`, guarded on `ANTHROPIC_API_KEY`
- **Tests:** Vitest (unit + RLS integration), Playwright (e2e)

## Quickstart (local dev)

```bash
pnpm install
cp .env.example .env.local        # fill in your Supabase keys (see docs/SETUP.md)

pnpm dlx supabase login           # or set SUPABASE_ACCESS_TOKEN
pnpm dlx supabase link --project-ref <your-project-ref>
pnpm db:push                      # applies supabase/migrations/*
pnpm seed                         # 10 indices × 24 months, 17 templates, a demo org

pnpm dev                          # → http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase anon key (client) |
| `SUPABASE_SERVICE_ROLE_KEY` | seed only | Used by `pnpm seed`; not needed by the running app |
| `ANTHROPIC_API_KEY` | for AI | Enables the three AI features; without it they stay hidden/inert |
| `SHOULDCOST_AI_MODEL` | optional | Override the model (default `claude-opus-4-8`; e.g. `claude-haiku-4-5`) |

## Scripts

- `pnpm dev` / `pnpm build` / `pnpm start`
- `pnpm typecheck` · `pnpm lint`
- `pnpm test` (unit) · `pnpm test:integration` (RLS — needs `TEST_USER_A/B`) · `pnpm test:e2e` (Playwright)
- `pnpm seed` · `pnpm db:push` · `pnpm db:reset`

> First-time Playwright: `pnpm dlx playwright install chromium`.
> On some Windows setups vitest's default pool can crash under load — run `vitest run --no-file-parallelism`.

## Project layout

```
app/
  (marketing)/        public site
  (auth)/             login, signup, OAuth callback
  (app)/              authenticated workspace (dashboard, projects, models, indices, settings)
  api/
    models/[id]/export  XLSX export (entitlement-gated)
    ai/                 explain-gap · suggest-node · draft-model (Claude)
    billing/            Stripe webhook (deferred under free-launch)
components/
  models/             CBS tree editor, charts, index binding, versioning
  quotes/             quote form, comparison matrix, gap waterfall, insights
  ai/                 AI assist surfaces
  ui/ layout/ shared/ number/  design-system primitives
lib/
  model/              pure logic: rollup, comparison, waterfall, insights
  db/ supabase/       repositories + clients (RLS-scoped)
  ai/                 Anthropic client (guarded), schemas, rate limiter
  entitlements.ts     plan → limits (free-launch elevates everyone to pro)
supabase/migrations/  schema, RLS policies, functions, auto-org trigger
```

## Deploy

Import the repo on Vercel, set the env vars above (Production + Preview), and deploy. Apply the
migrations and run `pnpm seed` against your production Supabase project. The app is designed to run
on Vercel + Supabase free tiers.

---

<div align="center">
<sub>Built with Next.js, Supabase, and Claude. Should-cost outputs are estimates for negotiation support, not certified audits.</sub>
</div>
