-- Milestone 1, step 3: extend the RLS backstop to the rest of the game
-- tables (row/game-scoped), and tighten the grants step 2 cast too wide.
--
-- Scope and intent (see docs/SECURITY.md and the approved plan):
--   * RLS here is row-level only. It scopes reads to the caller's own game,
--     and — for a PARTICIPANT audience — to their own participant-owned
--     rows. It does NOT hide columns: Participant.role and Task.otpHash stay
--     a src/lib/game/state.ts / action-function responsibility, because every
--     audience shares the one Postgres `authenticated` role and column-level
--     privacy would need security-definer views. This is a disclosed limit.
--   * The policies are permissive enough that the three sanctioned readers in
--     state.ts keep returning complete data for their own game when run
--     inside withAudienceContext (role -> authenticated).
--   * Session tables (ParticipantSession/AdminSession/SpectatorSession) get
--     no RLS — only session.ts reads them, via the raw (superuser) client,
--     before any claims context exists. Step 2's blanket GRANT SELECT did
--     reach them though, so we revoke that below.
--
-- NOTE (hosted deployment): PostgREST (`/rest/v1`) is exposed on the local
-- stack bound to loopback only. Before linking a hosted project, either keep
-- `public` out of [api].schemas or accept that a holder of a minted Realtime
-- token can reach these same RLS-filtered rows over REST — the filtering is
-- identical, but a SPECTATOR token could then read the role column off
-- Participant rows it can see. Revisit in the security/QA milestone.

-- ---------------------------------------------------------------------------
-- Claim accessors. Thin STABLE wrappers over the request JWT claims that
-- withAudienceContext sets (session_kind / game_id / participant_id).
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.claim_game_id() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT auth.jwt() ->> 'game_id' $$;

CREATE FUNCTION public.claim_session_kind() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT auth.jwt() ->> 'session_kind' $$;

CREATE FUNCTION public.claim_participant_id() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT auth.jwt() ->> 'participant_id' $$;

-- Parent-game lookups for the join tables that carry no gameId of their own.
-- SECURITY DEFINER so the lookup itself is not re-filtered by RLS.
CREATE FUNCTION public.game_of_participant(pid text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT "gameId" FROM "Participant" WHERE id = pid $$;

CREATE FUNCTION public.game_of_task(tid text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT "gameId" FROM "Task" WHERE id = tid $$;

CREATE FUNCTION public.game_of_meeting(mid text) RETURNS text
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS
  $$ SELECT "gameId" FROM "Meeting" WHERE id = mid $$;

-- ---------------------------------------------------------------------------
-- Undo the parts of step 2's blanket GRANT SELECT that reached tables which
-- must never be readable by the authenticated role.
-- ---------------------------------------------------------------------------
REVOKE ALL ON "ParticipantSession" FROM authenticated;
REVOKE ALL ON "AdminSession" FROM authenticated;
REVOKE ALL ON "SpectatorSession" FROM authenticated;
REVOKE ALL ON "_prisma_migrations" FROM authenticated;

-- ---------------------------------------------------------------------------
-- Directly game-scoped tables: readable iff the row's game is the caller's.
-- ---------------------------------------------------------------------------
-- "Game" keys on id; every other table in this group has a "gameId" column.
CREATE POLICY "Game_game_scoped_read" ON "Game"
  FOR SELECT TO authenticated
  USING ("id" = public.claim_game_id());
ALTER TABLE "Game" ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'GameConfig', 'GameResult', 'Round', 'Group', 'Location',
    'LocationEvent', 'Task', 'Meeting', 'Elimination', 'Ability', 'AuditLog'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING ("gameId" = public.claim_game_id())',
      t || '_game_scoped_read', t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Participant: ADMIN/SPECTATOR see the whole game roster (they only ever
-- count/aggregate it); a PARTICIPANT sees only their own row.
-- ---------------------------------------------------------------------------
ALTER TABLE "Participant" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participant_scoped_read" ON "Participant"
  FOR SELECT TO authenticated
  USING (
    "gameId" = public.claim_game_id()
    AND (
      public.claim_session_kind() IN ('ADMIN', 'SPECTATOR')
      OR "id" = public.claim_participant_id()
    )
  );

-- ---------------------------------------------------------------------------
-- Participant-owned join tables: same game, and for a PARTICIPANT audience
-- only their own rows.
-- ---------------------------------------------------------------------------
ALTER TABLE "ParticipantTask" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participant_task_scoped_read" ON "ParticipantTask"
  FOR SELECT TO authenticated
  USING (
    public.game_of_participant("participantId") = public.claim_game_id()
    AND (
      public.claim_session_kind() IN ('ADMIN', 'SPECTATOR')
      OR "participantId" = public.claim_participant_id()
    )
  );

ALTER TABLE "TaskAttempt" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "task_attempt_scoped_read" ON "TaskAttempt"
  FOR SELECT TO authenticated
  USING (
    public.game_of_participant("participantId") = public.claim_game_id()
    AND (
      public.claim_session_kind() IN ('ADMIN', 'SPECTATOR')
      OR "participantId" = public.claim_participant_id()
    )
  );

ALTER TABLE "AbilityUse" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ability_use_scoped_read" ON "AbilityUse"
  FOR SELECT TO authenticated
  USING (
    public.game_of_participant("participantId") = public.claim_game_id()
    AND (
      public.claim_session_kind() IN ('ADMIN', 'SPECTATOR')
      OR "participantId" = public.claim_participant_id()
    )
  );

-- ---------------------------------------------------------------------------
-- ChatMessage: MEETING-audience — every participant of the game plus admin,
-- never the spectator/projector.
-- ---------------------------------------------------------------------------
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_message_scoped_read" ON "ChatMessage"
  FOR SELECT TO authenticated
  USING (
    public.game_of_meeting("meetingId") = public.claim_game_id()
    AND public.claim_session_kind() IN ('ADMIN', 'PARTICIPANT')
  );

-- ---------------------------------------------------------------------------
-- Vote: never SELECT-able by a non-admin authenticated session (vote rows
-- are not queried by a player path at all). A participant may INSERT only
-- their own vote. The engine's own tally still runs on the raw client.
-- ---------------------------------------------------------------------------
ALTER TABLE "Vote" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vote_admin_read" ON "Vote"
  FOR SELECT TO authenticated
  USING (
    public.claim_session_kind() = 'ADMIN'
    AND public.game_of_meeting("meetingId") = public.claim_game_id()
  );

GRANT INSERT ON "Vote" TO authenticated;
CREATE POLICY "vote_self_insert" ON "Vote"
  FOR INSERT TO authenticated
  WITH CHECK (
    public.claim_session_kind() = 'PARTICIPANT'
    AND "voterId" = public.claim_participant_id()
    AND public.game_of_meeting("meetingId") = public.claim_game_id()
  );
