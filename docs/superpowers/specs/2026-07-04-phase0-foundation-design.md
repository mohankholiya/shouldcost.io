# Phase 0 — Foundation (Design Spec)

**Project:** shouldcost.io
**Phase:** 0 of 5
**Status:** Approved (pending written-spec review)
**Date:** 2026-07-04

---

## 1. Purpose

shouldcost.io is a SaaS product that lets energy-industry procurement, category, and cost-engineering teams build transparent, defensible **should-cost models** for the equipment and services they buy — so they can challenge supplier quotes with data instead of gut feel.

The full product is a platform spanning many subsystems (model builder, category templates, commodity index hub, quote comparison, exports, collaboration, billing, marketing + SEO calculators). It is too large for a single spec, so it is decomposed into five phases. **This spec covers Phase 0 (Foundation) only.** Each subsequent phase gets its own spec → plan → build cycle.

### Phase 0 scope boundary

**In scope:**
- Next.js 14 (App Router) app skeleton, TypeScript strict.
- Design system: Tailwind v4 tokens, core component library, live `/design` showcase.
- Full Supabase schema (all tables the product will need), Row Level Security policies, and security-definer functions.
- Seed script: 17 category templates + 10 indices (24 months each) + one demo org, written as reviewable TypeScript, upserted idempotently.
- Auth (email magic link working; Google OAuth wired and env-gated).
- Org/project scaffolding at the data layer with a minimal UI shell (dashboard empty state, project list, settings stub).
- Tooling: Vitest + Playwright config and one smoke test; pnpm; ESLint/Prettier.
- README with local setup, env vars, Supabase migration/seed commands, deploy steps.

**Explicitly out of scope (deferred):**
- Cost model editor, CBS tree, inline editing, versioning diff UI → Phase 1.
- Index binding/recalc, sensitivity/tornado chart, rollup donut, index hub UI → Phase 1.
- Quote entry/comparison, gap waterfall, rule-based insights, PDF/XLSX export, share links → Phase 2.
- Stripe + Razorpay billing, plan gating UI, marketing site, public SEO calculators, template gallery pages → Phase 3.
- Command palette, dark-mode toggle UI, audit-log UI, comments, onboarding checklist, Sentry/analytics → Phase 4.

**End state of Phase 0:** a user can sign up (magic link), land in an authenticated workspace backed by real Supabase tables under RLS, see a populated demo dashboard, browse the internal design-system showcase, and run the seed/migrations cleanly. The product is structurally real but has no model-editing features yet.

---

## 2. Confirmed decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sequencing | Approach A — design-system-led | Visible, reviewable design surface early; matches brief's Phase 0 ordering |
| Seed content | I draft, you validate before ship | Practitioner-grade illustrative content flagged `draft:true`; gated from public surfaces until signed off |
| Supabase environment | Cloud free-tier project | Zero Docker friction on Windows; Supabase handles email SMTP |
| Auth | Email magic link live + Google OAuth env-gated | No blocker either way; Google activates when OAuth client env vars are added |
| Org model | Auto-create personal org on signup | Lowest-friction solo start; team invite later |
| Stack | Next.js 14, TS strict, Tailwind v4, shadcn/ui, Recharts (P1+), TanStack Table (P1+), Zustand, RHF + Zod, Supabase | Fixed by brief |
| Package manager | pnpm | Speed, strictness |
| Fonts | Inter (UI) + JetBrains Mono (numbers/code) via `next/font` | Tabular-numbers discipline |
| Money | Integer minor units everywhere; single `lib/money.ts` chokepoint | No floats in math |
| Tests (Phase 0) | Vitest + Playwright config + one smoke test | Harness ready; full suite lands with Phase 1 |
| Deploy | Vercel preview at end of Phase 0 | No domain needed yet |

---

## 3. Tech stack

