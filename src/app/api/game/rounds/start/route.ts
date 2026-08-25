import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/guards";
import { RoundsEngine } from "@/lib/game/engine";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";

const schema = z.object({ roundNumber: z.number().int().min(1) });

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { roundNumber } = await parseJsonBody(request, schema);
    await RoundsEngine.startRound(session.gameId, roundNumber);
    return NextResponse.json({ ok: true });
  });
}
