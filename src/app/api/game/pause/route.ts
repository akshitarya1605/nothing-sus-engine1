import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { RoundsEngine } from "@/lib/game/engine";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

const schema = z.object({ reason: z.string().max(280).optional() });

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { reason } = await parseJsonBody(request, schema);
    await RoundsEngine.pauseGame(session.gameId, reason);
    return NextResponse.json({ ok: true });
  });
}
