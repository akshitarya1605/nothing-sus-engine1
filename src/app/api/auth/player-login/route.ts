import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { setSessionCookie } from "@/lib/auth/session";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { GameEngineError } from "@/lib/game/errors";

const schema = z.object({ gameId: z.string().min(1), playerCode: z.string().min(1) });

export async function POST(request: Request) {
  return handleRoute(async () => {
    const { gameId, playerCode } = await parseJsonBody(request, schema);

    const player = await prisma.player.findUnique({ where: { playerCode } });
    if (!player || player.gameId !== gameId) {
      // deliberately the same error for "no such code" and "wrong game"
      // so this can't be used to enumerate valid codes
      throw new GameEngineError("VALIDATION", "Invalid player code");
    }

    await setSessionCookie({ role: "PLAYER", gameId, playerId: player.id });

    return NextResponse.json({ playerId: player.id, displayName: player.displayName });
  });
}
