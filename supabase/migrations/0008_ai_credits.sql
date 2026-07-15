-- One free "Draft with AI" per workspace. Pro/team are unlimited via plan, not this counter.
alter table organizations
  add column ai_draft_credits integer not null default 1;

-- Atomically reserve one credit before the Anthropic call. The ownership guard
-- (id in current_user_orgs()) prevents a caller from touching another org.
-- Returns the new balance, or NULL when the org had no credits left.
create or replace function public.dec_ai_credit(p_org_id uuid)
returns integer language sql security definer set search_path = public as $$
  update public.organizations
    set ai_draft_credits = ai_draft_credits - 1
    where id = p_org_id
      and id in (select public.current_user_orgs())
      and ai_draft_credits > 0
    returning ai_draft_credits;
$$;
grant execute on function public.dec_ai_credit(uuid) to authenticated;

-- Refund one credit on a failed/aborted draft.
create or replace function public.inc_ai_credit(p_org_id uuid)
returns void language sql security definer set search_path = public as $$
  update public.organizations
    set ai_draft_credits = ai_draft_credits + 1
    where id = p_org_id
      and id in (select public.current_user_orgs());
$$;
grant execute on function public.inc_ai_credit(uuid) to authenticated;
