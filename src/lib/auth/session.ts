import { cookies } from "next/headers";
import { prisma } from "../db/prisma";
import { generateSecret, hashToken } from "./tokens";

/**
 * Three separate, DB-backed session types — not one JWT covering all
 * three roles. Each is a real row a request can be checked against and
 * an admin (or the system) can revoke, which is what makes "force
 * logout a participant's other device" and "admin session survives a
 * server restart, revokable on demand" both possible. See
 * docs/SECURITY.md "Admin access" / "Single device session".
 */

const PARTICIPANT_COOKIE = "ns_participant";
const ADMIN_COOKIE = "ns_admin";
const SPECTATOR_COOKIE = "ns_spectator";

const PARTICIPANT_SESSION_HOURS = 14;
const ADMIN_SESSION_HOURS = 14;
const SPECTATOR_SESSION_HOURS = 14;

function expiresInHours(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------
// Participant sessions
// ---------------------------------------------------------------------

export interface ActiveParticipantSession {
  participantId: string;
  gameId: string;
}

/** Creates a new session row and sets the cookie. Callers are
 * responsible for having already checked single-device eligibility —
 * see lib/game/actions/participants.ts::loginParticipant. */
export async function createParticipantSession(participantId: string): Promise<void> {
  const raw = generateSecret();
  await prisma.participantSession.create({
    data: {
      participantId,
      sessionTokenHash: hashToken(raw),
      expiresAt: expiresInHours(PARTICIPANT_SESSION_HOURS),
    },
  });
  const store = await cookies();
  store.set(PARTICIPANT_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: PARTICIPANT_SESSION_HOURS * 60 * 60,
  });
}

export async function getParticipantSession(): Promise<ActiveParticipantSession | null> {
  const store = await cookies();
  const raw = store.get(PARTICIPANT_COOKIE)?.value;
  if (!raw) return null;

  const session = await prisma.participantSession.findUnique({
    where: { sessionTokenHash: hashToken(raw) },
    include: { participant: { select: { id: true, gameId: true } } },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  // best-effort liveness ping — not on the critical path, never blocks
  void prisma.participantSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => {});

  return { participantId: session.participant.id, gameId: session.participant.gameId };
}

export async function clearParticipantSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(PARTICIPANT_COOKIE);
}

export async function clearAdminSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(ADMIN_COOKIE);
}

export async function clearSpectatorSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SPECTATOR_COOKIE);
}

// ---------------------------------------------------------------------
// Admin sessions
// ---------------------------------------------------------------------

export interface ActiveAdminSession {
  gameId: string;
}

/** Exchanges a verified admin secret for a session — called only from
 * the /control/[secret] route handler, never from a form submission. */
export async function createAdminSession(gameId: string): Promise<void> {
  const raw = generateSecret();
  await prisma.adminSession.create({
    data: { gameId, tokenHash: hashToken(raw), expiresAt: expiresInHours(ADMIN_SESSION_HOURS) },
  });
  const store = await cookies();
  store.set(ADMIN_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_HOURS * 60 * 60,
  });
}

export async function getAdminSession(): Promise<ActiveAdminSession | null> {
  const store = await cookies();
  const raw = store.get(ADMIN_COOKIE)?.value;
  if (!raw) return null;

  const session = await prisma.adminSession.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  return { gameId: session.gameId };
}

// ---------------------------------------------------------------------
// Spectator sessions
// ---------------------------------------------------------------------

export interface ActiveSpectatorSession {
  gameId: string;
}

export async function createSpectatorSession(gameId: string): Promise<void> {
  const raw = generateSecret();
  await prisma.spectatorSession.create({
    data: { gameId, tokenHash: hashToken(raw), expiresAt: expiresInHours(SPECTATOR_SESSION_HOURS) },
  });
  const store = await cookies();
  store.set(SPECTATOR_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SPECTATOR_SESSION_HOURS * 60 * 60,
  });
}

export async function getSpectatorSession(): Promise<ActiveSpectatorSession | null> {
  const store = await cookies();
  const raw = store.get(SPECTATOR_COOKIE)?.value;
  if (!raw) return null;

  const session = await prisma.spectatorSession.findUnique({ where: { tokenHash: hashToken(raw) } });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;

  return { gameId: session.gameId };
}

/** A single combined check, used by the realtime SSE route which needs
 * to know "who is this, if anyone" across all three session types
 * without assuming which one applies. */
export type AnySession =
  | { kind: "PARTICIPANT"; participantId: string; gameId: string }
  | { kind: "ADMIN"; gameId: string }
  | { kind: "SPECTATOR"; gameId: string };

export async function getAnySession(): Promise<AnySession | null> {
  const participant = await getParticipantSession();
  if (participant) return { kind: "PARTICIPANT", ...participant };
  const admin = await getAdminSession();
  if (admin) return { kind: "ADMIN", ...admin };
  const spectator = await getSpectatorSession();
  if (spectator) return { kind: "SPECTATOR", ...spectator };
  return null;
}

/**
 * All three session cookies (`ns_participant`, `ns_admin`, `ns_spectator`)
 * routinely coexist in one browser — a host who also opens the player join
 * link on the same laptop, or previews the projector screen from their own
 * device, ends up holding all three at once. `getAnySession()`'s fixed
 * priority order (participant beats admin beats spectator) then silently
 * answers for the wrong role: e.g. the control room gets rendered with
 * player-shaped data and crashes, or the projector screen gets rendered
 * with admin/participant-shaped data (which has no `round`/`finalResult`
 * field) and falls back to its "not started yet" splash forever, even
 * mid-game.
 *
 * `getSessionAs()` is the fix: every first-party page now says which
 * surface it is via an explicit `?as=ADMIN|SPECTATOR|PARTICIPANT` query
 * param, and this resolves *only* that specific session — no priority
 * guessing. `as` absent/unrecognized falls back to `getAnySession()`'s old
 * behavior, for any caller not yet updated.
 */
export async function getSessionAs(as: string | null): Promise<AnySession | null> {
  if (as === "ADMIN") {
    const admin = await getAdminSession();
    return admin ? { kind: "ADMIN", ...admin } : null;
  }
  if (as === "SPECTATOR") {
    const spectator = await getSpectatorSession();
    return spectator ? { kind: "SPECTATOR", ...spectator } : null;
  }
  if (as === "PARTICIPANT") {
    const participant = await getParticipantSession();
    return participant ? { kind: "PARTICIPANT", ...participant } : null;
  }
  return getAnySession();
}
