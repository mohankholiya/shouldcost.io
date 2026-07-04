-- Public resolver: given a token, return the version snapshot if not revoked/expired.
-- SECURITY DEFINER so an anon session (no org membership) can read a shared version only.
create or replace function public.resolve_share_link(p_token text)
returns table (
  model_version_id uuid,
  snapshot_json jsonb,
  total_cost bigint,
  created_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select sl.model_version_id, mv.snapshot_json, mv.total_cost, mv.created_at
  from public.share_links sl
  join public.model_versions mv on mv.id = sl.model_version_id
  where sl.token = p_token
    and coalesce(sl.revoked, false) = false
    and (sl.expires_at is null or sl.expires_at > now());
$$;

grant execute on function public.resolve_share_link(text) to anon, authenticated;
