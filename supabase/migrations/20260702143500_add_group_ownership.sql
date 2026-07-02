alter table public.groups
  add column if not exists owner_id uuid references auth.users(id) on delete cascade;

update public.groups as groups_to_update
set owner_id = (
  select group_members.user_id
  from public.group_members
  where group_members.group_id = groups_to_update.id
  order by group_members.joined_at asc, group_members.user_id asc
  limit 1
)
where groups_to_update.owner_id is null;

update public.groups as groups_to_update
set owner_id = (
  select beer_entries.user_id
  from public.beer_entries
  where beer_entries.group_id = groups_to_update.id
  order by beer_entries.created_at asc, beer_entries.user_id asc
  limit 1
)
where groups_to_update.owner_id is null;

do $$
begin
  if exists (
    select 1
    from public.groups
    where owner_id is null
  ) then
    raise exception 'Unable to backfill owner_id for all groups';
  end if;
end;
$$;

alter table public.groups
  alter column owner_id set not null;

create index if not exists groups_owner_id_idx on public.groups(owner_id);

create or replace function public.is_group_owner(group_uuid uuid, user_uuid uuid)
returns boolean as $$
  select exists (
    select 1
    from public.groups
    where id = group_uuid
      and owner_id = user_uuid
  );
$$ language sql security definer stable;

drop policy if exists "Anyone can create a group" on public.groups;
create policy "Anyone can create a group"
  on public.groups for insert
  with check (auth.uid() = owner_id);

drop policy if exists "Group members can update group" on public.groups;
drop policy if exists "Group owners can update group" on public.groups;
create policy "Group owners can update group"
  on public.groups for update
  using (owner_id = auth.uid());

drop policy if exists "Group owners can delete group" on public.groups;
create policy "Group owners can delete group"
  on public.groups for delete
  using (owner_id = auth.uid());

drop policy if exists "Users can leave groups" on public.group_members;
create policy "Users can leave groups"
  on public.group_members for delete
  using (
    user_id = auth.uid()
    and not public.is_group_owner(group_id, auth.uid())
  );

create or replace function public.delete_owned_group(target_group_id uuid)
returns uuid as $$
declare
  deleted_group_id uuid;
begin
  delete from public.groups
  where id = target_group_id
    and owner_id = auth.uid()
  returning id into deleted_group_id;

  if deleted_group_id is null then
    raise exception 'Only the group owner can delete this group';
  end if;

  return deleted_group_id;
end;
$$ language plpgsql security definer;
