import type { Prisma, PrismaClient } from "@prisma/client";
import { ParticipantStatus, ParticipantTaskStatus, TaskStatus, TaskDifficulty } from "@prisma/client";
import { randomInt } from "node:crypto";
import { prismaWrite as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { LIVE_PLAY_STATUSES } from "../permissions";
import { writeAuditLog, ActorType } from "../audit";
import { publishEvent } from "../events/publisher";
import { computeGlobalTaskProgress } from "../scoring";
import { hashOtp } from "../otp";

type TxClient = Prisma.TransactionClient;

/** Every field this trusts comes from the session (participantId) or is
 * re-derived from the database (task/round/game state) — taskId is the
 * only client-supplied value, and it's validated against the actual
 * task row, never assumed correct. */
async function loadAndValidateTaskAccess(tx: TxClient, participantId: string, taskId: string) {
  const participant = await tx.participant.findUnique({ where: { id: participantId }, include: { game: true } });
  if (!participant) throw new GameEngineError("NOT_FOUND", "Participant not found");
  if (participant.status !== ParticipantStatus.ALIVE) {
    throw new GameEngineError("FORBIDDEN", "Eliminated participants cannot perform tasks");
  }
  if (!LIVE_PLAY_STATUSES.includes(participant.game.status)) {
    throw new GameEngineError("CONFLICT", `Game is not in active play (status: ${participant.game.status})`);
  }

  const task = await tx.task.findUnique({ where: { id: taskId }, include: { round: true } });
  if (!task || task.gameId !== participant.gameId) {
    throw new GameEngineError("NOT_FOUND", "Task not found");
  }
  if (task.status === TaskStatus.DISABLED) {
    throw new GameEngineError("FORBIDDEN", "This task is disabled");
  }
  if (task.status === TaskStatus.LOCKED) {
    throw new GameEngineError("FORBIDDEN", "This task is not yet available");
  }
  if (task.round.number !== participant.currentRoundNumber) {
    throw new GameEngineError(
      "FORBIDDEN",
      `This task belongs to round ${task.round.number}, participant is in round ${participant.currentRoundNumber}`,
    );
  }
  const now = new Date();
  if (task.availableFrom && now < task.availableFrom) {
    throw new GameEngineError("FORBIDDEN", "This task is not available yet");
  }
  if (task.availableUntil && now > task.availableUntil) {
    throw new GameEngineError("FORBIDDEN", "This task's availability window has ended");
  }

  // "participant is assigned" — either the task is open to their whole
  // group, or an admin explicitly assigned it to them individually
  // (an existing ParticipantTask row from assignTaskToParticipant).
  const isGroupEligible = task.groupId === null || task.groupId === participant.groupId;
  if (!isGroupEligible) {
    const explicitAssignment = await tx.participantTask.findUnique({
      where: { participantId_taskId: { participantId, taskId } },
    });
    if (!explicitAssignment) {
      throw new GameEngineError("FORBIDDEN", "This task is not assigned to you");
    }
  }

  return { participant, task };
}

export async function startTask(participantId: string, taskId: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const { participant } = await loadAndValidateTaskAccess(tx, participantId, taskId);

    const existing = await tx.participantTask.findUnique({
      where: { participantId_taskId: { participantId, taskId } },
    });

    if (existing?.status === ParticipantTaskStatus.IN_PROGRESS) {
      return existing; // idempotent: already started
    }
    if (existing?.status === ParticipantTaskStatus.COMPLETED) {
      throw new GameEngineError("CONFLICT", "Task is already completed");
    }

    const participantTask = existing
      ? await tx.participantTask.update({
          where: { id: existing.id },
          data: { status: ParticipantTaskStatus.IN_PROGRESS, startedAt: new Date() },
        })
      : await tx.participantTask.create({
          data: { participantId, taskId, status: ParticipantTaskStatus.IN_PROGRESS, startedAt: new Date() },
        });

    await publishEvent(tx, { gameId: participant.gameId, type: "TASK_STARTED", payload: { participantId, taskId } });

    return participantTask;
  });
}

export interface OtpSubmissionResult {
  correct: boolean;
  attemptsRemaining: number;
  participantTask?: Awaited<ReturnType<typeof startTask>>;
}

/**
 * The primary physical-task verification path. Never reveals the
 * correct OTP — a wrong guess just decrements the attempts budget.
 * Rate limit is enforced from TaskAttempt rows (source of truth),
 * not from a counter the client could race.
 */
