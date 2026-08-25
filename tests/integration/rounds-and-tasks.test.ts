import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { GameEngineError } from "@/lib/game/errors";
import * as PlayersEngine from "@/lib/game/actions/players";
import * as RoundsEngine from "@/lib/game/actions/rounds";
import * as TasksEngine from "@/lib/game/actions/tasks";
import { PlayerStatus, TaskStatus } from "@prisma/client";
import { createTestGame, cleanupTestGame } from "./helpers";

let cleanupIds: string[] = [];
afterEach(async () => {
  await Promise.all(cleanupIds.map(cleanupTestGame));
  cleanupIds = [];
});

async function readyAndStart(gameId: string) {
  await PlayersEngine.assignRoles(gameId, 1, prisma);
  await PlayersEngine.lockRoles(gameId, prisma);
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
    await PlayersEngine.assignRoles(game.id, 0, prisma);
    await PlayersEngine.lockRoles(game.id, prisma);
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
    const { game, round1, players } = await createTestGame(3);
    cleanupIds.push(game.id);
    await readyAndStart(game.id);
    await prisma.player.updateMany({ where: { gameId: game.id }, data: { currentRoundNumber: 1 } });

    const task = await prisma.task.create({
      data: {
        gameId: game.id,
        roundId: round1.id,
        name: "Test task",
        description: "desc",
        difficulty: "EASY",
        estimatedMinutes: 5,
        points: 10,
        status: TaskStatus.AVAILABLE,
      },
    });

    return { game, round1, players, task };
  }

  it("a player can start and complete an available task in the current round", async () => {
    const { players, task } = await setupLiveGameWithTask();
    await TasksEngine.startTask(players[0].id, task.id, prisma);
    const completed = await TasksEngine.completeTask(players[0].id, task.id, null, prisma);
    expect(completed.status).toBe("COMPLETED");
    expect(completed.score).toBe(10);
  });

  it("rejects completing a task that was never started", async () => {
    const { players, task } = await setupLiveGameWithTask();
    await expect(TasksEngine.completeTask(players[0].id, task.id, null, prisma)).rejects.toThrow(GameEngineError);
  });

  it("completing the same task twice is idempotent, not a duplicate score", async () => {
    const { players, task } = await setupLiveGameWithTask();
    await TasksEngine.startTask(players[0].id, task.id, prisma);
    const first = await TasksEngine.completeTask(players[0].id, task.id, null, prisma);
    const second = await TasksEngine.completeTask(players[0].id, task.id, null, prisma);
    expect(first.id).toBe(second.id);
    expect(second.status).toBe("COMPLETED");

    const progress = await prisma.playerTask.count({
      where: { playerId: players[0].id, taskId: task.id, status: "COMPLETED" },
    });
    expect(progress).toBe(1); // exactly one row, not two
  });

  it("rejects a disabled task", async () => {
    const { players, task } = await setupLiveGameWithTask();
    await prisma.task.update({ where: { id: task.id }, data: { status: TaskStatus.DISABLED } });
    await expect(TasksEngine.startTask(players[0].id, task.id, prisma)).rejects.toThrow(GameEngineError);
  });

  it("rejects a task belonging to a round the player isn't in (the brief's exact example)", async () => {
    const { game, players } = await setupLiveGameWithTask();
    const round2 = await prisma.round.create({
      data: { gameId: game.id, number: 2, name: "Round 2", scheduledStartAt: new Date(), durationMinutes: 60 },
    });
    const round2Task = await prisma.task.create({
      data: {
        gameId: game.id,
        roundId: round2.id,
        name: "Round 2 task",
        description: "desc",
        difficulty: "EASY",
        estimatedMinutes: 5,
        points: 10,
        status: TaskStatus.AVAILABLE,
      },
    });
    // player is in round 1
    await expect(TasksEngine.startTask(players[0].id, round2Task.id, prisma)).rejects.toThrow(GameEngineError);
  });

  it("rejects task actions from an eliminated player", async () => {
    const { players, task } = await setupLiveGameWithTask();
    await prisma.player.update({ where: { id: players[0].id }, data: { status: PlayerStatus.ELIMINATED } });
    await expect(TasksEngine.startTask(players[0].id, task.id, prisma)).rejects.toThrow(GameEngineError);
  });
});
