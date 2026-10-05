import { NextResponse } from "next/server";
import { getStudentSession } from "@/lib/auth/studentSession";
import { createParticipantSession } from "@/lib/auth/session";
import { prismaWrite } from "@/lib/db/prisma";
import { handleRoute, parseJsonBody } from "@/lib/api/respond";
import { GameEngineError } from "@/lib/game/errors";
import { publishEvent } from "@/lib/game/events/publisher";
import { generateUniqueGameBadge } from "@/lib/game/badges";
import { getParticipantProfession, getTasksForProfession } from "@/lib/game/professions";
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

    // 4. Room must be active (or midgame joinable)
    const isMidgame = game.status !== "SETUP" && game.status !== "READY";
    if (game.status === "FINISHED") {
      throw new GameEngineError("FORBIDDEN", `Room ${formattedCode} has ended.`);
    }

    // Check if player was already in this game (reconnect)
    const existing = await prismaWrite.participant.findFirst({
      where: {
        gameId: game.id,
        accountId: student.accountId,
      },
    });

    if (existing) {
      let badge = existing.badge;
      if (!badge) {
        badge = await generateUniqueGameBadge(prismaWrite, game.id);
        await prismaWrite.participant.update({ where: { id: existing.id }, data: { badge } });
      }
      await createParticipantSession(existing.id);
      return NextResponse.json({
        success: true,
        reconnected: true,
        roomCode: game.roomCode,
        badge,
        playerNumber: existing.playerNumber,
        gameId: game.id,
      });
    }

    // 5. Check if already in the room
    const alreadyJoined = await prismaWrite.participant.findFirst({
      where: {
        gameId: game.id,
        accountId: student.accountId,
      },
    });

    if (alreadyJoined) {
      let badge = alreadyJoined.badge;
      if (!badge) {
        badge = await generateUniqueGameBadge(prismaWrite, game.id);
        await prismaWrite.participant.update({ where: { id: alreadyJoined.id }, data: { badge } });
      }
      await createParticipantSession(alreadyJoined.id);
      return NextResponse.json({
        success: true,
        alreadyJoined: true,
        roomCode: game.roomCode,
        badge,
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

    // 7. Generate non-sequential unpredictable badge (e.g. K7Q4)
    const badge = await generateUniqueGameBadge(prismaWrite, game.id);
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
        badge,
        playerNumber: assignedNumber,
        isApproved: true,
        status: "ALIVE",
        role: isMidgame ? "ENGINEER" : null,
      },
    });

    if (isMidgame) {
      const profession = getParticipantProfession(assignedNumber, participant.id);
      const assignedTaskDefs = getTasksForProfession(profession);
      const activeTasks = await prismaWrite.task.findMany({
        where: { gameId: game.id, status: "AVAILABLE" },
      });
      const activeMap = new Map(activeTasks.map((t) => [t.title, t.id]));

      for (const tDef of assignedTaskDefs) {
        const taskId = activeMap.get(tDef.title);
        if (!taskId) continue;
        await prismaWrite.participantTask.upsert({
          where: { participantId_taskId: { participantId: participant.id, taskId } },
          update: {},
          create: {
            participantId: participant.id,
            taskId,
            status: "AVAILABLE",
          },
        });
      }
    }

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
      badge,
      playerNumber: assignedNumber,
      gameId: game.id,
      name: student.fullName,
    });
  });
}
