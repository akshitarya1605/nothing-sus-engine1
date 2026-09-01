import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { GroupsEngine } from "@/lib/game/engine";
import { assignGroupSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { participantId, groupId } = await parseJsonBody(request, assignGroupSchema);
    await GroupsEngine.assignParticipantToGroup(session.gameId, participantId, groupId);
    return NextResponse.json({ ok: true });
  });
}
