import type { Prisma, PrismaClient } from "@prisma/client";
import { EventVisibility, MeetingStatus, ParticipantStatus, RoleRevealStatus } from "@prisma/client";
import { prismaInternal } from "../db/prisma";
import { GameEngineError } from "./errors";
import { computeGlobalTaskProgress, computeParticipantTaskProgress } from "./scoring";
import { computeRoundTiming } from "./timers";

/**
 * These read functions accept either the raw client or an active
 * transaction client. Milestone 1 introduced `withAudienceContext`
 * (src/lib/db/rlsContext.ts), which runs them inside a transaction whose
 * connection has been downgraded to the `authenticated` role so the RLS
 * backstop is exercised — the signature widening is what lets that
 * transaction client be threaded straight through.
 */
type Queryable = PrismaClient | Prisma.TransactionClient;

/**
 * Run several reads strictly in sequence. These functions can be handed a
 * transaction client (state.ts under `withAudienceContext`), where
 * concurrent queries on the single connection are unsafe and
 * `@prisma/adapter-pg` warns. At this app's scale the lost parallelism is
 * a few ms on the admin snapshot — not worth branching on client type.
 */
async function gather<T extends readonly unknown[]>(
  _db: Queryable,
  thunks: { readonly [K in keyof T]: () => Promise<T[K]> },
): Promise<T> {
  const out: unknown[] = [];
  for (const t of thunks) out.push(await t());
  return out as unknown as T;
}

/**
 * The three data contracts from the brief. Each is the ONLY way its
 * respective client is allowed to read game state — nobody queries
 * `prisma.participant.findMany()` directly from a route handler. If a field
 * isn't returned here, that audience never sees it.
 */

// ---------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------

export interface ParticipantGameState {
  identity: { id: string; name: string; code: string; playerNumber: number | null; batchNumber: number };
  ownRole: "ENGINEER" | "IMPOSTER" | null;
  ownStatus: string;
  weaponUnlocked: boolean;
  lastKillAt: string | null;
  killCooldownSeconds: number;
  weaponLocation: string | null;
  weaponClue: string | null;
  game: { status: string; currentRoundNumber: number; currentPhase: string | null };
  round: {
    number: number;
    name: string;
    msRemaining: number | null;
  } | null;
  meetingStatus: string | null;
  ownTasks: Array<{
    taskId: string;
    title: string;
    difficulty: string;
    points: number;
    status: string;
  }>;
  ownProgress: { completed: number; inPlay: number; percentage: number };
  ownLocation: { id: string; name: string } | null;
  notifications: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
  /** Present only while a meeting is active — the list of players to vote
   * for, tapped not typed. Names + alive/eliminated only; never role/code. */
  meetingRoster: Array<{ id: string; name: string; playerNumber: number | null; status: string }> | null;
}

