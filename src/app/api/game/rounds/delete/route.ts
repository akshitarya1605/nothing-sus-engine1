import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { z } from "zod";
import { GameEngineError } from "@/lib/game/errors";

const deleteRoundSchema = z.object({
  roundId: z.string().min(1),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const { roundId } = await parseJsonBody(request, deleteRoundSchema);

    const round = await prismaWrite.round.findUnique({ where: { id: roundId } });
    if (!round || round.gameId !== session.gameId) {
      throw new GameEngineError("NOT_FOUND", "Round not found");
    }
    if (round.status !== "SCHEDULED") {
      throw new GameEngineError("CONFLICT", "Cannot delete a round that has already started");
    }

    await prismaWrite.round.delete({ where: { id: roundId } });

    // Re-number remaining rounds
    const remaining = await prismaWrite.round.findMany({
      where: { gameId: session.gameId },
      orderBy: { number: "asc" },
    });
    for (let i = 0; i < remaining.length; i++) {
      await prismaWrite.round.update({
        where: { id: remaining[i].id },
        data: { number: i + 1 },
      });
    }

    return NextResponse.json({ ok: true });
  });
}