- **Frontend:** Next.js 14+ App Router, TypeScript strict, Tailwind CSS v4 (CSS-first tokens), shadcn/ui (customized), Recharts (P1+), TanStack Table (P1+), Zustand, React Hook Form + Zod.
- **Backend:** Next.js server actions / route handlers; Supabase Postgres + Auth (magic link + Google OAuth) + Storage; Row Level Security on every table.
- **Exports:** deferred to Phase 2 (decision between `@react-pdf/renderer` and Playwright print made then).
- **Payments:** deferred to Phase 3; built behind a `billing` interface so Stripe/Razorpay stay pluggable.
- **Hosting:** Vercel + Supabase free tiers. No Redis, queues, microservices, or Kubernetes.
- **Analytics/errors:** deferred to Phase 4 (Sentry + Plausible/PostHog).
- **No LLM/AI features in Phase 0–2.** A seam may be left in `quotes` parsing for future use; not built now.

---

## 4. File / folder structure

Single Next.js 14 app with three route groups: `(marketing)` public, `(auth)` login/signup, `(app)` authenticated workspace. Plus an internal `/design` showcase.

```
shouldcost.io/
├── app/
│   ├── (marketing)/            # Public site (minimal in Phase 0; Phase 3 fills it)
│   │   ├── layout.tsx          #   public nav + footer
│   │   └── page.tsx            #   home — brief landing + "sign in" CTA
│   ├── (auth)/
│   │   ├── layout.tsx          #   centered auth shell
│   │   ├── login/page.tsx      #   magic link + Google button
│   │   ├── signup/page.tsx
│   │   └── callback/route.ts   #   OAuth/magic-link callback
│   ├── (app)/                  # Authenticated workspace
│   │   ├── layout.tsx          #   AppShell: sidebar + topbar + SavedIndicator
│   │   ├── dashboard/page.tsx  #   portfolio view — demo data + empty state
│   │   ├── projects/
│   │   │   ├── page.tsx        #   list
│   │   │   └── [id]/page.tsx   #   detail → models grid
│   │   ├── models/[id]/page.tsx#   editor (stub in Phase 0, built in Phase 1)
│   │   ├── indices/            #   hub stub (Phase 1)
│   │   └── settings/
│   │       ├── page.tsx        #   org + profile
│   │       └── members|billing/#   Phase 2/3
│   ├── design/page.tsx         # Internal design-system + seed-review showcase (dev-only)
│   ├── layout.tsx              # Root: fonts, providers, metadata defaults
│   ├── globals.css             # Tailwind v4 @theme tokens + base styles
│   ├── not-found.tsx · error.tsx
├── components/
│   ├── ui/                     # shadcn/ui primitives (Button, Input, Table…)
│   ├── layout/                 # AppShell, Sidebar, Topbar, MarketingNav, Footer
│   ├── auth/                   # Auth forms (RHF + Zod)
│   ├── shared/                 # EmptyState, Logo, SavedIndicator, DensityToggle
│   ├── data-table/  charts/    # wrappers (built Phase 1+)
│   └── models/                 # CBS tree, etc. (built Phase 1+)
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # browser client (RLS-bound)
│   │   ├── server.ts           # server client (cookies, RLS-bound)
│   │   ├── admin.ts            # service-role — server/seed only, never browser
│   │   └── middleware.ts       # session refresh helper
│   ├── db/                     # typed repositories per table
│   ├── money.ts                # integer-minor-units + FX math (no floats)
│   ├── format.ts               # currency/number formatting w/ tabular-nums
│   ├── entitlements.ts         # central plan-gating seam (Phase 3 fills)
│   ├── utils.ts                # cn(), misc
│   └── seed/
│       ├── run-seed.ts         # idempotent runner (upsert by slug/code)
│       ├── indices.ts          # 10 indices + 24mo generated values
│       └── templates/          # 17 template CBS definitions (reviewable TS)
├── supabase/
│   ├── config.toml             # CLI config (links to cloud project)
│   └── migrations/
│       ├── 0001_init_schema.sql    # all tables, indexes, constraints
│       ├── 0002_rls_policies.sql   # RLS enabled + per-table policies
│       └── 0003_functions.sql      # share_links token resolver (security definer)
├── tests/
│   ├── e2e/smoke.spec.ts       # Playwright: signup → empty workspace
│   └── unit/                   # Vitest: money/format/seed helpers
├── middleware.ts               # root: session refresh + route protection
├── public/                     # og image, favicon, robots.txt
├── docs/
│   ├── superpowers/specs/      # design specs (this document)
│   └── seed-review-checklist.md
├── .env.example  .gitignore  README.md
├── next.config.ts  tsconfig.json (strict)  components.json (shadcn)
├── playwright.config.ts  vitest.config.ts
└── package.json  pnpm-lock.yaml
```

