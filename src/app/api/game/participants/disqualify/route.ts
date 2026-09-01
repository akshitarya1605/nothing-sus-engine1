import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { EliminationsEngine } from "@/lib/game/engine";
import { disqualifyParticipantSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

/** Host removes a player from the game (cheating, no-show). Sets status
 * DISQUALIFIED — excluded from win-condition counts, no role reveal. */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { participantId, reason } = await parseJsonBody(request, disqualifyParticipantSchema);
    const result = await EliminationsEngine.disqualifyParticipant(session.gameId, {
      participantId,
      reason,
      actorId: "admin",
    });
    return NextResponse.json(result);
  });
}
