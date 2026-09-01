import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { ParticipantsEngine } from "@/lib/game/engine";
import { setParticipantRoleSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { participantId, role } = await parseJsonBody(request, setParticipantRoleSchema);
    await ParticipantsEngine.setParticipantRole(session.gameId, participantId, role);
    return NextResponse.json({ ok: true });
  });
}
