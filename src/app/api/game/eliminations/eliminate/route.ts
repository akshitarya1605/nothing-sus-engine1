import { NextResponse } from "next/server";
import { EliminationMethod } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { EliminationsEngine } from "@/lib/game/engine";
import { eliminateParticipantSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

/** Direct admin elimination outside a meeting (spec: EliminationMethod
 * includes ADMIN as well as VOTE). */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { participantId, meetingId } = await parseJsonBody(request, eliminateParticipantSchema);
    const result = await EliminationsEngine.eliminateParticipant(session.gameId, {
      participantId,
      meetingId,
      method: EliminationMethod.ADMIN,
      actorId: "admin",
    });
    return NextResponse.json(result);
  });
}
