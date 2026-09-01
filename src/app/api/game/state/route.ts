import { NextResponse } from "next/server";
import { getAnySession } from "@/lib/auth/session";
import { withAudienceContext } from "@/lib/db/rlsContext";
import { getAdminGameState, getParticipantGameState, getProjectorState, checkAutoAdvance } from "@/lib/game/engine";
import type { AdminGameState, ParticipantGameState, ProjectorState } from "@/lib/game/state";
import { GameEngineError } from "@/lib/game/errors";
import { handleRoute } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/**
 * The one snapshot endpoint every client polls (or, more precisely,
 * calls once on mount/reconnect and then again whenever a realtime
 * event tells it something changed — see /api/realtime). It runs the
 * time-based auto-advance check before reading, so state is always
 * caught up regardless of who else has been connected.
 */
export async function GET() {
  return handleRoute(async () => {
    const session = await getAnySession();
    if (!session) throw new GameEngineError("UNAUTHENTICATED", "No active session");

    await checkAutoAdvance(session.gameId);

    // The snapshot read runs inside an audience-scoped transaction (role
    // downgraded to `authenticated`, RLS claims set) so the DB-level
    // backstop is exercised on the same path the browser polls — the
    // TypeScript contracts in state.ts remain the primary filter.
    const snapshot = await withAudienceContext<
      AdminGameState | ParticipantGameState | ProjectorState
    >(session, (tx) => {
      if (session.kind === "ADMIN") return getAdminGameState(tx, session.gameId);
      if (session.kind === "SPECTATOR") return getProjectorState(tx, session.gameId);
      return getParticipantGameState(tx, session.participantId);
    });
    return NextResponse.json(snapshot);
  });
}
