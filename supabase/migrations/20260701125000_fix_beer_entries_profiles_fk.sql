-- Fix the foreign key on beer_entries.user_id to point to profiles
-- instead of auth.users. This makes the relationship visible to
-- PostgREST so that embedded resource joins like
-- profiles(username, avatar_url) work correctly in queries on
-- beer_entries (e.g. the leaderboard page).
--
-- Cascade behaviour is preserved: auth.users → profiles (cascade)
-- → beer_entries (cascade).

alter table beer_entries
  drop constraint if exists beer_entries_user_id_fkey;

alter table beer_entries
  add constraint beer_entries_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;
