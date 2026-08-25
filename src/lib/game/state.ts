import type { PrismaClient } from "@prisma/client";
import { EventVisibility, MeetingStatus, PlayerStatus } from "@prisma/client";
import { GameEngineError } from "./errors";
import { computeGlobalTaskProgress, computePlayerTaskProgress } from "./scoring";
import { computeRoundTiming } from "./timers";

/**
 * The three data contracts from the brief. Each is the ONLY way its
 * respective client is allowed to read game state — nobody queries
 * `prisma.player.findMany()` directly from a route handler. If a field
 * isn't returned here, that audience never sees it.
 */

// ---------------------------------------------------------------------
// Player
// ---------------------------------------------------------------------

export interface PlayerGameState {
  identity: { id: string; displayName: string; playerCode: string };
  ownRole: "ENGINEER" | "IMPOSTER" | null;
  ownStatus: string;
  game: { status: string; currentRoundNumber: number; currentPhase: string | null };
  round: {
    number: number;
    name: string;
    msRemaining: number | null;
  } | null;
  meetingStatus: string | null;
  ownTasks: Array<{
    taskId: string;
    name: string;
    difficulty: string;
    points: number;
    status: string;
  }>;
  ownProgress: { completed: number; inPlay: number; percentage: number };
  ownLocation: { id: string; name: string } | null;
  notifications: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
}

