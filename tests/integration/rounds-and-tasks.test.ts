import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { GameEngineError } from "@/lib/game/errors";
import * as ParticipantsEngine from "@/lib/game/actions/participants";
import * as RoundsEngine from "@/lib/game/actions/rounds";
import * as TasksEngine from "@/lib/game/actions/tasks";
import { hashOtp } from "@/lib/game/otp";
import { ParticipantStatus, TaskStatus } from "@prisma/client";
import { createTestGame, cleanupTestGame } from "./helpers";

const TEST_OTP = "1234";

let cleanupIds: string[] = [];
afterEach(async () => {
  await Promise.all(cleanupIds.map(cleanupTestGame));
  cleanupIds = [];
});

async function readyAndStart(gameId: string) {
  await ParticipantsEngine.assignRoles(gameId, 1, prisma);
  await ParticipantsEngine.lockRoles(gameId, prisma);
  await RoundsEngine.markGameReady(gameId, prisma);
  await RoundsEngine.startRound(gameId, 1, prisma);
}

describe("round lifecycle", () => {
  it("rejects starting round 1 before roles are locked", async () => {
    const { game } = await createTestGame(2);
    cleanupIds.push(game.id);
    await expect(RoundsEngine.markGameReady(game.id, prisma)).rejects.toThrow(GameEngineError);
  });

  it("rejects starting the wrong round number", async () => {
    const { game } = await createTestGame(2);
    cleanupIds.push(game.id);
    await ParticipantsEngine.assignRoles(game.id, 0, prisma);
    await ParticipantsEngine.lockRoles(game.id, prisma);
    await RoundsEngine.markGameReady(game.id, prisma);
    await expect(RoundsEngine.startRound(game.id, 2, prisma)).rejects.toThrow(GameEngineError);
  });

  it("starting the same round twice is rejected (idempotency guard), not silently re-applied", async () => {
    const { game } = await createTestGame(2);
    cleanupIds.push(game.id);
    await readyAndStart(game.id);
    await expect(RoundsEngine.startRound(game.id, 1, prisma)).rejects.toThrow(GameEngineError);
  });

  it("pause stores what to resume into, and resume restores it exactly", async () => {
    const { game } = await createTestGame(2);
    cleanupIds.push(game.id);
    await readyAndStart(game.id);

    await RoundsEngine.pauseGame(game.id, "test pause", prisma);
    const paused = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    expect(paused.status).toBe("PAUSED");
    expect(paused.pausedFromStatus).toBe("LIVE");

    await RoundsEngine.resumeGame(game.id, prisma);
    const resumed = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    expect(resumed.status).toBe("LIVE");
    expect(resumed.pausedFromStatus).toBeNull();
  });
});

