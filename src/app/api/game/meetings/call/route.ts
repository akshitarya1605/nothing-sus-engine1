import { NextResponse } from "next/server";
import { MeetingType } from "@prisma/client";
import { getSessionAs } from "@/lib/auth/session";
import { MeetingsEngine } from "@/lib/game/engine";
import { callMeetingSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { GameEngineError } from "@/lib/game/errors";

/** Admin calls a regular meeting; an alive participant can call an
 * emergency meeting (subject to GameConfig.allowEmergencyMeeting,
 * enforced inside the engine, not here). */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const as = new URL(request.url).searchParams.get("as");
    const session = await getSessionAs(as);
    if (!session || (session.kind !== "ADMIN" && session.kind !== "PARTICIPANT")) {
      throw new GameEngineError("UNAUTHENTICATED", "No active admin or participant session");
    }
    const { reason, emergency } = await parseJsonBody(request, callMeetingSchema);

    if (session.kind === "PARTICIPANT" && !emergency) {
      throw new GameEngineError("FORBIDDEN", "Participants can only call emergency meetings");
    }

    const meeting = await MeetingsEngine.callMeeting(session.gameId, {
      type: session.kind === "PARTICIPANT" ? MeetingType.EMERGENCY : MeetingType.ADMIN_CALLED,
      reason,
      calledById: session.kind === "PARTICIPANT" ? session.participantId : undefined,
    });

    return NextResponse.json(meeting);
  });
}