**Structural rules:**
- **Schema in SQL migrations, seed content in TS.** Tables/RLS/functions versioned in SQL run via `supabase db push`. The 17 templates + 10 indices live as reviewable TS in `lib/seed/` and are written through `admin.ts` with idempotent upserts keyed by `slug`/`code`. This makes the 24-month index series programmatically generated and the templates easy for the domain expert to read and correct.
- **Three Supabase clients, strict separation.** `client.ts` (browser, RLS-bound), `server.ts` (route handlers/server actions, RLS-bound), `admin.ts` (service role, bypasses RLS — server + seed only; guarded so it can never reach the browser bundle).
- **Money as integer minor units** everywhere with a single `lib/money.ts` chokepoint; formatting isolated in `lib/format.ts`. No floats in arithmetic.
- **`/design` showcase is dev-only** (unlisted in production navigation) — the single review surface for tokens, components, and seed content.
- **Phase 1+ surfaces exist as stubs** (model editor, indices hub) so navigation works end-to-end in Phase 0 without leaking unfinished features.

---

## 5. Design-system component inventory

### A. Design tokens (Tailwind v4 `@theme` in `globals.css`)
- **Color:** `petrol` primary (#0B3C5D + full 50–900 ramp), `amber` for deltas/warnings (used only for ± changes), `favor` green #059669 (only for favorable gaps), `ink` #1A1A1A, `canvas` #FAFAF8, `hairline` #E5E5E0, plus semantic `success/warning/danger/info`. No ad-hoc hex outside tokens.
- **Type:** Inter (UI), JetBrains Mono (every number + code), explicit scale (xs→2xl); `tabular-nums` enforced via a `.num` utility and on every numeric component.
- **Spacing:** 8px grid (4px half-steps). **Radius:** sharp/hairline on tables & data, soft on buttons/inputs/overlays. **Shadow:** overlay-only (`shadow-overlay`), flat elsewhere. **Density:** `data-density="comfortable|compact"` attribute, primarily affects table row height.
- **Dark mode:** tokens defined as CSS variables with `.dark` overrides; toggle UI lands in Phase 4 but the token structure is correct from day one.

### B. Form & input primitives (Phase 0)
Button (primary/secondary/ghost/danger; sm/md/lg/icon; loading) · Input · **NumberInput / MoneyInput** (integer-minor-unit aware, currency prefix, tabular-nums) · Textarea · Select · Combobox · Checkbox · Switch · RadioGroup · Label · DatePicker · **Form** (RHF + Zod: Form/FormField/FormItem/FormLabel/FormControl/FormMessage).

### C. Layout & shells (Phase 0)
AppShell · Sidebar (collapsible, project switcher, plan badge) · Topbar (breadcrumbs, DensityToggle, SavedIndicator, user menu, Cmd-K hint) · MarketingNav · Footer (persistent Email/LinkedIn/résumé CTAs) · Container · PageHeader (title + subtitle + actions) · Card · Separator · ScrollArea.

### D. Data display (Phase 0)
**Table** (HTML-based, TanStack-ready shell: sticky header, hairline rows, `data-density`, `.num` on numeric columns) · Badge (status/plan/category) · **Stat / KPI tile** (label + AnimatedCounter + delta) · Skeleton (route-level loading; no full-page spinners) · **EmptyState** (illustration + 3-step teach + CTA — every empty screen) · Avatar · Tooltip · Breadcrumbs · Pagination.

### E. Feedback & overlays (Phase 0)
Sonner (toasts — powers "Saved ✓") · Dialog · Sheet/Drawer (mobile nav, template-preview drawer) · DropdownMenu · Tabs · **SavedIndicator** (debounced autosave status: saving / saved ✓ / error).

### F. Cost-engineering differentiators (Phase 0)
**CurrencySelect** (USD/EUR/INR/GBP/SAR/AED — drives formatting + stored FX rate) · **AnimatedCounter** (smooth eased rollup for the live should-cost total) · **DeltaPill** (favorable green / unfavorable amber, sign + %) · tabular-numbers discipline enforced at the primitive level · **DensityToggle** (comfortable/compact; compact is the cost-engineer default).

### G. Deferred to Phase 1+ (built on these primitives)
- **P1:** CBS tree editor (inline edit cells, Excel-like nav, drag-drop), tornado/sensitivity chart, rollup donut, index sparkline. **ChartContainer** wrapper (with "download PNG / copy data" affordance) lands here but is designed now so every chart inherits it.
- **P2:** Gap waterfall chart, quote-comparison matrix, rule-based insight cards.
- **P3:** Pricing/billing components, public calculator widgets.
- **P4:** Full Command palette (Cmd+K), dark-mode toggle UI, audit-log timeline, comments thread.

The `/design` page renders every Phase-0 token and component in light + dark, at comfortable + compact density, plus a seed-review panel for the 17 templates and 10 indices.

---

## 6. Seed data plan

All values are illustrative practitioner-grade drafts flagged `draft: true` until the domain expert signs off. Nothing draft reaches a public surface.

### 6.1 Indices (10)

| # | Code | Name | Unit | Currency | Latest (illustr.) |
|---|------|------|------|----------|------|
| 1 | `hrc_steel` | HRC hot-rolled coil | $/MT | USD | ~650 |
| 2 | `crc_steel` | Cold-rolled coil | $/MT | USD | ~780 |
| 3 | `ss316` | Stainless 316 hot-rolled | $/MT | USD | ~3,200 |
| 4 | `copper_lme` | Copper LME 3M | $/MT | USD | ~9,500 |
| 5 | `aluminum_lme` | Aluminum LME 3M | $/MT | USD | ~2,400 |
| 6 | `nickel_lme` | Nickel LME 3M | $/MT | USD | ~16,000 |
| 7 | `polysilicon` | Polysilicon spot | $/kg | USD | ~6.0 |
| 8 | `brent` | Brent crude | $/bbl | USD | ~80 |
| 9 | `hdpe` | HDPE blow-molding resin | $/MT | USD | ~1,000 |
| 10 | `fab_labor_in` | Fabricated-steel labor composite | ₹/hr | INR | ~850 |

24-month values are generated in `lib/seed/indices.ts` from per-index waypoints (HRC dip-then-recover; polysilicon long decline; copper steady climb) plus realistic monthly noise, so sparklines read as live markets. PVC, other resins, and per-country labor (KSA/UAE/US Gulf/EU) live as benchmark rates inside the EPC man-hour template's CBS, not as hub indices — keeping the hub to the 10 specified. The data layer supports N indices.

### 6.2 Templates (17)

| # | Template | Unit | Primary index binding |
|---|----------|------|-----------------------|
| **Oil & Gas** | | | |
| 1 | OCTG casing & tubing | /MT | hrc_steel |
| 2 | Line pipe (LSAW/HSAW/ERW) | /MT | hrc_steel |
| 3 | Ball / gate valves | /unit | ss316, crc_steel |
| 4 | Wellheads & Christmas trees | /set | ss316 |
| 5 | Centrifugal pumps (API 610) | /unit | ss316, crc_steel |
| 6 | Pressure vessels & heat exchangers | /kg | hrc_steel, ss316 |
| 7 | Drilling day rates | /day | brent |
| 8 | Structural steel fabrication | /MT | hrc_steel, fab_labor_in |
| **Power & Utilities** | | | |
| 9 | Power transformers | /MVA | ss316 (CRGO core), copper_lme |
| 10 | HV/MV cables | /km | copper_lme, aluminum_lme |
| 11 | Switchgear panels | /panel | copper_lme, crc_steel |
| 12 | Solar PV modules | /Wp | polysilicon |
| 13 | Solar EPC BoS | /MW | aluminum_lme, copper_lme |
| 14 | Wind turbine towers | /section | hrc_steel |
| 15 | Transmission towers | /MT | hrc_steel |
| **Services** | | | |
| 16 | EPC man-hour rate buildup (5 countries) | /hr | fab_labor_in + country benchmarks |
| 17 | Maintenance & shutdown services | /event | fab_labor_in, brent |

Each template stores: `industry`, `unit`, full `cbs_json` (groups → line items), `driver_to_index` bindings, `practitioner_notes`, `draft: true`.

### 6.3 Exemplar fidelity — OCTG casing & tubing (per MT, USD)

| Group | Line item | Driver | Qty | Unit rate | Source | Line |
|-------|-----------|--------|-----|-----------|--------|------|
| Material | Steel billet (HRC) | 1.08 MT/MT (yield) | 1.08 | 650 | `index:hrc_steel` | 702 |
| Conversion | Piercing & rolling | 1 MT | 1.0 | 280 | benchmark | 280 |
| Conversion | Heat treatment (Q&T) | 1 MT | 1.0 | 150 | benchmark | 150 |
| Conversion | Threading & coupling | per MT | 1.0 | 220 | benchmark | 220 |
| Conversion | Inspection & NDT | per MT | 1.0 | 60 | benchmark | 60 |
| Overhead | Manufacturing overhead | 12% of conversion | — | — | formula | 85 |
| SG&A | Selling, general & admin | 5% of (mat+conv+oh) | — | — | formula | 71 |
| Margin | Supplier margin | 9% | — | — | formula | 156 |
| Logistics | Inland freight + port + duty | per MT | 1.0 | 90 | benchmark | 90 |
| | **Should-cost total** | | | | | **~1,814** |

The seed stores exact line math, not rounded values. All 17 templates target this depth.

### 6.4 Practitioner notes (the moat)

Each template carries a one-paragraph `practitioner_notes` field written from a buyer's seat. OCTG example:

> Suppliers hide margin in bundled "conversion" charges and in scrap/yield assumptions — they'll quote 1.15× billet weight when 1.08× is realistic on a modern rolling line. Threading is routinely marked up 30–40% over what independent specialist threaders charge. Tie the steel line to the HRC index × a published conversion constant, and challenge anything above 10% margin for commodity grades.

### 6.5 Validation workflow (draft → reviewed gate)

- Every template/indices TS file carries `draft: true` until signed off.
- `pnpm seed` upserts idempotently by slug/code; the `draft` flag is stored in the DB.
- The internal `/design` → "Seed review" panel renders all 17 templates + 10 indices for one-pass review.
- **Phase 3 public surfaces (gallery pages, SEO calculators) gate on `draft = false`** — illustrative content can never ship externally by accident. The in-app template picker (Phase 1) may use drafts since only authenticated users see it.
- `docs/seed-review-checklist.md` tracks sign-off per item.

### 6.6 Demo account target

The seed creates one demo org (`Westmark Energy`, masked) with a populated OCTG model at ~$1,814/MT should-cost vs a $2,150/MT supplier quote, plus a transformer model and an in-flight EPC man-hour model — so the Phase 0 dashboard already tells a story. Marked as demo data, not counted against the free-tier model limit.

---

## 7. Data model (Postgres + RLS)

All tables created in Phase 0 with RLS enabled. Users see only rows belonging to their org; `share_links` resolve via token through a security-definer function; `category_templates` and `indices` are public-read.

```
organizations(id, name, plan, created_at)
org_members(org_id, user_id, role: admin|editor|viewer)
projects(id, org_id, name, description)
cost_models(id, project_id, name, category_template_id?, currency, fx_rate, status, created_by)
model_versions(id, model_id, version_no, snapshot_json, total_cost, created_by, created_at, note)
cost_nodes(id, model_id, parent_id?, sort_order, name, node_type: group|line,
           driver_name, quantity, unit, rate, rate_source: manual|index|benchmark,
           index_id?, index_factor, formula?, notes)
category_templates(id, industry, name, description, cbs_json, practitioner_notes,
                   unit, is_public, draft, slug UNIQUE)
indices(id, code UNIQUE, name, unit, currency, region, source_note, draft)
index_values(index_id, date, value)
quotes(id, model_id, supplier_name, currency, incoterm, payment_terms, quoted_total, received_at)
quote_lines(id, quote_id, cost_node_id?, description, amount)
comments(id, model_id, user_id, body, created_at)
audit_log(id, org_id, user_id, entity, entity_id, action, diff_json, created_at)
share_links(id, model_version_id, token UNIQUE, expires_at, revoked)
subscriptions(org_id, provider, provider_customer_id, plan, status, current_period_end)
```

Notes:
- `cost_models.fx_rate`, `quoted_total`, `rate`, `amount`, `total_cost` are stored as **integer minor units** (e.g. cents, paise). Currency is stored on the row; conversion uses `fx_rate`.
- `category_templates.slug` and `indices.code` are the idempotent seed keys.
- `model_versions.snapshot_json` stores an immutable CBS snapshot per the brief's versioning requirement (diff view is a Phase 1 UI concern; storage is Phase 0).
- RLS policy pattern: `org_members` join on `org_id = auth.uid() → user_id`. A helper SQL function `current_user_orgs()` returns the set of orgs the calling user belongs to, referenced by policies.

---

## 8. Definition of done (Phase 0)

A change ships only when all hold:
- No placeholder text or metrics visible anywhere (`[X]`, lorem ipsum, blank tiles). Illustrative seed values carry the internal `draft` flag and are not user-facing as final.
- Lighthouse ≥ 95 on the marketing home and `/design` pages; app shell interactive < 2s on 4G.
- Fully keyboard-navigable with visible focus states; WCAG AA contrast.
- Renders correctly at 375px, 768px, 1440px.
- TypeScript strict, zero `any`. Zod validation on every mutation. Money as integers.
- Every table has RLS enabled with tested policies.
- Migrations + seed run cleanly from scratch (`supabase db push` then `pnpm seed`).
- Playwright smoke test (signup → empty workspace) passes.
- README documents setup, env vars, migration/seed commands, and deploy steps.
- Legal disclaimer present: "Should-cost outputs are estimates for negotiation support, not certified cost audits."

---

## 9. Prerequisites & environment

External accounts needed for Phase 0:
- **Supabase** — free project (URL + anon key + service-role key). [Required to run.]
- **Vercel** — for end-of-phase deploy. [Required only to deploy.]
- **Google Cloud** — OAuth client (ID + secret) for Google sign-in. [Optional; email magic link works without it.]

`.env.example` documents:
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server/seed only — never exposed to client
GOOGLE_OAUTH_CLIENT_ID=             # optional
GOOGLE_OAUTH_CLIENT_SECRET=         # optional
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## 10. Risks & open items

- **Seed fidelity:** all 17 templates need a domain-expert review pass before any external use. Mitigated by the draft gate (§6.5).
- **Magic-link email deliverability** on Supabase free tier is rate-limited; acceptable for dev, will need configured SMTP before production scale.
- **Tailwind v4 + shadcn/ui** is newer; if a component dependency has not shipped v4 compatibility at build time, fall back to Tailwind v3 (decision made when the design system task starts, not later).
- **`model_versions.snapshot_json` size** for very large trees is not a Phase 0 concern but the column type (`jsonb`) is chosen to keep options open.

---

## 11. Next step

On written-spec approval, invoke the **writing-plans** skill to produce the Phase 0 implementation plan (task breakdown with dependencies, ordered for incremental shippability), which the executor will then carry out.
