import { NextResponse } from "next/server";
import { requirePlayerSession } from "@/lib/auth/guards";
import { TasksEngine } from "@/lib/game/engine";
import { startTaskSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requirePlayerSession();
    const { taskId } = await parseJsonBody(request, startTaskSchema);
    const result = await TasksEngine.startTask(session.playerId, taskId);
    return NextResponse.json(result);
  });
}
