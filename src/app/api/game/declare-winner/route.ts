import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { RoundsEngine } from "@/lib/game/engine";
import { declareWinnerSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

/** Host override — ends the game now with a chosen outcome, from any
 * non-finished state. */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { winner, reason, championParticipantId } = await parseJsonBody(request, declareWinnerSchema);
    await RoundsEngine.declareWinner(session.gameId, { winner, reason, championParticipantId, actorId: "admin" });
    return NextResponse.json({ ok: true });
  });
}
