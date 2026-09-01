import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { TasksEngine } from "@/lib/game/engine";
import { assignTaskToParticipantSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { taskId, participantId } = await parseJsonBody(request, assignTaskToParticipantSchema);
    await TasksEngine.assignTaskToParticipant(session.gameId, taskId, participantId);
    return NextResponse.json({ ok: true });
  });
}
