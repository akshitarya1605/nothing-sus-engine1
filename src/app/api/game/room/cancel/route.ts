import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";

export async function POST() {
  return handleRoute(async () => {
    const session = await requireAdmin();

    // Reset current game room
    await prismaWrite.participant.deleteMany({
      where: { gameId: session.gameId },
    });
    await prismaWrite.gameResult.deleteMany({
      where: { gameId: session.gameId },
    });
    await prismaWrite.game.update({
      where: { id: session.gameId },
      data: {
        roomCode: null,
        status: "FINISHED",
        currentRoundNumber: 0,
        rolesLocked: false,
      },
    });

    return NextResponse.json({ success: true, message: "Room cancelled." });
  });
}
