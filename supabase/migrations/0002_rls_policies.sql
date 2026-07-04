-- Row Level Security: users see only rows belonging to their org(s);
-- category_templates + indices + index_values are public-read.

-- Helper: the set of orgs the calling user belongs to.
create or replace function public.current_user_orgs()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select org_id from public.org_members where user_id = auth.uid();
$$;

-- Organizations: members can read; members can manage.
alter table organizations enable row level security;
create policy org_read on organizations for select using (id in (select public.current_user_orgs()));
create policy org_admin on organizations for all
  using (id in (select public.current_user_orgs()))
  with check (id in (select public.current_user_orgs()));

-- org_members: members read; only admins write.
alter table org_members enable row level security;
create policy om_read on org_members for select using (org_id in (select public.current_user_orgs()));
create policy om_admin_insert on org_members for insert with check (
  org_id in (select public.current_user_orgs())
  and exists (
    select 1 from public.org_members m
    where m.org_id = org_members.org_id and m.user_id = auth.uid() and m.role = 'admin'
  )
);
create policy om_admin_update on org_members for update using (
  exists (
    select 1 from public.org_members m
    where m.org_id = org_members.org_id and m.user_id = auth.uid() and m.role = 'admin'
  )
);

-- projects, models, nodes, quotes, comments, audit, share links: scoped via org membership.
alter table projects enable row level security;
create policy proj_all on projects for all
  using (org_id in (select public.current_user_orgs()))
  with check (org_id in (select public.current_user_orgs()));

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
  using (model_version_id in (
    select mv.id from public.model_versions mv
    join public.cost_models cm on cm.id = mv.model_id
    join public.projects p on p.id = cm.project_id
    where p.org_id in (select public.current_user_orgs())
  ));

alter table subscriptions enable row level security;
create policy sub_all on subscriptions for all using (org_id in (select public.current_user_orgs()));

-- Public-read reference data (templates + commodity indices).
alter table category_templates enable row level security;
create policy ct_read on category_templates for select using (true);

alter table indices enable row level security;
create policy idx_read on indices for select using (true);

alter table index_values enable row level security;
create policy idx_values_read on index_values for select using (true);
