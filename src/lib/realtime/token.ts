import { SignJWT, jwtVerify } from "jose";
import type { AnySession } from "@/lib/auth/session";
import { audienceClaimsFor, type AudienceClaims } from "@/lib/db/rlsContext";

/**
 * The ONE signed-JWT surface in this app. It exists only to authenticate a
 * browser's Supabase Realtime subscription — it is never persisted, never
 * set as a cookie, and has nothing to do with the login/session system
 * (which stays opaque DB-backed tokens). It is deliberately short-lived; a
 * client refetches one whenever its socket needs to (re)connect.
 *
 * Claims:
 *   - `role: "authenticated"` — Supabase Realtime SET ROLEs to this when it
 *     evaluates the RLS policies on "GameEvent".
 *   - session_kind / game_id / participant_id — read by those same policies
 *     via auth.jwt() (see src/lib/db/rlsContext.ts and the *_rls_* migrations).
 *   - standard iat / exp / aud / sub.
 *
 * Signed HS256 with SUPABASE_JWT_SECRET — the same secret the local Supabase
 * stack verifies with. `.env.example` documents loudly that the local
 * default MUST be rotated before linking a hosted project.
 */

const TOKEN_TTL_SECONDS = 5 * 60;
const ALG = "HS256";
const AUDIENCE = "authenticated";

function secretKey(): Uint8Array {
  const s = process.env.SUPABASE_JWT_SECRET;
  if (!s) throw new Error("SUPABASE_JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

export interface RealtimeTokenClaims extends AudienceClaims {
  role: "authenticated";
}

export interface MintedRealtimeToken {
  token: string;
  /** seconds until expiry — the client uses this to schedule a refetch */
  expiresIn: number;
}

export async function mintRealtimeToken(session: AnySession): Promise<MintedRealtimeToken> {
  const claims = audienceClaimsFor(session);
  const subject = session.kind === "PARTICIPANT" ? session.participantId : session.gameId;

  const token = await new SignJWT({ ...claims, role: "authenticated" })
    .setProtectedHeader({ alg: ALG })
    .setSubject(subject)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());

  return { token, expiresIn: TOKEN_TTL_SECONDS };
}

const SESSION_KINDS = new Set<AudienceClaims["session_kind"]>(["PARTICIPANT", "ADMIN", "SPECTATOR"]);

/**
 * Verify + shape-check a token this app minted. Supabase Realtime does its
 * own independent verification; this is for our tests and any future
 * server-side use.
 */
export async function verifyRealtimeToken(token: string): Promise<RealtimeTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: [ALG],
    audience: AUDIENCE,
  });

  const kind = payload.session_kind;
  const gameId = payload.game_id;
  if (
    payload.role !== "authenticated" ||
    typeof kind !== "string" ||
    !SESSION_KINDS.has(kind as AudienceClaims["session_kind"]) ||
    typeof gameId !== "string"
  ) {
    throw new Error("Realtime token payload failed shape validation");
  }
  if (kind === "PARTICIPANT" && typeof payload.participant_id !== "string") {
    throw new Error("Participant realtime token is missing participant_id");
  }

  return {
    role: "authenticated",
    session_kind: kind as AudienceClaims["session_kind"],
    game_id: gameId,
    ...(typeof payload.participant_id === "string" ? { participant_id: payload.participant_id } : {}),
  };
}
