# Setup — Supabase, auth, migrations, seed

## 1. Create the Supabase project

1. Create a free project at https://supabase.com/dashboard.
2. Project settings → API: copy the **Project URL**, the **anon** public key, and the
   **service_role** key.
3. Put them in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role key>   # server + seed only — never client
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

The service-role key bypasses RLS. It is used only by `lib/supabase/admin.ts` (guarded with
`server-only`) and the seed runner. Never expose it to the browser.

## 2. Enable email magic link

Authentication → Providers → Email: enable **Email OTP / magic link**. The free tier rate-limits
outbound email — fine for development.

Authentication → URL configuration → Redirect URLs: add `http://localhost:3000/callback`
(and your deployed `https://<domain>/callback`).

## 3. (Optional) Google OAuth

1. Google Cloud console → create an OAuth 2.0 client (Web application).
2. Authorized redirect URI: `https://<project>.supabase.co/auth/v1/callback`.
3. Supabase → Authentication → Providers → Google: paste the client ID + secret.
4. Add to `.env.local`:
   ```
   GOOGLE_OAUTH_CLIENT_ID=...
   GOOGLE_OAUTH_CLIENT_SECRET=...
   ```
Magic link works without this; Google activates once the vars are set.

## 4. Link and push migrations

```bash
pnpm dlx supabase login                                   # or export SUPABASE_ACCESS_TOKEN
pnpm dlx supabase link --project-ref <your-project-ref>   # ref is in the dashboard URL
pnpm db:push
```

This applies, in order:
- `0001_init_schema.sql` — all tables, enums, indexes
- `0002_rls_policies.sql` — RLS enabled on every table + `current_user_orgs()` helper
- `0003_functions.sql` — `resolve_share_link()` security-definer resolver
- `0004_auto_org.sql` — trigger creating a personal org + admin membership on new user

## 5. Seed

```bash
pnpm seed
```

Upserts 10 indices (24 monthly values each), 17 category templates, and the `Westmark Energy`
demo org (idempotent — safe to re-run). Verify in the dashboard: 10 indices, 17 templates,
1 demo org with 3 models.

## 6. Seed review

All seed content is flagged `draft: true`. Review it on the internal `/design` page and sign
off item-by-item in `docs/seed-review-checklist.md` before any public surface consumes it.

## 7. Run

```bash
pnpm dev
```

Visit `/` (marketing), `/signup` (magic link), and after signing in, `/dashboard`.
