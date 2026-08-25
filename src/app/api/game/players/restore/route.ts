import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { PlayersEngine } from "@/lib/game/engine";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

const schema = z.object({ playerId: z.string().min(1) });

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { playerId } = await parseJsonBody(request, schema);
    await PlayersEngine.restorePlayer(session.gameId, playerId);
    return NextResponse.json({ ok: true });
  });
}
