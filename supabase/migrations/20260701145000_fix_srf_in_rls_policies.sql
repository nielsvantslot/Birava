-- Fix "set-returning functions are not allowed in policy expressions" (0A000)
--
-- get_user_group_ids was declared as RETURNS SETOF uuid, which PostgreSQL
-- forbids in RLS USING/WITH CHECK expressions even inside = any(...).
-- Changing the return type to uuid[] (array) resolves the error.
-- All callers already use = any(...), so no policy syntax changes are needed.

-- Must DROP first because return type is changing (CREATE OR REPLACE cannot
-- change a function's return type).
drop function if exists public.get_user_group_ids(uuid);

create function public.get_user_group_ids(user_uuid uuid)
returns uuid[] as $$
  select coalesce(array_agg(group_id), '{}')
  from public.group_members
  where user_id = user_uuid
$$ language sql security definer stable;

-- Re-create all policies that reference the function
-- (policies are not automatically updated when a function is replaced).

drop policy if exists "Members can view their group memberships" on group_members;
create policy "Members can view their group memberships"
  on group_members for select
  using (
    user_id = auth.uid() or
    group_id = any(public.get_user_group_ids(auth.uid()))
  );

drop policy if exists "Groups are viewable by members" on groups;
create policy "Groups are viewable by members"
  on groups for select
  using (
    id = any(public.get_user_group_ids(auth.uid()))
  );

drop policy if exists "Group members can view group beer entries" on beer_entries;
create policy "Group members can view group beer entries"
  on beer_entries for select
  using (
    group_id is not null and
    group_id = any(public.get_user_group_ids(auth.uid()))
  );
