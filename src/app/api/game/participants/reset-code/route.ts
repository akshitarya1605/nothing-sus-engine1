import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { ParticipantsEngine } from "@/lib/game/engine";
import { participantIdSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { participantId } = await parseJsonBody(request, participantIdSchema);
    const result = await ParticipantsEngine.resetParticipantCode(session.gameId, participantId);
    return NextResponse.json(result);
  });
}
