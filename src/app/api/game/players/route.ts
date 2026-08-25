import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { PlayersEngine } from "@/lib/game/engine";
import { createPlayerSchema } from "@/lib/game/validators";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const input = await parseJsonBody(request, createPlayerSchema);
    const player = await PlayersEngine.createPlayer(session.gameId, input);
    return NextResponse.json(player);
  });
}
