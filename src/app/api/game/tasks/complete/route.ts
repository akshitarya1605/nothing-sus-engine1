import { NextResponse } from "next/server";
import { requirePlayerSession } from "@/lib/auth/guards";
import { TasksEngine } from "@/lib/game/engine";
import { completeTaskSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requirePlayerSession();
    const { taskId, verificationData } = await parseJsonBody(request, completeTaskSchema);
    const result = await TasksEngine.completeTask(session.playerId, taskId, verificationData);
    return NextResponse.json(result);
  });
}