export async function getPlayerGameState(
  prisma: PrismaClient,
  playerId: string,
): Promise<PlayerGameState> {
  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: {
      game: { include: { config: true } },
      currentLocation: true,
      playerTasks: { include: { task: true } },
    },
  });
  if (!player) throw new GameEngineError("NOT_FOUND", "Player not found");

  const round = player.currentRoundNumber
    ? await prisma.round.findUnique({
        where: { gameId_number: { gameId: player.gameId, number: player.currentRoundNumber } },
      })
    : null;

  const timing = round
    ? computeRoundTiming(round, player.game.config?.meetingAfterMinutes ?? 20)
    : null;

  const activeMeeting = round
    ? await prisma.meeting.findFirst({
        where: { roundId: round.id, status: { not: MeetingStatus.REVEALED } },
        orderBy: { createdAt: "desc" },
      })
    : null;

  const progress = await computePlayerTaskProgress(prisma, playerId);

  const notifications = await prisma.gameEvent.findMany({
    where: {
      gameId: player.gameId,
      OR: [
        { visibility: EventVisibility.PUBLIC },
        { visibility: EventVisibility.PLAYER, targetPlayerId: playerId },
      ],
    },
    orderBy: { sequenceNumber: "desc" },
    take: 25,
  });

  return {
    identity: { id: player.id, displayName: player.displayName, playerCode: player.playerCode },
    ownRole: player.role,
    ownStatus: player.status,
    game: {
      status: player.game.status,
      currentRoundNumber: player.game.currentRoundNumber,
      currentPhase: player.game.currentPhase,
    },
    round: round
      ? { number: round.number, name: round.name, msRemaining: timing?.roundMsRemaining ?? null }
      : null,
    meetingStatus: activeMeeting?.status ?? null,
    ownTasks: player.playerTasks.map((pt) => ({
      taskId: pt.taskId,
      name: pt.task.name,
      difficulty: pt.task.difficulty,
      points: pt.task.points,
      status: pt.status,
    })),
    ownProgress: progress,
    ownLocation: player.currentLocation
      ? { id: player.currentLocation.id, name: player.currentLocation.name }
      : null,
    notifications: notifications.map((e) => ({
      id: e.id,
      type: e.type,
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------

export interface AdminGameState {
  game: {
    id: string;
    status: string;
    currentRoundNumber: number;
    currentPhase: string | null;
    rolesLocked: boolean;
    pausedFromStatus: string | null;
    pauseReason: string | null;
  };
  config: unknown;
  rounds: Array<{ number: number; name: string; status: string; startedAt: string | null }>;
  players: Array<{
    id: string;
    displayName: string;
    playerCode: string;
    role: string | null;
    status: string;
    currentRoundNumber: number | null;
  }>;
  taskProgress: { completed: number; inPlay: number; percentage: number };
  activeMeeting: {
    id: string;
    status: string;
    type: string;
    voteCount: number;
    aliveVoterCount: number;
  } | null;
  recentAuditLog: Array<{
    id: string;
    action: string;
    actorType: string;
    actorId: string | null;
    createdAt: string;
  }>;
}

export async function getAdminGameState(
  prisma: PrismaClient,
  gameId: string,
): Promise<AdminGameState> {
  const game = await prisma.game.findUnique({ where: { id: gameId }, include: { config: true } });
  if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");

  const [rounds, players, taskProgress, activeMeeting, auditLog] = await Promise.all([
    prisma.round.findMany({ where: { gameId }, orderBy: { number: "asc" } }),
    prisma.player.findMany({ where: { gameId }, orderBy: { displayName: "asc" } }),
    computeGlobalTaskProgress(prisma, gameId),
    prisma.meeting.findFirst({
      where: { gameId, status: { not: MeetingStatus.REVEALED } },
      orderBy: { createdAt: "desc" },
      include: { votes: true },
    }),
    prisma.auditLog.findMany({ where: { gameId }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  const aliveVoterCount = activeMeeting
    ? await prisma.player.count({ where: { gameId, status: PlayerStatus.ALIVE } })
    : 0;

  return {
    game: {
      id: game.id,
      status: game.status,
      currentRoundNumber: game.currentRoundNumber,
      currentPhase: game.currentPhase,
      rolesLocked: game.rolesLocked,
      pausedFromStatus: game.pausedFromStatus,
      pauseReason: game.pauseReason,
    },
    config: game.config,
    rounds: rounds.map((r) => ({
      number: r.number,
      name: r.name,
      status: r.status,
      startedAt: r.startedAt?.toISOString() ?? null,
    })),
    players: players.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      playerCode: p.playerCode,
      role: p.role,
      status: p.status,
      currentRoundNumber: p.currentRoundNumber,
    })),
    taskProgress,
    activeMeeting: activeMeeting
      ? {
          id: activeMeeting.id,
          status: activeMeeting.status,
          type: activeMeeting.type,
          voteCount: activeMeeting.votes.length,
          aliveVoterCount,
        }
      : null,
    recentAuditLog: auditLog.map((a) => ({
      id: a.id,
      action: a.action,
      actorType: a.actorType,
      actorId: a.actorId,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

// ---------------------------------------------------------------------
// Projector
// ---------------------------------------------------------------------

export interface ProjectorState {
  round: { number: number; name: string; msRemaining: number | null } | null;
  phase: string | null;
  globalProgress: { completed: number; inPlay: number; percentage: number };
  aliveCount: number;
  eliminatedCount: number;
  meetingState: { status: string; type: string } | null;
  votingState: { isOpen: boolean } | null;
  recentPublicEvents: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
  finalResult: { winner: string; reason: string; stats: unknown } | null;
}

/** The projector never touches Player, Vote, or role tables directly —
 * only aggregate counts (by status, never by role) and the PUBLIC event
 * feed. Reveal-gated info (an eliminated player's role) only appears
 * here once a ROLE_REVEALED event exists in that feed. */
export async function getProjectorState(
  prisma: PrismaClient,
  gameId: string,
): Promise<ProjectorState> {
  const game = await prisma.game.findUnique({ where: { id: gameId }, include: { config: true } });
  if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");

  const round = game.currentRoundNumber
    ? await prisma.round.findUnique({
        where: { gameId_number: { gameId, number: game.currentRoundNumber } },
      })
    : null;

  const timing = round
    ? computeRoundTiming(round, game.config?.meetingAfterMinutes ?? 20)
    : null;

  const [globalProgress, aliveCount, eliminatedCount, activeMeeting, events, result] =
    await Promise.all([
      computeGlobalTaskProgress(prisma, gameId),
      prisma.player.count({ where: { gameId, status: PlayerStatus.ALIVE } }),
      prisma.player.count({ where: { gameId, status: PlayerStatus.ELIMINATED } }),
      prisma.meeting.findFirst({
        where: { gameId, status: { not: MeetingStatus.REVEALED } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.gameEvent.findMany({
        where: { gameId, visibility: EventVisibility.PUBLIC },
        orderBy: { sequenceNumber: "desc" },
        take: 20,
      }),
      prisma.gameResult.findUnique({ where: { gameId } }),
    ]);

  return {
    round: round
      ? { number: round.number, name: round.name, msRemaining: timing?.roundMsRemaining ?? null }
      : null,
    phase: game.currentPhase,
    globalProgress,
    aliveCount,
    eliminatedCount,
    meetingState: activeMeeting ? { status: activeMeeting.status, type: activeMeeting.type } : null,
    votingState: activeMeeting
      ? { isOpen: activeMeeting.status === MeetingStatus.VOTING }
      : null,
    recentPublicEvents: events.map((e) => ({
      id: e.id,
      type: e.type,
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
    })),
    finalResult: result
      ? { winner: result.winner, reason: result.reason, stats: result.stats }
      : null,
  };
}
