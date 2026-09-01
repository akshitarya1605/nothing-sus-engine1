-- Milestone 1, step 5: add "GameEvent" to the Supabase Realtime publication
-- so "Postgres Changes" forwards inserts to subscribed browsers. Delivery is
-- authorized by the game_event_audience_read RLS policy (added in
-- 20260901083218_rls_game_event) evaluated as the subscriber's role.
--
-- "GameEvent" rows are insert-only and their id is a cuid (not a sequence),
-- so REPLICA IDENTITY DEFAULT (primary key) is enough for the change feed.
--
-- The legacy pg_notify('game_events', ...) call in
-- src/lib/game/events/publisher.ts and the SSE route stay live alongside
-- this — the two realtime paths run in parallel through Milestone 1; the
-- old one is removed as the opening step of Milestone 2.
--
-- `supabase_realtime` is created empty by the Supabase base image; guard the
-- ADD TABLE so re-running against a db that already has it is a no-op.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'GameEvent'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE "GameEvent"';
  END IF;
END $$;
