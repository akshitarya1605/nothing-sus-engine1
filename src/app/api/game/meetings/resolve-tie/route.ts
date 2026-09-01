import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { VotingEngine } from "@/lib/game/engine";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

const schema = z.object({ meetingId: z.string().min(1), eliminateParticipantId: z.string().min(1).nullable() });

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { meetingId, eliminateParticipantId } = await parseJsonBody(request, schema);
    await VotingEngine.resolveTie(session.gameId, meetingId, { eliminateParticipantId });
    return NextResponse.json({ ok: true });
  });
}
