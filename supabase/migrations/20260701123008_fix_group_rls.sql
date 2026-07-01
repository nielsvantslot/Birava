-- Fix recursive RLS policies on group_members and groups
-- PostgreSQL does not support recursive RLS policies (behavior is undefined).
-- We replace them with a security-definer helper function.

-- ============================================================
-- Helper function (bypasses RLS to avoid recursion)
-- ============================================================
create or replace function public.get_user_group_ids(user_uuid uuid)
returns setof uuid as $$
  select group_id from public.group_members where user_id = user_uuid
$$ language sql security definer stable;

-- ============================================================
-- Fix group_members select policy (was recursive)
-- ============================================================
drop policy if exists "Members can view their group memberships" on group_members;

create policy "Members can view their group memberships"
  on group_members for select
  using (
    user_id = auth.uid() or
    group_id = any(public.get_user_group_ids(auth.uid()))
  );

-- ============================================================
-- Fix groups select policy (was also recursive via group_members)
-- ============================================================
drop policy if exists "Groups are viewable by members" on groups;

create policy "Groups are viewable by members"
  on groups for select
  using (
    id = any(public.get_user_group_ids(auth.uid()))
  );

-- ============================================================
-- RPC for joining a group by invite code
-- Runs as security definer so it can look up any group by
-- invite_code without the caller needing to be a member first.
-- ============================================================
create or replace function public.join_group_by_invite_code(invite text)
returns uuid as $$
declare
  gid uuid;
begin
  select id into gid from public.groups where invite_code = invite;
  if gid is null then
    raise exception 'Group not found';
  end if;
  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid())
  on conflict do nothing;
  return gid;
end;
$$ language plpgsql security definer;
