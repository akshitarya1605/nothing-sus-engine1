import type { PrismaClient } from "@prisma/client";
import { GameStatus, MeetingStatus, MeetingType, ParticipantStatus, RoundStatus, RoundPhase } from "@prisma/client";
import { prismaWrite as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { assertValidTransition } from "../transitions";
import { writeAuditLog, ActorType } from "../audit";
import { publishEvent } from "../events/publisher";

export interface CallMeetingInput {
  type: MeetingType;
  reason?: string | null;
  calledById?: string;
}

/** Shared by the automatic-meeting tick (rounds.ts) and the admin
 * "call meeting" / participant "emergency meeting" entry points. */
export async function callMeeting(
  gameId: string,
  input: CallMeetingInput,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId }, include: { config: true } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    assertValidTransition(game.status, GameStatus.MEETING);

    if (input.calledById) {
      const caller = await tx.participant.findUnique({ where: { id: input.calledById } });
      if (!caller || caller.gameId !== gameId) {
        throw new GameEngineError("NOT_FOUND", "Caller participant not found");
      }
      if (caller.status !== ParticipantStatus.ALIVE) {
        throw new GameEngineError("FORBIDDEN", "Dead or eliminated players cannot call a meeting");
      }
    }

    if (input.type === MeetingType.EMERGENCY && !game.config?.allowEmergencyMeeting) {
      throw new GameEngineError("FORBIDDEN", "Emergency meetings are disabled for this game");
    }

    const round = await tx.round.findUnique({
      where: { gameId_number: { gameId, number: game.currentRoundNumber } },
    });
    if (!round) throw new GameEngineError("NOT_FOUND", "Current round not found");

    // idempotency: don't allow a second meeting to start while one is
    // already in play for this round
    const existing = await tx.meeting.findFirst({ where: { roundId: round.id } });
    if (existing) {
      throw new GameEngineError("CONFLICT", "A meeting already exists for this round");
    }

    const meeting = await tx.meeting.create({
      data: {
        gameId,
        roundId: round.id,
        status: MeetingStatus.ACTIVE,
        type: input.type,
        reason: input.reason ?? null,
        calledById: input.calledById,
        startedAt: new Date(),
      },
    });

    await tx.round.update({ where: { id: round.id }, data: { status: RoundStatus.MEETING } });
    await tx.game.update({
      where: { id: gameId },
      data: { status: GameStatus.MEETING, currentPhase: RoundPhase.MEETING },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: input.calledById ? ActorType.PARTICIPANT : ActorType.ADMIN,
      actorId: input.calledById ?? "admin",
      action: "meeting_called",
      targetType: "Meeting",
      targetId: meeting.id,
      metadata: { type: input.type, reason: input.reason },
    });

    await publishEvent(tx, {
      gameId,
      type: "MEETING_STARTED",
      payload: { meetingId: meeting.id, type: input.type, reason: input.reason ?? null },
    });

    return meeting;
  });
}

export async function startVoting(
  gameId: string,
  meetingId: string,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game) throw new GameEngineError("NOT_FOUND", "Game not found");
    assertValidTransition(game.status, GameStatus.VOTING);

    const meeting = await tx.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting || meeting.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Meeting not found");
    }
    if (meeting.status !== MeetingStatus.ACTIVE) {
      throw new GameEngineError(
        "CONFLICT",
        `Voting cannot start — meeting status is ${meeting.status} (idempotency guard)`,
      );
    }

    await tx.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.VOTING, votingStartedAt: new Date() },
    });
    await tx.round.update({ where: { id: meeting.roundId }, data: { status: RoundStatus.VOTING } });
    await tx.game.update({
      where: { id: gameId },
      data: { status: GameStatus.VOTING, currentPhase: RoundPhase.VOTING },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "voting_started",
      targetType: "Meeting",
      targetId: meetingId,
    });

    await publishEvent(tx, { gameId, type: "VOTING_STARTED", payload: { meetingId } });
  });
}
