import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { TasksEngine } from "@/lib/game/engine";
import { createTaskSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

/** Returns the plaintext OTP exactly once — the admin must record/print
 * it now; it is never retrievable again (only the hash is stored). */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const input = await parseJsonBody(request, createTaskSchema);
    const result = await TasksEngine.createTask(session.gameId, input);
    return NextResponse.json(result);
  });
}