export async function submitTaskOtp(
  participantId: string,
  taskId: string,
  enteredOtp: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<OtpSubmissionResult> {
  return prisma.$transaction(async (tx) => {
    const { participant, task } = await loadAndValidateTaskAccess(tx, participantId, taskId);
    const config = await tx.gameConfig.findUnique({ where: { gameId: participant.gameId } });
    const maxAttempts = config?.otpRateLimitMax ?? 10;
    const windowSeconds = config?.otpRateLimitWindowSeconds ?? 60;

    const existing = await tx.participantTask.findUnique({
      where: { participantId_taskId: { participantId, taskId } },
    });
    if (existing?.status === ParticipantTaskStatus.COMPLETED) {
      throw new GameEngineError("CONFLICT", "Task is already completed");
    }

    const windowStart = new Date(Date.now() - windowSeconds * 1000);
    const recentAttempts = await tx.taskAttempt.count({
      where: { participantId, taskId, createdAt: { gte: windowStart } },
    });
    if (recentAttempts >= maxAttempts) {
      throw new GameEngineError(
        "CONFLICT",
        `Too many attempts — try again in a minute (max ${maxAttempts} per ${windowSeconds}s)`,
      );
    }

    const wasCorrect = hashOtp(enteredOtp) === task.otpHash;

    await tx.taskAttempt.create({ data: { participantId, taskId, wasCorrect } });

    const participantTask = existing
      ? await tx.participantTask.update({
          where: { id: existing.id },
          data: {
            status: wasCorrect ? ParticipantTaskStatus.COMPLETED : existing.status,
            startedAt: existing.startedAt ?? new Date(),
            completedAt: wasCorrect ? new Date() : existing.completedAt,
            score: wasCorrect ? task.points : existing.score,
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
          },
        })
      : await tx.participantTask.create({
          data: {
            participantId,
            taskId,
            status: wasCorrect ? ParticipantTaskStatus.COMPLETED : ParticipantTaskStatus.IN_PROGRESS,
            startedAt: new Date(),
            completedAt: wasCorrect ? new Date() : null,
            score: wasCorrect ? task.points : null,
            attemptCount: 1,
            lastAttemptAt: new Date(),
          },
        });

    if (wasCorrect) {
      await writeAuditLog(tx, {
        gameId: participant.gameId,
        actorType: ActorType.PARTICIPANT,
        actorId: participantId,
        action: "task_completed",
        targetType: "Task",
        targetId: taskId,
        metadata: { points: task.points, attempts: participantTask.attemptCount },
      });

      const progress = await computeGlobalTaskProgress(tx, participant.gameId);
      await publishEvent(tx, {
        gameId: participant.gameId,
        type: "TASK_COMPLETED",
        payload: { participantId, taskId, globalProgressPercentage: progress.percentage },
      });
    }

    const attemptsRemaining = Math.max(0, maxAttempts - (recentAttempts + 1));
    return { correct: wasCorrect, attemptsRemaining, participantTask };
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

export interface CreateTaskInput {
  roundId: string;
  groupId?: string | null;
  title: string;
  description: string;
  locationId?: string | null;
  difficulty: TaskDifficulty;
  estimatedMinutes: number;
  points: number;
}

function generateOtp(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

/** Returns the plaintext OTP exactly once, in the admin's response —
 * it is never stored or logged anywhere after this call returns. */
export async function createTask(
  gameId: string,
  input: CreateTaskInput,
  prisma: PrismaClient = defaultPrisma,
): Promise<{ taskId: string; otp: string }> {
  const otp = generateOtp();
  const task = await prisma.$transaction(async (tx) => {
    const round = await tx.round.findUnique({ where: { id: input.roundId } });
    if (!round || round.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Round not found");

    const created = await tx.task.create({
      data: {
        gameId,
        roundId: input.roundId,
        groupId: input.groupId ?? null,
        title: input.title,
        description: input.description,
        locationId: input.locationId ?? null,
        difficulty: input.difficulty,
        estimatedMinutes: input.estimatedMinutes,
        points: input.points,
        status: TaskStatus.AVAILABLE,
        otpHash: hashOtp(otp),
      },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "task_created",
      targetType: "Task",
      targetId: created.id,
    });

    return created;
  });

  return { taskId: task.id, otp };
}

export async function regenerateOtp(
  gameId: string,
  taskId: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<{ otp: string }> {
  const otp = generateOtp();
  await prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId } });
    if (!task || task.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Task not found");

    await tx.task.update({ where: { id: taskId }, data: { otpHash: hashOtp(otp) } });
    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "task_otp_regenerated",
      targetType: "Task",
      targetId: taskId,
    });
  });
  return { otp };
}

/** Explicit individual assignment — creates the ParticipantTask row
 * ahead of time so the participant is "assigned" even if the task's
 * groupId doesn't match theirs (or the task has no group at all). */
export async function assignTaskToParticipant(
  gameId: string,
  taskId: string,
  participantId: string,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId } });
    if (!task || task.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Task not found");
    const participant = await tx.participant.findUnique({ where: { id: participantId } });
    if (!participant || participant.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Participant not found");
    }

    await tx.participantTask.upsert({
      where: { participantId_taskId: { participantId, taskId } },
      create: { participantId, taskId, status: ParticipantTaskStatus.AVAILABLE },
      update: {},
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "task_assigned_to_participant",
      targetType: "Task",
      targetId: taskId,
      metadata: { participantId },
    });
  });
}

export async function assignTaskToGroup(
  gameId: string,
  taskId: string,
  groupId: string | null,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.findUnique({ where: { id: taskId } });
    if (!task || task.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Task not found");

    await tx.task.update({ where: { id: taskId }, data: { groupId } });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "task_assigned_to_group",
      targetType: "Task",
      targetId: taskId,
      metadata: { groupId },
    });
  });
}
