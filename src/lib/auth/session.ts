import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Session model. There is deliberately no per-admin user table yet
 * (see docs/SECURITY.md "Known limitations") — ADMIN and PROJECTOR
 * sessions are granted by a shared passphrase from env, and PLAYER
 * sessions are bound to a single playerId. Every server-side check that
 * matters reads this session, never a value the client sent in a body.
 */
export type SessionRole = "ADMIN" | "PROJECTOR" | "PLAYER";

export interface SessionPayload {
  role: SessionRole;
  gameId: string;
  /** set only when role === "PLAYER" */
  playerId?: string;
}

const COOKIE_NAME = "ns_session";
const SESSION_TTL_SECONDS = 60 * 60 * 14; // 14h — covers a full event day

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      (payload.role === "ADMIN" || payload.role === "PROJECTOR" || payload.role === "PLAYER") &&
      typeof payload.gameId === "string"
    ) {
      return {
        role: payload.role,
        gameId: payload.gameId,
        playerId: typeof payload.playerId === "string" ? payload.playerId : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Reads and verifies the session cookie for the current request. Safe
 * to call from Server Components, Route Handlers, and Server Functions
 * (read-only). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Must be called from a Route Handler or Server Function — see
 * Next.js cookies() docs on why plain Server Components can't set
 * cookies. */
export async function setSessionCookie(payload: SessionPayload): Promise<void> {
  const token = await createSessionToken(payload);
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
