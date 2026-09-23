import type { PrismaClient, Vote } from "@prisma/client";
import {
  EliminationMethod,
  GameStatus,
  MeetingStatus,
  ParticipantStatus,
  RoundPhase,
  RoundStatus,
} from "@prisma/client";
import { prismaWrite as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { assertValidTransition } from "../transitions";
import { writeAuditLog, ActorType } from "../audit";
import { publishEvent } from "../events/publisher";
import { eliminateParticipantTx } from "./eliminations";

export interface VoteTally {
  counts: Map<string, number>; // targetParticipantId -> vote count (skips excluded)
  skipCount: number;
  totalVotes: number;
  /** the single participant with strictly more votes than everyone else, or
   * null if there's a tie for first place or nobody voted for anyone */
  winner: string | null;
  isTie: boolean;
}

export function tallyVotes(votes: Pick<Vote, "targetParticipantId">[]): VoteTally {
  const counts = new Map<string, number>();
  let skipCount = 0;
  for (const vote of votes) {
    if (!vote.targetParticipantId) {
      skipCount++;
      continue;
    }
    counts.set(vote.targetParticipantId, (counts.get(vote.targetParticipantId) ?? 0) + 1);
  }

  let winner: string | null = null;
  let topCount = -1;
  let isTie = false;
  for (const [participantId, count] of counts) {
    if (count > topCount) {
      topCount = count;
      winner = participantId;
      isTie = false;
    } else if (count === topCount) {
      isTie = true;
    }
  }
  if (isTie) winner = null;

  return { counts, skipCount, totalVotes: votes.length, winner, isTie };
}

/** Participants never see live totals — this only returns success/failure.
 * The @@unique([meetingId, voterId]) constraint is what actually makes
 * a duplicate vote impossible, even under a race; the pre-check below
 * is just for a clean error message in the common case. */
export async function castVote(
  gameId: string,
  voterId: string,
  input: { meetingId: string; targetParticipantId: string | null | undefined },
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    if (game.status !== GameStatus.VOTING) {
      throw new GameEngineError("CONFLICT", `Voting is not open (game status: ${game.status})`);
    }

    const voter = await tx.participant.findUnique({ where: { id: voterId } });
    if (!voter || voter.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Participant not found");
    if (voter.status !== ParticipantStatus.ALIVE) {
      throw new GameEngineError("FORBIDDEN", "Eliminated participants cannot vote");
    }

    const meeting = await tx.meeting.findUnique({ where: { id: input.meetingId } });
    if (!meeting || meeting.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Meeting not found");
    }
    if (meeting.status !== MeetingStatus.VOTING) {
      throw new GameEngineError("CONFLICT", "This meeting is not in its voting phase");
    }

    const targetId = input.targetParticipantId ?? null;
    if (targetId) {
      if (targetId === voterId) {
        throw new GameEngineError("VALIDATION", "You cannot vote for yourself");
      }
      const target = await tx.participant.findUnique({ where: { id: targetId } });
      if (!target || target.gameId !== gameId) {
        throw new GameEngineError("VALIDATION", "Invalid vote target");
      }
      if (target.status !== ParticipantStatus.ALIVE) {
        throw new GameEngineError("VALIDATION", "Cannot vote for a participant who is not alive");
      }
    }

    try {
      await tx.vote.create({
        data: { meetingId: input.meetingId, voterId, targetParticipantId: targetId },
      });
    } catch (err) {
      // unique constraint on (meetingId, voterId)
      if (isUniqueConstraintError(err)) {
        throw new GameEngineError("CONFLICT", "You have already voted in this meeting");
      }
      throw err;
    }

    const voterCount = await tx.vote.count({ where: { meetingId: input.meetingId } });
    await publishEvent(tx, { gameId, type: "VOTE_CAST", payload: { meetingId: input.meetingId, voterCount } });
  });
}

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

/** Admin "CLOSE VOTING" — locks the ballot (tally is computed later, in
 * revealResult) but does not yet announce anything about who's out. */
