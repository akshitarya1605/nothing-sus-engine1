import { NextResponse } from "next/server";
import { EliminationMethod } from "@prisma/client";
import { requireAdmin } from "@/lib/auth/guards";
import { EliminationsEngine } from "@/lib/game/engine";
import { eliminatePlayerSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

/** Direct admin elimination outside a meeting (spec: EliminationMethod
 * includes ADMIN as well as VOTE). */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { playerId, meetingId } = await parseJsonBody(request, eliminatePlayerSchema);
    const result = await EliminationsEngine.eliminatePlayer(session.gameId, {
      playerId,
      meetingId,
      method: EliminationMethod.ADMIN,
      actorId: "admin",
    });
    return NextResponse.json(result);
  });
}
