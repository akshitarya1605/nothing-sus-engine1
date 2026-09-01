import type { Prisma, PrismaClient } from "@prisma/client";
import { GameStatus, RoundStatus, RoundPhase, ParticipantStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { assertValidTransition } from "../transitions";
import { writeAuditLog, ActorType } from "../audit";
import { publishEvent } from "../events/publisher";
import { computeRoundTiming } from "../timers";
import { callMeeting } from "./meetings";

export async function markGameReady(gameId: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    assertValidTransition(game.status, GameStatus.READY);

    if (!game.rolesLocked) {
      throw new GameEngineError("CONFLICT", "Roles must be locked before the game can be readied");
    }
    const roundCount = await tx.round.count({ where: { gameId } });
    if (roundCount === 0) {
      throw new GameEngineError("VALIDATION", "Game has no rounds configured");
    }

    await tx.game.update({ where: { id: gameId }, data: { status: GameStatus.READY } });
    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "game_readied",
    });
  });
}

/** Starts round `roundNumber`. Valid from READY (round 1 only) or from
 * ROUND_COMPLETE (the next sequential round only) — see
 * docs/GAME_STATE_MACHINE.md. */
export async function startRound(
  gameId: string,
  roundNumber: number,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    assertValidTransition(game.status, GameStatus.LIVE);

    const isFirstRound = game.status === GameStatus.READY;
    const expectedRoundNumber = isFirstRound ? 1 : game.currentRoundNumber + 1;
    if (roundNumber !== expectedRoundNumber) {
      throw new GameEngineError(
        "VALIDATION",
        `Expected round ${expectedRoundNumber}, got ${roundNumber}`,
      );
    }

    const round = await tx.round.findUnique({
      where: { gameId_number: { gameId, number: roundNumber } },
    });
    if (!round) throw new GameEngineError("NOT_FOUND", `Round ${roundNumber} not found`);
    if (round.status !== RoundStatus.SCHEDULED) {
      throw new GameEngineError("CONFLICT", `Round ${roundNumber} is not SCHEDULED (idempotency guard)`);
    }

    const now = new Date();
    await tx.round.update({
      where: { id: round.id },
      data: { status: RoundStatus.ACTIVE, startedAt: now },
    });
    await tx.game.update({
      where: { id: gameId },
      data: { status: GameStatus.LIVE, currentRoundNumber: roundNumber, currentPhase: RoundPhase.ROUND },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "round_started",
      targetType: "Round",
      targetId: round.id,
      metadata: { roundNumber },
    });

    if (isFirstRound) {
      await publishEvent(tx, { gameId, type: "GAME_STARTED", payload: { gameId } });
    }
    await publishEvent(tx, {
      gameId,
      type: "ROUND_STARTED",
      payload: { roundNumber, roundName: round.name, startedAt: now.toISOString() },
    });
  });
}

export async function pauseGame(
  gameId: string,
  reason: string | undefined,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    assertValidTransition(game.status, GameStatus.PAUSED);

    await tx.game.update({
      where: { id: gameId },
      data: {
        pausedFromStatus: game.status,
        status: GameStatus.PAUSED,
        pausedAt: new Date(),
        pauseReason: reason ?? null,
      },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "game_paused",
      metadata: { reason, resumesTo: game.status },
    });

    await publishEvent(tx, { gameId, type: "GAME_PAUSED", payload: { reason: reason ?? null } });
  });
}

export async function resumeGame(gameId: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    if (game.status !== GameStatus.PAUSED || !game.pausedFromStatus) {
      throw new GameEngineError("CONFLICT", "Game is not paused");
    }
    assertValidTransition(game.status, game.pausedFromStatus);

    await tx.game.update({
      where: { id: gameId },
      data: {
        status: game.pausedFromStatus,
        pausedFromStatus: null,
        pausedAt: null,
        pauseReason: null,
      },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "game_resumed",
    });

    await publishEvent(tx, { gameId, type: "GAME_RESUMED", payload: {} });
  });
}

export async function completeRound(gameId: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    assertValidTransition(game.status, GameStatus.ROUND_COMPLETE);

    const round = await tx.round.findUnique({
      where: { gameId_number: { gameId, number: game.currentRoundNumber } },
    });
    if (!round) throw new GameEngineError("NOT_FOUND", "Current round not found");

    await tx.round.update({
      where: { id: round.id },
      data: { status: RoundStatus.COMPLETE, endedAt: new Date() },
    });
    await tx.game.update({
      where: { id: gameId },
      data: { status: GameStatus.ROUND_COMPLETE, currentPhase: null },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "round_completed",
      targetType: "Round",
      targetId: round.id,
    });

    await publishEvent(tx, {
      gameId,
      type: "ROUND_COMPLETE",
      payload: { roundNumber: round.number },
    });
  });
}

/**
 * Determines the winner using the configured win conditions and writes
 * the final GameResult. Kept deliberately simple and explicit rather
 * than a generic rule engine — see docs/GAME_ENGINE.md "Win conditions"
 * for what each configured value means.
 */
type Winner = "ENGINEERS" | "IMPOSTERS" | "NONE";

/** Shared finalization — round cleanup, result row, GAME_FINISHED event.
 * `finishGame` computes the winner from the win conditions; `declareWinner`
 * passes the host's choice straight through. */
