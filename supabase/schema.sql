-- Brava – Supabase SQL Schema
-- Run this in the Supabase SQL editor

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- Profiles
-- ============================================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  avatar_url text,
  created_at timestamptz default now() not null
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Groups
-- ============================================================
create table if not exists groups (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  invite_code text not null unique,
  created_at timestamptz default now() not null
);

-- ============================================================
-- Group Members
-- ============================================================
create table if not exists group_members (
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  joined_at timestamptz default now() not null,
  primary key (group_id, user_id)
);

-- ============================================================
-- Beer Entries
-- ============================================================
create table if not exists beer_entries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  group_id uuid references groups(id) on delete set null,
  beer_name text,
  brewery text,
  style text,
  amount numeric not null default 1 check (amount > 0 and amount <= 50),
  notes text,
  created_at timestamptz default now() not null
);

-- Indexes for performance
create index if not exists beer_entries_user_id_idx on beer_entries(user_id);
create index if not exists beer_entries_created_at_idx on beer_entries(created_at desc);
create index if not exists beer_entries_group_id_idx on beer_entries(group_id);
create index if not exists group_members_user_id_idx on group_members(user_id);

-- ============================================================
-- Row Level Security
-- ============================================================

-- Profiles
alter table profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on profiles for select
  using (true);

create policy "Users can insert their own profile"
  on profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

-- Groups
alter table groups enable row level security;

create policy "Groups are viewable by members"
  on groups for select
  using (
    id in (
      select group_id from group_members where user_id = auth.uid()
    )
  );

create policy "Anyone can create a group"
  on groups for insert
  with check (auth.uid() is not null);

create policy "Group members can update group"
  on groups for update
  using (
    id in (
      select group_id from group_members where user_id = auth.uid()
    )
  );

-- Group Members
alter table group_members enable row level security;

create policy "Members can view their group memberships"
  on group_members for select
  using (
    user_id = auth.uid() or
    group_id in (
      select group_id from group_members where user_id = auth.uid()
    )
  );

create policy "Users can join groups"
  on group_members for insert
  with check (user_id = auth.uid());

create policy "Users can leave groups"
  on group_members for delete
  using (user_id = auth.uid());

-- Beer Entries
alter table beer_entries enable row level security;

create policy "Users can view their own beer entries"
  on beer_entries for select
  using (user_id = auth.uid());

create policy "Group members can view group beer entries"
  on beer_entries for select
  using (
    group_id is not null and
    group_id in (
      select group_id from group_members where user_id = auth.uid()
    )
  );

create policy "Users can insert their own beer entries"
  on beer_entries for insert
  with check (user_id = auth.uid());

create policy "Users can update their own beer entries"
  on beer_entries for update
  using (user_id = auth.uid());

create policy "Users can delete their own beer entries"
  on beer_entries for delete
  using (user_id = auth.uid());
