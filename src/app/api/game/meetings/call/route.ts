import { NextResponse } from "next/server";
import { MeetingType } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { MeetingsEngine } from "@/lib/game/engine";
import { callMeetingSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { GameEngineError } from "@/lib/game/errors";

/** Admin calls a regular meeting; an alive player can call an emergency
 * meeting (subject to GameConfig.allowEmergencyMeeting, enforced inside
 * the engine, not here). */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireRole("ADMIN", "PLAYER");
    const { reason, emergency } = await parseJsonBody(request, callMeetingSchema);

    if (session.role === "PLAYER" && !emergency) {
      throw new GameEngineError("FORBIDDEN", "Players can only call emergency meetings");
    }
    if (session.role === "PLAYER" && !session.playerId) {
      throw new GameEngineError("UNAUTHENTICATED", "Player session missing playerId");
    }

    const meeting = await MeetingsEngine.callMeeting(session.gameId, {
      type: session.role === "PLAYER" ? MeetingType.EMERGENCY : MeetingType.ADMIN_CALLED,
      reason,
      calledById: session.role === "PLAYER" ? session.playerId : undefined,
    });

    return NextResponse.json(meeting);
  });
}
