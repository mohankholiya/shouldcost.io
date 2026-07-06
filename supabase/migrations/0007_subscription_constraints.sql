-- 0007_subscription_constraints.sql — Phase 3A billing plumbing.
-- subscriptions.org_id is already the primary key (one row per org),
-- so no (org_id, provider) uniqueness is needed; Razorpay as a fast-follow
-- REPLACES a Stripe subscription rather than coexisting.

-- Webhook customer lookup: given a Stripe customer id, find the org.
create index if not exists subscriptions_provider_customer_idx
  on subscriptions (provider, provider_customer_id);

-- Idempotency for Stripe webhook replays. Written by the webhook route via
-- the service-role admin client. RLS is ENABLED with NO policies: the
-- service role bypasses RLS (used by createAdminClient in the webhook),
-- while anon/authenticated get nothing via PostgREST.
create table if not exists processed_stripe_events (
  event_id text primary key,
  created_at timestamptz not null default now()
);
alter table processed_stripe_events enable row level security;