async function finalizeGameTx(
  tx: Prisma.TransactionClient,
  gameId: string,
  winner: Winner,
  reason: string,
  opts: { declaredByHost: boolean; championParticipantId?: string | null; actorId?: string | null },
) {
  const [aliveEngineers, aliveImposters, totalTasks, completedTasks] = await Promise.all([
    tx.participant.count({ where: { gameId, status: ParticipantStatus.ALIVE, role: "ENGINEER" } }),
    tx.participant.count({ where: { gameId, status: ParticipantStatus.ALIVE, role: "IMPOSTER" } }),
    tx.participantTask.count({ where: { task: { gameId }, status: { not: "LOCKED" } } }),
    tx.participantTask.count({ where: { task: { gameId }, status: "COMPLETED" } }),
  ]);

  const topScorer = await tx.participantTask.groupBy({
    by: ["participantId"],
    where: { task: { gameId }, status: "COMPLETED" },
    _sum: { score: true },
    orderBy: { _sum: { score: "desc" } },
    take: 2,
  });

  await tx.round.updateMany({
    where: { gameId, status: { not: RoundStatus.COMPLETE } },
    data: { status: RoundStatus.COMPLETE, endedAt: new Date() },
  });

  await tx.game.update({ where: { id: gameId }, data: { status: GameStatus.FINISHED } });

  await tx.gameResult.upsert({
    where: { gameId },
    update: {
      winner,
      reason,
      declaredByHost: opts.declaredByHost,
      championParticipantId: opts.championParticipantId ?? null,
    },
    create: {
      gameId,
      winner,
      reason,
      declaredByHost: opts.declaredByHost,
      championParticipantId: opts.championParticipantId ?? null,
      topScorerParticipantId: topScorer[0]?.participantId,
      runnerUpParticipantId: topScorer[1]?.participantId,
      stats: { aliveEngineers, aliveImposters, totalTasks, completedTasks },
    },
  });

  await writeAuditLog(tx, {
    gameId,
    actorType: ActorType.ADMIN,
    actorId: opts.actorId ?? "admin",
    action: opts.declaredByHost ? "winner_declared" : "game_finished",
    metadata: { winner, reason, declaredByHost: opts.declaredByHost },
  });

  await publishEvent(tx, { gameId, type: "GAME_FINISHED", payload: { winner, reason } });
}

export async function finishGame(gameId: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId }, include: { config: true } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    assertValidTransition(game.status, GameStatus.FINISHED);

    const [aliveEngineers, aliveImposters, totalTasks, completedTasks] = await Promise.all([
      tx.participant.count({ where: { gameId, status: ParticipantStatus.ALIVE, role: "ENGINEER" } }),
      tx.participant.count({ where: { gameId, status: ParticipantStatus.ALIVE, role: "IMPOSTER" } }),
      tx.participantTask.count({ where: { task: { gameId }, status: { not: "LOCKED" } } }),
      tx.participantTask.count({ where: { task: { gameId }, status: "COMPLETED" } }),
    ]);

    let winner: Winner = "NONE";
    let reason: string;

    if (aliveImposters === 0) {
      winner = "ENGINEERS";
      reason = "All imposters were eliminated.";
    } else if (aliveImposters >= aliveEngineers) {
      winner = "IMPOSTERS";
      reason = "Imposters equal or outnumber remaining engineers.";
    } else if (totalTasks > 0 && completedTasks === totalTasks) {
      winner = "ENGINEERS";
      reason = "Engineers completed every task.";
    } else {
      winner = "NONE";
      reason = "Final round ended without a decisive condition being met.";
    }

    await finalizeGameTx(tx, gameId, winner, reason, { declaredByHost: false });
  });
}

/**
 * Host override — ends the game NOW with an outcome the host chooses,
 * from any non-finished state (skips the state-graph edge check that
 * `finishGame` enforces). Optionally spotlights one player as the winner.
 */
export async function declareWinner(
  gameId: string,
  input: { winner: Winner; reason?: string; championParticipantId?: string | null; actorId?: string | null },
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    if (game.status === GameStatus.FINISHED) {
      throw new GameEngineError("CONFLICT", "Game is already finished");
    }

    if (input.championParticipantId) {
      const champ = await tx.participant.findUnique({ where: { id: input.championParticipantId } });
      if (!champ || champ.gameId !== gameId) {
        throw new GameEngineError("NOT_FOUND", "Champion player not found in this game");
      }
    }

    const label = { ENGINEERS: "Engineers", IMPOSTERS: "Imposters", NONE: "Nobody" }[input.winner];
    const reason = input.reason?.trim() || `${label} declared the winner by the host.`;

    await finalizeGameTx(tx, gameId, input.winner, reason, {
      declaredByHost: true,
      championParticipantId: input.championParticipantId ?? null,
      actorId: input.actorId ?? "admin",
    });
  });
}

/**
 * Server-side "tick" — advances state that depends purely on elapsed
 * time (the automatic meeting rule), and does nothing otherwise. Called
 * at the top of every participant/admin/projector state read (see
 * app/api/game/*), NOT from a browser setTimeout and NOT from a
 * standalone cron. This is what makes a refresh mid-round always
 * correct: the check is a pure function of stored timestamps vs. now,
 * so any client hitting any snapshot endpoint re-derives (and, if
 * necessary, advances) the same authoritative state.
 */
export async function checkAutoAdvance(gameId: string, prisma: PrismaClient = defaultPrisma) {
  const game = await prisma.game.findUnique({ where: { id: gameId }, include: { config: true } });
  if (!game || game.status !== GameStatus.LIVE) return;

  const round = await prisma.round.findUnique({
    where: { gameId_number: { gameId, number: game.currentRoundNumber } },
  });
  if (!round || !round.startedAt) return;

  const timing = computeRoundTiming(round, game.config?.meetingAfterMinutes ?? 20);
  if (!timing.meetingIsDue) return;

  const existingMeeting = await prisma.meeting.findFirst({
    where: { roundId: round.id },
  });
  if (existingMeeting) return; // already handled (idempotency)

  await callMeeting(gameId, { type: "AUTOMATIC", reason: null }, prisma);
}
