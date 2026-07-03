-- Enable realtime for beer_entries so postgres_changes subscriptions work.
-- Without this the leaderboard's Supabase subscription never receives events.
alter publication supabase_realtime add table beer_entries;

-- Set REPLICA IDENTITY FULL so the full row is available on UPDATE/DELETE events,
-- allowing Supabase to correctly apply RLS filters when delivering those events.
alter table beer_entries replica identity full;
