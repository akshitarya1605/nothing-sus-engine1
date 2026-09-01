-- Milestone 1, step 3 (follow-up): shrink the privilege surface of the
-- `anon` / `authenticated` roles on the game tables.
--
-- Supabase's local bootstrap grants TRUNCATE / TRIGGER / REFERENCES on every
-- public table to anon + authenticated by default. Neither role can log in,
-- and the only code that assumes `authenticated` (withAudienceContext, and
-- Supabase Realtime's RLS evaluation) only ever reads — but there is no
-- reason for these roles to be able to TRUNCATE a game table, so take it
-- away. SELECT stays governed by the RLS policies from the previous
-- migration; INSERT on "Vote" (the one write authenticated is meant to be
-- able to do, gated by vote_self_insert) is re-granted afterwards.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES, INSERT, UPDATE, DELETE ON TABLES FROM anon, authenticated;

GRANT INSERT ON "Vote" TO authenticated;
