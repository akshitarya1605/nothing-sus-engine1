import { NextResponse } from "next/server";
import { requirePlayerSession } from "@/lib/auth/guards";
import { VotingEngine } from "@/lib/game/engine";
import { castVoteSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requirePlayerSession();
    const { meetingId, targetPlayerId } = await parseJsonBody(request, castVoteSchema);
    await VotingEngine.castVote(session.gameId, session.playerId, { meetingId, targetPlayerId });
    // deliberately no vote counts in the response — see docs/SECURITY.md
    return NextResponse.json({ ok: true });
  });
}
