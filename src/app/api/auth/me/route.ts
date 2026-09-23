import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth/studentSession";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const session = await getStudentSession();
  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  // Find if student is currently part of an active game
  const activeParticipation = await prisma.participant.findFirst({
    where: {
      accountId: session.accountId,
      game: { status: { not: "FINISHED" } },
    },
    orderBy: { createdAt: "desc" },
    include: {
      game: {
        select: { id: true, roomCode: true, status: true, currentRoundNumber: true },
      },
    },
  });

  return NextResponse.json({
    authenticated: true,
    account: {
      id: session.accountId,
      fullName: session.fullName,
      collegeRegId: session.collegeRegId,
      approvalStatus: session.approvalStatus,
    },
    activeGame: activeParticipation
      ? {
          roomCode: activeParticipation.game.roomCode,
          playerNumber: activeParticipation.playerNumber,
          gameStatus: activeParticipation.game.status,
          role: activeParticipation.role,
          status: activeParticipation.status,
        }
      : null,
  });
}
