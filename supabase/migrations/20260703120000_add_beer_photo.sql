-- ============================================================
-- Add photo_url column to beer_entries
-- ============================================================
alter table beer_entries add column if not exists photo_url text;

-- ============================================================
-- Storage bucket for beer photos
-- ============================================================
insert into storage.buckets (id, name, public)
values ('beer-photos', 'beer-photos', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload their own photos
-- Files are stored as {user_id}/{filename}
drop policy if exists "Users can upload beer photos" on storage.objects;
create policy "Users can upload beer photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'beer-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow public read of all beer photos
drop policy if exists "Beer photos are publicly readable" on storage.objects;
create policy "Beer photos are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'beer-photos');

-- Allow users to update their own photos
drop policy if exists "Users can update their own beer photos" on storage.objects;
create policy "Users can update their own beer photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'beer-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own photos
drop policy if exists "Users can delete their own beer photos" on storage.objects;
create policy "Users can delete their own beer photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'beer-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- Update get_social_feed to include photo_url
-- ============================================================
create or replace function public.get_social_feed(
  lim integer default 20,
  off integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  group_id uuid,
  beer_name text,
  brewery text,
  style text,
  amount numeric,
  notes text,
  photo_url text,
  created_at timestamptz,
  username text,
  avatar_url text
) as $$
begin
  return query
    select
      be.id,
      be.user_id,
      be.group_id,
      be.beer_name,
      be.brewery,
      be.style,
      be.amount,
      be.notes,
      be.photo_url,
      be.created_at,
      p.username,
      p.avatar_url
    from public.beer_entries be
    join public.profiles p on p.id = be.user_id
    where be.user_id in (
      select following_id from public.follows where follower_id = auth.uid()
    )
    order by be.created_at desc
    limit lim offset off;
end;
$$ language plpgsql security definer stable;

-- ============================================================
-- RPC: Group activity feed (recent entries in a group)
-- ============================================================
create or replace function public.get_group_feed(
  target_group_id uuid,
  lim integer default 20,
  off integer default 0
)
returns table (
  id uuid,
  user_id uuid,
  group_id uuid,
  beer_name text,
  brewery text,
  style text,
  amount numeric,
  notes text,
  photo_url text,
  created_at timestamptz,
  username text,
  avatar_url text
) as $$
begin
  -- Verify caller is a member of the group
  if not exists (
    select 1 from public.group_members
    where group_id = target_group_id and user_id = auth.uid()
  ) then
    raise exception 'Not a member of this group';
  end if;

  return query
    select
      be.id,
      be.user_id,
      be.group_id,
      be.beer_name,
      be.brewery,
      be.style,
      be.amount,
      be.notes,
      be.photo_url,
      be.created_at,
      p.username,
      p.avatar_url
    from public.beer_entries be
    join public.profiles p on p.id = be.user_id
    where be.user_id in (
      select user_id from public.group_members where group_id = target_group_id
    )
    order by be.created_at desc
    limit lim offset off;
end;
$$ language plpgsql security definer stable;
