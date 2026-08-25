import { GameEngineError } from "../game/errors";
import { getSession, type SessionPayload, type SessionRole } from "./session";

/** Every route handler that mutates or reads privileged data calls one
 * of these first. There is no "trust the body" path — the role and
 * playerId always come from the verified session, never from request
 * JSON. */
async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new GameEngineError("UNAUTHENTICATED", "No active session");
  }
  return session;
}

export async function requireRole(...roles: SessionRole[]): Promise<SessionPayload> {
  const session = await requireSession();
  if (!roles.includes(session.role)) {
    throw new GameEngineError("FORBIDDEN", `Requires one of: ${roles.join(", ")}`);
  }
  return session;
}

export const requireAdmin = () => requireRole("ADMIN");
export const requireProjector = () => requireRole("ADMIN", "PROJECTOR");
export const requirePlayer = () => requireRole("PLAYER");

/** Player session, with playerId guaranteed present (it always is for a
 * validly-issued PLAYER session, but this keeps callers from needing a
 * non-null assertion). */
export async function requirePlayerSession(): Promise<SessionPayload & { playerId: string }> {
  const session = await requireRole("PLAYER");
  if (!session.playerId) {
    throw new GameEngineError("UNAUTHENTICATED", "Player session missing playerId");
  }
  return session as SessionPayload & { playerId: string };
}