export async function getParticipantGameState(
  prisma: Queryable,
  participantId: string,
): Promise<ParticipantGameState> {
  const participant = await prisma.participant.findUnique({
    where: { id: participantId },
    include: {
      game: { include: { config: true } },
      currentLocation: true,
      participantTasks: { include: { task: true } },
    },
  });
  if (!participant) throw new GameEngineError("NOT_FOUND", "Participant not found");

  // The round to show is the game's current round — `Participant.currentRoundNumber`
  // is never populated by the engine (only the seed touches it).
  const currentRoundNumber = participant.game.currentRoundNumber || null;
  const round = currentRoundNumber
    ? await prisma.round.findUnique({
        where: { gameId_number: { gameId: participant.gameId, number: currentRoundNumber } },
      })
    : null;

  const timing = round
    ? computeRoundTiming(round, participant.game.config?.meetingAfterMinutes ?? 20)
    : null;

  const activeMeeting = await prisma.meeting.findFirst({
    where: { gameId: participant.gameId, status: { not: MeetingStatus.REVEALED } },
    orderBy: { createdAt: "desc" },
  });

  const progress = await computeParticipantTaskProgress(prisma, participantId);

  // Voting roster — only while a meeting is live. Deliberately read through
  // `prismaInternal` (RLS-bypassing) rather than widening the row policy so
  // a participant can't `findMany` co-players elsewhere. Selects id/name/
  // status only — role and code never leave this function.
  const meetingRoster =
    activeMeeting != null
      ? (
          await prismaInternal.participant.findMany({
            where: { gameId: participant.gameId },
            select: { id: true, name: true, playerNumber: true, status: true },
            orderBy: { playerNumber: "asc" },
          })
        ).map((p) => ({ id: p.id, name: p.name, playerNumber: p.playerNumber, status: p.status }))
      : null;

  const notifications = await prisma.gameEvent.findMany({
    where: {
      gameId: participant.gameId,
      OR: [
        { visibility: EventVisibility.PUBLIC },
        { visibility: EventVisibility.PARTICIPANT, targetParticipantId: participantId },
      ],
    },
    orderBy: { sequenceNumber: "desc" },
    take: 25,
  });

  return {
    identity: {
      id: participant.id,
      name: participant.name,
      code: participant.code,
      playerNumber: participant.playerNumber,
      batchNumber: participant.batchNumber,
    },
    ownRole: participant.role,
    ownStatus: participant.status,
    weaponUnlocked: participant.weaponUnlocked,
    lastKillAt: participant.lastKillAt?.toISOString() ?? null,
    killCooldownSeconds: participant.game.config?.killCooldownSeconds ?? 60,
    weaponLocation: participant.game.config?.weaponLocation ?? null,
    weaponClue: participant.game.config?.weaponClue ?? null,
    game: {
      status: participant.game.status,
      currentRoundNumber: participant.game.currentRoundNumber,
      currentPhase: participant.game.currentPhase,
    },
    round: round
      ? { number: round.number, name: round.name, msRemaining: timing?.roundMsRemaining ?? null }
      : null,
    meetingStatus: activeMeeting?.status ?? null,
    ownTasks: participant.participantTasks.map((pt) => ({
      taskId: pt.taskId,
      title: pt.task.title,
      difficulty: pt.task.difficulty,
      points: pt.task.points,
      status: pt.status,
    })),
    ownProgress: progress,
    ownLocation: participant.currentLocation
      ? { id: participant.currentLocation.id, name: participant.currentLocation.name }
      : null,
    notifications: notifications.map((e) => ({
      id: e.id,
      type: e.type,
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
    })),
    meetingRoster,
  };
}

// ---------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------

