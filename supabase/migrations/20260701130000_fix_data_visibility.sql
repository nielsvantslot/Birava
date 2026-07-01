-- Fix data visibility: re-apply all RLS policies idempotently and repair orphaned data.
--
-- Why this is needed
-- ==================
-- 1. The Vercel build never ran `supabase db push`, so migrations 2 and 3 may not
--    have been applied to the production database.  This migration is idempotent:
--    it safely re-creates every helper function and policy that was introduced in
--    those earlier migrations, so running it twice is harmless.
--
-- 2. The beer_entries "Group members can view group beer entries" policy used a raw
--    sub-select into group_members.  If group_members' own RLS hadn't been fixed yet
--    (migration 2 unapplied), that sub-select could misbehave.  We now rewrite it to
--    use get_user_group_ids() for consistency.
--
-- 3. Groups that were created before the PR #8 fix have no group_members row for the
--    creator, so they are invisible under every current policy.  The repair at the
--    bottom infers membership from existing beer_entries and adds the missing rows.

-- ============================================================
-- 1. Ensure helper function exists / is up to date
-- ============================================================
create or replace function public.get_user_group_ids(user_uuid uuid)
returns uuid[] as $$
  select coalesce(array_agg(group_id), '{}')
  from public.group_members where user_id = user_uuid
$$ language sql security definer stable;

-- ============================================================
-- 2. Fix group_members select policy (non-recursive)
-- ============================================================
drop policy if exists "Members can view their group memberships" on group_members;
create policy "Members can view their group memberships"
  on group_members for select
  using (
    user_id = auth.uid() or
    group_id = any(public.get_user_group_ids(auth.uid()))
  );

-- ============================================================
-- 3. Fix groups select policy (uses helper, no sub-select)
-- ============================================================
drop policy if exists "Groups are viewable by members" on groups;
create policy "Groups are viewable by members"
  on groups for select
  using (
    id = any(public.get_user_group_ids(auth.uid()))
  );

-- ============================================================
-- 4. Fix beer_entries group-members policy to use helper
--    (previously used a raw sub-select into group_members)
-- ============================================================
drop policy if exists "Group members can view group beer entries" on beer_entries;
create policy "Group members can view group beer entries"
  on beer_entries for select
  using (
    group_id is not null and
    group_id = any(public.get_user_group_ids(auth.uid()))
  );

-- ============================================================
-- 5. Ensure join_group_by_invite_code RPC exists
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

-- ============================================================
-- 6. Repair orphaned data
--    Add group_members rows for every (group_id, user_id) pair
--    that appears in beer_entries but has no membership row.
--    This fixes groups whose creator was never inserted into
--    group_members due to the pre-PR#8 group-creation bug.
-- ============================================================
insert into group_members (group_id, user_id)
select distinct be.group_id, be.user_id
from   beer_entries be
left   join group_members gm
       on  gm.group_id = be.group_id
       and gm.user_id  = be.user_id
where  be.group_id is not null
and    gm.group_id is null
on conflict do nothing;
