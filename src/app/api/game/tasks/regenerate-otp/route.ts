import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { TasksEngine } from "@/lib/game/engine";
import { taskIdSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { taskId } = await parseJsonBody(request, taskIdSchema);
    const result = await TasksEngine.regenerateOtp(session.gameId, taskId);
    return NextResponse.json(result);
  });
}