export interface AdminGameState {
  game: {
    id: string;
    roomCode: string | null;
    maxPlayers: number;
    presetId: string | null;
    status: string;
    currentRoundNumber: number;
    currentPhase: string | null;
    rolesLocked: boolean;
    pausedFromStatus: string | null;
    pauseReason: string | null;
    adminSecret: string;
    spectatorSecret: string;
  };
  config: unknown;
  rounds: Array<{ id: string; number: number; name: string; status: string; startedAt: string | null }>;
  groups: Array<{
    id: string;
    name: string;
    participantCount: number;
    taskProgress: { completed: number; inPlay: number; percentage: number };
  }>;
  participants: Array<{
    id: string;
    name: string;
    code: string;
    playerNumber: number | null;
    collegeRegId?: string | null;
    fullName?: string | null;
    isApproved?: boolean;
    batchNumber: number;
    weaponUnlocked: boolean;
    lastKillAt: string | null;
    role: string | null;
    status: string;
    groupId: string | null;
    groupName: string | null;
    currentRoundNumber: number | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    roundNumber: number;
    groupId: string | null;
    groupName: string | null;
    difficulty: string;
    points: number;
    status: string;
    completedCount: number;
    attemptCount: number;
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
  /** Eliminations still waiting on "Role reveal" (the host's projector
   * beat). The elimination's own id is never exposed via recentAuditLog
   * (that log's targetId for "participant_eliminated" is the *participant*
   * id) — this is the one place a host can get the real id the reveal
   * endpoint needs, so the UI never has to ask them to paste one in. */
  pendingRoleReveals: Array<{ eliminationId: string; participantId: string; participantName: string }>;
}

export async function getAdminGameState(
  prisma: Queryable,
  gameId: string,
): Promise<AdminGameState> {
  const game = await prisma.game.findUnique({ where: { id: gameId }, include: { config: true } });
  if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");

  const [rounds, groups, participants, tasks, taskProgress, activeMeeting, auditLog, pendingReveals] = await gather(
    prisma,
    [
    () => prisma.round.findMany({ where: { gameId }, orderBy: { number: "asc" } }),
    () => prisma.group.findMany({ where: { gameId }, orderBy: { name: "asc" } }),
    () => prisma.participant.findMany({ where: { gameId }, orderBy: { name: "asc" }, include: { group: true } }),
    () =>
      prisma.task.findMany({
        where: { gameId },
        orderBy: { createdAt: "asc" },
        include: {
          round: true,
          group: true,
          participantTasks: { select: { status: true } },
          taskAttempts: { select: { id: true } },
        },
      }),
    () => computeGlobalTaskProgress(prisma, gameId),
    () =>
      prisma.meeting.findFirst({
        where: { gameId, status: { not: MeetingStatus.REVEALED } },
        orderBy: { createdAt: "desc" },
        include: { votes: true },
      }),
    () => prisma.auditLog.findMany({ where: { gameId }, orderBy: { createdAt: "desc" }, take: 30 }),
    () =>
      prisma.elimination.findMany({
        where: { gameId, roleRevealStatus: RoleRevealStatus.PENDING },
        include: { participant: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ],
  );

  const aliveVoterCount = activeMeeting
    ? await prisma.participant.count({ where: { gameId, status: ParticipantStatus.ALIVE } })
    : 0;

  const groupProgress: AdminGameState["groups"] = [];
  for (const g of groups) {
    const [completed, inPlay, participantCount] = await gather(prisma, [
      () =>
        prisma.participantTask.count({
          where: { status: "COMPLETED", task: { gameId }, participant: { groupId: g.id } },
        }),
      () =>
        prisma.participantTask.count({
          where: {
            status: { in: ["AVAILABLE", "IN_PROGRESS", "COMPLETED"] },
            task: { gameId },
            participant: { groupId: g.id },
          },
        }),
      () => prisma.participant.count({ where: { gameId, groupId: g.id } }),
    ]);
    groupProgress.push({
      id: g.id,
      name: g.name,
      participantCount,
      taskProgress: {
        completed,
        inPlay,
        percentage: inPlay === 0 ? 0 : Math.round((completed / inPlay) * 1000) / 10,
      },
    });
  }

  return {
    game: {
      id: game.id,
      roomCode: game.roomCode,
      maxPlayers: game.maxPlayers,
      presetId: game.presetId,
      status: game.status,
      currentRoundNumber: game.currentRoundNumber,
      currentPhase: game.currentPhase,
      rolesLocked: game.rolesLocked,
      pausedFromStatus: game.pausedFromStatus,
      pauseReason: game.pauseReason,
      adminSecret: game.adminSecret,
      spectatorSecret: game.spectatorSecret,
    },
    config: game.config,
    rounds: rounds.map((r) => ({
      id: r.id,
      number: r.number,
      name: r.name,
      status: r.status,
      startedAt: r.startedAt?.toISOString() ?? null,
    })),
    groups: groupProgress,
    participants: participants.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      playerNumber: p.playerNumber,
      collegeRegId: p.collegeRegId ?? null,
      fullName: p.fullName ?? null,
      isApproved: p.isApproved,
      batchNumber: p.batchNumber,
      weaponUnlocked: p.weaponUnlocked,
      lastKillAt: p.lastKillAt?.toISOString() ?? null,
      role: p.role,
      status: p.status,
      groupId: p.groupId,
      groupName: p.group?.name ?? null,
      currentRoundNumber: p.currentRoundNumber,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      roundNumber: t.round.number,
      groupId: t.groupId,
      groupName: t.group?.name ?? null,
      difficulty: t.difficulty,
      points: t.points,
      status: t.status,
      completedCount: t.participantTasks.filter((pt) => pt.status === "COMPLETED").length,
      attemptCount: t.taskAttempts.length,
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
    pendingRoleReveals: pendingReveals.map((e) => ({
      eliminationId: e.id,
      participantId: e.participantId,
      participantName: e.participant.name,
    })),
  };
}

// ---------------------------------------------------------------------
// Projector
// ---------------------------------------------------------------------

export interface ProjectorState {
  status: string;
  roomCode: string | null;
  maxPlayers: number;
  round: { number: number; name: string; msRemaining: number | null } | null;
  phase: string | null;
  globalProgress: { completed: number; inPlay: number; percentage: number };
  aliveCount: number;
  eliminatedCount: number;
  playerRoster: Array<{ id: string; name: string; playerNumber: number | null; status: string }>;
  meetingState: { status: string; type: string } | null;
  votingState: { isOpen: boolean } | null;
  recentPublicEvents: Array<{ id: string; type: string; payload: unknown; createdAt: string }>;
  /** The most recent role reveal, for the projector's reveal animation.
   * Derived from the already-public ROLE_REVEALED event + a name lookup. */
  eliminationReveal: { participantId: string; name: string; role: "ENGINEER" | "IMPOSTER" } | null;
  finalResult:
    | { winner: string; reason: string; stats: unknown; declaredByHost: boolean; championName: string | null }
    | null;
}

/** The projector never touches Participant, Vote, or role tables directly —
 * only aggregate counts (by status, never by role) and the PUBLIC event
 * feed. Reveal-gated info (an eliminated participant's role) only appears
 * here once a ROLE_REVEALED event exists in that feed. */
export async function getProjectorState(
  prisma: Queryable,
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

  const [globalProgress, aliveCount, eliminatedCount, playerRoster, activeMeeting, events, result] = await gather(prisma, [
    () => computeGlobalTaskProgress(prisma, gameId),
    () => prisma.participant.count({ where: { gameId, status: ParticipantStatus.ALIVE } }),
    () => prisma.participant.count({ where: { gameId, status: ParticipantStatus.ELIMINATED } }),
    () =>
      prismaInternal.participant.findMany({
        where: { gameId },
        select: { id: true, name: true, playerNumber: true, status: true },
        orderBy: { playerNumber: "asc" },
      }),
    () =>
      prisma.meeting.findFirst({
        where: { gameId, status: { not: MeetingStatus.REVEALED } },
        orderBy: { createdAt: "desc" },
      }),
    () =>
      prisma.gameEvent.findMany({
        where: { gameId, visibility: EventVisibility.PUBLIC },
        orderBy: { sequenceNumber: "desc" },
        take: 20,
      }),
    () => prisma.gameResult.findUnique({ where: { gameId } }),
  ]);

  // Latest role reveal (event is already PUBLIC; the name is not on the
  // payload, so look it up — projector never gets a roster otherwise).
  const revealEvt = events.find((e) => e.type === "ROLE_REVEALED");
  const revealPayload = (revealEvt?.payload ?? null) as
    | { participantId?: string; role?: "ENGINEER" | "IMPOSTER" }
    | null;
  const eliminationReveal =
    revealPayload?.participantId && revealPayload.role
      ? await prismaInternal.participant
          .findUnique({
            where: { id: revealPayload.participantId },
            select: { id: true, name: true },
          })
          .then((p) =>
            p ? { participantId: p.id, name: p.name, role: revealPayload.role! } : null,
          )
      : null;

  return {
    status: game.status,
    roomCode: game.roomCode,
    maxPlayers: game.maxPlayers,
    round: round
      ? { number: round.number, name: round.name, msRemaining: timing?.roundMsRemaining ?? null }
      : null,
    phase: game.currentPhase,
    globalProgress,
    aliveCount,
    eliminatedCount,
    playerRoster: playerRoster.map((p) => ({ id: p.id, name: p.name, playerNumber: p.playerNumber, status: p.status })),
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
    eliminationReveal,
    finalResult: result
      ? {
          winner: result.winner,
          reason: result.reason,
          stats: result.stats,
          declaredByHost: result.declaredByHost,
          championName: result.championParticipantId
            ? ((await prismaInternal.participant.findUnique({
                where: { id: result.championParticipantId },
                select: { name: true },
              }))?.name ?? null)
            : null,
        }
      : null,
  };
}
