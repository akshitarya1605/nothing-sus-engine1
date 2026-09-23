import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth/studentSession";
import { createParticipantSession } from "@/lib/auth/session";
import { prismaWrite } from "@/lib/db/prisma";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { GameEngineError } from "@/lib/game/errors";
import { publishEvent } from "@/lib/game/events/publisher";
import { z } from "zod";
import { randomInt } from "node:crypto";

const joinSchema = z.object({
  roomCode: z.string().min(1, "Room code is required"),
});

export async function POST(request: Request) {
  return handleRoute(async () => {
    // 1. Check authenticated student session
    const student = await getStudentSession();
    if (!student) {
      throw new GameEngineError("UNAUTHENTICATED", "Please log in to join a game room.");
    }

    // 2. Check student approval
    if (student.approvalStatus !== "APPROVED") {
      throw new GameEngineError("FORBIDDEN", "Your account is pending ISA approval.");
    }

    const { roomCode } = await parseJsonBody(request, joinSchema);
    const formattedCode = roomCode.trim().toUpperCase();

    // 3. Find active room
    const game = await prismaWrite.game.findFirst({
      where: {
        OR: [{ roomCode: formattedCode }, { adminSecret: formattedCode }],
      },
    });

    if (!game) {
      throw new GameEngineError("NOT_FOUND", `Room ${formattedCode} does not exist. Check the TV screen for the active room code.`);
    }

    // 4. Room must be accepting players
    if (game.status !== "SETUP" && game.status !== "READY") {
      // Check if player was already in this game (reconnect)
      const existing = await prismaWrite.participant.findFirst({
        where: {
          gameId: game.id,
          accountId: student.accountId,
        },
      });

      if (existing) {
        await createParticipantSession(existing.id);
        return NextResponse.json({
          success: true,
          reconnected: true,
          roomCode: game.roomCode,
          playerNumber: existing.playerNumber,
          gameId: game.id,
        });
      }

      throw new GameEngineError("FORBIDDEN", `Room ${formattedCode} has already started. Spectate on the arena screen or wait for next match.`);
    }

    // 5. Check if already in the room
    const alreadyJoined = await prismaWrite.participant.findFirst({
      where: {
        gameId: game.id,
        accountId: student.accountId,
      },
    });

    if (alreadyJoined) {
      await createParticipantSession(alreadyJoined.id);
      return NextResponse.json({
        success: true,
        alreadyJoined: true,
        roomCode: game.roomCode,
        playerNumber: alreadyJoined.playerNumber,
        gameId: game.id,
      });
    }

    // 6. Check room player cap
    const currentCount = await prismaWrite.participant.count({
      where: { gameId: game.id },
    });

    if (currentCount >= (game.maxPlayers || 30)) {
      throw new GameEngineError("CONFLICT", `Room ${formattedCode} is full (${currentCount}/${game.maxPlayers}).`);
    }

    // 7. Assign sequential player number in this game (#01, #02, #03...)
    const assignedNumber = currentCount + 1;
    const internalPin = `NS-${randomInt(100000, 999999)}`;

    const participant = await prismaWrite.participant.create({
      data: {
        gameId: game.id,
        accountId: student.accountId,
        name: student.fullName,
        fullName: student.fullName,
        collegeRegId: student.collegeRegId,
        code: internalPin,
        playerNumber: assignedNumber,
        isApproved: true,
        status: "ALIVE",
      },
    });

    // 8. Set participant session cookie for in-game APIs
    await createParticipantSession(participant.id);

    // 9. Broadcast player joined event to all clients (Host & Spectator)
    try {
      await publishEvent(prismaWrite, {
        gameId: game.id,
        type: "PLAYER_JOINED",
        payload: {
          participantId: participant.id,
          name: student.fullName,
        },
      });
    } catch {
      // Non-fatal if event publishing fails
    }

    return NextResponse.json({
      success: true,
      roomCode: game.roomCode,
      playerNumber: assignedNumber,
      gameId: game.id,
      name: student.fullName,
    });
  });
}
