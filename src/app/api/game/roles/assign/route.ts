import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { ParticipantsEngine } from "@/lib/game/engine";
import { configureRolesSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { imposterCount } = await parseJsonBody(request, configureRolesSchema);
    const result = await ParticipantsEngine.assignRoles(session.gameId, imposterCount);
    return NextResponse.json(result);
  });
}
