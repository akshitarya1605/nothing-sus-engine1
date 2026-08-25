import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { VotingEngine } from "@/lib/game/engine";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

const schema = z.object({ meetingId: z.string().min(1) });

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { meetingId } = await parseJsonBody(request, schema);
    await VotingEngine.closeVoting(session.gameId, meetingId);
    return NextResponse.json({ ok: true });
  });
}
