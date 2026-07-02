-- ============================================================
-- Follows
-- ============================================================
create table if not exists follows (
  follower_id uuid references profiles(id) on delete cascade not null,
  following_id uuid references profiles(id) on delete cascade not null,
  created_at timestamptz default now() not null,
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

create index if not exists follows_follower_id_idx on follows(follower_id);
create index if not exists follows_following_id_idx on follows(following_id);

-- ============================================================
-- Row Level Security for follows
-- ============================================================
alter table follows enable row level security;

create policy "Follows are viewable by everyone"
  on follows for select
  using (true);

create policy "Users can follow others"
  on follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on follows for delete
  using (auth.uid() = follower_id);

-- ============================================================
-- RLS: beer entries visible to followers
-- ============================================================
create policy "Followers can view followed users' beer entries"
  on beer_entries for select
  using (
    user_id in (
      select following_id from public.follows where follower_id = auth.uid()
    )
  );

-- ============================================================
-- RPC: Social feed
-- Returns beer entries (with profile) from users the caller follows,
-- ordered newest-first. Uses security definer to bypass per-table RLS.
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
-- RPC: Get follow counts for a profile
-- ============================================================
create or replace function public.get_follow_counts(profile_id uuid)
returns table (followers bigint, following bigint) as $$
begin
  return query
    select
      (select count(*) from public.follows where following_id = profile_id) as followers,
      (select count(*) from public.follows where follower_id = profile_id) as following;
end;
$$ language plpgsql security definer stable;

-- ============================================================
-- RPC: Get public profile stats (for /profile/[username])
-- ============================================================
create or replace function public.get_public_profile(target_username text)
returns table (
  id uuid,
  username text,
  avatar_url text,
  member_since timestamptz,
  total_beers numeric,
  streak_days integer
) as $$
declare
  target_id uuid;
begin
  select p.id into target_id from public.profiles p where p.username = target_username;
  if target_id is null then
    return;
  end if;

  return query
    select
      p.id,
      p.username,
      p.avatar_url,
      p.created_at as member_since,
      coalesce(sum(be.amount), 0) as total_beers,
      0::integer as streak_days   -- computed client-side from recent_entries
    from public.profiles p
    left join public.beer_entries be on be.user_id = p.id
    where p.id = target_id
    group by p.id, p.username, p.avatar_url, p.created_at;
end;
$$ language plpgsql security definer stable;
