import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db/prisma";
import { writeAuditLog, ActorType } from "../audit";
import { publishEvent } from "../events/publisher";

export async function createAnnouncement(
  gameId: string,
  message: string,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    await writeAuditLog(tx, {
      gameId,
      actorType: ActorType.ADMIN,
      actorId: "admin",
      action: "announcement_created",
      metadata: { message },
    });
    await publishEvent(tx, { gameId, type: "ANNOUNCEMENT_CREATED", payload: { message } });
  });
}
