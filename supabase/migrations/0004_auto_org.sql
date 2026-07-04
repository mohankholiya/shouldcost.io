-- When a new auth user is created, give them a personal org + admin membership.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_org uuid;
begin
  insert into public.organizations (name, plan)
  values (coalesce(new.email, 'My workspace'), 'free')
  returning id into new_org;
  insert into public.org_members (org_id, user_id, role)
  values (new_org, new.id, 'admin');
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();
