import { NextResponse } from "next/server";
import { EventVisibility } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getAnySession } from "@/lib/auth/session";
import { handleRoute } from "@/lib/api/respond";
import { GameEngineError } from "@/lib/game/errors";

export const dynamic = "force-dynamic";

const MAX_EVENTS = 200;

/**
 * Event replay for the realtime client. `useGameRealtime` calls this on
 * (re)connect with its last-seen `sequenceNumber` to fill any gap the
 * websocket missed while it was down — realtime is a delivery mechanism,
 * the GameEvent table is the source of truth.
 *
 * Permission-filtered per the connected session, matching the audience ->
 * visibility map that the RLS policy on "GameEvent" enforces for the
 * websocket path (see prisma/migrations/*_rls_game_event). This route
 * uses the raw client + an explicit filter rather than
 * withAudienceContext because it only ever reads this one table and the
 * filter here is the authoritative statement of the rule.
 */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const session = await getAnySession();
    if (!session) throw new GameEngineError("UNAUTHENTICATED", "No active session");

    const since = BigInt(new URL(request.url).searchParams.get("since") ?? "0");

    const rows = await prisma.gameEvent.findMany({
      where: {
        gameId: session.gameId,
        sequenceNumber: { gt: since },
        OR: [
          { visibility: EventVisibility.PUBLIC },
          ...(session.kind === "ADMIN" ? [{ visibility: EventVisibility.ADMIN }] : []),
          ...(session.kind === "ADMIN" || session.kind === "SPECTATOR"
            ? [{ visibility: EventVisibility.PROJECTOR }]
            : []),
          ...(session.kind === "ADMIN" || session.kind === "PARTICIPANT"
            ? [{ visibility: EventVisibility.MEETING }]
            : []),
          ...(session.kind === "PARTICIPANT"
            ? [{ visibility: EventVisibility.PARTICIPANT, targetParticipantId: session.participantId }]
            : []),
        ],
      },
      orderBy: { sequenceNumber: "asc" },
      take: MAX_EVENTS,
    });

    return NextResponse.json({
      events: rows.map((e) => ({
        id: e.id,
        type: e.type,
        payload: e.payload,
        sequenceNumber: e.sequenceNumber.toString(),
        createdAt: e.createdAt.toISOString(),
      })),
    });
  });
}
