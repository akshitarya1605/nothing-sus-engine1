import type { Prisma, PrismaClient } from "@prisma/client";
import { EliminationMethod, ParticipantStatus, RoleRevealStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { writeAuditLog, ActorType } from "../audit";
import { publishEvent } from "../events/publisher";

type TxClient = Prisma.TransactionClient;

/**
 * The core elimination logic, taking an already-open transaction client
 * so callers that need to do more in the same transaction (voting.ts's
 * revealResult also closes out the meeting) can compose it in rather
 * than nesting a second `$transaction`. Participant status, the Elimination
 * row, the audit log entry, and the PLAYER_ELIMINATED event all commit
 * together or not at all.
 */
export async function eliminateParticipantTx(
  tx: TxClient,
  gameId: string,
  input: { participantId: string; meetingId?: string; method: EliminationMethod; actorId: string | null },
) {
  const participant = await tx.participant.findUnique({ where: { id: input.participantId } });
  if (!participant || participant.gameId !== gameId) {
    throw new GameEngineError("NOT_FOUND", "Participant not found");
  }
  if (participant.status !== ParticipantStatus.ALIVE) {
    // idempotency guard — eliminating twice is a no-op conflict, not a
    // second elimination record
    throw new GameEngineError("CONFLICT", `Participant is not ALIVE (status: ${participant.status})`);
  }

  await tx.participant.update({ where: { id: participant.id }, data: { status: ParticipantStatus.ELIMINATED } });

  const elimination = await tx.elimination.create({
    data: {
      gameId,
      meetingId: input.meetingId,
      participantId: participant.id,
      method: input.method,
      roleRevealStatus: RoleRevealStatus.PENDING,
    },
  });

  await writeAuditLog(tx, {
    gameId,
    actorType: input.method === EliminationMethod.VOTE ? ActorType.SYSTEM : ActorType.ADMIN,
    actorId: input.actorId,
    action: "participant_eliminated",
    targetType: "Participant",
    targetId: participant.id,
    metadata: { method: input.method, meetingId: input.meetingId },
  });

  await publishEvent(tx, {
    gameId,
    type: "PLAYER_ELIMINATED",
    payload: { participantId: participant.id, name: participant.name, status: "ELIMINATED" },
  });

  await publishEvent(tx, {
    gameId,
    type: "ROLE_REVEAL_PENDING",
    payload: { eliminationId: elimination.id, participantId: participant.id },
  });

  return elimination;
}

/** Standalone entry point for direct admin eliminations (no meeting in
 * play) — opens its own transaction around eliminateParticipantTx. */
export async function eliminateParticipant(
  gameId: string,
  input: { participantId: string; meetingId?: string; method: EliminationMethod; actorId: string | null },
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction((tx) => eliminateParticipantTx(tx, gameId, input));
}

/** Admin-triggered role reveal — the ONLY place ROLE_REVEALED (which
 * carries the actual role, PUBLIC visibility) is published. */
export async function revealRole(
  gameId: string,
  eliminationId: string,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const elimination = await tx.elimination.findUnique({
      where: { id: eliminationId },
      include: { participant: true },
    });
    if (!elimination || elimination.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Elimination not found");
    }
    if (elimination.roleRevealStatus !== RoleRevealStatus.PENDING) {
      throw new GameEngineError("CONFLICT", "Role has already been revealed (idempotency guard)");
    }
    if (!elimination.participant.role) {
      throw new GameEngineError("VALIDATION", "Participant has no assigned role to reveal");
    }

    await tx.elimination.update({
      where: { id: eliminationId },
      data: { roleRevealStatus: RoleRevealStatus.REVEALED, revealedAt: new Date() },
    });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "role_revealed",
      targetType: "Participant",
      targetId: elimination.participantId,
    });

    await publishEvent(tx, {
      gameId,
      type: "ROLE_REVEALED",
      payload: {
        eliminationId,
        participantId: elimination.participantId,
        role: elimination.participant.role,
      },
    });
  });
}
