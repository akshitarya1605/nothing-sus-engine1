import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { AnySession } from "@/lib/auth/session";

/**
 * The RLS claim shape. Mirrors what the migration policies read via
 * `auth.jwt() ->> '...'` (see prisma/migrations/*_rls_game_event) and what
 * the Realtime token embeds (src/lib/realtime/token.ts).
 */
export interface AudienceClaims {
  session_kind: AnySession["kind"];
  game_id: string;
  /** present only for participant sessions */
  participant_id?: string;
}

export function audienceClaimsFor(session: AnySession): AudienceClaims {
  return {
    session_kind: session.kind,
    game_id: session.gameId,
    ...(session.kind === "PARTICIPANT" ? { participant_id: session.participantId } : {}),
  };
}

/**
 * Runs `fn` against a DB handle scoped to `session`'s audience: an explicit
 * transaction whose connection has `request.jwt.claims` set and its role
 * downgraded from the superuser Prisma connects as (`postgres`, which
 * bypasses RLS) to `authenticated` (which does not). This is the ONLY
 * sanctioned way to obtain an audience-scoped connection.
 *
 * Both statements MUST run inside an explicit transaction: `SET LOCAL`
 * outside one persists onto the next checkout of the same pooled
 * connection and leaks one request's identity into another's. Prisma's
 * interactive `$transaction` is that boundary — `SET LOCAL` reverts on
 * COMMIT/ROLLBACK.
 *
 * Claims are set *before* the role switch, while still `postgres`, and the
 * value is passed as a bound parameter (never string-interpolated).
 *
 * NOTE: the `state.ts` readers now run their own queries sequentially, but
 * Prisma's relation loading (`include`) can still issue several queries per
 * call on the one transaction connection. Prisma serializes them correctly;
 * `@prisma/adapter-pg` logs a benign `client.query() while executing`
 * DeprecationWarning for it under Node's warning stream. Not a correctness
 * issue (every integration test passes); revisit if pg@9 upgrades it to an
 * error, at which point the fix is `$queryRaw` for the admin snapshot.
 */
export async function withAudienceContext<T>(
  session: AnySession,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const claims = JSON.stringify(audienceClaimsFor(session));
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('request.jwt.claims', ${claims}, true)`;
      await tx.$executeRawUnsafe("SET LOCAL ROLE authenticated");
      return fn(tx);
    },
    // the admin snapshot fans out into ~10 sequential queries on the single
    // transaction connection; the default 5s interactive-tx timeout is a
    // little tight under load.
    { timeout: 15_000 },
  );
}
