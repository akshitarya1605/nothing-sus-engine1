-- Milestone 1, step 2: Row-Level Security backstop on "GameEvent".
--
-- The browser never connects to Postgres directly — Prisma runs server-side
-- only. RLS here is a DB-level backstop UNDER the existing TypeScript
-- enforcement (src/lib/game/state.ts + src/app/api/realtime/route.ts), not a
-- replacement for it. Its two jobs:
--   (a) gate what Supabase Realtime "Postgres Changes" forwards to a
--       subscribed browser, and
--   (b) catch a future route that queries "GameEvent" without going through
--       the sanctioned read paths.
--
-- The policy mirrors the audience -> visibility mapping already encoded in
-- src/app/api/realtime/route.ts exactly:
--     any          -> PUBLIC
--     ADMIN        -> ADMIN, PROJECTOR, MEETING
--     SPECTATOR    -> PROJECTOR
--     PARTICIPANT  -> MEETING, and PARTICIPANT rows whose targetParticipantId
--                     is the participant themselves
--
-- Claims: src/lib/db/rlsContext.ts sets request.jwt.claims (via set_config)
-- to { session_kind, game_id, participant_id } inside a transaction that also
-- does SET LOCAL ROLE authenticated. Supabase's auth.jwt() reads exactly that
-- GUC. When the GUC is unset, auth.jwt() is NULL and every ->> yields NULL,
-- so the policy denies by default.

-- ---------------------------------------------------------------------------
-- Grants. Supabase's local database does not auto-grant table privileges to
-- the Data API roles for tables created by Prisma. Both the audience-scoped
-- server reads (SET LOCAL ROLE authenticated) and Supabase Realtime (which
-- evaluates RLS as the subscribing role) need SELECT. RLS — added here for
-- "GameEvent", and for the remaining tables in the next migration — is what
-- actually filters rows; the grant only makes the table reachable.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS on "GameEvent". The Prisma connection role (postgres) owns the table
-- and is a superuser, so it bypasses RLS entirely; this only takes effect
-- once a connection has done SET LOCAL ROLE authenticated. We deliberately do
-- NOT force RLS on the owner — the sanctioned cross-audience server reads
-- (prismaInternal, added later) rely on that bypass.
ALTER TABLE "GameEvent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "game_event_audience_read" ON "GameEvent"
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() ->> 'game_id') = "gameId"
    AND (
      "visibility" = 'PUBLIC'
      OR (
        (auth.jwt() ->> 'session_kind') = 'ADMIN'
        AND "visibility" IN ('ADMIN', 'PROJECTOR', 'MEETING')
      )
      OR (
        (auth.jwt() ->> 'session_kind') = 'SPECTATOR'
        AND "visibility" = 'PROJECTOR'
      )
      OR (
        (auth.jwt() ->> 'session_kind') = 'PARTICIPANT'
        AND "visibility" = 'MEETING'
      )
      OR (
        (auth.jwt() ->> 'session_kind') = 'PARTICIPANT'
        AND "visibility" = 'PARTICIPANT'
        AND "targetParticipantId" = (auth.jwt() ->> 'participant_id')
      )
    )
  );
