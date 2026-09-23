import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import type { AnySession } from "@/lib/auth/session";

export interface AudienceClaims {
  session_kind: AnySession["kind"];
  game_id: string;
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
 * Runs `fn` against a DB handle scoped to `session`'s audience.
 *
 * Since Prisma connects as the superuser (which bypasses RLS on Supabase),
 * audience scoping is enforced entirely at the TypeScript/query layer in
 * state.ts and the action files — every query filters by session.gameId and
 * session.participantId as appropriate.
 *
 * We intentionally do NOT attempt SET LOCAL / SET ROLE inside a transaction
 * here: on Supabase's free-tier transaction pooler (PgBouncer, port 6543),
 * interactive multi-statement transactions are rejected. The superuser
 * connection already sees all rows; TypeScript is the access-control layer.
 */
export async function withAudienceContext<T>(
  _session: AnySession,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  // Pass the prisma client directly — cast matches TransactionClient's shape
  // for all the query methods state.ts uses.
  return fn(prisma as unknown as Prisma.TransactionClient);
}