describe("task validation", () => {
  async function setupLiveGameWithTask() {
    const { game, round1, participants } = await createTestGame(3);
    cleanupIds.push(game.id);
    await readyAndStart(game.id);
    await prisma.participant.updateMany({ where: { gameId: game.id }, data: { currentRoundNumber: 1 } });

    const task = await prisma.task.create({
      data: {
        gameId: game.id,
        roundId: round1.id,
        title: "Test task",
        description: "desc",
        difficulty: "EASY",
        estimatedMinutes: 5,
        points: 10,
        status: TaskStatus.AVAILABLE,
        otpHash: hashOtp(TEST_OTP),
      },
    });

    return { game, round1, participants, task };
  }

  it("a participant can start and complete an available task with the correct OTP", async () => {
    const { participants, task } = await setupLiveGameWithTask();
    await TasksEngine.startTask(participants[0].id, task.id, prisma);
    const result = await TasksEngine.submitTaskOtp(participants[0].id, task.id, TEST_OTP, prisma);
    expect(result.correct).toBe(true);
    expect(result.participantTask?.status).toBe("COMPLETED");
    expect(result.participantTask?.score).toBe(10);
  });

  it("rejects a wrong OTP without completing the task, and never reveals the correct one", async () => {
    const { participants, task } = await setupLiveGameWithTask();
    const result = await TasksEngine.submitTaskOtp(participants[0].id, task.id, "0000", prisma);
    expect(result.correct).toBe(false);
    expect(JSON.stringify(result)).not.toContain(TEST_OTP);

    const row = await prisma.participantTask.findUnique({
      where: { participantId_taskId: { participantId: participants[0].id, taskId: task.id } },
    });
    expect(row?.status).not.toBe("COMPLETED");
  });

  it("submitting the correct OTP twice is idempotent, not a duplicate score", async () => {
    const { participants, task } = await setupLiveGameWithTask();
    const first = await TasksEngine.submitTaskOtp(participants[0].id, task.id, TEST_OTP, prisma);
    const second = await TasksEngine.submitTaskOtp(participants[0].id, task.id, TEST_OTP, prisma).catch((e) => e);
    expect(first.correct).toBe(true);
    // second call is a CONFLICT (already completed) — rejected, not double-scored
    expect(second).toBeInstanceOf(GameEngineError);

    const count = await prisma.participantTask.count({
      where: { participantId: participants[0].id, taskId: task.id, status: "COMPLETED" },
    });
    expect(count).toBe(1); // exactly one row, not two
  });

  it("rate limits OTP attempts (max per window), rejecting further attempts as a CONFLICT", async () => {
    const { participants, task, game } = await setupLiveGameWithTask();
    await prisma.gameConfig.update({
      where: { gameId: game.id },
      data: { otpRateLimitMax: 3, otpRateLimitWindowSeconds: 60 },
    });

    for (let i = 0; i < 3; i++) {
      const r = await TasksEngine.submitTaskOtp(participants[0].id, task.id, "0000", prisma);
      expect(r.correct).toBe(false);
    }
    await expect(TasksEngine.submitTaskOtp(participants[0].id, task.id, "0000", prisma)).rejects.toThrow(
      GameEngineError,
    );
  });

  it("rejects a disabled task", async () => {
    const { participants, task } = await setupLiveGameWithTask();
    await prisma.task.update({ where: { id: task.id }, data: { status: TaskStatus.DISABLED } });
    await expect(TasksEngine.startTask(participants[0].id, task.id, prisma)).rejects.toThrow(GameEngineError);
  });

  it("rejects a task belonging to a round the participant isn't in (the brief's exact example)", async () => {
    const { game, participants } = await setupLiveGameWithTask();
    const round2 = await prisma.round.create({
      data: { gameId: game.id, number: 2, name: "Round 2", scheduledStartAt: new Date(), durationMinutes: 60 },
    });
    const round2Task = await prisma.task.create({
      data: {
        gameId: game.id,
        roundId: round2.id,
        title: "Round 2 task",
        description: "desc",
        difficulty: "EASY",
        estimatedMinutes: 5,
        points: 10,
        status: TaskStatus.AVAILABLE,
        otpHash: hashOtp(TEST_OTP),
      },
    });
    // participant is in round 1
    await expect(TasksEngine.startTask(participants[0].id, round2Task.id, prisma)).rejects.toThrow(GameEngineError);
  });

  it("rejects task actions from an eliminated participant", async () => {
    const { participants, task } = await setupLiveGameWithTask();
    await prisma.participant.update({ where: { id: participants[0].id }, data: { status: ParticipantStatus.ELIMINATED } });
    await expect(TasksEngine.startTask(participants[0].id, task.id, prisma)).rejects.toThrow(GameEngineError);
  });

  it("rejects a group-restricted task for a participant outside that group, unless explicitly assigned", async () => {
    const { game, round1, participants } = await setupLiveGameWithTask();
    const group = await prisma.group.create({ data: { gameId: game.id, name: "Engineering" } });
    const restrictedTask = await prisma.task.create({
      data: {
        gameId: game.id,
        roundId: round1.id,
        groupId: group.id,
        title: "Group-only task",
        description: "desc",
        difficulty: "EASY",
        estimatedMinutes: 5,
        points: 10,
        status: TaskStatus.AVAILABLE,
        otpHash: hashOtp(TEST_OTP),
      },
    });

    // participants[0] is in no group — blocked
    await expect(TasksEngine.startTask(participants[0].id, restrictedTask.id, prisma)).rejects.toThrow(
      GameEngineError,
    );

    // explicit individual assignment overrides the group restriction
    await TasksEngine.assignTaskToParticipant(game.id, restrictedTask.id, participants[0].id, prisma);
    await expect(TasksEngine.startTask(participants[0].id, restrictedTask.id, prisma)).resolves.toBeDefined();
  });
});
