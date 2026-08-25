import type { PrismaClient } from "@prisma/client";
import { LocationEventType, PlayerStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db/prisma";
import { GameEngineError } from "../errors";
import { LIVE_PLAY_STATUSES } from "../permissions";
import { publishEvent } from "../events/publisher";

/**
 * The client sends the opaque QR token, never a location id — see
 * Location.qrToken in the schema. A photographed/leaked QR code only
 * ever reveals that one token, not a guessable id space, and it's not
 * treated as proof of GPS position — just a marker that this player's
 * device scanned this room's code just now.
 */
export async function scanLocation(
  gameId: string,
  playerId: string,
  qrToken: string,
  prisma: PrismaClient = defaultPrisma,
) {
  return prisma.$transaction(async (tx) => {
    const player = await tx.player.findUnique({ where: { id: playerId }, include: { game: true } });
    if (!player || player.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Player not found");
    if (player.status !== PlayerStatus.ALIVE) {
      throw new GameEngineError("FORBIDDEN", "Eliminated players cannot scan locations");
    }
    if (!LIVE_PLAY_STATUSES.includes(player.game.status)) {
      throw new GameEngineError("CONFLICT", "Game is not in active play");
    }

    const location = await tx.location.findUnique({ where: { qrToken } });
    if (!location || location.gameId !== gameId || !location.active) {
      throw new GameEngineError("NOT_FOUND", "Invalid or inactive location code");
    }

    await tx.locationEvent.create({
      data: { gameId, playerId, locationId: location.id, type: LocationEventType.ENTERED },
    });
    await tx.player.update({ where: { id: playerId }, data: { currentLocationId: location.id } });

    await publishEvent(tx, {
      gameId,
      type: "PLAYER_LOCATION_CHANGED",
      payload: { playerId, locationId: location.id, locationName: location.name },
    });

    return { locationId: location.id, locationName: location.name };
  });
}

export async function exitLocation(gameId: string, playerId: string, prisma: PrismaClient = defaultPrisma) {
  return prisma.$transaction(async (tx) => {
    const player = await tx.player.findUnique({ where: { id: playerId } });
    if (!player || player.gameId !== gameId) throw new GameEngineError("NOT_FOUND", "Player not found");
    if (!player.currentLocationId) return; // idempotent no-op

    await tx.locationEvent.create({
      data: {
        gameId,
        playerId,
        locationId: player.currentLocationId,
        type: LocationEventType.EXITED,
      },
    });
    await tx.player.update({ where: { id: playerId }, data: { currentLocationId: null } });
  });
}
