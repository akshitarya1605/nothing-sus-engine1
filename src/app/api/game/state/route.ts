import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";
import { getAdminGameState, getPlayerGameState, getProjectorState, checkAutoAdvance } from "@/lib/game/engine";
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
    const session = await getSession();
    if (!session) throw new GameEngineError("UNAUTHENTICATED", "No active session");

    await checkAutoAdvance(session.gameId);

    if (session.role === "ADMIN") {
      return NextResponse.json(await getAdminGameState(prisma, session.gameId));
    }
    if (session.role === "PROJECTOR") {
      return NextResponse.json(await getProjectorState(prisma, session.gameId));
    }
    if (!session.playerId) throw new GameEngineError("UNAUTHENTICATED", "Player session missing playerId");
    return NextResponse.json(await getPlayerGameState(prisma, session.playerId));
  });
}
