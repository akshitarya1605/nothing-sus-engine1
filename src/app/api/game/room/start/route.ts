import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guards";
import { handleRoute } from "@/lib/api/respond";
import { prismaWrite } from "@/lib/db/prisma";
import { GameEngineError } from "@/lib/game/errors";
import { randomInt } from "node:crypto";
import { ActorType, GameStatus, ParticipantRole, ParticipantStatus, ParticipantTaskStatus, RoundPhase, RoundStatus, } from "@prisma/client";
import { writeAuditLog } from "@/lib/game/audit";
import { publishEvent } from "@/lib/game/events/publisher";
import { generateUniqueGameBadge } from "@/lib/game/badges";


export const dynamic = "force-dynamic";

export async function POST() {
  return handleRoute(async () => {
    const session = await requireAdmin();
    const gameId = session.gameId;

    return prismaWrite.$transaction(async (tx) => {
      // 1. Fetch Game and Config
      const game = await tx.game.findUnique({
        where: { id: gameId },
        include: { config: true },
      });
      if (!game) throw new GameEngineError("NOT_FOUND", "Game room not found");

      // 2. Idempotency guard: If already live or later phase, succeed immediately
      if (game.status === GameStatus.LIVE || game.status === GameStatus.MEETING || game.status === GameStatus.VOTING) {
        return NextResponse.json({
          success: true,
          alreadyStarted: true,
          message: "Game is already running.",
          status: game.status,
        });
      }

      // 3. Load all joined participants
      const participants = await tx.participant.findMany({
        where: { gameId },
        orderBy: { playerNumber: "asc" },
      });

      if (participants.length === 0) {
        throw new GameEngineError("VALIDATION", "Cannot start match: Waiting lobby has 0 players.");
      }

      // 4. Calculate impostor count safely
      const configuredImposters = game.config?.imposterCount ?? 1;
      // Allow 1 imposter even if testing with 1 player; otherwise cap strictly below total
      const maxAllowedImposters = participants.length > 1 ? participants.length - 1 : 1;
      const imposterCount = Math.max(1, Math.min(configuredImposters, maxAllowedImposters));

      // 5. Cryptographic Fisher-Yates Shuffle
      const shuffled = [...participants];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = randomInt(i + 1);
        const temp = shuffled[i];
        shuffled[i] = shuffled[j];
        shuffled[j] = temp;
      }
      const imposterIds = new Set(shuffled.slice(0, imposterCount).map((p) => p.id));

      // 6. Assign roles atomically in DB + guarantee non-guessable badge
      for (const p of participants) {
        const isImposter = imposterIds.has(p.id);
        const badge = p.badge || (await generateUniqueGameBadge(tx, gameId));
        await tx.participant.update({
          where: { id: p.id },
          data: {
            role: isImposter ? ParticipantRole.IMPOSTER : ParticipantRole.ENGINEER,
            status: ParticipantStatus.ALIVE,
            weaponUnlocked: true,
            lastKillAt: null,
            badge,
          },
        });
      }

      // 7. Ensure Round 1 exists and is set to ACTIVE
      const round1 = await tx.round.upsert({
        where: { gameId_number: { gameId, number: 1 } },
        update: {
          status: RoundStatus.ACTIVE,
          startedAt: new Date(),
          durationMinutes: 20,
        },
        create: {
          gameId,
          number: 1,
          name: "Round 1",
          status: RoundStatus.ACTIVE,
          startedAt: new Date(),
          scheduledStartAt: new Date(),
          durationMinutes: 20,
        },
      });

      // 7b. Fetch all existing Tasks for this game (created by admin)
      const allGameTasks = await tx.task.findMany({
        where: { gameId },
      });
      
      // If there are no tasks, that's fine, we just don't assign any.
      // But typically admin should create tasks.
      
      for (const p of participants) {
        const isImposter = imposterIds.has(p.id);
        // Filter tasks based on role
        const eligibleTasks = allGameTasks.filter(t => t.forImposter === isImposter);
        
        // Randomly select 10 tasks (or fewer if total is less than 10)
        const shuffledTasks = [...eligibleTasks].sort(() => 0.5 - Math.random());
        const assignedTasks = shuffledTasks.slice(0, 10);
        
        for (const task of assignedTasks) {
          await tx.participantTask.upsert({
            where: { participantId_taskId: { participantId: p.id, taskId: task.id } },
            update: {},
            create: {
              participantId: p.id,
              taskId: task.id,
              status: ParticipantTaskStatus.AVAILABLE,
            },
          });
        }
      }

      // 8. Lock roles and transition Game to LIVE
      const updatedGame = await tx.game.update({
        where: { id: gameId },
        data: {
          status: GameStatus.LIVE,
          rolesLocked: true,
          currentRoundNumber: 1,
          currentPhase: RoundPhase.ROUND,
        },
      });

      // 9. Write authoritative audit log
      await writeAuditLog(tx, {
        gameId,
        actorType: ActorType.ADMIN,
        actorId: "admin",
        action: "game_started_authoritative",
        metadata: {
          playerCount: participants.length,
          imposterCount,
          roundId: round1.id,
        },
      });

      // 10. Broadcast public realtime events
      await publishEvent(tx, {
        gameId,
        type: "GAME_STARTED",
        payload: { gameId },
      });
      await publishEvent(tx, {
        gameId,
        type: "ROUND_STARTED",
        payload: {
          roundNumber: 1,
          roundName: "Round 1",
          startedAt: new Date().toISOString(),
        },
      });

      // 11. Broadcast confidential role assignments to individual participants
      for (const p of participants) {
        const role = imposterIds.has(p.id) ? "IMPOSTER" : "ENGINEER";
        await publishEvent(tx, {
          gameId,
          type: "YOUR_ROLE_ASSIGNED",
          targetParticipantId: p.id,
          payload: { role },
        });
      }

      return NextResponse.json({
        success: true,
        message: "Match launched successfully! Roles transmitted to all players.",
        status: updatedGame.status,
        playerCount: participants.length,
        imposterCount,
      });
    });
  });
}
