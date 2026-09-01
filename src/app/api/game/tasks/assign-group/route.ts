import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { TasksEngine } from "@/lib/game/engine";
import { assignTaskToGroupSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { taskId, groupId } = await parseJsonBody(request, assignTaskToGroupSchema);
    await TasksEngine.assignTaskToGroup(session.gameId, taskId, groupId);
    return NextResponse.json({ ok: true });
  });
}