export async function closeVoting(
  gameId: string,
  meetingId: string,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    assertValidTransition(game.status, GameStatus.REVEAL);

    const meeting = await tx.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting || meeting.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Meeting not found");
    if (meeting.status !== MeetingStatus.VOTING) {
      throw new GameEngineError("CONFLICT", `Voting is not open (meeting status: ${meeting.status})`);
    }

    await tx.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.CLOSED, votingEndedAt: new Date() },
    });
    await tx.round.update({ where: { id: meeting.roundId }, data: { status: RoundStatus.REVEAL } });
    await tx.game.update({
      where: { id: gameId },
      data: { status: GameStatus.REVEAL, currentPhase: RoundPhase.REVEAL },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "voting_closed",
      targetType: "Meeting",
      targetId: meetingId,
    });

    await publishEvent(tx, { gameId, type: "VOTING_CLOSED", payload: { meetingId } });
  });
}

export interface RevealResultOutcome {
  outcome: "ELIMINATED" | "NO_ELIMINATION" | "TIE_NEEDS_ADMIN";
  eliminatedParticipantId?: string;
}

/**
 * Admin "REVEAL RESULT" — tallies the (already-closed) ballot and, per
 * the game's configured tie policy, either eliminates the plurality
 * target, announces no elimination, or (ADMIN_DECISION) stops and waits
 * for the admin to resolve the tie explicitly. Never silently picks a
 * winner on a tie.
 */
export async function revealResult(
  gameId: string,
  meetingId: string,
  prisma: PrismaClient = defaultPrisma,
): Promise<RevealResultOutcome> {
  const game = await prisma.game.findUnique({ where: { id: gameId }, include: { config: true } });
  if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");

  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { votes: true },
  });
  if (!meeting || meeting.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Meeting not found");
  if (meeting.status !== MeetingStatus.CLOSED) {
    throw new GameEngineError("CONFLICT", `Voting must be closed first (meeting status: ${meeting.status})`);
  }

  const tally = tallyVotes(meeting.votes);
  const tiePolicy = game.config?.voteTiePolicy ?? "NO_ELIMINATION";

  if (tally.winner) {
    const winnerId = tally.winner;
    await prisma.$transaction(async (tx) => {
      await eliminateParticipantTx(tx, gameId, {
        participantId: winnerId,
        meetingId,
        method: EliminationMethod.VOTE,
        actorId: null,
      });
      await tx.meeting.update({
        where: { id: meetingId },
        data: { status: MeetingStatus.REVEALED, endedAt: new Date() },
      });
    });
    return { outcome: "ELIMINATED", eliminatedParticipantId: winnerId };
  }

  if (tally.isTie && tiePolicy === "ADMIN_DECISION") {
    return { outcome: "TIE_NEEDS_ADMIN" };
  }

  // NO_ELIMINATION policy, or a tie under that policy, or nobody voted
  await prisma.$transaction(async (tx) => {
    await tx.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.REVEALED, endedAt: new Date() },
    });
    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "voting_result_no_elimination",
      targetType: "Meeting",
      targetId: meetingId,
      metadata: { isTie: tally.isTie },
    });
    await publishEvent(tx, {
      gameId,
      type: "ANNOUNCEMENT_CREATED",
      payload: { message: tally.isTie ? "The vote was tied — no one was eliminated." : "No majority — no one was eliminated." },
    });
  });

  return { outcome: "NO_ELIMINATION" };
}

/** Explicit admin action for the ADMIN_DECISION tie policy — the admin
 * picks either a participant to eliminate or "no elimination". This never
 * runs automatically. */
export async function resolveTie(
  gameId: string,
  meetingId: string,
  resolution: { eliminateParticipantId: string | null },
  prisma: PrismaClient = defaultPrisma,
) {
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId } });
  if (!meeting || meeting.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Meeting not found");
  if (meeting.status !== MeetingStatus.CLOSED) {
    throw new GameEngineError("CONFLICT", "Meeting is not awaiting tie resolution");
  }

  await prisma.$transaction(async (tx) => {
    if (resolution.eliminateParticipantId) {
      await eliminateParticipantTx(tx, gameId, {
        participantId: resolution.eliminateParticipantId,
        meetingId,
        method: EliminationMethod.ADMIN,
        actorId: "admin",
      });
    }

    await tx.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.REVEALED, endedAt: new Date() },
    });
    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "tie_resolved",
      targetType: "Meeting",
      targetId: meetingId,
      metadata: resolution,
    });
    if (!resolution.eliminateParticipantId) {
      await publishEvent(tx, {
        gameId,
        type: "ANNOUNCEMENT_CREATED",
        payload: { message: "The admin resolved the tie — no one was eliminated." },
      });
    }
  });
}
