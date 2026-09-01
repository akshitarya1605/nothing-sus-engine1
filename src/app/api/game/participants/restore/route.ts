import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { ParticipantsEngine } from "@/lib/game/engine";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

const schema = z.object({ participantId: z.string().min(1) });

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { participantId } = await parseJsonBody(request, schema);
    await ParticipantsEngine.restoreParticipant(session.gameId, participantId);
    return NextResponse.json({ ok: true });
  });
}
