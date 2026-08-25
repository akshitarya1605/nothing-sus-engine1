import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { EliminationsEngine } from "@/lib/game/engine";
import { revealRoleSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { eliminationId } = await parseJsonBody(request, revealRoleSchema);
    await EliminationsEngine.revealRole(session.gameId, eliminationId);
    return NextResponse.json({ ok: true });
  });
}
