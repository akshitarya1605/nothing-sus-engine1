import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { writeAuditLog, ActorType } from "../audit";

export async function createGroup(gameId: string, name: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.group.findUnique({ where: { gameId_name: { gameId, name } } });
    if (existing) throw new GameEngineError("CONFLICT", "A group with this name already exists");

    const group = await tx.group.create({ data: { gameId, name } });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "group_created",
      targetType: "Group",
      targetId: group.id,
      metadata: { name },
    });

    return group;
  });
}

export async function assignParticipantToGroup(
  gameId: string,
  participantId: string,
  groupId: string | null,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.participant.findUnique({ where: { id: participantId } });
    if (!participant || participant.gameId !== gameId) {
      throw new GameEngineError("NOT_FOUND", "Participant not found");
    }
    if (groupId) {
      const group = await tx.group.findUnique({ where: { id: groupId } });
      if (!group || group.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Group not found");
    }

    await tx.participant.update({ where: { id: participantId }, data: { groupId } });

    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "participant_group_assigned",
      targetType: "Participant",
      targetId: participantId,
      metadata: { groupId },
    });
  });
}
