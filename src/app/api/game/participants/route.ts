import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { ParticipantsEngine } from "@/lib/game/engine";
import { createParticipantSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const input = await parseJsonBody(request, createParticipantSchema);
    const participant = await ParticipantsEngine.createParticipant(session.gameId, input);
    return NextResponse.json(participant);
  });
}
