import { NextResponse } from "next/server";
import { getSessionAs } from "@/lib/auth/session";
import { ChatEngine } from "@/lib/game/engine";
import { GameEngineError } from "@/lib/game/errors";
import { handleRoute } from "@/lib/api/respond";

/** Alive participants (their own game) and admin only — never the
 * spectator/projector (spec: "Projector does NOT display chat"). */
export async function GET(request: Request) {
  return handleRoute(async () => {
    const url = new URL(request.url);
    const session = await getSessionAs(url.searchParams.get("as"));
    if (!session || (session.kind !== "ADMIN" && session.kind !== "PARTICIPANT")) {
      throw new GameEngineError("UNAUTHENTICATED", "No active admin or participant session");
    }
    const meetingId = url.searchParams.get("meetingId");
    if (!meetingId) throw new GameEngineError("VALIDATION", "meetingId is required");

    const messages = await ChatEngine.getChatMessages(session.gameId, meetingId);
    return NextResponse.json(messages);
  });
}
