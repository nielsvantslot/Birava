create or replace function public.leave_group(target_group_id uuid)
returns uuid as $$
declare
  current_owner_id uuid;
  left_group_id uuid;
  deleted_group_id uuid;
begin
  select owner_id
  into current_owner_id
  from public.groups
  where id = target_group_id;

  if current_owner_id = auth.uid() then
    raise exception 'Group owners cannot leave their own group';
  end if;

  delete from public.group_members
  where group_id = target_group_id
    and user_id = auth.uid()
  returning group_id into left_group_id;

  if left_group_id is null then
    raise exception 'You are not a member of this group';
  end if;

  if current_owner_id is null then
    delete from public.groups
    where id = target_group_id
      and owner_id is null
      and not exists (
        select 1
        from public.group_members
        where group_id = target_group_id
      )
    returning id into deleted_group_id;
  end if;

  return coalesce(deleted_group_id, left_group_id);
end;
$$ language plpgsql security definer;
