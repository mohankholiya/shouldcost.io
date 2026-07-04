-- Phase 0 — full schema. RLS is enabled in 0002; functions in 0003.
-- Money columns (rate, amount, quoted_total, total_cost, fx-applied values) are
-- stored as integer minor units (bigint). Currency lives on the row.
--
-- Table order respects inline REFERENCES: public-read reference tables
-- (category_templates, indices) are declared before the tables that point at them.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type org_role as enum ('admin', 'editor', 'viewer');
create type model_status as enum ('draft', 'active', 'archived');
create type node_type as enum ('group', 'line');
create type rate_source as enum ('manual', 'index', 'benchmark');
create type billing_plan as enum ('free', 'pro', 'team');
create type billing_provider as enum ('stripe', 'razorpay');

-- ---------------------------------------------------------------------------
-- Organizations & membership
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Projects
-- ---------------------------------------------------------------------------
create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now()
);
create index on projects (org_id);

-- ---------------------------------------------------------------------------
-- Reference data (public-read): category templates & commodity indices
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Cost models, versions, and the CBS node tree
-- ---------------------------------------------------------------------------
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
  total_cost bigint not null default 0, -- integer minor units
  created_by uuid,
  created_at timestamptz not null default now(),
  note text,
  unique (model_id, version_no)
);

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
  rate bigint, -- integer minor units
  rate_source rate_source not null default 'manual',
  index_id uuid references indices(id),
  index_factor double precision,
  formula text,
  notes text
);
create index on cost_nodes (model_id);
create index on cost_nodes (parent_id);

-- ---------------------------------------------------------------------------
-- Quotes
-- ---------------------------------------------------------------------------
create table quotes (
  id uuid primary key default gen_random_uuid(),
  model_id uuid not null references cost_models(id) on delete cascade,
  supplier_name text not null,
  currency text not null default 'USD',
  incoterm text,
  payment_terms text,
  quoted_total bigint not null default 0, -- integer minor units
  received_at timestamptz not null default now()
);
create index on quotes (model_id);

create table quote_lines (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  cost_node_id uuid references cost_nodes(id) on delete set null,
  description text,
  amount bigint not null default 0 -- integer minor units
);

-- ---------------------------------------------------------------------------
-- Collaboration / governance
-- ---------------------------------------------------------------------------
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
