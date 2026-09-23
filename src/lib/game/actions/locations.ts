import type { PrismaClient } from "@prisma/client";
import { LocationEventType, ParticipantStatus } from "@prisma/client";
import { prismaWrite as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { LIVE_PLAY_STATUSES } from "../permissions";
import { publishEvent } from "../events/publisher";

/**
 * The client sends the opaque QR token, never a location id — see
 * Location.qrToken in the schema. A photographed/leaked QR code only
 * ever reveals that one token, not a guessable id space, and it's not
 * treated as proof of GPS position — just a marker that this participant's
 * device scanned this room's code just now.
 */
export async function scanLocation(
  gameId: string,
  participantId: string,
  qrToken: string,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.participant.findUnique({ where: { id: participantId }, include: { game: true } });
    if (!participant || participant.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Participant not found");
    if (participant.status !== ParticipantStatus.ALIVE) {
      throw new GameEngineError("FORBIDDEN", "Eliminated participants cannot scan locations");
    }
    if (!LIVE_PLAY_STATUSES.includes(participant.game.status)) {
      throw new GameEngineError("CONFLICT", "Game is not in active play");
    }

    const location = await tx.location.findUnique({ where: { qrToken } });
    if (!location || location.gameId !== gameId || !location.active) {
      throw new GameEngineError("NOT_FOUND", "Invalid or inactive location code");
    }

    await tx.locationEvent.create({
      data: { gameId, participantId, locationId: location.id, type: LocationEventType.ENTERED },
    });
    await tx.participant.update({ where: { id: participantId }, data: { currentLocationId: location.id } });

    await publishEvent(tx, {
      gameId,
      type: "PLAYER_LOCATION_CHANGED",
      payload: { participantId, locationId: location.id, locationName: location.name },
    });

    return { locationId: location.id, locationName: location.name };
  });
}

export async function exitLocation(gameId: string, participantId: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const participant = await tx.participant.findUnique({ where: { id: participantId } });
    if (!participant || participant.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Participant not found");
    if (!participant.currentLocationId) return; // idempotent no-op

    await tx.locationEvent.create({
      data: {
        gameId,
        participantId,
        locationId: participant.currentLocationId,
        type: LocationEventType.EXITED,
      },
    });
    await tx.participant.update({ where: { id: participantId }, data: { currentLocationId: null } });
  });
}
