import type { Prisma, PrismaClient } from "@prisma/client";
import { PlayerStatus, PlayerTaskStatus, TaskStatus } from "@prisma/client";

type TxClient = Prisma.TransactionClient;
import { prisma as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { LIVE_PLAY_STATUSES } from "../permissions";
import { writeAuditLog, ActorType } from "../audit";
import { publishEvent } from "../events/publisher";
import { computeGlobalTaskProgress } from "../scoring";

/** Every field this trusts comes from the session (playerId) or is
 * re-derived from the database (task/round/game state) — taskId is the
 * only client-supplied value, and it's validated against the actual
 * task row, never assumed correct. */
async function loadAndValidateTaskAccess(tx: TxClient, playerId: string, taskId: string) {
  const player = await tx.player.findUnique({ where: { id: playerId }, include: { game: true } });
  if (!player) throw new GameEngineError("NOT_FOUND", "Player not found");
  if (player.status !== PlayerStatus.ALIVE) {
    throw new GameEngineError("FORBIDDEN", "Eliminated players cannot perform tasks");
  }
  if (!LIVE_PLAY_STATUSES.includes(player.game.status)) {
    throw new GameEngineError("CONFLICT", `Game is not in active play (status: ${player.game.status})`);
  }

  const task = await tx.task.findUnique({ where: { id: taskId }, include: { round: true } });
  if (!task || task.gameId !== player.gameId) {
    throw new GameEngineError("NOT_FOUND", "Task not found");
  }
  if (task.status === TaskStatus.DISABLED) {
    throw new GameEngineError("FORBIDDEN", "This task is disabled");
  }
  if (task.status === TaskStatus.LOCKED) {
    throw new GameEngineError("FORBIDDEN", "This task is not yet available");
  }
  if (task.round.number !== player.currentRoundNumber) {
    throw new GameEngineError(
      "FORBIDDEN",
      `This task belongs to round ${task.round.number}, player is in round ${player.currentRoundNumber}`,
    );
  }
  const now = new Date();
  if (task.availableFrom && now < task.availableFrom) {
    throw new GameEngineError("FORBIDDEN", "This task is not available yet");
  }
  if (task.availableUntil && now > task.availableUntil) {
    throw new GameEngineError("FORBIDDEN", "This task's availability window has ended");
  }

  return { player, task };
}

export async function startTask(
  playerId: string,
  taskId: string,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const { player } = await loadAndValidateTaskAccess(tx, playerId, taskId);

    const existing = await tx.playerTask.findUnique({
      where: { playerId_taskId: { playerId, taskId } },
    });

    if (existing?.status === PlayerTaskStatus.IN_PROGRESS) {
      return existing; // idempotent: already started
    }
    if (existing?.status === PlayerTaskStatus.COMPLETED) {
      throw new GameEngineError("CONFLICT", "Task is already completed");
    }

    const playerTask = existing
      ? await tx.playerTask.update({
          where: { id: existing.id },
          data: { status: PlayerTaskStatus.IN_PROGRESS, startedAt: new Date(), attempts: { increment: 1 } },
        })
      : await tx.playerTask.create({
          data: {
            playerId,
            taskId,
            status: PlayerTaskStatus.IN_PROGRESS,
            startedAt: new Date(),
            attempts: 1,
          },
        });

    await publishEvent(tx, { gameId: player.gameId, type: "TASK_STARTED", payload: { playerId, taskId } });

    return playerTask;
  });
}

export async function completeTask(
  playerId: string,
  taskId: string,
  verificationData: unknown,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const { player, task } = await loadAndValidateTaskAccess(tx, playerId, taskId);

    const existing = await tx.playerTask.findUnique({
      where: { playerId_taskId: { playerId, taskId } },
    });

    if (existing?.status === PlayerTaskStatus.COMPLETED) {
      // idempotent: completing twice is a no-op success, not corruption
      return existing;
    }
    if (!existing || existing.status !== PlayerTaskStatus.IN_PROGRESS) {
      throw new GameEngineError("CONFLICT", "Task must be started before it can be completed");
    }

    const playerTask = await tx.playerTask.update({
      where: { id: existing.id },
      data: {
        status: PlayerTaskStatus.COMPLETED,
        completedAt: new Date(),
        score: task.points,
        verificationData: verificationData as never,
      },
    });

    await writeAuditLog(tx, {
      gameId: player.gameId,
      actorType: ActorType.PLAYER,
      actorId: playerId,
      action: "task_completed",
      targetType: "Task",
      targetId: taskId,
      metadata: { points: task.points },
    });

    const progress = await computeGlobalTaskProgress(tx, player.gameId);

    await publishEvent(tx, {
      gameId: player.gameId,
      type: "TASK_COMPLETED",
      payload: { playerId, taskId, globalProgressPercentage: progress.percentage },
    });

    return playerTask;
  });
}

export async function setTaskStatus(
  gameId: string,
  taskId: string,
  status: TaskStatus,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId } });
    if (!task || task.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Task not found");

    await tx.task.update({ where: { id: taskId }, data: { status } });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "task_status_changed",
      targetType: "Task",
      targetId: taskId,
      metadata: { from: task.status, to: status },
    });
  });
}
