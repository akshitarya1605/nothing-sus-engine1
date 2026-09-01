import { GameEngineError } from "../game/errors";
import { getAdminSession, getParticipantSession, getSpectatorSession } from "./session";

/** Every route that mutates or reads privileged data calls one of
 * these first. Role and participantId always come from a verified,
 * DB-backed session — never from the request body. */

export async function requireParticipant(): Promise<{ participantId: string; gameId: string }> {
  const session = await getParticipantSession();
  if (!session) {
    throw new GameEngineError("UNAUTHENTICATED", "No active participant session");
  }
  return session;
}

export async function requireAdmin(): Promise<{ gameId: string }> {
  const session = await getAdminSession();
  if (!session) {
    throw new GameEngineError("UNAUTHENTICATED", "No active admin session");
  }
  return session;
}

export async function requireSpectator(): Promise<{ gameId: string }> {
  const session = await getSpectatorSession();
  if (!session) {
    throw new GameEngineError("UNAUTHENTICATED", "No active spectator session");
  }
  return session;
}

/** Admin and spectator overlap in a few read-only cases (e.g. chat
 * moderation view) — most routes want exactly one of the three guards
 * above, not this. */
export async function requireAdminOrSpectator(): Promise<{ gameId: string }> {
  const admin = await getAdminSession();
  if (admin) return admin;
  const spectator = await getSpectatorSession();
  if (spectator) return spectator;
  throw new GameEngineError("UNAUTHENTICATED", "No active admin or spectator session");
}
