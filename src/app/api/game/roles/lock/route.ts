import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { PlayersEngine } from "@/lib/game/engine";
import { handleRoute } from "@/lib/api/respond";

export async function POST() {
  return handleRoute(async () => {
    const session = await requireAdmin();
    await PlayersEngine.lockRoles(session.gameId);
    return NextResponse.json({ ok: true });
  });
}
