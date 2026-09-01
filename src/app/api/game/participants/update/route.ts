import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { ParticipantsEngine } from "@/lib/game/engine";
import { updateParticipantSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { participantId, ...input } = await parseJsonBody(request, updateParticipantSchema);
    await ParticipantsEngine.updateParticipant(session.gameId, participantId, input);
    return NextResponse.json({ ok: true });
  });
}
